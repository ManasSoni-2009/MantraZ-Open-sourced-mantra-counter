document.addEventListener('DOMContentLoaded', () => {

  // --- 1. DEFAULT DATA ---
  const DEFAULT_SETTINGS = {
    darkMode: true,
    malaSize: 108,
    sensitivity: 0.7,
    lang: 'en-IN',
    vibration: true,
    sound: true
  };

  const DEFAULT_MANTRAS = [
    { id: '1', name: 'Gayatri Mantra', text: 'Om Bhur Bhuva Swaha...', deity: 'Savitr', lang: 'Sanskrit', target: 108, triggers: ['om', 'swaha', 'svaha', 'bhur'] },
    { id: '2', name: 'Shiva Panchakshara', text: 'Om Namah Shivaya', deity: 'Shiva', lang: 'Sanskrit', target: 108, triggers: ['om', 'namah', 'shivaya', 'shiva'] },
    { id: '3', name: 'Maha Mrityunjaya', text: 'Om Tryambakam Yajamahe...', deity: 'Shiva', lang: 'Sanskrit', target: 108, triggers: ['om', 'tryambakam', 'yajamahe', 'swaha'] },
    { id: '4', name: 'Hare Krishna', text: 'Hare Krishna Hare Krishna...', deity: 'Krishna', lang: 'Sanskrit', target: 108, triggers: ['hare', 'krishna', 'rama'] },
  ];

  // --- 2. STATE ---
  const savedSettings = JSON.parse(localStorage.getItem('mantraz_settings'));
  let settings = savedSettings ? { ...DEFAULT_SETTINGS, ...savedSettings } : { ...DEFAULT_SETTINGS };
  
  const savedMantras = JSON.parse(localStorage.getItem('mantraz_mantras'));
  let mantras = savedMantras ? savedMantras : [ ...DEFAULT_MANTRAS ];
  
  let history = JSON.parse(localStorage.getItem('mantraz_history')) || [];
  
  let currentMantra = mantras.find(m => m.id === localStorage.getItem('mantraz_last_mantra')) || mantras[0];
  
  // Session State
  let count = 0;
  let malas = 0;
  let sessionStartTime = null;
  let sessionTimer = null;
  let sessionDuration = 0;

  // --- 3. DOM ELEMENTS ---
  const htmlEl = document.documentElement;
  const screens = document.querySelectorAll('.screen');
  const navBtns = document.querySelectorAll('.nav-btn');
  const splashScreen = document.getElementById('screen-splash');

  // Home counter elements
  const activeMantraName = document.getElementById('active-mantra-name');
  const activeMantraLang = document.getElementById('active-mantra-language');
  const mantraTargetBadge = document.getElementById('mantra-target-badge');
  const countDisplay = document.getElementById('count-display');
  const countLabel = document.getElementById('count-label');
  const malaDisplay = document.getElementById('mala-display');
  const ringProgress = document.getElementById('ring-progress');
  const ringContainer = document.querySelector('.counter-center');

  // Stats
  const statMalas = document.getElementById('stat-malas');
  const statTotal = document.getElementById('stat-total');
  const statDuration = document.getElementById('stat-duration');

  // Voice
  const btnMic = document.getElementById('btn-mic');
  const micIconOn = document.getElementById('mic-icon-on');
  const micIconOff = document.getElementById('mic-icon-off');
  const voiceStatus = document.getElementById('voice-status');
  const voiceLabel = document.getElementById('voice-label');
  const transcriptPreview = document.getElementById('transcript-preview');

  // Triggers UI
  const btnEditTriggers = document.getElementById('btn-edit-triggers');
  const activeMantraTriggers = document.getElementById('active-mantra-triggers');
  const modalEditTriggers = document.getElementById('modal-edit-triggers');
  const inputEditTriggers = document.getElementById('input-edit-triggers');
  const formEditTriggers = document.getElementById('form-edit-triggers');
  const btnCancelTriggers = document.getElementById('btn-cancel-triggers');

  // Controls
  const btnReset = document.getElementById('btn-reset');
  const btnComplete = document.getElementById('btn-complete');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const iconSun = document.getElementById('icon-sun');
  const iconMoon = document.getElementById('icon-moon');
  const btnSelectMantra = document.getElementById('btn-select-mantra');

  // Settings
  const toggleDarkMode = document.getElementById('setting-dark-mode');
  const selectMalaSize = document.getElementById('setting-mala-size');
  const sliderSensitivity = document.getElementById('setting-sensitivity');
  const labelSensitivity = document.getElementById('sensitivity-value');
  const selectLang = document.getElementById('setting-lang');
  const toggleVibration = document.getElementById('setting-vibration');
  const toggleSound = document.getElementById('setting-sound');

  // Modals
  const modalSelect = document.getElementById('modal-select-mantra');
  const modalAdd = document.getElementById('modal-add-mantra');
  const modalComplete = document.getElementById('modal-session-complete');
  const modalMantraList = document.getElementById('modal-mantra-list');

  // Library & History
  const mantraListEl = document.getElementById('mantra-list');
  const sessionListEl = document.getElementById('session-list');

  // --- 4. INITIALIZATION ---
  function init() {
    applyTheme(settings.darkMode);
    updateSettingsUI();
    loadMantra(currentMantra);
    renderMantraLibrary();
    renderHistory();
    
    // Remove splash screen after 2s
    setTimeout(() => {
      splashScreen.classList.remove('active');
      document.getElementById('screen-home').classList.add('active');
    }, 2000);
  }

  // --- 5. THEME & SETTINGS ---
  function applyTheme(isDark) {
    htmlEl.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (isDark) {
      iconSun.style.display = 'block';
      iconMoon.style.display = 'none';
    } else {
      iconSun.style.display = 'none';
      iconMoon.style.display = 'block';
    }
  }

  function saveSettings() {
    localStorage.setItem('mantraz_settings', JSON.stringify(settings));
  }

  function updateSettingsUI() {
    toggleDarkMode.checked = settings.darkMode;
    selectMalaSize.value = settings.malaSize;
    sliderSensitivity.value = settings.sensitivity;
    labelSensitivity.textContent = settings.sensitivity;
    selectLang.value = settings.lang;
    toggleVibration.checked = settings.vibration;
    toggleSound.checked = settings.sound;
  }

  // --- 6. NAVIGATION ---
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScreen = btn.dataset.screen;
      // Update buttons
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Update screens
      screens.forEach(s => s.classList.remove('active'));
      document.getElementById(`screen-${targetScreen}`).classList.add('active');
    });
  });

  btnThemeToggle.addEventListener('click', () => {
    settings.darkMode = !settings.darkMode;
    applyTheme(settings.darkMode);
    saveSettings();
    updateSettingsUI();
  });

  // --- 7. COUNTER LOGIC ---
  function loadMantra(mantra) {
    currentMantra = mantra;
    localStorage.setItem('mantraz_last_mantra', mantra.id);
    activeMantraName.textContent = mantra.name;
    activeMantraLang.textContent = `${mantra.lang} • ${mantra.deity}`;
    mantraTargetBadge.textContent = mantra.target;
    countLabel.textContent = `/ ${settings.malaSize}`;
    activeMantraTriggers.textContent = mantra.triggers.join(', ');
    resetSession();
    
    if (isListening) stopListening();
  }

  function updateCounter() {
    countDisplay.textContent = count;
    statTotal.textContent = count;
    
    // Calculate Malas
    const malaSize = parseInt(settings.malaSize);
    malas = Math.floor(count / malaSize);
    const remainder = count % malaSize;
    
    malaDisplay.textContent = `Mala ${malas + 1} of ∞`;
    statMalas.textContent = malas;

    // Update SVG Ring
    const circleCircumference = 703.72; // 2 * pi * r (r=112)
    const progress = remainder / malaSize;
    const offset = circleCircumference - (progress * circleCircumference);
    ringProgress.style.strokeDashoffset = offset;

    // Haptics & Sound
    if (remainder === 0 && count > 0) {
      if (settings.vibration && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      if (settings.sound) playBell();
      showToast('Mala Completed! 🙏');
    } else if (settings.vibration && navigator.vibrate) {
      navigator.vibrate(20);
    }
  }

  function incrementCount() {
    if (count === 0 && !sessionStartTime) {
      startSessionTimer();
    }
    count++;
    updateCounter();
  }

  function resetSession() {
    count = 0;
    malas = 0;
    sessionDuration = 0;
    sessionStartTime = null;
    if (sessionTimer) clearInterval(sessionTimer);
    updateCounter();
    statDuration.textContent = "0:00";
    ringProgress.style.strokeDashoffset = 703.72; // Full empty ring
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
    // Simple synthesized bell for web
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

  // Manual Tap
  ringContainer.addEventListener('click', incrementCount);
  btnReset.addEventListener('click', resetSession);

  // --- 8. VOICE RECOGNITION ---
  let recognition = null;
  let isListening = false;
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let resultMatchCounts = [];
    
    recognition.onstart = () => {
      isListening = true;
      resultMatchCounts = [];
      btnMic.classList.add('active');
      micIconOn.style.display = 'block';
      micIconOff.style.display = 'none';
      voiceStatus.classList.add('listening');
      voiceLabel.textContent = 'Listening to chants...';
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let newlyFinalTranscript = '';

      const reqExact = settings.sensitivity >= 0.8;
      const triggers = currentMantra.triggers;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const textChunk = event.results[i][0].transcript.toLowerCase();
        
        if (event.results[i].isFinal) {
          newlyFinalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
        
        // Count triggers in this specific chunk
        let countInChunk = 0;
        triggers.forEach(t => {
          if (!t) return;
          if (reqExact) {
            const regex = new RegExp(`\\b${t}\\b`, 'g');
            const matches = textChunk.match(regex);
            if (matches) countInChunk += matches.length;
          } else {
            let idx = textChunk.indexOf(t);
            while (idx !== -1) {
              countInChunk++;
              idx = textChunk.indexOf(t, idx + t.length);
            }
          }
        });
        
        const previouslyAdded = resultMatchCounts[i] || 0;
        if (countInChunk > previouslyAdded) {
          const newMatches = countInChunk - previouslyAdded;
          resultMatchCounts[i] = countInChunk;
          
          voiceStatus.classList.add('recognized');
          setTimeout(() => voiceStatus.classList.remove('recognized'), 500);
          for (let k = 0; k < newMatches; k++) {
            incrementCount();
          }
        }
      }

      transcriptPreview.textContent = (newlyFinalTranscript + interimTranscript).trim() || '...';
    };

    recognition.onerror = (e) => {
      console.error('Speech Recognition Error', e);
      if (e.error === 'not-allowed') {
        showToast('Microphone access denied.');
        stopListening();
      }
    };

    recognition.onend = () => {
      // Auto restart if intended
      if (isListening) {
        try { recognition.start(); } catch(e){}
      }
    };
  } else {
    btnMic.style.opacity = '0.5';
    btnMic.addEventListener('click', () => showToast('Voice recognition not supported in this browser.'));
  }

  function startListening() {
    if (!recognition) return;
    recognition.lang = settings.lang;
    try {
      recognition.start();
    } catch(e) {}
  }

  function stopListening() {
    if (!recognition) return;
    isListening = false;
    btnMic.classList.remove('active');
    micIconOn.style.display = 'none';
    micIconOff.style.display = 'block';
    voiceStatus.classList.remove('listening', 'recognized');
    voiceLabel.textContent = 'Tap mic to start';
    transcriptPreview.textContent = '';
    recognition.stop();
  }

  btnMic.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  // --- 9. MODALS & FORMS ---
  function openModal(el) { 
    el.classList.add('active'); 
    document.body.style.overflow = 'hidden'; // Lock background scrolling
  }
  function closeModal(el) { 
    el.classList.remove('active'); 
    document.body.style.overflow = ''; // Restore background scrolling
  }

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
    modal.querySelector('.modal-handle').addEventListener('click', () => closeModal(modal));
  });

  // Select Mantra
  btnSelectMantra.addEventListener('click', () => {
    renderModalMantraList();
    openModal(modalSelect);
  });

  function renderModalMantraList() {
    modalMantraList.innerHTML = mantras.map(m => `
      <div class="modal-mantra-item ${m.id === currentMantra.id ? 'selected' : ''}" data-id="${m.id}">
        <div class="mmi-info">
          <div style="font-weight: 600">${m.name}</div>
          <div style="font-size: 13px; color: var(--text-secondary)">${m.deity}</div>
        </div>
        ${m.id === currentMantra.id ? '✓' : ''}
      </div>
    `).join('');

    modalMantraList.querySelectorAll('.modal-mantra-item').forEach(el => {
      el.addEventListener('click', () => {
        const selected = mantras.find(m => m.id === el.dataset.id);
        if (selected) loadMantra(selected);
        closeModal(modalSelect);
      });
    });
  }

  document.getElementById('btn-add-mantra').addEventListener('click', () => {
    openModal(modalAdd);
  });
  
  document.getElementById('btn-cancel-mantra').addEventListener('click', () => {
    closeModal(modalAdd);
  });

  btnCancelTriggers.addEventListener('click', () => closeModal(modalEditTriggers));

  btnEditTriggers.addEventListener('click', () => {
    inputEditTriggers.value = currentMantra.triggers.join(', ');
    openModal(modalEditTriggers);
  });

  formEditTriggers.addEventListener('submit', (e) => {
    e.preventDefault();
    const words = inputEditTriggers.value.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    if (words.length > 0) {
      currentMantra.triggers = words;
      activeMantraTriggers.textContent = words.join(', ');
      // Upate in mantras array and save
      const idx = mantras.findIndex(m => m.id === currentMantra.id);
      if (idx !== -1) mantras[idx] = currentMantra;
      localStorage.setItem('mantraz_mantras', JSON.stringify(mantras));
      showToast('Voice triggers updated');
      closeModal(modalEditTriggers);
    } else {
      showToast('Please enter at least one trigger word');
    }
  });

  document.getElementById('mantra-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('form-name').value;
    const text = document.getElementById('form-text').value;
    const deity = document.getElementById('form-deity').value;
    const lang = document.getElementById('form-lang').value;
    const target = document.getElementById('form-target').value;
    const words = document.getElementById('form-words').value;

    const newMantra = {
      id: Date.now().toString(),
      name, text, deity, lang,
      target: parseInt(target) || 108,
      triggers: words.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0)
    };

    mantras.push(newMantra);
    localStorage.setItem('mantraz_mantras', JSON.stringify(mantras));
    renderMantraLibrary();
    closeModal(modalAdd);
    loadMantra(newMantra);
    e.target.reset();
    showToast('Custom Mantra Added!');
  });

  // Complete Session
  btnComplete.addEventListener('click', () => {
    if (count === 0) {
      showToast("Session hasn't started yet.");
      return;
    }
    document.getElementById('complete-subtitle').textContent = currentMantra.name;
    document.getElementById('complete-count').textContent = count;
    document.getElementById('complete-malas').textContent = malas;
    const mins = Math.floor(sessionDuration / 60);
    document.getElementById('complete-duration').textContent = mins;
    openModal(modalComplete);
  });

  document.getElementById('btn-continue-session').addEventListener('click', () => {
    closeModal(modalComplete);
  });

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
    renderHistory();
    closeModal(modalComplete);
    resetSession();
    showToast('Session Saved successfully.');
    // go to history
    navBtns[2].click();
  });

  // --- 10. LIBRARY & HISTORY RENDERING ---
  function renderMantraLibrary() {
    mantraListEl.innerHTML = '';
    mantras.forEach(m => {
      const card = document.createElement('div');
      card.className = 'mantra-card';
      card.innerHTML = `
        <div class="mantra-card-icon">🕉️</div>
        <div class="mantra-card-content">
          <div class="mantra-card-title">${m.name}</div>
          <div class="mantra-card-desc">${m.text.substring(0, 40)}...</div>
          <div class="mantra-tag">${m.deity}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        loadMantra(m);
        navBtns[0].click(); // go home
      });
      mantraListEl.appendChild(card);
    });
  }

  function renderHistory() {
    document.getElementById('total-sessions').textContent = history.length;
    const totalCount = history.reduce((sum, s) => sum + s.count, 0);
    document.getElementById('total-count').textContent = totalCount >= 1000 ? (totalCount/1000).toFixed(1)+'k' : totalCount;
    
    // Calculate streak (simple version based on consecutive days)
    document.getElementById('current-streak').textContent = calculateStreak();

    sessionListEl.innerHTML = history.slice(0, 10).map(s => `
      <div class="session-item">
        <div class="session-item-left">
          <div class="session-item-title">${s.mantraName}</div>
          <div class="session-item-date">${new Date(s.date).toLocaleDateString()}</div>
        </div>
        <div class="session-item-right">
          <div class="session-item-count">${s.count}</div>
          <div class="session-item-duration">${Math.floor(s.durationSeconds/60)}m ${s.durationSeconds%60}s</div>
        </div>
      </div>
    `).join('');
  }

  function calculateStreak() {
    if (history.length === 0) return 0;
    // Just a placeholder for actual streak logic
    let streak = 0;
    const today = new Date().setHours(0,0,0,0);
    const dates = [...new Set(history.map(h => new Date(h.date).setHours(0,0,0,0)))].sort((a,b)=>b-a);
    if (dates[0] < today - 86400000) return 0; // Missed yesterday
    
    let current = dates[0] === today ? today : dates[0];
    streak = 1;
    for(let i=1; i<dates.length; i++) {
        if (dates[i-1] - dates[i] === 86400000) streak++;
        else break;
    }
    return streak;
  }

  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history?')) {
      history = [];
      localStorage.setItem('mantraz_history', JSON.stringify([]));
      renderHistory();
      showToast('History cleared.');
    }
  });

  // --- 11. SETTINGS EVENTS ---
  toggleDarkMode.addEventListener('change', (e) => {
    settings.darkMode = e.target.checked;
    applyTheme(settings.darkMode);
    saveSettings();
  });
  selectMalaSize.addEventListener('change', (e) => {
    settings.malaSize = parseInt(e.target.value);
    saveSettings();
    updateCounter();
  });
  sliderSensitivity.addEventListener('input', (e) => {
    settings.sensitivity = e.target.value;
    labelSensitivity.textContent = e.target.value;
  });
  sliderSensitivity.addEventListener('change', () => saveSettings());
  selectLang.addEventListener('change', (e) => {
    settings.lang = e.target.value;
    if (recognition) recognition.lang = settings.lang;
    saveSettings();
  });
  toggleVibration.addEventListener('change', (e) => { settings.vibration = e.target.checked; saveSettings(); });
  toggleSound.addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });

  document.getElementById('btn-clear-all-data').addEventListener('click', () => {
    if (confirm('WARNING: This will delete ALL mantras, history and reset settings. Continue?')) {
      localStorage.clear();
      location.reload();
    }
  });

  document.getElementById('btn-export-data').addEventListener('click', () => {
    const data = { settings, mantras, history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mantraz-backup.json';
    a.click();
  });

  // --- 12. UTILS ---
  const toast = document.getElementById('toast');
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // --- START ---
  init();
});
