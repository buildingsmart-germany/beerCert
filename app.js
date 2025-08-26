/* eslint-disable no-undef */
(function () {
  "use strict";

  const quizState = {
    allQuestions: [],
    currentDifficulty: null,
    currentQuestion: null,
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
        <p class="lead" data-tippy-content="Keine Sorge, wir bewerten fair.* *hust">Willkommen bei BeerCert!</p>
        <h2 class="heading">Wähle deine Schwierigkeit</h2>
        <div class="difficulty" role="list">
          <button class="chip" data-diff="${Difficulty.EASY}" aria-label="Einsteiger" data-tippy-content="Easy: wie Pils im Biergarten.">Easy</button>
          <button class="chip" data-diff="${Difficulty.MEDIUM}" aria-label="Fortgeschritten" data-tippy-content="Medium: wie IPA blind verkosten.">Medium</button>
          <button class="chip" data-diff="${Difficulty.HARD}" aria-label="Schwierig" data-tippy-content="Difficult: wie Reinheitsgebot rückwärts.">Difficult</button>
        </div>
        <div class="spacer"></div>
        <p class="hint">Die Fragen kommen aus <code>questions.xlsx</code>. Keine Sorge, Excel wurde durch Bier motiviert.</p>
      </div>
    `;
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
          <span>Schwierigkeit:</span>
          <strong>${labelDifficulty(quizState.currentDifficulty)}</strong>
        </p>
        <h2 class="heading" data-tippy-content="Du schaffst das. Vielleicht.">${escapeHtml(q.question)}</h2>
        <div class="choices"></div>
        <div class="divider"></div>
        <div class="inline">
          <button id="again" data-tippy-content="Nochmal? Na klar, immer Durst.">Zurück zur Auswahl</button>
          <span class="hint">Tipp: Antwort ohne Garantie, wie Craft-Bierpreise.</span>
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
      showToast('Richtig! Du darfst jetzt „Gewinn“ sagen und ein Bier holen.');
      setTimeout(() => {
        // nächste Runde
        render(createStartView());
      }, 1100);
    } else {
      btn.classList.add('wrong');
      const correctBtn = all.find(b => b.getAttribute('data-answer') === q.correct);
      if (correctBtn) correctBtn.classList.add('correct');
      showToast('Upsi! Besser noch mal BeerCert machen. Oder erst lernen, dann trinken.');
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
    if (!resp.ok) throw new Error('Konnte questions.xlsx nicht laden');
    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    // Erwartete Spalten: difficulty | category | question | correct | incorrect1 | incorrect2 | incorrect3
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
      showToast('Keine Fragen für diese Schwierigkeit gefunden. Excel hat wohl Durst.');
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
      showToast('Fragen geladen. Kein Schaum, nur Inhalt.');
    } catch (e) {
      console.error(e);
      render(errorView(e));
    }
  }

  function errorView(e) {
    const container = document.createElement('section');
    container.className = 'section';
    container.innerHTML = `
      <h2 class="heading">Fehler beim Laden</h2>
      <p class="lead">${escapeHtml(e.message || 'Unbekannter Fehler')}.</p>
      <button id="retry">Nochmal versuchen</button>
    `;
    container.querySelector('#retry').addEventListener('click', init);
    return container;
  }

  window.addEventListener('DOMContentLoaded', init);
})();


