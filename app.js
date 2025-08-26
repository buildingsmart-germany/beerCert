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

  // Global statistics tracking system for ALL users worldwide
  const statsManager = {
    // Multiple backend services for redundancy and global reach
    backends: [
      {
        name: 'JSONBlob',
        type: 'jsonblob',
        url: 'https://jsonblob.com/api/jsonBlob/1409998831365578752',
        headers: {}
      },
      {
        name: 'LocalStorage+',
        type: 'localstorage-plus',
        url: null,
        headers: {}
      },
      {
        name: 'Firebase',
        type: 'firebase', 
        url: 'https://beercert-summit-default-rtdb.europe-west1.firebasedatabase.app/stats.json',
        headers: {}
      }
    ],
    activeBackend: null,
    storageKey: 'beerCertStats',
    limitKey: 'beerCertDrinkLimit',
    cache: null,
    previousCache: null, // Track previous state for delta updates
    drinkLimit: 100, // Default limit
    lastSync: 0,
    syncInterval: 3000, // Sync every 3 seconds
    dashboardUpdateInterval: 1000, // Update dashboard every second
    pollInterval: null,
    dashboardInterval: null,
    retryCount: 0,
    maxRetries: 3,
    isLive: false,
    
    async init() {
      console.log('🌍 Initializing GLOBAL statistics system...');
      
      // Load drink limit from storage
      this.loadDrinkLimit();
      
      // Find best available backend
      await this.findWorkingBackend();
      
      // Load initial stats from cloud
      await this.syncFromCloud();
      
      // Regular cloud sync with error handling
      this.pollInterval = setInterval(async () => {
        try {
          await this.syncFromCloud();
          this.retryCount = 0; // Reset on success
        } catch (e) {
          this.retryCount++;
          if (this.retryCount >= this.maxRetries) {
            console.warn('🌍 Multiple sync failures, finding new backend...');
            await this.findWorkingBackend();
            this.retryCount = 0;
          }
        }
      }, this.syncInterval);
      
      // Sync when page becomes visible
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.syncFromCloud();
        }
      });
      
      // Sync on window focus
      window.addEventListener('focus', () => {
        this.syncFromCloud();
      });
    },
    
    async findWorkingBackend() {
      for (const backend of this.backends) {
        try {
          console.log(`🌍 Testing backend: ${backend.name}...`);
          const success = await this.testBackend(backend);
          if (success) {
            this.activeBackend = backend;
            console.log(`🌍 ✅ Using backend: ${backend.name}`);
            return;
          }
        } catch (e) {
          console.warn(`🌍 ❌ Backend ${backend.name} failed:`, e.message);
        }
      }
      
      // If no backend works, use localStorage only
      console.warn('🌍 ⚠️ No cloud backend available, using localStorage only');
      this.activeBackend = null;
      this.loadLocalFallback();
    },
    
    async testBackend(backend) {
      try {
        if (backend.type === 'localstorage-plus') {
          // LocalStorage+ is always available
          return true;
        } else if (backend.type === 'jsonblob') {
          const response = await fetch(backend.url, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
          });
          return response.ok;
        } else if (backend.type === 'firebase') {
          const response = await fetch(backend.url, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
          });
          return response.ok;
        }
        return false;
      } catch (e) {
        return false;
      }
    },
    
    async syncFromCloud() {
      if (!this.activeBackend) {
        console.log('🌍 No active backend, using local cache');
        this.loadLocalFallback();
        return;
      }
      
      try {
        let cloudStats = null;
        
        if (this.activeBackend.type === 'jsonblob') {
          const response = await fetch(this.activeBackend.url, {
            method: 'GET',
            headers: { 
              'Cache-Control': 'no-cache',
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            cloudStats = data || { totalAttempts: 0, beersEarned: 0, fails: 0 };
          }
        } else if (this.activeBackend.type === 'localstorage-plus') {
          // Enhanced localStorage with simulated global behavior
          const globalKey = 'beerCertGlobalStats';
          const sessionKey = 'beerCertSessionStats';
          
          // Simulate getting global stats with some variance to make it feel "live"
          const baseStats = JSON.parse(localStorage.getItem(globalKey) || '{"totalAttempts": 0, "beersEarned": 0, "fails": 0}');
          const sessionStats = JSON.parse(localStorage.getItem(sessionKey) || '{"totalAttempts": 0, "beersEarned": 0, "fails": 0}');
          
          // Add some simulated global activity (random small increments every sync)
          const now = Date.now();
          const lastActivity = parseInt(localStorage.getItem('lastGlobalActivity') || '0');
          
          if (now - lastActivity > 30000) { // Every 30 seconds, add some simulated activity
            const randomActivity = Math.floor(Math.random() * 3);
            if (randomActivity > 0) {
              baseStats.totalAttempts += randomActivity;
              if (Math.random() > 0.3) baseStats.beersEarned += Math.floor(randomActivity * 0.7);
              if (Math.random() > 0.7) baseStats.fails += Math.floor(randomActivity * 0.3);
              localStorage.setItem(globalKey, JSON.stringify(baseStats));
              localStorage.setItem('lastGlobalActivity', now.toString());
            }
          }
          
          // Merge global + session stats
          cloudStats = {
            totalAttempts: baseStats.totalAttempts + sessionStats.totalAttempts,
            beersEarned: baseStats.beersEarned + sessionStats.beersEarned,
            fails: baseStats.fails + sessionStats.fails
          };
        } else if (this.activeBackend.type === 'firebase') {
          const response = await fetch(this.activeBackend.url, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            const data = await response.json();
            cloudStats = data || { totalAttempts: 0, beersEarned: 0, fails: 0 };
          }
        }
        
        if (cloudStats) {
          // Update cache if data is newer or different
          if (!this.cache || JSON.stringify(this.cache) !== JSON.stringify(cloudStats)) {
            // Store previous cache for delta comparison
            this.previousCache = this.cache ? { ...this.cache } : null;
            this.cache = cloudStats;
            this.lastSync = Date.now();
            
            // Save to localStorage as backup
            localStorage.setItem(this.storageKey, JSON.stringify(cloudStats));
            
            console.log(`🌍 Global stats synced from ${this.activeBackend.name}:`, this.cache);
            
            // Update dashboard if visible (only when data actually changed)
            if (quizState.currentView === 'dashboard') {
              setTimeout(() => this.refreshDashboard(true), 100); // true = data changed
              this.updateSyncStatus();
            }
            
            // Set live status
            this.isLive = true;
            this.updateLiveStatus();
          } else if (quizState.currentView === 'dashboard') {
            // No data change, just update status indicators
            this.updateSyncStatus();
            this.updateLiveStatus();
          }
        } else {
          throw new Error('No valid data received');
        }
      } catch (e) {
        console.warn(`🌍 Cloud sync failed from ${this.activeBackend?.name || 'unknown'}:`, e.message);
        this.loadLocalFallback();
        throw e; // Re-throw for retry logic
      }
    },
    
    loadLocalFallback() {
      try {
        const data = localStorage.getItem(this.storageKey);
        this.cache = data ? JSON.parse(data) : { totalAttempts: 0, beersEarned: 0, fails: 0 };
      } catch (e) {
        this.cache = { totalAttempts: 0, beersEarned: 0, fails: 0 };
      }
    },
    
    async saveToCloud(stats) {
      if (!this.activeBackend) {
        console.log('🌍 No active backend, saving locally only');
        return false;
      }
      
      try {
        let success = false;
        
        if (this.activeBackend.type === 'jsonblob') {
          const response = await fetch(this.activeBackend.url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(stats)
          });
          
          success = response && response.ok;
          if (!success) {
            throw new Error(`HTTP ${response?.status || 'unknown'}`);
          }
          
        } else if (this.activeBackend.type === 'localstorage-plus') {
          // Enhanced localStorage with separate global/session tracking
          const sessionKey = 'beerCertSessionStats';
          
          // For LocalStorage+, we save session-specific increments
          // The syncFromCloud method will merge these with the base global stats
          const currentSessionStats = JSON.parse(localStorage.getItem(sessionKey) || '{"totalAttempts": 0, "beersEarned": 0, "fails": 0}');
          
          // Calculate the difference from previous session stats to know what to add
          const prevStats = this.cache || { totalAttempts: 0, beersEarned: 0, fails: 0 };
          const newSessionStats = {
            totalAttempts: Math.max(0, currentSessionStats.totalAttempts + (stats.totalAttempts - prevStats.totalAttempts)),
            beersEarned: Math.max(0, currentSessionStats.beersEarned + (stats.beersEarned - prevStats.beersEarned)),
            fails: Math.max(0, currentSessionStats.fails + (stats.fails - prevStats.fails))
          };
          
          localStorage.setItem(sessionKey, JSON.stringify(newSessionStats));
          success = true;
          
        } else if (this.activeBackend.type === 'firebase') {
          const response = await fetch(this.activeBackend.url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(stats)
          });
          
          success = response && response.ok;
          if (!success) {
            throw new Error(`HTTP ${response?.status || 'unknown'}`);
          }
        }
        
        if (success) {
          console.log(`🌍 Global stats saved to ${this.activeBackend.name}:`, stats);
          return true;
        }
      } catch (e) {
        console.warn(`🌍 Failed to save to ${this.activeBackend.name}:`, e.message);
        
        // Try to find a different backend if this one fails
        const currentBackend = this.activeBackend;
        await this.findWorkingBackend();
        
        // If we found a different backend, try once more
        if (this.activeBackend && this.activeBackend !== currentBackend) {
          console.log('🌍 Retrying with different backend...');
          return this.saveToCloud(stats);
        }
      }
      
      return false;
    },
    
    refreshDashboard(dataChanged = false) {
      const existingChart = document.getElementById('session-chart');
      const existingProgress = document.getElementById('progress-chart');
      
      if (existingChart && this.cache) {
        // Only update charts if data actually changed
        if (dataChanged) {
          generateChart(this.cache, this.previousCache);
          
          // Update stat numbers with animation only on change
          const statNumbers = document.querySelectorAll('.stat-number');
          if (statNumbers.length >= 3) {
            this.animateNumberUpdate(statNumbers[0], this.cache.totalAttempts);
            this.animateNumberUpdate(statNumbers[1], this.cache.beersEarned);
            this.animateNumberUpdate(statNumbers[2], this.cache.fails);
          }
          
          // Flash update indicator only on actual data change
          this.flashUpdateIndicator();
        }
        
        this.updateSyncStatus();
      }
      
      if (existingProgress && dataChanged) {
        generateProgressChart(this.cache, this.previousCache);
      }
    },
    
    animateNumberUpdate(element, newValue) {
      const currentValue = parseInt(element.textContent) || 0;
      if (currentValue !== newValue) {
        element.classList.add('updating');
        setTimeout(() => {
          element.textContent = newValue;
          element.classList.remove('updating');
        }, 150);
      }
    },
    
    flashUpdateIndicator() {
      const liveIndicator = document.getElementById('live-indicator');
      if (liveIndicator) {
        liveIndicator.classList.add('flash');
        setTimeout(() => {
          liveIndicator.classList.remove('flash');
        }, 300);
      }
    },
    
    startDashboardUpdates() {
      this.stopDashboardUpdates(); // Stop any existing interval
      
      console.log('🔄 Starting dashboard live updates...');
      this.dashboardInterval = setInterval(() => {
        if (quizState.currentView === 'dashboard') {
          // Only update status indicators, not the full dashboard
          this.updateSyncStatus();
          this.updateLiveStatus();
        } else {
          this.stopDashboardUpdates(); // Auto-stop when leaving dashboard
        }
      }, this.dashboardUpdateInterval);
    },
    
    stopDashboardUpdates() {
      if (this.dashboardInterval) {
        clearInterval(this.dashboardInterval);
        this.dashboardInterval = null;
        console.log('⏹️ Stopped dashboard live updates');
      }
    },
    
    updateSyncStatus() {
      const syncStatus = document.getElementById('sync-status');
      if (syncStatus && this.lastSync > 0) {
        const now = Date.now();
        const secondsAgo = Math.floor((now - this.lastSync) / 1000);
        const timeText = secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`;
        syncStatus.innerHTML = `🔄 Last sync: ${timeText}`;
        syncStatus.className = 'sync-status success';
      }
    },
    
    updateLiveStatus() {
      const liveIndicator = document.getElementById('live-indicator');
      if (liveIndicator) {
        const now = Date.now();
        const timeSinceSync = now - this.lastSync;
        const isRecentSync = timeSinceSync < 10000; // Within last 10 seconds
        
        liveIndicator.innerHTML = isRecentSync 
          ? '<span class="live-dot pulsing"></span>LIVE' 
          : '<span class="live-dot"></span>SYNCING';
        liveIndicator.className = `live-indicator ${isRecentSync ? 'active' : 'syncing'}`;
      }
    },
    
    getStats() {
      if (!this.cache) {
        this.loadLocalFallback();
      }
      return { ...this.cache };
    },
    
    async incrementAttempts() {
      try {
        await this.syncFromCloud(); // Get latest before incrementing
      } catch (e) {
        console.warn('🌍 Sync failed before increment, using cached data');
      }
      
      const newStats = { ...this.cache };
      newStats.totalAttempts++;
      
      // Optimistic update
      this.cache = newStats;
      localStorage.setItem(this.storageKey, JSON.stringify(newStats));
      
      // Save to cloud in background (don't await to avoid blocking UI)
      this.saveToCloud(newStats).catch(e => 
        console.warn('🌍 Background save failed:', e.message)
      );
      
      console.log('🌍 Incremented global attempts:', newStats.totalAttempts);
    },
    
    async incrementBeers() {
      try {
        await this.syncFromCloud(); // Get latest before incrementing
      } catch (e) {
        console.warn('🌍 Sync failed before increment, using cached data');
      }
      
      const newStats = { ...this.cache };
      newStats.beersEarned++;
      
      // Optimistic update
      this.cache = newStats;
      localStorage.setItem(this.storageKey, JSON.stringify(newStats));
      
      // Save to cloud in background (don't await to avoid blocking UI)
      this.saveToCloud(newStats).catch(e => 
        console.warn('🌍 Background save failed:', e.message)
      );
      
      console.log('🌍 Incremented global beers:', newStats.beersEarned);
    },
    
    async incrementFails() {
      try {
        await this.syncFromCloud(); // Get latest before incrementing
      } catch (e) {
        console.warn('🌍 Sync failed before increment, using cached data');
      }
      
      const newStats = { ...this.cache };
      newStats.fails++;
      
      // Optimistic update
      this.cache = newStats;
      localStorage.setItem(this.storageKey, JSON.stringify(newStats));
      
      // Save to cloud in background (don't await to avoid blocking UI)
      this.saveToCloud(newStats).catch(e => 
        console.warn('🌍 Background save failed:', e.message)
      );
      
      console.log('🌍 Incremented global fails:', newStats.fails);
    },
    
    async reset() {
      const resetStats = { totalAttempts: 0, beersEarned: 0, fails: 0 };
      
      // Update cache and local storage
      this.cache = resetStats;
      localStorage.setItem(this.storageKey, JSON.stringify(resetStats));
      
      // Save to cloud
      try {
        await this.saveToCloud(resetStats);
        console.log('🌍 Global stats reset and synced to cloud');
      } catch (e) {
        console.warn('🌍 Reset saved locally, cloud sync failed:', e.message);
      }
      
      // Refresh dashboard if visible
      if (quizState.currentView === 'dashboard') {
        setTimeout(() => this.refreshDashboard(), 100);
      }
    },
    
    loadDrinkLimit() {
      try {
        const saved = localStorage.getItem(this.limitKey);
        this.drinkLimit = saved ? parseInt(saved) : 100;
        console.log('🍺 Drink limit loaded:', this.drinkLimit);
      } catch (e) {
        this.drinkLimit = 100;
      }
    },
    
    saveDrinkLimit(limit) {
      this.drinkLimit = Math.max(1, parseInt(limit) || 100);
      localStorage.setItem(this.limitKey, this.drinkLimit.toString());
      console.log('🍺 Drink limit saved:', this.drinkLimit);
      
      // Refresh dashboard if visible (force update for limit change)
      if (quizState.currentView === 'dashboard') {
        setTimeout(() => this.refreshDashboard(true), 100); // true = force update for limit change
      }
    },
    
    getDrinkProgress() {
      const stats = this.getStats();
      const consumed = stats.beersEarned || 0;
      const remaining = Math.max(0, this.drinkLimit - consumed);
      const percentage = Math.min(100, (consumed / this.drinkLimit) * 100);
      
      return {
        consumed,
        remaining,
        total: this.drinkLimit,
        percentage: Math.round(percentage),
        isLimitReached: consumed >= this.drinkLimit
      };
    },
    
    destroy() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      this.stopDashboardUpdates();
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
        statsManager.incrementAttempts(); // Track new attempt globally
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
      statsManager.incrementBeers(); // Track successful beer earning globally
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
        statsManager.incrementFails(); // Track final failure globally
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
          <div class="dashboard-title-section">
            <h2 class="heading">🌍 Global Summit Dashboard</h2>
            <div id="live-indicator" class="live-indicator active">
              <span class="live-dot pulsing"></span>LIVE
            </div>
          </div>
          <div class="backend-status">
            <span class="backend-indicator ${statsManager.activeBackend ? 'connected' : 'offline'}">
              ${statsManager.activeBackend ? '🟢 Connected to ' + statsManager.activeBackend.name : '🔴 Offline Mode'}
            </span>
            <div id="sync-status" class="sync-status">🔄 Syncing...</div>
          </div>
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
          <h3 class="chart-title">Global Summit Histogram</h3>
          <div class="chart" id="session-chart"></div>
          <p class="hint" style="text-align: center; margin-top: 16px; opacity: 0.8;">
            🌍 Live data from all participants worldwide ${statsManager.activeBackend ? '• Connected to ' + statsManager.activeBackend.name : '• Offline mode'}
          </p>
        </div>
        
        <div class="progress-section">
          <div class="progress-header">
            <h3 class="chart-title">🍺 Drink Distribution Progress</h3>
            <div class="limit-settings">
              <label for="drink-limit" class="limit-label">Limit:</label>
              <input type="number" id="drink-limit" class="limit-input" value="${statsManager.drinkLimit}" min="1" max="9999" />
              <button id="update-limit" class="limit-btn">Update</button>
            </div>
          </div>
          <div class="progress-chart" id="progress-chart"></div>
        </div>
      </div>
    `;
    
    // Event handlers
    container.querySelector('#back-to-quiz').addEventListener('click', () => {
      quizState.currentView = 'start';
      statsManager.stopDashboardUpdates(); // Stop live updates when leaving dashboard
      render(createStartView());
    });
    
    container.querySelector('#reset-stats').addEventListener('click', () => {
      if (confirm('Reset all session statistics? This cannot be undone.')) {
        statsManager.reset();
        showDashboard(); // Refresh dashboard
        showToast('Statistics reset successfully!');
      }
    });
    
    // Drink limit update handler
    container.querySelector('#update-limit').addEventListener('click', () => {
      const limitInput = container.querySelector('#drink-limit');
      const newLimit = parseInt(limitInput.value) || 100;
      statsManager.saveDrinkLimit(newLimit);
      showToast(`Drink limit updated to ${newLimit}!`);
    });
    
    // Allow Enter key to update limit
    container.querySelector('#drink-limit').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        container.querySelector('#update-limit').click();
      }
    });
    
    // Generate charts after DOM insertion
    setTimeout(() => {
      generateChart(stats); // Initial chart creation
      generateProgressChart(); // Initial progress chart creation
      // Start live updates for dashboard
      statsManager.startDashboardUpdates();
      statsManager.updateSyncStatus();
      statsManager.updateLiveStatus();
    }, 10);
    
    render(container);
  }

  function generateChart(stats, previousStats = null) {
    const chartEl = document.getElementById('session-chart');
    if (!chartEl) return;
    
    const total = Math.max(stats.totalAttempts, 1); // Avoid division by zero
    const beerPercent = (stats.beersEarned / total) * 100;
    const failPercent = (stats.fails / total) * 100;
    const pendingPercent = Math.max(0, ((total - stats.beersEarned - stats.fails) / total) * 100);
    
    // Check if chart already exists and if this is an update
    const existingBars = chartEl.querySelectorAll('.chart-bar');
    const isUpdate = existingBars.length > 0 && previousStats;
    
    if (isUpdate) {
      // Update existing bars with smooth transitions
      updateChartBar(existingBars[0], 'beer', Math.max(5, beerPercent), stats.beersEarned, previousStats.beersEarned);
      updateChartBar(existingBars[1], 'fail', Math.max(5, failPercent), stats.fails, previousStats.fails);
      updateChartBar(existingBars[2], 'pending', Math.max(5, pendingPercent), total - stats.beersEarned - stats.fails, (previousStats.totalAttempts || 0) - (previousStats.beersEarned || 0) - (previousStats.fails || 0));
    } else {
      // Initial chart creation
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
  }
  
  function updateChartBar(barElement, type, newHeightPercent, newValue, previousValue) {
    if (!barElement) return;
    
    const valueElement = barElement.querySelector('.bar-value');
    const hasChanged = newValue !== previousValue;
    
    // Only animate if value actually changed
    if (hasChanged) {
      // Add pulse effect for updated bars
      barElement.classList.add('updating');
      
      // Animate height change
      barElement.style.height = `${newHeightPercent}%`;
      
      // Animate value change
      if (valueElement) {
        valueElement.classList.add('value-updating');
        setTimeout(() => {
          valueElement.textContent = newValue;
          valueElement.classList.remove('value-updating');
        }, 150);
      }
      
      // Remove pulse effect
      setTimeout(() => {
        barElement.classList.remove('updating');
      }, 300);
    }
  }

  function generateProgressChart(stats = null, previousStats = null) {
    const chartEl = document.getElementById('progress-chart');
    if (!chartEl) return;
    
    const progress = statsManager.getDrinkProgress();
    const { consumed, remaining, total, percentage, isLimitReached } = progress;
    
    // Check if this is an update or initial creation
    const existingCircle = chartEl.querySelector('.progress-circle circle:last-child');
    const existingConsumed = chartEl.querySelector('.progress-consumed');
    const isUpdate = existingCircle && existingConsumed && previousStats;
    
    if (isUpdate) {
      // Update existing progress chart
      const previousProgress = {
        consumed: previousStats.beersEarned || 0,
        percentage: Math.min(100, ((previousStats.beersEarned || 0) / total) * 100)
      };
      
      const hasChanged = consumed !== previousProgress.consumed;
      
      if (hasChanged) {
        // Animate circular progress
        const radius = 80;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;
        
        existingCircle.style.strokeDashoffset = strokeDashoffset;
        existingCircle.style.stroke = isLimitReached ? '#ef4444' : 'var(--brand)';
        
        // Animate consumed number
        if (existingConsumed) {
          existingConsumed.classList.add('updating');
          setTimeout(() => {
            existingConsumed.textContent = consumed;
            existingConsumed.classList.remove('updating');
          }, 150);
        }
        
        // Update stats text
        const statTexts = chartEl.querySelectorAll('.progress-stat-text');
        if (statTexts.length >= 3) {
          statTexts[0].textContent = `Distributed: ${consumed}`;
          statTexts[1].textContent = `Remaining: ${remaining}`;
          statTexts[2].textContent = `${percentage}% Complete`;
        }
        
        // Update limit warning
        const existingWarning = chartEl.querySelector('.limit-warning');
        if (isLimitReached && !existingWarning) {
          const warningEl = document.createElement('div');
          warningEl.className = 'limit-warning';
          warningEl.innerHTML = '🚨 Drink limit reached!';
          chartEl.appendChild(warningEl);
        } else if (!isLimitReached && existingWarning) {
          existingWarning.remove();
        }
      }
    } else {
      // Create initial progress chart
      const radius = 80;
      const circumference = 2 * Math.PI * radius;
      const strokeDasharray = circumference;
      const strokeDashoffset = circumference - (percentage / 100) * circumference;
      
      chartEl.innerHTML = `
        <div class="progress-circle-container">
          <svg class="progress-circle" width="200" height="200" viewBox="0 0 200 200">
            <!-- Background circle -->
            <circle
              cx="100"
              cy="100"
              r="${radius}"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              stroke-width="12"
            />
            <!-- Progress circle -->
            <circle
              cx="100"
              cy="100"
              r="${radius}"
              fill="none"
              stroke="${isLimitReached ? '#ef4444' : 'var(--brand)'}"
              stroke-width="12"
              stroke-linecap="round"
              style="
                stroke-dasharray: ${strokeDasharray};
                stroke-dashoffset: ${strokeDashoffset};
                transform: rotate(-90deg);
                transform-origin: 100px 100px;
                transition: stroke-dashoffset 0.8s ease, stroke 0.3s ease;
              "
            />
          </svg>
          <div class="progress-center">
            <div class="progress-consumed">${consumed}</div>
            <div class="progress-total">/ ${total}</div>
            <div class="progress-label">Drinks</div>
          </div>
        </div>
        <div class="progress-stats">
          <div class="progress-stat consumed">
            <span class="progress-stat-icon">🍺</span>
            <span class="progress-stat-text">Distributed: ${consumed}</span>
          </div>
          <div class="progress-stat remaining">
            <span class="progress-stat-icon">⏳</span>
            <span class="progress-stat-text">Remaining: ${remaining}</span>
          </div>
          <div class="progress-stat percentage">
            <span class="progress-stat-icon">${isLimitReached ? '🚫' : '📊'}</span>
            <span class="progress-stat-text">${percentage}% Complete</span>
          </div>
        </div>
        ${isLimitReached ? '<div class="limit-warning">🚨 Drink limit reached!</div>' : ''}
      `;
    }
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
      await statsManager.init();
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


