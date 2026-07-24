// frontend/src/ui/QuizUI.js
// Renders the holographic quiz overlay: question panel + four answer cards.
// Pure DOM manipulation — no game/network logic lives here.

const CATEGORY_COLORS = {
  programming: 'text-neon-green border-neon-green/40',
  science: 'text-neon-cyan border-neon-cyan/40',
  mathematics: 'text-neon-amber border-neon-amber/40',
  history: 'text-neon-crimson border-neon-crimson/40',
  geography: 'text-neon-emerald border-neon-emerald/40',
  entertainment: 'text-neon-magenta border-neon-magenta/40',
};

export class QuizUI {
  constructor() {
    this.overlay = document.getElementById('quiz-overlay');
    this.categoryLabel = document.getElementById('question-category');
    this.questionText = document.getElementById('question-text');
    this.answersGrid = document.getElementById('answers-grid');
    this.exitBtn = document.getElementById('exit-quiz-btn');

    this.onAnswerSelected = null; // set by main.js: (index) => void
    this.onExit = null; // set by main.js: () => void

    this.exitBtn.addEventListener('click', () => {
      if (this.onExit) this.onExit();
    });
  }

  show() {
    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }

  /**
   * Renders a question and its four options.
   * @param {{category: string, questionText: string, options: string[]}} question
   * @param {number} questionNumber
   * @param {number} totalQuestions
   */
  renderQuestion(question, questionNumber, totalQuestions) {
    const colorClass = CATEGORY_COLORS[question.category] || 'text-neon-cyan border-neon-cyan/40';

    this.categoryLabel.textContent = `${question.category.toUpperCase()} · ${questionNumber}/${totalQuestions}`;
    this.categoryLabel.className = `font-display text-xs tracking-[0.3em] mb-2 ${colorClass.split(' ')[0]}`;
    this.questionText.textContent = question.questionText;

    this.answersGrid.innerHTML = '';

    question.options.forEach((optionText, index) => {
      const card = document.createElement('button');
      card.className = `answer-card glass-panel rounded-xl px-5 py-4 text-left border ${colorClass.split(' ')[1]} pointer-events-auto`;
      card.innerHTML = `
        <span class="text-white/40 text-xs mr-2 font-display">${String.fromCharCode(65 + index)}</span>
        <span class="text-sm">${this._escape(optionText)}</span>
      `;
      card.dataset.index = String(index);

      card.addEventListener('click', () => {
        this._lockCards();
        if (this.onAnswerSelected) this.onAnswerSelected(index, card);
      });

      this.answersGrid.appendChild(card);
    });
  }

  /** Marks the chosen card and the true correct card once the server responds. */
  applyResult({ selectedCard, correctIndex, isCorrect }) {
    const cards = Array.from(this.answersGrid.children);

    cards.forEach((card, i) => {
      if (i === correctIndex) {
        card.classList.add('correct');
      } else if (card === selectedCard && !isCorrect) {
        card.classList.add('incorrect');
      }
    });
  }

  /** Briefly shakes the question panel canvas overlay for wrong-answer feedback. */
  triggerLocalGlitchFlash() {
    const panel = document.getElementById('question-panel');
    panel.classList.add('glitch-active');
    setTimeout(() => panel.classList.remove('glitch-active'), 340);
  }

  _lockCards() {
    Array.from(this.answersGrid.children).forEach((c) => {
      c.style.pointerEvents = 'none';
    });
  }

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
