/* eslint-disable no-undef */
(function () {
  "use strict";

  const quizState = {
    allQuestions: [],
    currentDifficulty: null,
    currentQuestion: null,
    loaded: false,
    attemptsLeft: 3,
    maxAttempts: 3,
    currentView: 'start', // 'start' | 'question' | 'dashboard'
  };

  // Statistics tracking system with robust cross-tab synchronization
  const statsManager = {
    storageKey: 'beerCertStats',
    timestampKey: 'beerCertStatsTimestamp',
    cache: null,
    lastUpdate: 0,
    pollInterval: null,
    
    init() {
      // Load initial stats
      this.loadStats();
      
      // Multiple sync mechanisms for maximum compatibility
      
      // 1. Storage event listener (works in most cases)
      window.addEventListener('storage', (e) => {
        if (e.key === this.storageKey) {
          this.loadStats();
          console.log('📊 Stats updated via storage event:', this.cache);
        }
      });
      
      // 2. Polling fallback for browsers/environments where storage events don't work
      this.pollInterval = setInterval(() => {
        this.checkForUpdates();
      }, 2000); // Check every 2 seconds
      
      // 3. Page visibility change sync (when user switches tabs)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForUpdates();
        }
      });
      
      // 4. Focus event sync (when user clicks on tab)
      window.addEventListener('focus', () => {
        this.checkForUpdates();
      });
    },
    
    checkForUpdates() {
      try {
        const timestampStr = localStorage.getItem(this.timestampKey);
        const timestamp = timestampStr ? parseInt(timestampStr) : 0;
        
        if (timestamp > this.lastUpdate) {
          this.loadStats();
          console.log('📊 Stats updated via polling:', this.cache);
        }
      } catch (e) {
        console.warn('📊 Failed to check for updates');
      }
    },
    
    loadStats() {
      try {
        const data = localStorage.getItem(this.storageKey);
        const timestamp = localStorage.getItem(this.timestampKey);
        
        this.cache = data ? JSON.parse(data) : { totalAttempts: 0, beersEarned: 0, fails: 0 };
        this.lastUpdate = timestamp ? parseInt(timestamp) : Date.now();
        
        // Force UI update if dashboard is visible
        if (quizState.currentView === 'dashboard') {
          setTimeout(() => this.refreshDashboard(), 100);
        }
      } catch (e) {
        console.warn('📊 Failed to load stats, using defaults');
        this.cache = { totalAttempts: 0, beersEarned: 0, fails: 0 };
        this.lastUpdate = Date.now();
      }
    },
    
    refreshDashboard() {
      const existingChart = document.getElementById('session-chart');
      if (existingChart) {
        generateChart(this.cache);
        
        // Update stat numbers
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 3) {
          statNumbers[0].textContent = this.cache.totalAttempts;
          statNumbers[1].textContent = this.cache.beersEarned;
          statNumbers[2].textContent = this.cache.fails;
        }
      }
    },
    
    getStats() {
      // Always check for fresh data when requested
      this.checkForUpdates();
      if (!this.cache) this.loadStats();
      return { ...this.cache };
    },
    
    saveStats(stats) {
      const timestamp = Date.now();
      
      this.cache = { ...stats };
      this.lastUpdate = timestamp;
      
      // Save data and timestamp
      localStorage.setItem(this.storageKey, JSON.stringify(stats));
      localStorage.setItem(this.timestampKey, timestamp.toString());
      
      console.log('📊 Stats saved:', this.cache, 'at', new Date(timestamp).toLocaleTimeString());
      
      // Trigger storage event manually for better compatibility
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: this.storageKey,
          newValue: JSON.stringify(stats),
          oldValue: null,
          url: window.location.href,
          storageArea: localStorage
        }));
      } catch (e) {
        console.warn('📊 Could not dispatch storage event');
      }
    },
    
    incrementAttempts() {
      const currentStats = this.getStats();
      const newStats = { ...currentStats };
      newStats.totalAttempts++;
      this.saveStats(newStats);
      console.log('📊 Incremented attempts:', newStats.totalAttempts);
    },
    
    incrementBeers() {
      const currentStats = this.getStats();
      const newStats = { ...currentStats };
      newStats.beersEarned++;
      this.saveStats(newStats);
      console.log('📊 Incremented beers:', newStats.beersEarned);
    },
    
    incrementFails() {
      const currentStats = this.getStats();
      const newStats = { ...currentStats };
      newStats.fails++;
      this.saveStats(newStats);
      console.log('📊 Incremented fails:', newStats.fails);
    },
    
    reset() {
      const resetStats = { totalAttempts: 0, beersEarned: 0, fails: 0 };
      this.saveStats(resetStats);
      console.log('📊 Stats reset');
    },
    
    destroy() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
    }
  };

  const Difficulty = {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "difficult",
  };

  function canonicalizeDifficulty(raw) {
    const v = String(raw || '').toLowerCase().trim();
    // Common and fuzzy variants
    if (['e', 'easy', 'einfach', 'leicht', 'beginner', 'basic', 'low', '1'].includes(v)) return Difficulty.EASY;
    if (['m', 'med', 'medium', 'mittel', 'normal', 'intermediate', '2'].includes(v)) return Difficulty.MEDIUM;
    if (['h', 'hard', 'difficult', 'difficul', 'diccifult', 'schwierig', 'hart', 'advanced', '3'].includes(v)) return Difficulty.HARD;
    if (v.startsWith('eas')) return Difficulty.EASY;
    if (v.startsWith('med')) return Difficulty.MEDIUM;
    if (v.startsWith('dif') || v.startsWith('har') || v.startsWith('schw')) return Difficulty.HARD;
    return '';
  }

  function normalizeRowKeys(row) {
    const normalized = {};
    Object.keys(row).forEach((key) => {
      const norm = String(key)
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      normalized[norm] = row[key];
    });
    return normalized;
  }

  function pickBySynonyms(obj, synonyms) {
    for (const syn of synonyms) {
      const exact = syn.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(obj, exact)) return obj[exact];
      // also try contains (for cases like "difficulty level")
      const key = Object.keys(obj).find(k => k.includes(exact));
      if (key) return obj[key];
    }
    return '';
  }

  function showToast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function createStartView() {
    const container = document.createElement('section');
    container.className = 'section';
    container.innerHTML = `
      <div>
        <div class="start-header">
          <p class="lead" data-tippy-content="A light-hearted teaser for the real thing: bSI Professional Certification.">Welcome to BeerCert — Summit Special</p>
          <button id="dashboard-btn" class="dashboard-icon" data-tippy-content="Statistics">📊</button>
        </div>
        <h2 class="heading">Choose your difficulty</h2>
        <div class="difficulty" role="list">
          <button class="chip" data-diff="${Difficulty.EASY}" aria-label="Beginner" data-tippy-content="Easy: like lager in a sunny beer garden."><span>Easy</span></button>
          <button class="chip" data-diff="${Difficulty.MEDIUM}" aria-label="Intermediate" data-tippy-content="Medium: like blind-tasting an IPA."><span>Medium</span></button>
          <button class="chip" data-diff="${Difficulty.HARD}" aria-label="Hard" data-tippy-content="Difficult: like reciting the Purity Law backwards."><span>Difficult</span></button>
        </div>
        <div class="spacer"></div>
        <p class="hint">Questions are loaded from <code>questions.xlsx</code>. The aim: get into the spirit of digitizing the built environment with openBIM.</p>
        <p class="hint" id="loadStatus"></p>
      </div>
    `;
    const status = container.querySelector('#loadStatus');
    const chips = Array.from(container.querySelectorAll('.chip'));
    if (!quizState.loaded) {
      chips.forEach((b) => (b.disabled = true));
      status.textContent = 'Loading questions…';
    }
    container.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        quizState.currentDifficulty = btn.dataset.diff;
        quizState.attemptsLeft = quizState.maxAttempts; // Reset attempts
        statsManager.incrementAttempts(); // Track new attempt (non-blocking)
        pickAndShowQuestion();
      });
    });
    
    // Dashboard button handler
    const dashboardBtn = container.querySelector('#dashboard-btn');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        quizState.currentView = 'dashboard';
        showDashboard();
      });
    }
    
    return container;
  }

  function createQuestionView(q) {
    const container = document.createElement('section');
    container.className = 'section';
    const answers = shuffle([q.correct, ...q.incorrect]);
    container.innerHTML = `
      <div>
        <div class="question-header">
          <div class="inline">
            <span class="lead">Difficulty:</span>
            <strong class="difficulty-badge">${labelDifficulty(quizState.currentDifficulty)}</strong>
          </div>
          <div class="attempts-counter">
            <span class="attempts-label">Attempts remaining:</span>
            <span class="attempts-count">${quizState.attemptsLeft}</span>
          </div>
        </div>
        <h2 class="heading" data-tippy-content="You got this. Probably.">${escapeHtml(q.question)}</h2>
        <div class="choices"></div>
        <div class="divider"></div>
        <div class="question-footer">
          <button id="again" data-tippy-content="Again? Sure, thirst never ends.">Back to selection</button>
          <span class="hint">Hint: Answers come with no warranty, much like craft beer pricing.</span>
        </div>
      </div>
    `;
    const choices = container.querySelector('.choices');
    answers.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.type = 'button';
      btn.setAttribute('data-answer', a);
      btn.innerHTML = `<span>${escapeHtml(a)}</span>`;
      btn.addEventListener('click', () => handleAnswer(btn, q));
      choices.appendChild(btn);
    });

    container.querySelector('#again').addEventListener('click', () => render(createStartView()));
    return container;
  }

  function labelDifficulty(d) {
    switch (d) {
      case Difficulty.EASY: return 'Easy';
      case Difficulty.MEDIUM: return 'Medium';
      case Difficulty.HARD: return 'Difficult';
      default: return '';
    }
  }

  function handleAnswer(btn, q) {
    const all = Array.from(document.querySelectorAll('.choice'));
    all.forEach(b => b.disabled = true);
    const chosen = btn.getAttribute('data-answer');
    const isCorrect = chosen === q.correct;
    
    if (isCorrect) {
      btn.classList.add('correct');
      showResultOverlay('correct');
      triggerBeerCheersAnimation();
      triggerConfetti();
      statsManager.incrementBeers(); // Track successful beer earning (non-blocking)
      showToast('Correct! You may now say "win" and fetch a beer.');
      setTimeout(() => {
        render(createStartView());
      }, 1100);
    } else {
      btn.classList.add('wrong');
      const correctBtn = all.find(b => b.getAttribute('data-answer') === q.correct);
      if (correctBtn) correctBtn.classList.add('correct');
      showResultOverlay('wrong');
      
      quizState.attemptsLeft--;
      
      if (quizState.attemptsLeft > 0) {
        showToast(`Wrong answer. ${quizState.attemptsLeft} attempt(s) remaining. New question coming!`);
        setTimeout(() => {
          // Show new question instead of re-enabling same choices
          pickAndShowQuestion();
        }, 1500);
      } else {
        statsManager.incrementFails(); // Track final failure (non-blocking)
        showToast('All attempts used. Time to practice more before enjoying that cold drink!');
        showFinalFailAnimation();
        setTimeout(() => render(createStartView()), 2500);
      }
    }
  }

  function showResultOverlay(type) {
    const overlay = document.getElementById('result-overlay');
    if (!overlay) return;
    // Clear previous classes
    overlay.className = 'result-overlay';
    // Add new class to trigger animation
    overlay.classList.add(type);
    // Auto-remove after animation
    setTimeout(() => {
      overlay.className = 'result-overlay';
    }, 800);
  }

  function triggerBeerCheersAnimation() {
    // Create floating beer cheers animation
    const cheers = document.createElement('div');
    cheers.className = 'beer-cheers-animation';
    cheers.innerHTML = '🍻';
    document.body.appendChild(cheers);
    
    setTimeout(() => {
      if (cheers.parentNode) {
        cheers.parentNode.removeChild(cheers);
      }
    }, 2000);
  }

  function showFinalFailAnimation() {
    // Professional "practice more" animation
    const failMsg = document.createElement('div');
    failMsg.className = 'final-fail-animation';
    failMsg.innerHTML = `
      <div class="fail-content">
        <div class="fail-icon">📚</div>
        <h3>Time to Practice!</h3>
        <p>Please line up again and study the materials<br>before enjoying your well-earned refreshment.</p>
      </div>
    `;
    document.body.appendChild(failMsg);
    
    setTimeout(() => {
      if (failMsg.parentNode) {
        failMsg.parentNode.removeChild(failMsg);
      }
    }, 2000);
  }

  function triggerConfetti() {
    if (typeof confetti !== 'function') return;
    // Use theme-aware colors
    const style = getComputedStyle(document.documentElement);
    const brand = style.getPropertyValue('--brand').trim();
    const accent = style.getPropertyValue('--accent').trim();
    // Bigger, more prominent confetti burst
    confetti({
      particleCount: 200,
      spread: 85,
      origin: { y: 0.5 },
      scalar: 1.5,
      shapes: ['circle', 'square'],
      colors: [brand, accent, '#ffffff', '#ffd700']
    });
    // Second burst for extra effect
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.7 },
        scalar: 1.2,
        colors: [brand, accent, '#ffffff']
      });
    }, 200);
  }

  function showDashboard() {
    const container = document.createElement('section');
    container.className = 'section dashboard';
    const stats = statsManager.getStats();
    
    container.innerHTML = `
      <div>
        <div class="dashboard-header">
          <h2 class="heading">📊 Session Dashboard</h2>
          <div class="dashboard-actions">
            <button id="reset-stats" class="reset-btn" data-tippy-content="Reset all statistics">🔄 Reset</button>
            <button id="back-to-quiz" data-tippy-content="Back to the quiz">← Back</button>
          </div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card total">
            <div class="stat-icon">🎯</div>
            <div class="stat-content">
              <div class="stat-number">${stats.totalAttempts}</div>
              <div class="stat-label">Total Attempts</div>
            </div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-icon">🍺</div>
            <div class="stat-content">
              <div class="stat-number">${stats.beersEarned}</div>
              <div class="stat-label">Beers Earned</div>
            </div>
          </div>
          
          <div class="stat-card fail">
            <div class="stat-icon">😢</div>
            <div class="stat-content">
              <div class="stat-number">${stats.fails}</div>
              <div class="stat-label">Practice Needed</div>
            </div>
          </div>
        </div>
        
        <div class="chart-container">
          <h3 class="chart-title">Session Histogram</h3>
          <div class="chart" id="session-chart"></div>
        </div>
      </div>
    `;
    
    // Event handlers
    container.querySelector('#back-to-quiz').addEventListener('click', () => {
      quizState.currentView = 'start';
      render(createStartView());
    });
    
    container.querySelector('#reset-stats').addEventListener('click', () => {
      if (confirm('Reset all session statistics? This cannot be undone.')) {
        statsManager.reset();
        showDashboard(); // Refresh dashboard
        showToast('Statistics reset successfully!');
      }
    });
    
    // Generate chart after DOM insertion
    setTimeout(() => {
      generateChart(stats);
    }, 10);
    
    render(container);
  }

  function generateChart(stats) {
    const chartEl = document.getElementById('session-chart');
    if (!chartEl) return;
    
    const total = Math.max(stats.totalAttempts, 1); // Avoid division by zero
    const beerPercent = (stats.beersEarned / total) * 100;
    const failPercent = (stats.fails / total) * 100;
    const pendingPercent = Math.max(0, ((total - stats.beersEarned - stats.fails) / total) * 100);
    
    chartEl.innerHTML = `
      <div class="chart-bars">
        <div class="chart-bar beer" style="height: ${Math.max(5, beerPercent)}%">
          <div class="bar-label">🍺</div>
          <div class="bar-value">${stats.beersEarned}</div>
        </div>
        <div class="chart-bar fail" style="height: ${Math.max(5, failPercent)}%">
          <div class="bar-label">😢</div>
          <div class="bar-value">${stats.fails}</div>
        </div>
        <div class="chart-bar pending" style="height: ${Math.max(5, pendingPercent)}%">
          <div class="bar-label">⏳</div>
          <div class="bar-value">${total - stats.beersEarned - stats.fails}</div>
        </div>
      </div>
      <div class="chart-legend">
        <div class="legend-item beer">🍺 Beers Earned</div>
        <div class="legend-item fail">😢 Practice Needed</div>
        <div class="legend-item pending">⏳ In Progress</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function loadQuestionsFromExcel() {
    const resp = await fetch('questions.xlsx', { cache: 'no-store' });
    if (!resp.ok) throw new Error('Failed to load questions.xlsx');
    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    // Expected columns: difficulty | category | question | correct | incorrect1 | incorrect2 | incorrect3
    const normalized = rows.map((rawRow) => {
      const row = normalizeRowKeys(rawRow);
      const diffRaw = pickBySynonyms(row, ['difficulty level', 'difficulty', 'schwierigkeit']);
      const mapped = canonicalizeDifficulty(diffRaw);
      const question = pickBySynonyms(row, ['question', 'frage']);
      const correct = pickBySynonyms(row, ['correct answer', 'correct', 'richtig']);

      // Collect all incorrect values by any header that contains 'incorrect'
      const incorrect = Object.keys(row)
        .filter(k => k.includes('incorrect'))
        .map(k => String(row[k] || '').trim())
        .filter(v => v.length > 0);

      return {
        difficulty: mapped,
        category: String(pickBySynonyms(row, ['category', 'kategorie']) || '').trim(),
        question: String(question || '').trim(),
        correct: String(correct || '').trim(),
        incorrect: Array.from(new Set(incorrect)),
      };
    }).filter(q => q.question && q.correct && q.incorrect.length > 0);
    quizState.allQuestions = normalized;
    // Debug counts per level for better UX when none found
    const counts = {
      [Difficulty.EASY]: normalized.filter(q => q.difficulty === Difficulty.EASY).length,
      [Difficulty.MEDIUM]: normalized.filter(q => q.difficulty === Difficulty.MEDIUM).length,
      [Difficulty.HARD]: normalized.filter(q => q.difficulty === Difficulty.HARD).length,
      unknown: normalized.filter(q => !q.difficulty).length,
    };
    console.log('BeerCert question stats', counts);
  }

  function pickAndShowQuestion() {
    const d = quizState.currentDifficulty;
    const pool = quizState.allQuestions.filter(q => {
      const qd = q.difficulty || '';
      if (d === Difficulty.HARD) return qd === Difficulty.HARD;
      if (d === Difficulty.MEDIUM) return qd === Difficulty.MEDIUM;
      return qd === Difficulty.EASY;
    });
    if (pool.length === 0) {
      const counts = {
        easy: quizState.allQuestions.filter(q => q.difficulty === Difficulty.EASY).length,
        medium: quizState.allQuestions.filter(q => q.difficulty === Difficulty.MEDIUM).length,
        difficult: quizState.allQuestions.filter(q => q.difficulty === Difficulty.HARD).length,
      };
      showToast(`No questions for this difficulty. Found: easy ${counts.easy}, medium ${counts.medium}, difficult ${counts.difficult}.`);
      render(createStartView());
      return;
    }
    const q = pool[Math.floor(Math.random() * pool.length)];
    quizState.currentQuestion = q;
    render(createQuestionView(q));
  }

  function render(node) {
    const root = document.getElementById('view-container');
    root.innerHTML = '';
    root.appendChild(node);
    if (window.tippy) tippy('[data-tippy-content]', { theme: 'light', delay: [80, 0] });
  }

  async function init() {
    try {
      // Clear any old cache/service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister();
          }
        });
      }
      
      console.log('🍺 BeerCert initializing - version:', Date.now());
      
      applyThemeFromPrefs();
      statsManager.init();
      render(createStartView());
      await loadQuestionsFromExcel();
      quizState.loaded = true;
      showToast('Questions loaded. No foam, just content.');
      // Re-render to enable buttons and show status
      render(createStartView());
    } catch (e) {
      console.error(e);
      render(errorView(e));
    }
  }

  function applyThemeFromPrefs() {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('theme');
    const stored = localStorage.getItem('beerCertTheme');
    const t = param || stored || 'bsi';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('beerCertTheme', t);
  }

  function errorView(e) {
    const container = document.createElement('section');
    container.className = 'section';
    container.innerHTML = `
      <h2 class="heading">Load error</h2>
      <p class="lead">${escapeHtml(e.message || 'Unknown error')}.</p>
      <button id="retry">Try again</button>
    `;
    container.querySelector('#retry').addEventListener('click', init);
    return container;
  }

  window.addEventListener('DOMContentLoaded', init);
})();


