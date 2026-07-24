// frontend/src/games/PuzzleGrid.js
// "Neon Circuit Match" — a memory-match puzzle. Flip two tiles per turn;
// matching pairs light up permanently. Pure DOM/CSS, no WebGL dependency,
// so it can run as a lightweight overlay inside the Arcade Spire.

const SYMBOLS = ['⚡', '🧬', '🛰️', '💾', '🔮', '🛡️', '🌐', '🧠'];

export class PuzzleGrid {
  constructor({ onComplete } = {}) {
    this.onComplete = onComplete;
    this.container = null;
    this.flipped = [];
    this.matchedCount = 0;
    this.locked = false;
    this.moves = 0;
  }

  mount(rootElement) {
    this.container = document.createElement('div');
    this.container.className =
      'fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm';

    const pairs = [...SYMBOLS, ...SYMBOLS];
    const deck = pairs
      .map((symbol) => ({ symbol, id: Math.random() }))
      .sort(() => Math.random() - 0.5);

    const panel = document.createElement('div');
    panel.className = 'glass-panel rounded-2xl p-6 max-w-md w-full';
    panel.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-display text-sm tracking-widest text-neon-cyan">NEON CIRCUIT MATCH</h3>
        <span id="puzzle-moves" class="text-xs text-white/50">Moves: 0</span>
      </div>
      <div id="puzzle-tiles" class="grid grid-cols-4 gap-3"></div>
      <button id="puzzle-close" class="mt-5 w-full text-xs text-white/50 hover:text-neon-crimson font-display tracking-widest">
        ← EXIT GAME
      </button>
    `;

    this.container.appendChild(panel);
    rootElement.appendChild(this.container);

    this.movesLabel = panel.querySelector('#puzzle-moves');
    const tileGrid = panel.querySelector('#puzzle-tiles');

    this.tiles = deck.map((card) => {
      const tile = document.createElement('button');
      tile.className =
        'aspect-square rounded-lg bg-white/5 border border-neon-cyan/20 flex items-center justify-center text-2xl transition-all duration-200';
      tile.dataset.symbol = card.symbol;
      tile.dataset.matched = 'false';
      tile.textContent = '';
      tile.addEventListener('click', () => this._flip(tile));
      tileGrid.appendChild(tile);
      return tile;
    });

    panel.querySelector('#puzzle-close').addEventListener('click', () => this.unmount());
  }

  _flip(tile) {
    if (this.locked || tile.dataset.matched === 'true' || this.flipped.includes(tile)) return;

    tile.textContent = tile.dataset.symbol;
    tile.classList.add('border-neon-magenta/60');
    this.flipped.push(tile);

    if (this.flipped.length === 2) {
      this.moves += 1;
      this.movesLabel.textContent = `Moves: ${this.moves}`;
      this.locked = true;

      const [a, b] = this.flipped;
      const isMatch = a.dataset.symbol === b.dataset.symbol;

      setTimeout(() => {
        if (isMatch) {
          [a, b].forEach((t) => {
            t.dataset.matched = 'true';
            t.classList.add('border-neon-green', 'text-neon-green');
          });
          this.matchedCount += 1;
          if (this.matchedCount === SYMBOLS.length) {
            this._celebrate();
          }
        } else {
          [a, b].forEach((t) => {
            t.textContent = '';
            t.classList.remove('border-neon-magenta/60');
          });
        }
        this.flipped = [];
        this.locked = false;
      }, 550);
    }
  }

  _celebrate() {
    const panel = this.container.querySelector('.glass-panel');
    const banner = document.createElement('p');
    banner.className = 'text-center text-neon-green font-display text-xs tracking-widest mt-3';
    banner.textContent = `SOLVED IN ${this.moves} MOVES!`;
    panel.appendChild(banner);
    if (this.onComplete) this.onComplete({ moves: this.moves });
  }

  unmount() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
