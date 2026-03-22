from __future__ import annotations

import json
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
TOKEN_RE = re.compile(r"[^a-z0-9']+")
SESSION_TTL_SECONDS = 60 * 30
MAX_WINDOW_TOKENS = 24

VARIANT_MAP = {
    'svaha': 'swaha',
    'shri': 'sri',
    'namaha': 'namah',
    'shivay': 'shivaya',
}


def normalize_token(value: str) -> str:
    token = TOKEN_RE.sub(' ', value.lower()).strip()
    if not token:
        return ''
    collapsed = ''.join(token.split()) if ' ' in token else token
    return VARIANT_MAP.get(collapsed, collapsed)


@dataclass
class SessionState:
    recent_tokens: List[str] = field(default_factory=list)
    updated_at: float = field(default_factory=time.time)


class VoiceEngine:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: Dict[str, SessionState] = {}

    def create_session(self) -> str:
        with self._lock:
            self._purge_expired_locked()
            session_id = uuid.uuid4().hex
            self._sessions[session_id] = SessionState()
            return session_id

    def reset_session(self, session_id: str) -> None:
        with self._lock:
            self._sessions[session_id] = SessionState()

    def process(self, session_id: str, transcript: str, triggers: List[str]) -> Dict[str, object]:
        normalized_tokens = self._normalize_transcript(transcript)
        normalized_triggers = [normalize_token(trigger) for trigger in triggers]
        normalized_triggers = [trigger for trigger in normalized_triggers if trigger]

        with self._lock:
            self._purge_expired_locked()
            state = self._sessions.setdefault(session_id, SessionState())
            state.updated_at = time.time()

            overlap = self._overlap(state.recent_tokens, normalized_tokens)
            new_tokens = normalized_tokens[overlap:]
            matched_tokens = [token for token in new_tokens if token in normalized_triggers]
            increments = len(matched_tokens)

            combined = state.recent_tokens + new_tokens
            state.recent_tokens = combined[-MAX_WINDOW_TOKENS:]

            return {
                'increments': increments,
                'matchedTokens': matched_tokens,
                'normalizedTranscript': ' '.join(normalized_tokens[-MAX_WINDOW_TOKENS:]),
                'sessionId': session_id,
            }

    def _normalize_transcript(self, transcript: str) -> List[str]:
        raw_tokens = TOKEN_RE.sub(' ', transcript.lower()).split()
        normalized = []
        for token in raw_tokens:
            normalized_token = normalize_token(token)
            if normalized_token:
                normalized.append(normalized_token)
        return normalized[-MAX_WINDOW_TOKENS:]

    @staticmethod
    def _overlap(previous: List[str], current: List[str]) -> int:
        max_overlap = min(len(previous), len(current))
        for size in range(max_overlap, -1, -1):
            if previous[-size:] == current[:size]:
                return size
        return 0

    def _purge_expired_locked(self) -> None:
        cutoff = time.time() - SESSION_TTL_SECONDS
        expired_ids = [session_id for session_id, state in self._sessions.items() if state.updated_at < cutoff]
        for session_id in expired_ids:
            self._sessions.pop(session_id, None)


ENGINE = VoiceEngine()


class AppHandler(SimpleHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == '/api/voice/session':
            self._handle_create_session()
            return
        if parsed.path == '/api/voice/reset':
            self._handle_reset_session()
            return
        if parsed.path == '/api/voice/match':
            self._handle_match()
            return
        self.send_error(HTTPStatus.NOT_FOUND, 'Endpoint not found')

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            self._send_json({'ok': True, 'service': 'mantraz-python-voice-engine'})
            return
        if parsed.path == '/':
            self.path = '/index.html'
        return super().do_GET()

    def translate_path(self, path: str) -> str:
        path = urlparse(path).path
        resolved = ROOT / path.lstrip('/')
        if resolved.is_dir():
            resolved = resolved / 'index.html'
        return str(resolved)

    def _read_json(self) -> Dict[str, object]:
        length = int(self.headers.get('Content-Length', '0'))
        raw_body = self.rfile.read(length) if length else b'{}'
        try:
            return json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise ValueError('Invalid JSON payload') from exc

    def _handle_create_session(self) -> None:
        session_id = ENGINE.create_session()
        self._send_json({'sessionId': session_id})

    def _handle_reset_session(self) -> None:
        payload = self._read_json()
        session_id = str(payload.get('sessionId', '')).strip()
        if not session_id:
            self._send_json({'error': 'sessionId is required'}, HTTPStatus.BAD_REQUEST)
            return
        ENGINE.reset_session(session_id)
        self._send_json({'ok': True, 'sessionId': session_id})

    def _handle_match(self) -> None:
        try:
            payload = self._read_json()
        except ValueError as exc:
            self._send_json({'error': str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        session_id = str(payload.get('sessionId', '')).strip()
        transcript = str(payload.get('transcript', ''))
        triggers = payload.get('triggers', [])
        if not session_id:
            self._send_json({'error': 'sessionId is required'}, HTTPStatus.BAD_REQUEST)
            return
        if not isinstance(triggers, list):
            self._send_json({'error': 'triggers must be a list'}, HTTPStatus.BAD_REQUEST)
            return

        result = ENGINE.process(session_id, transcript, [str(trigger) for trigger in triggers])
        self._send_json(result)

    def _send_json(self, payload: Dict[str, object], status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(encoded)


def run() -> None:
    server = ThreadingHTTPServer(('0.0.0.0', 8000), AppHandler)
    print('MantraZ running at http://127.0.0.1:8000')
    server.serve_forever()


if __name__ == '__main__':
    run()
