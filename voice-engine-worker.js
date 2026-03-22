const TOKEN_RE = /[^a-z0-9']+/g;
const MAX_WINDOW_TOKENS = 36;
const VARIANT_MAP = {
  svaha: 'swaha',
  swaaha: 'swaha',
  namaha: 'namah',
  shivay: 'shivaya',
  shree: 'sri',
  krisna: 'krishna',
  krushna: 'krishna',
  raam: 'rama',
  ram: 'rama',
  aum: 'om'
};

const sessions = new Map();

function normalizeToken(value) {
  const token = String(value || '').toLowerCase().replace(TOKEN_RE, ' ').trim();
  if (!token) return '';
  const compact = token.replace(/\s+/g, '');
  return VARIANT_MAP[compact] || compact;
}

function normalizeTranscript(transcript) {
  return String(transcript || '')
    .toLowerCase()
    .replace(TOKEN_RE, ' ')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean)
    .slice(-MAX_WINDOW_TOKENS);
}

function buildTriggerSet(triggers, sensitivity) {
  const triggerSet = new Set();
  triggers.forEach((trigger) => {
    const normalized = normalizeToken(trigger);
    if (!normalized) return;
    triggerSet.add(normalized);
    if (normalized === 'swaha') triggerSet.add('svaha');
    if (normalized === 'om') triggerSet.add('aum');
    if (normalized === 'rama') triggerSet.add('ram');
    if (Number(sensitivity) <= 0.55) {
      triggerSet.add(normalized.replace(/a$/, ''));
      triggerSet.add(normalized.replace(/h$/, ''));
    }
  });
  return triggerSet;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[b.length];
}

function tokenMatches(token, triggerSet, sensitivity) {
  if (triggerSet.has(token)) return true;
  const triggerList = [...triggerSet].filter((trigger) => trigger.length > 2);
  const threshold = Number(sensitivity) <= 0.45 ? 0 : Number(sensitivity) <= 0.7 ? 1 : 2;
  if (!threshold) return false;
  return triggerList.some((trigger) => Math.abs(trigger.length - token.length) <= threshold && levenshtein(token, trigger) <= threshold);
}

function overlap(previous, current) {
  const maxOverlap = Math.min(previous.length, current.length);
  for (let size = maxOverlap; size >= 0; size -= 1) {
    let match = true;
    for (let idx = 0; idx < size; idx += 1) {
      if (previous[previous.length - size + idx] !== current[idx]) {
        match = false;
        break;
      }
    }
    if (match) return size;
  }
  return 0;
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { recentTokens: [] });
  }
  return sessions.get(sessionId);
}

self.onmessage = (event) => {
  const { type, payload } = event.data || {};

  if (type === 'reset-session') {
    sessions.set(payload.sessionId, { recentTokens: [] });
    self.postMessage({ type: 'session-reset', payload: { sessionId: payload.sessionId } });
    return;
  }

  if (type !== 'process-transcript') return;

  const { sessionId, transcript, triggers, sensitivity } = payload;
  const session = getSession(sessionId);
  const normalizedTokens = normalizeTranscript(transcript);
  const triggerSet = buildTriggerSet(triggers || [], sensitivity);
  const overlapped = overlap(session.recentTokens, normalizedTokens);
  const freshTokens = normalizedTokens.slice(overlapped);
  const matchedTokens = freshTokens.filter((token) => tokenMatches(token, triggerSet, sensitivity));
  session.recentTokens = session.recentTokens.concat(freshTokens).slice(-MAX_WINDOW_TOKENS);

  self.postMessage({
    type: 'transcript-processed',
    payload: {
      sessionId,
      increments: matchedTokens.length,
      matchedTokens,
      normalizedTranscript: normalizedTokens.join(' ')
    }
  });
};
