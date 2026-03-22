document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SETTINGS = {
    darkMode: true,
    malaSize: 108,
    sensitivity: 0.7,
    lang: 'en-IN',
    vibration: true,
    sound: true
  };

  const DEFAULT_MANTRAS = [
    { id: '1', name: 'Gayatri Mantra', text: 'Om Bhur Bhuva Swaha...', deity: 'Savitr', category: 'vedic', lang: 'Sanskrit', target: 108, triggers: ['om', 'swaha', 'svaha', 'bhur'] },
    { id: '2', name: 'Shiva Panchakshara', text: 'Om Namah Shivaya', deity: 'Shiva', category: 'shaiva', lang: 'Sanskrit', target: 108, triggers: ['om', 'namah', 'shivaya', 'shiva'] },
    { id: '3', name: 'Maha Mrityunjaya', text: 'Om Tryambakam Yajamahe...', deity: 'Shiva', category: 'shaiva', lang: 'Sanskrit', target: 108, triggers: ['om', 'tryambakam', 'yajamahe', 'swaha'] },
    { id: '4', name: 'Hare Krishna', text: 'Hare Krishna Hare Krishna...', deity: 'Krishna', category: 'vaishnava', lang: 'Sanskrit', target: 108, triggers: ['hare', 'krishna', 'rama'] },
  ];

  let settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem('mantraz_settings')) || {}) };
  let mantras = (JSON.parse(localStorage.getItem('mantraz_mantras')) || DEFAULT_MANTRAS).map((mantra) => ({
    ...mantra,
    category: mantra.category || inferCategory(mantra),
    triggers: Array.isArray(mantra.triggers) ? mantra.triggers : []
  }));
  let history = JSON.parse(localStorage.getItem('mantraz_history')) || [];
  let currentMantra = mantras.find((mantra) => mantra.id === localStorage.getItem('mantraz_last_mantra')) || mantras[0];

  let count = 0;
  let malas = 0;
  let sessionStartTime = null;
  let sessionTimer = null;
  let sessionDuration = 0;
  let libraryFilter = 'all';
  let searchTerm = '';
  let historyFilter = 'all';
  let toastTimer = null;

  let recognition = null;
  let isListening = false;
  let shouldBeListening = false;
  let speechSupported = false;
  let voiceSessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let latestProcessedTranscript = '';
  const transcriptIdSeen = new Set();

  const htmlEl = document.documentElement;
  const screens = document.querySelectorAll('.screen');
  const navBtns = document.querySelectorAll('.nav-btn');
  const splashScreen = document.getElementById('screen-splash');
  const activeMantraName = document.getElementById('active-mantra-name');
  const activeMantraLang = document.getElementById('active-mantra-language');
  const mantraTargetBadge = document.getElementById('mantra-target-badge');
  const countDisplay = document.getElementById('count-display');
  const countLabel = document.getElementById('count-label');
  const malaDisplay = document.getElementById('mala-display');
  const ringProgress = document.getElementById('ring-progress');
  const ringContainer = document.querySelector('.counter-center');
  const statMalas = document.getElementById('stat-malas');
  const statTotal = document.getElementById('stat-total');
  const statDuration = document.getElementById('stat-duration');
  const btnMic = document.getElementById('btn-mic');
  const micIconOn = document.getElementById('mic-icon-on');
  const micIconOff = document.getElementById('mic-icon-off');
  const voiceStatus = document.getElementById('voice-status');
  const voiceLabel = document.getElementById('voice-label');
  const transcriptPreview = document.getElementById('transcript-preview');
  const btnEditTriggers = document.getElementById('btn-edit-triggers');
  const activeMantraTriggers = document.getElementById('active-mantra-triggers');
  const modalEditTriggers = document.getElementById('modal-edit-triggers');
  const inputEditTriggers = document.getElementById('input-edit-triggers');
  const formEditTriggers = document.getElementById('form-edit-triggers');
  const btnCancelTriggers = document.getElementById('btn-cancel-triggers');
  const btnReset = document.getElementById('btn-reset');
  const btnComplete = document.getElementById('btn-complete');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const iconSun = document.getElementById('icon-sun');
  const iconMoon = document.getElementById('icon-moon');
  const btnSelectMantra = document.getElementById('btn-select-mantra');
  const toggleDarkMode = document.getElementById('setting-dark-mode');
  const selectMalaSize = document.getElementById('setting-mala-size');
  const sliderSensitivity = document.getElementById('setting-sensitivity');
  const labelSensitivity = document.getElementById('sensitivity-value');
  const selectLang = document.getElementById('setting-lang');
  const toggleVibration = document.getElementById('setting-vibration');
  const toggleSound = document.getElementById('setting-sound');
  const modalSelect = document.getElementById('modal-select-mantra');
  const modalAdd = document.getElementById('modal-add-mantra');
  const modalComplete = document.getElementById('modal-session-complete');
  const modalMantraList = document.getElementById('modal-mantra-list');
  const mantraListEl = document.getElementById('mantra-list');
  const mantraSearch = document.getElementById('mantra-search');
  const filterChips = document.querySelectorAll('.filter-chip');
  const sessionListEl = document.getElementById('session-list');
  const historyFilterSelect = document.getElementById('history-filter-mantra');
  const weeklyChart = document.getElementById('weekly-chart');
  const toast = document.getElementById('toast');

  const worker = window.Worker ? new Worker('voice-engine-worker.js') : null;
  if (worker) {
    worker.onmessage = ({ data }) => {
      if (!data || data.type !== 'transcript-processed') return;
      const { increments, normalizedTranscript, matchedTokens } = data.payload;
      latestProcessedTranscript = normalizedTranscript;
      transcriptPreview.textContent = normalizedTranscript || 'Listening...';
      if (increments > 0) {
        for (let index = 0; index < increments; index += 1) incrementCount();
        voiceStatus.classList.add('recognized');
        setTimeout(() => voiceStatus.classList.remove('recognized'), 500);
        if (matchedTokens.length) {
          showToast(`Counted ${matchedTokens.length} mantra${matchedTokens.length > 1 ? 's' : ''}`);
        }
      }
    };
    worker.postMessage({ type: 'reset-session', payload: { sessionId: voiceSessionId } });
  }

  function init() {
    applyTheme(settings.darkMode);
    updateSettingsUI();
    setupSpeechRecognition();
    loadMantra(currentMantra);
    renderMantraLibrary();
    renderHistory();
    updateVoiceIdleState();
    setTimeout(() => {
      splashScreen.classList.remove('active');
      document.getElementById('screen-home').classList.add('active');
    }, 2000);
  }

  function inferCategory(mantra) {
    const text = `${mantra.name} ${mantra.deity} ${mantra.text}`.toLowerCase();
    if (text.includes('shiva')) return 'shaiva';
    if (text.includes('krishna') || text.includes('rama') || text.includes('vishnu')) return 'vaishnava';
    if (text.includes('devi') || text.includes('durga') || text.includes('lakshmi')) return 'devi';
    if (text.includes('gayatri') || text.includes('vedic')) return 'vedic';
    return 'custom';
  }

  function persistMantras() {
    localStorage.setItem('mantraz_mantras', JSON.stringify(mantras));
  }

  function saveSettings() {
    localStorage.setItem('mantraz_settings', JSON.stringify(settings));
  }

  function applyTheme(isDark) {
    htmlEl.setAttribute('data-theme', isDark ? 'dark' : 'light');
    iconSun.style.display = isDark ? 'block' : 'none';
    iconMoon.style.display = isDark ? 'none' : 'block';
  }

  function updateSettingsUI() {
    toggleDarkMode.checked = settings.darkMode;
    selectMalaSize.value = settings.malaSize;
    sliderSensitivity.value = settings.sensitivity;
    labelSensitivity.textContent = Number(settings.sensitivity).toFixed(2).replace(/0$/, '');
    selectLang.value = settings.lang;
    toggleVibration.checked = settings.vibration;
    toggleSound.checked = settings.sound;
  }

  function switchScreen(targetScreen) {
    navBtns.forEach((btn) => {
      const isActive = btn.dataset.screen === targetScreen;
      btn.classList.toggle('active', isActive);
      if (isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    screens.forEach((screen) => screen.classList.remove('active'));
    document.getElementById(`screen-${targetScreen}`).classList.add('active');
  }

  function loadMantra(mantra) {
    currentMantra = mantra;
    localStorage.setItem('mantraz_last_mantra', mantra.id);
    activeMantraName.textContent = mantra.name;
    activeMantraLang.textContent = `${mantra.lang} • ${mantra.deity}`;
    mantraTargetBadge.textContent = mantra.target;
    countLabel.textContent = `/ ${settings.malaSize}`;
    activeMantraTriggers.textContent = mantra.triggers.join(', ');
    resetSession();
    resetVoiceEngineSession();
    renderModalMantraList();
    if (isListening) stopListening();
  }

  function updateCounter() {
    countDisplay.textContent = count;
    statTotal.textContent = count;
    malas = Math.floor(count / Number(settings.malaSize));
    const remainder = count % Number(settings.malaSize);
    malaDisplay.textContent = `Mala ${malas + 1} of ∞`;
    statMalas.textContent = malas;
    const circleCircumference = 703.72;
    ringProgress.style.strokeDashoffset = circleCircumference - ((remainder / Number(settings.malaSize)) * circleCircumference);
    if (remainder === 0 && count > 0) {
      if (settings.vibration && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      if (settings.sound) playBell();
      showToast('Mala Completed! 🙏');
    } else if (count > 0 && settings.vibration && navigator.vibrate) {
      navigator.vibrate(20);
    }
  }

  function incrementCount() {
    if (count === 0 && !sessionStartTime) startSessionTimer();
    count += 1;
    updateCounter();
  }

  function resetSession() {
    count = 0;
    malas = 0;
    sessionDuration = 0;
    sessionStartTime = null;
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimer = null;
    statDuration.textContent = '0:00';
    updateCounter();
    ringProgress.style.strokeDashoffset = 703.72;
  }

  function startSessionTimer() {
    sessionStartTime = Date.now();
    sessionTimer = setInterval(() => {
      sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
      const mins = Math.floor(sessionDuration / 60);
      const secs = sessionDuration % 60;
      statDuration.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
  }

  function playBell() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 2);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 2);
  }

  function resetVoiceEngineSession() {
    voiceSessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    latestProcessedTranscript = '';
    transcriptIdSeen.clear();
    transcriptPreview.textContent = '';
    if (worker) worker.postMessage({ type: 'reset-session', payload: { sessionId: voiceSessionId } });
  }

  function updateVoiceIdleState() {
    if (!speechSupported) {
      voiceLabel.textContent = 'Voice recognition not supported in this browser';
      transcriptPreview.textContent = 'Use Chrome or Safari for voice counting.';
      btnMic.style.opacity = '0.5';
      return;
    }
    voiceLabel.textContent = 'Tap mic to start on-device voice counting';
    if (!isListening) transcriptPreview.textContent = latestProcessedTranscript || 'Fast browser speech recognition with smart mantra matching.';
  }

  function enqueueTranscript(text, isFinal) {
    const cleaned = String(text || '').trim();
    if (!cleaned) return;
    transcriptPreview.textContent = cleaned;
    if (!worker) {
      transcriptPreview.textContent = cleaned;
      return;
    }
    worker.postMessage({
      type: 'process-transcript',
      payload: {
        sessionId: voiceSessionId,
        transcript: cleaned,
        triggers: currentMantra.triggers,
        sensitivity: Number(settings.sensitivity),
        isFinal
      }
    });
  }

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speechSupported = false;
      return;
    }

    speechSupported = true;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = settings.lang;

    recognition.onstart = () => {
      isListening = true;
      btnMic.classList.add('active');
      btnMic.setAttribute('aria-pressed', 'true');
      micIconOn.style.display = 'block';
      micIconOff.style.display = 'none';
      voiceStatus.classList.add('listening');
      voiceLabel.textContent = 'Listening for mantra phrases...';
      transcriptPreview.textContent = 'Speak your mantra naturally.';
      resetVoiceEngineSession();
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || '';
        const signature = `${index}:${transcript.trim()}:${result.isFinal}`;
        if (transcriptIdSeen.has(signature)) continue;
        transcriptIdSeen.add(signature);
        if (result.isFinal) finalTranscript += `${transcript} `;
        else interimTranscript += `${transcript} `;
      }
      if (finalTranscript.trim()) enqueueTranscript(finalTranscript, true);
      if (interimTranscript.trim()) enqueueTranscript(interimTranscript, false);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToast('Microphone permission is required for voice counting.');
      } else if (event.error === 'no-speech') {
        voiceLabel.textContent = 'Listening... say your mantra clearly';
      } else {
        showToast(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (shouldBeListening) {
        try {
          recognition.start();
          return;
        } catch (error) {
          console.error('Speech restart failed', error);
        }
      }
      stopListening();
    };
  }

  function startListening() {
    if (!speechSupported || !recognition) {
      showToast('Voice recognition works in Chrome and Safari on secure origins.');
      return;
    }
    shouldBeListening = true;
    recognition.lang = settings.lang;
    try {
      recognition.start();
    } catch (error) {
      console.error('Speech start failed', error);
    }
  }

  function stopListening() {
    shouldBeListening = false;
    isListening = false;
    btnMic.classList.remove('active');
    btnMic.setAttribute('aria-pressed', 'false');
    micIconOn.style.display = 'none';
    micIconOff.style.display = 'block';
    voiceStatus.classList.remove('listening', 'recognized');
    if (recognition) {
      try { recognition.stop(); } catch (error) { /* noop */ }
    }
    updateVoiceIdleState();
  }

  function openModal(element) {
    element.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(element) {
    element.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderModalMantraList() {
    modalMantraList.innerHTML = mantras.map((mantra) => `
      <div class="modal-mantra-item ${mantra.id === currentMantra.id ? 'selected' : ''}" data-id="${mantra.id}">
        <div class="mmi-info">
          <div style="font-weight: 600">${mantra.name}</div>
          <div style="font-size: 13px; color: var(--text-secondary)">${mantra.deity}</div>
        </div>
        ${mantra.id === currentMantra.id ? '✓' : ''}
      </div>
    `).join('');
    modalMantraList.querySelectorAll('.modal-mantra-item').forEach((item) => {
      item.addEventListener('click', () => {
        const selected = mantras.find((mantra) => mantra.id === item.dataset.id);
        if (selected) loadMantra(selected);
        closeModal(modalSelect);
      });
    });
  }

  function getFilteredMantras() {
    return mantras.filter((mantra) => {
      const normalizedTerm = searchTerm.trim().toLowerCase();
      const matchesSearch = !normalizedTerm || [mantra.name, mantra.text, mantra.deity, mantra.lang, mantra.triggers.join(' ')].join(' ').toLowerCase().includes(normalizedTerm);
      const matchesFilter = libraryFilter === 'all' || mantra.category === libraryFilter;
      return matchesSearch && matchesFilter;
    });
  }

  function renderMantraLibrary() {
    const filtered = getFilteredMantras();
    mantraListEl.innerHTML = filtered.length ? '' : '<div class="empty-state">No mantras match your search yet.</div>';
    filtered.forEach((mantra) => {
      const card = document.createElement('div');
      card.className = 'mantra-card';
      card.innerHTML = `
        <div class="mantra-card-icon">🕉️</div>
        <div class="mantra-card-content">
          <div class="mantra-card-title">${mantra.name}</div>
          <div class="mantra-card-desc">${mantra.text.substring(0, 60)}${mantra.text.length > 60 ? '...' : ''}</div>
          <div class="mantra-tag">${mantra.deity} • ${mantra.category}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        loadMantra(mantra);
        switchScreen('home');
      });
      mantraListEl.appendChild(card);
    });
  }

  function formatCompactNumber(value) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  }

  function calculateStreak() {
    if (history.length === 0) return 0;
    const uniqueDays = [...new Set(history.map((item) => new Date(item.date).setHours(0, 0, 0, 0)))].sort((a, b) => b - a);
    const today = new Date().setHours(0, 0, 0, 0);
    if (uniqueDays[0] !== today && uniqueDays[0] !== today - 86400000) return 0;
    let streak = 1;
    for (let index = 1; index < uniqueDays.length; index += 1) {
      if (uniqueDays[index - 1] - uniqueDays[index] === 86400000) streak += 1;
      else break;
    }
    return streak;
  }

  function renderWeeklyChart() {
    const context = weeklyChart.getContext('2d');
    const width = weeklyChart.width = weeklyChart.offsetWidth * devicePixelRatio;
    const height = weeklyChart.height = weeklyChart.offsetHeight * devicePixelRatio;
    context.scale(devicePixelRatio, devicePixelRatio);
    context.clearRect(0, 0, width, height);

    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - offset));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const counts = days.map((day) => history.filter((item) => new Date(item.date).setHours(0, 0, 0, 0) === day.getTime()).reduce((sum, item) => sum + item.count, 0));
    const maxCount = Math.max(...counts, 1);
    const chartWidth = weeklyChart.clientWidth;
    const chartHeight = weeklyChart.clientHeight;
    const barWidth = chartWidth / (counts.length * 1.4);

    counts.forEach((value, index) => {
      const x = 12 + index * (barWidth + 12);
      const barHeight = (value / maxCount) * (chartHeight - 36);
      const y = chartHeight - barHeight - 20;
      context.fillStyle = 'rgba(255, 126, 95, 0.18)';
      context.fillRect(x, 12, barWidth, chartHeight - 32);
      context.fillStyle = '#ff7e5f';
      context.fillRect(x, y, barWidth, barHeight);
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
      context.font = '12px Inter';
      context.textAlign = 'center';
      context.fillText(days[index].toLocaleDateString([], { weekday: 'short' }).slice(0, 2), x + (barWidth / 2), chartHeight - 4);
    });
  }

  function renderHistoryFilterOptions() {
    const options = ['<option value="all">All Mantras</option>'].concat(
      mantras.map((mantra) => `<option value="${mantra.id}">${mantra.name}</option>`)
    );
    historyFilterSelect.innerHTML = options.join('');
    historyFilterSelect.value = historyFilter;
  }

  function renderHistory() {
    document.getElementById('total-sessions').textContent = history.length;
    document.getElementById('total-count').textContent = formatCompactNumber(history.reduce((sum, item) => sum + item.count, 0));
    document.getElementById('current-streak').textContent = calculateStreak();
    renderHistoryFilterOptions();
    renderWeeklyChart();

    const filteredHistory = history.filter((item) => historyFilter === 'all' || item.mantraId === historyFilter);
    sessionListEl.innerHTML = filteredHistory.length ? '' : '<div class="empty-state">No saved sessions yet. Complete a chanting session to see it here.</div>';
    filteredHistory.slice(0, 20).forEach((session) => {
      const item = document.createElement('div');
      item.className = 'session-item';
      item.innerHTML = `
        <div class="session-item-left">
          <div class="session-item-title">${session.mantraName}</div>
          <div class="session-item-date">${new Date(session.date).toLocaleString()}</div>
        </div>
        <div class="session-item-right">
          <div class="session-item-count">${session.count}</div>
          <div class="session-item-duration">${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s • ${session.malas} malas</div>
        </div>
      `;
      sessionListEl.appendChild(item);
    });
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  navBtns.forEach((btn) => btn.addEventListener('click', () => switchScreen(btn.dataset.screen)));
  btnThemeToggle.addEventListener('click', () => {
    settings.darkMode = !settings.darkMode;
    applyTheme(settings.darkMode);
    renderWeeklyChart();
    saveSettings();
    updateSettingsUI();
  });
  ringContainer.addEventListener('click', incrementCount);
  btnReset.addEventListener('click', () => {
    resetSession();
    resetVoiceEngineSession();
    showToast('Session reset');
  });
  btnMic.addEventListener('click', () => (shouldBeListening ? stopListening() : startListening()));
  btnSelectMantra.addEventListener('click', () => {
    renderModalMantraList();
    openModal(modalSelect);
  });
  document.getElementById('btn-add-mantra').addEventListener('click', () => openModal(modalAdd));
  document.getElementById('btn-cancel-mantra').addEventListener('click', () => closeModal(modalAdd));
  btnCancelTriggers.addEventListener('click', () => closeModal(modalEditTriggers));
  btnEditTriggers.addEventListener('click', () => {
    inputEditTriggers.value = currentMantra.triggers.join(', ');
    openModal(modalEditTriggers);
  });

  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal);
    });
    const handle = modal.querySelector('.modal-handle');
    if (handle) handle.addEventListener('click', () => closeModal(modal));
  });

  formEditTriggers.addEventListener('submit', (event) => {
    event.preventDefault();
    const words = inputEditTriggers.value.split(',').map((word) => word.trim().toLowerCase()).filter(Boolean);
    if (!words.length) {
      showToast('Please enter at least one trigger word');
      return;
    }
    currentMantra.triggers = words;
    const mantraIndex = mantras.findIndex((mantra) => mantra.id === currentMantra.id);
    if (mantraIndex !== -1) mantras[mantraIndex] = currentMantra;
    activeMantraTriggers.textContent = words.join(', ');
    persistMantras();
    closeModal(modalEditTriggers);
    resetVoiceEngineSession();
    renderMantraLibrary();
    showToast('Voice triggers updated');
  });

  document.getElementById('mantra-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('form-name').value.trim();
    const text = document.getElementById('form-text').value.trim();
    const deity = document.getElementById('form-deity').value.trim() || 'Custom';
    const lang = document.getElementById('form-lang').value.trim() || 'Sanskrit';
    const target = Number(document.getElementById('form-target').value) || 108;
    const triggers = document.getElementById('form-words').value.split(',').map((word) => word.trim().toLowerCase()).filter(Boolean);
    if (!name || !triggers.length) {
      showToast('Add a mantra name and at least one trigger word');
      return;
    }
    const mantra = {
      id: Date.now().toString(),
      name,
      text: text || name,
      deity,
      lang,
      target,
      triggers,
      category: 'custom'
    };
    mantras.unshift(mantra);
    persistMantras();
    renderMantraLibrary();
    renderHistory();
    closeModal(modalAdd);
    event.target.reset();
    loadMantra(mantra);
    switchScreen('home');
    showToast('Custom mantra added');
  });

  btnComplete.addEventListener('click', () => {
    if (count === 0) {
      showToast("Session hasn't started yet.");
      return;
    }
    document.getElementById('complete-subtitle').textContent = currentMantra.name;
    document.getElementById('complete-count').textContent = count;
    document.getElementById('complete-malas').textContent = malas;
    document.getElementById('complete-duration').textContent = Math.floor(sessionDuration / 60);
    openModal(modalComplete);
  });
  document.getElementById('btn-continue-session').addEventListener('click', () => closeModal(modalComplete));
  document.getElementById('btn-save-session').addEventListener('click', () => {
    const session = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      mantraId: currentMantra.id,
      mantraName: currentMantra.name,
      count,
      malas,
      durationSeconds: sessionDuration
    };
    history.unshift(session);
    localStorage.setItem('mantraz_history', JSON.stringify(history));
    closeModal(modalComplete);
    resetSession();
    resetVoiceEngineSession();
    renderHistory();
    switchScreen('history');
    showToast('Session saved successfully');
  });

  mantraSearch.addEventListener('input', (event) => {
    searchTerm = event.target.value;
    renderMantraLibrary();
  });

  filterChips.forEach((chip) => chip.addEventListener('click', () => {
    filterChips.forEach((button) => button.classList.remove('active'));
    chip.classList.add('active');
    libraryFilter = chip.dataset.filter;
    renderMantraLibrary();
  }));

  historyFilterSelect.addEventListener('change', (event) => {
    historyFilter = event.target.value;
    renderHistory();
  });

  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (!confirm('Are you sure you want to clear all history?')) return;
    history = [];
    localStorage.setItem('mantraz_history', JSON.stringify(history));
    renderHistory();
    showToast('History cleared');
  });

  toggleDarkMode.addEventListener('change', (event) => {
    settings.darkMode = event.target.checked;
    applyTheme(settings.darkMode);
    renderWeeklyChart();
    saveSettings();
  });
  selectMalaSize.addEventListener('change', (event) => {
    settings.malaSize = Number(event.target.value);
    saveSettings();
    updateCounter();
  });
  sliderSensitivity.addEventListener('input', (event) => {
    settings.sensitivity = Number(event.target.value);
    labelSensitivity.textContent = Number(settings.sensitivity).toFixed(2).replace(/0$/, '');
    resetVoiceEngineSession();
  });
  sliderSensitivity.addEventListener('change', saveSettings);
  selectLang.addEventListener('change', (event) => {
    settings.lang = event.target.value;
    if (recognition) recognition.lang = settings.lang;
    saveSettings();
  });
  toggleVibration.addEventListener('change', (event) => {
    settings.vibration = event.target.checked;
    saveSettings();
  });
  toggleSound.addEventListener('change', (event) => {
    settings.sound = event.target.checked;
    saveSettings();
  });

  document.getElementById('btn-clear-all-data').addEventListener('click', () => {
    if (!confirm('WARNING: This will delete ALL mantras, history and reset settings. Continue?')) return;
    localStorage.clear();
    location.reload();
  });

  document.getElementById('btn-export-data').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ settings, mantras, history }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mantraz-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
  });

  window.addEventListener('resize', renderWeeklyChart);
  init();
});
