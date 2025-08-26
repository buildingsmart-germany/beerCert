/* eslint-disable no-undef */
(function () {
  "use strict";

  const quizState = {
    allQuestions: [],
    currentDifficulty: null,
    currentQuestion: null,
    loaded: false,
  };

  const Difficulty = {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "difficult",
  };

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
        <p class="lead" data-tippy-content="Don't worry, we grade fairly.* *cough">Welcome to BeerCert!</p>
        <h2 class="heading">Choose your difficulty</h2>
        <div class="difficulty" role="list">
          <button class="chip" data-diff="${Difficulty.EASY}" aria-label="Beginner" data-tippy-content="Easy: like lager in a sunny beer garden."><span>Easy</span></button>
          <button class="chip" data-diff="${Difficulty.MEDIUM}" aria-label="Intermediate" data-tippy-content="Medium: like blind-tasting an IPA."><span>Medium</span></button>
          <button class="chip" data-diff="${Difficulty.HARD}" aria-label="Hard" data-tippy-content="Difficult: like reciting the Purity Law backwards."><span>Difficult</span></button>
        </div>
        <div class="spacer"></div>
        <p class="hint">Questions are loaded from <code>questions.xlsx</code>. Excel was beer-motivated.</p>
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
        pickAndShowQuestion();
      });
    });
    return container;
  }

  function createQuestionView(q) {
    const container = document.createElement('section');
    container.className = 'section';
    const answers = shuffle([q.correct, ...q.incorrect]);
    container.innerHTML = `
      <div>
        <p class="lead inline">
          <span>Difficulty:</span>
          <strong>${labelDifficulty(quizState.currentDifficulty)}</strong>
        </p>
        <h2 class="heading" data-tippy-content="You got this. Probably.">${escapeHtml(q.question)}</h2>
        <div class="choices"></div>
        <div class="divider"></div>
        <div class="inline">
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
      triggerConfetti();
      showToast('Correct! You may now say “win” and fetch a beer.');
      setTimeout(() => {
        render(createStartView());
      }, 1100);
    } else {
      btn.classList.add('wrong');
      const correctBtn = all.find(b => b.getAttribute('data-answer') === q.correct);
      if (correctBtn) correctBtn.classList.add('correct');
      showToast('Oops! Maybe take BeerCert again. Or learn first, then drink.');
      setTimeout(() => render(createStartView()), 1500);
    }
  }

  function triggerConfetti() {
    if (typeof confetti !== 'function') return;
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f5c451', '#7dd3fc', '#ffffff']
    });
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
    const normalized = rows.map((r) => ({
      difficulty: String(r.difficulty || r.Difficulty || r.schwierigkeit || '').toLowerCase().trim(),
      category: String(r.category || r.Category || r.kategorie || '').trim(),
      question: String(r.question || r.Frage || '').trim(),
      correct: String(r.correct || r.Correct || r.richtig || '').trim(),
      incorrect: [r.incorrect1, r.incorrect2, r.incorrect3]
        .map(v => String(v || '').trim())
        .filter(Boolean)
    })).filter(q => q.question && q.correct && q.incorrect.length > 0);
    quizState.allQuestions = normalized;
  }

  function pickAndShowQuestion() {
    const d = quizState.currentDifficulty;
    const pool = quizState.allQuestions.filter(q => {
      const qd = (q.difficulty || '').toLowerCase();
      if (d === Difficulty.HARD) return qd === 'hard' || qd === 'difficult';
      if (d === Difficulty.MEDIUM) return qd === 'medium';
      return qd === 'easy';
    });
    if (pool.length === 0) {
      showToast('No questions found for this difficulty. Excel seems thirsty.');
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


