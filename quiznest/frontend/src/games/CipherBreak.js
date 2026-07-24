// frontend/src/games/CipherBreak.js
// "Cipher Break" — a Caesar-cipher word puzzle. A tech/sci-fi word is
// shifted by a random amount; the player types the decoded word.

const WORD_BANK = ['NEURAL', 'QUANTUM', 'CIRCUIT', 'PLASMA', 'VECTOR', 'BINARY', 'NEXUS', 'PHOTON'];

function caesarShift(text, shift) {
  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift) % 26) + 65);
      }
      return char;
    })
    .join('');
}

export class CipherBreak {
  constructor({ onComplete } = {}) {
    this.onComplete = onComplete;
    this.container = null;
    this.round = 0;
    this.totalRounds = 5;
    this.shift = 0;
    this.answer = '';
  }

  mount(rootElement) {
    this.container = document.createElement('div');
    this.container.className =
      'fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm';

    const panel = document.createElement('div');
    panel.className = 'glass-panel rounded-2xl p-6 max-w-md w-full text-center';
    panel.innerHTML = `
      <h3 class="font-display text-sm tracking-widest text-neon-magenta mb-1">CIPHER BREAK</h3>
      <p id="cipher-progress" class="text-xs text-white/50 mb-4">Round 0/${this.totalRounds}</p>
      <p id="cipher-shift-hint" class="text-xs text-white/40 mb-2"></p>
      <p id="cipher-word" class="font-display text-3xl tracking-[0.4em] text-neon-cyan mb-4"></p>
      <input
        id="cipher-input"
        type="text"
        placeholder="type the decoded word"
        autocomplete="off"
        class="w-full mb-3 px-3 py-2 rounded bg-white/5 border border-white/10 text-center uppercase tracking-widest outline-none focus:border-neon-cyan"
      />
      <p id="cipher-feedback" class="text-xs h-4 mb-2"></p>
      <button id="cipher-close" class="w-full text-xs text-white/50 hover:text-neon-crimson font-display tracking-widest">
        ← EXIT GAME
      </button>
    `;

    this.container.appendChild(panel);
    rootElement.appendChild(this.container);

    this.progressLabel = panel.querySelector('#cipher-progress');
    this.shiftHint = panel.querySelector('#cipher-shift-hint');
    this.wordLabel = panel.querySelector('#cipher-word');
    this.input = panel.querySelector('#cipher-input');
    this.feedback = panel.querySelector('#cipher-feedback');

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._checkAnswer();
    });

    panel.querySelector('#cipher-close').addEventListener('click', () => this.unmount());

    this._nextRound();
  }

  _nextRound() {
    this.round += 1;
    if (this.round > this.totalRounds) {
      this._celebrate();
      return;
    }

    this.answer = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    this.shift = 1 + Math.floor(Math.random() * 12);

    this.progressLabel.textContent = `Round ${this.round}/${this.totalRounds}`;
    this.shiftHint.textContent = `Caesar shift: +${this.shift}`;
    this.wordLabel.textContent = caesarShift(this.answer, this.shift);
    this.input.value = '';
    this.feedback.textContent = '';
    this.input.focus();
  }

  _checkAnswer() {
    const guess = this.input.value.trim().toUpperCase();
    if (guess === this.answer) {
      this.feedback.textContent = 'DECODED ✓';
      this.feedback.className = 'text-xs h-4 mb-2 text-neon-green';
      setTimeout(() => this._nextRound(), 500);
    } else {
      this.feedback.textContent = 'Try again…';
      this.feedback.className = 'text-xs h-4 mb-2 text-neon-crimson';
    }
  }

  _celebrate() {
    const panel = this.container.querySelector('.glass-panel');
    panel.innerHTML = `
      <h3 class="font-display text-sm tracking-widest text-neon-green mb-2">ALL CIPHERS BROKEN</h3>
      <p class="text-xs text-white/50 mb-4">Great work, runner.</p>
      <button id="cipher-close-final" class="w-full text-xs text-white/50 hover:text-neon-crimson font-display tracking-widest">
        ← RETURN TO ARCADE
      </button>
    `;
    panel.querySelector('#cipher-close-final').addEventListener('click', () => this.unmount());
    if (this.onComplete) this.onComplete({ roundsCompleted: this.totalRounds });
  }

  unmount() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
