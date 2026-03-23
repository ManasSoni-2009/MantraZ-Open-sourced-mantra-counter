<div align="center">

# 🕉️ MantraZ
### *A voice-enabled mantra counting experience for focused spiritual practice.*

[![Static Site](https://img.shields.io/badge/deploy-GitHub%20Pages-181717?style=for-the-badge&logo=github)](#-deployment)
[![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-ff7e5f?style=for-the-badge)](#-tech-stack)
[![Voice Engine](https://img.shields.io/badge/voice-On--device%20Worker-feb47b?style=for-the-badge)](#-voice-engine)
[![Storage](https://img.shields.io/badge/storage-LocalStorage-2ecca6?style=for-the-badge)](#-features)

**MantraZ** is a beautiful static web app for mantra counting with voice input, mala tracking, mantra selection, history, and a GitHub Pages-ready deployment pipeline.

</div>

---

## ✨ Highlights

- 🎙️ **Voice-based mantra counting** using browser speech recognition.
- ⚙️ **On-device transcript processing** via `voice-engine-worker.js` for overlap-aware matching.
- 📿 **Mala progress tracking** with animated ring progress and haptic/audio feedback.
- 📚 **Mantra library** with search, filtering, and custom mantra creation.
- 📈 **History dashboard** with streaks, total counts, and weekly charting.
- 💾 **Local-first persistence** using `localStorage`.
- 🚀 **Static deployment** through GitHub Pages with `.nojekyll` support.

---

## 🌸 Experience Overview

MantraZ is designed to feel calm, fast, and mobile-friendly:

- a spiritual dark/light theme,
- a dedicated counter experience,
- one-tap microphone activation,
- clear visual voice feedback,
- and persistent personal practice history.

It is intentionally built as a **static app** so it can be hosted directly on GitHub Pages without a backend.

---

## 🧠 Voice Engine

The voice system has two layers:

### 1. Browser speech recognition
The app uses the browser's speech recognition support to capture spoken mantra transcripts in real time.

### 2. Worker-based matching engine
`voice-engine-worker.js` processes transcript chunks off the main thread and handles:

- transcript normalization,
- transliteration-friendly token cleanup,
- overlap detection between transcript windows,
- fuzzy matching using Levenshtein distance,
- sensitivity-based token matching,
- and per-session counting state.

This keeps the UI responsive while improving count accuracy for repeated mantra phrases.

---

## 🪔 Features

### Counter & Session Flow
- Tap-to-count fallback.
- Voice-triggered counting.
- Mala completion feedback.
- Session duration tracking.
- Session completion modal.
- JSON export for all saved data.

### Mantra Library
- Built-in mantra presets.
- Custom mantra creation.
- Editable trigger phrases.
- Search by mantra name, deity, or trigger words.
- Category filtering (`vedic`, `shaiva`, `vaishnava`, `devi`, `custom`).

### History & Insights
- Total sessions.
- Total count.
- Day streak.
- Weekly visualization.
- Filterable session history.

### Settings
- Theme toggle.
- Mala size selection.
- Voice sensitivity.
- Speech language.
- Vibration and sound preferences.

---

## 🧱 Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── static.yml
├── .nojekyll
├── app.js
├── index.html
├── mantraz-core.js
├── style.css
└── voice-engine-worker.js
```

### What each file does

- **`index.html`** — app shell, screens, modals, and script entrypoint.
- **`style.css`** — visual system, layout, animations, and responsive styling.
- **`app.js`** — lightweight compatibility entry file kept in the repo.
- **`mantraz-core.js`** — main client-side application logic.
- **`voice-engine-worker.js`** — transcript matching worker.
- **`.github/workflows/static.yml`** — GitHub Pages deployment workflow.
- **`.nojekyll`** — prevents Jekyll from interfering with static asset delivery.

---

## 🛠 Tech Stack

- **HTML5**
- **CSS3**
- **Vanilla JavaScript**
- **Web Worker API**
- **Web Speech API**
- **LocalStorage**
- **GitHub Pages / GitHub Actions**

---

## 🚀 Local Development

Because the app uses browser features like workers and speech APIs, run it through a local server instead of opening `index.html` directly.

### Option 1: Python

```bash
python -m http.server 8123
```

Then open:

```text
http://127.0.0.1:8123
```

### Option 2: Any static server
You can use any simple static file server you prefer.

---

## 🌍 Deployment

This repo is configured for **GitHub Pages via GitHub Actions**.

### Workflow behavior
The Pages workflow:

1. checks out the repository,
2. creates a `deploy/` folder,
3. copies only the required static files,
4. uploads that artifact,
5. and publishes it to GitHub Pages.

### Required files included in deploy artifact
- `index.html`
- `style.css`
- `app.js`
- `mantraz-core.js`
- `voice-engine-worker.js`
- `.nojekyll`

### To deploy
- Push the branch configured in `.github/workflows/static.yml`.
- Ensure GitHub Pages is set to **GitHub Actions** in repository settings.
- Merge to `main` if the workflow is configured to deploy from `main`.

---

## 🔊 Browser Support Notes

Voice recognition depends on browser support and permissions.

For the best experience, use:
- **Chrome**
- **Edge**
- **Safari**

If speech recognition is unavailable, the app still supports manual counting.

---

## 📦 Data Model

The app stores the following in `localStorage`:

- `mantraz_settings`
- `mantraz_mantras`
- `mantraz_history`
- `mantraz_last_mantra`

This means user data stays local to the browser unless exported manually.

---

## 🎯 Future Ideas

- Sanskrit transliteration presets.
- Import / restore backup flow.
- Better chart styling and insights.
- PWA install support.
- Optional ambient soundscapes.
- Guided chanting mode.

---

## 🙏 Philosophy

MantraZ is meant to stay lightweight, peaceful, and accessible:

> *open quickly, count reliably, and get out of the way of practice.*

---

## 📄 License

This repository is open-sourced by its author. Add your preferred license here if you want explicit reuse terms.

---

<div align="center">

### 🌺 Built for mindful repetition, focus, and devotion.

</div>
