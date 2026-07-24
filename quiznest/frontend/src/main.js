// frontend/src/main.js
// Application coordinator: wires together the WebGL scene, audio engine,
// quiz UI, GSAP camera choreography, auth, and all backend fetch calls.

import gsap from 'gsap';
import { CityScene, ARCADE_KEY } from './engine/Scene.js';
import { AudioEngine } from './engine/Audio.js';
import { QuizUI } from './ui/QuizUI.js';
import { PuzzleGrid } from './games/PuzzleGrid.js';
import { CipherBreak } from './games/CipherBreak.js';

const API_BASE = window.QUIZNEST_API_BASE || 'http://localhost:4000/api';
const ANALYTICS_BASE = window.QUIZNEST_ANALYTICS_BASE || 'http://localhost:8000';
const MULTIPLAYER_WS = window.QUIZNEST_MULTIPLAYER_WS || 'ws://localhost:8080/ws/battle';

/* -------------------------------------------------------------------------- */
/* Application state                                                          */
/* -------------------------------------------------------------------------- */
const state = {
  token: localStorage.getItem('quiznest_token') || null,
  user: null,
  currentCategory: null,
  questions: [],
  questionIndex: 0,
  mode: 'city', // 'city' | 'quiz' | 'arcade'
  achievementCatalog: null, // populated lazily from GET /achievements
  battleSocket: null,
};

/* -------------------------------------------------------------------------- */
/* DOM references                                                             */
/* -------------------------------------------------------------------------- */
const canvas = document.getElementById('scene-canvas');
const hudUsername = document.getElementById('hud-username');
const hudLevel = document.getElementById('hud-level');
const hudXp = document.getElementById('hud-xp');
const xpBar = document.getElementById('xp-bar');
const authStatus = document.getElementById('auth-status');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');

/* -------------------------------------------------------------------------- */
/* Engines                                                                    */
/* -------------------------------------------------------------------------- */
const audio = new AudioEngine();
const quizUI = new QuizUI();

const scene = new CityScene(canvas, {
  onBuildingSelect: (categoryKey, towerMesh) => enterCategory(categoryKey, towerMesh),
});

// Unlock audio (and start the ambient drone) on the first user gesture,
// since browsers block AudioContext until an interaction occurs.
function unlockAudioOnce() {
  audio.unlock();
  audio.startAmbientDrone();
  window.removeEventListener('pointerdown', unlockAudioOnce);
}
window.addEventListener('pointerdown', unlockAudioOnce);

/* -------------------------------------------------------------------------- */
/* XP / Level HUD                                                             */
/* -------------------------------------------------------------------------- */
function xpProgressWithinLevel(xp, level) {
  // Mirrors the backend's levelFromXp curve: level N needs N*500 XP.
  let remaining = xp;
  let currentLevel = 1;
  while (currentLevel < level) {
    remaining -= currentLevel * 500;
    currentLevel += 1;
  }
  const needed = level * 500;
  return { current: Math.max(0, remaining), needed };
}

function updateHud(user) {
  if (!user) return;
  state.user = user;
  hudUsername.textContent = user.username;
  hudLevel.textContent = `LVL ${user.level}`;
  hudXp.textContent = `${user.xp} XP`;

  const { current, needed } = xpProgressWithinLevel(user.xp, user.level);
  const pct = Math.min(100, (current / needed) * 100);
  gsap.to(xpBar, { width: `${pct}%`, duration: 0.6, ease: 'power2.out' });
}

/* -------------------------------------------------------------------------- */
/* Achievement toasts                                                         */
/* -------------------------------------------------------------------------- */
async function getAchievementCatalog() {
  if (state.achievementCatalog) return state.achievementCatalog;
  try {
    const data = await apiRequest('/achievements');
    state.achievementCatalog = data.achievements;
  } catch (err) {
    state.achievementCatalog = [];
  }
  return state.achievementCatalog;
}

async function showAchievementToasts(badgeKeys) {
  if (!badgeKeys || !badgeKeys.length) return;
  const catalog = await getAchievementCatalog();
  const container = document.getElementById('achievement-toasts');

  badgeKeys.forEach((key, i) => {
    const meta = catalog.find((a) => a.key === key) || { title: key, icon: '🏆', description: '' };
    const toast = document.createElement('div');
    toast.className = 'glass-panel rounded-lg px-4 py-3 min-w-[220px] pointer-events-auto';
    toast.style.borderColor = meta.color || '#00f6ff';
    toast.innerHTML = `
      <p class="text-xs font-display tracking-widest text-neon-amber">ACHIEVEMENT UNLOCKED</p>
      <p class="text-sm mt-1">${meta.icon || '🏆'} ${meta.title}</p>
      <p class="text-[10px] text-white/50 mt-0.5">${meta.description || ''}</p>
    `;
    container.appendChild(toast);

    gsap.fromTo(toast, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, delay: i * 0.15 });
    setTimeout(() => {
      gsap.to(toast, { x: 60, opacity: 0, duration: 0.4, onComplete: () => toast.remove() });
    }, 4500 + i * 400);
  });
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */
async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function login(username, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  onAuthSuccess(data);
}

async function register(username, password) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  onAuthSuccess(data);
}

function onAuthSuccess(data) {
  state.token = data.token;
  localStorage.setItem('quiznest_token', data.token);
  updateHud(data.user);
  authStatus.textContent = `Signed in as ${data.user.username}`;
  authStatus.className = 'text-[10px] text-neon-green mt-2';
}

document.getElementById('auth-login-btn').addEventListener('click', async () => {
  try {
    await login(authUsernameInput.value.trim(), authPasswordInput.value);
  } catch (err) {
    authStatus.textContent = err.message;
    authStatus.className = 'text-[10px] text-neon-crimson mt-2';
  }
});

document.getElementById('auth-register-btn').addEventListener('click', async () => {
  try {
    await register(authUsernameInput.value.trim(), authPasswordInput.value);
  } catch (err) {
    authStatus.textContent = err.message;
    authStatus.className = 'text-[10px] text-neon-crimson mt-2';
  }
});

/* -------------------------------------------------------------------------- */
/* Cinematic camera transitions (GSAP)                                        */
/* -------------------------------------------------------------------------- */
function zoomCameraToTower(tower) {
  const targetPos = tower.position;

  return gsap.timeline()
    .to(scene.camera.position, {
      x: targetPos.x + 2.5,
      y: targetPos.y + 4,
      z: targetPos.z + 2.5,
      duration: 1.6,
      ease: 'power3.inOut',
    })
    .to(
      {},
      {
        duration: 1.6,
        ease: 'power3.inOut',
        onUpdate: function () {
          scene.camera.lookAt(targetPos.x, targetPos.y + 5, targetPos.z);
        },
      },
      '<'
    );
}

function zoomCameraToCity() {
  return gsap.timeline()
    .to(scene.camera.position, {
      x: 0,
      y: 22,
      z: 34,
      duration: 1.4,
      ease: 'power3.inOut',
    })
    .to(
      {},
      {
        duration: 1.4,
        ease: 'power3.inOut',
        onUpdate: function () {
          scene.camera.lookAt(0, 4, 0);
        },
      },
      '<'
    );
}

/* -------------------------------------------------------------------------- */
/* Quiz flow                                                                  */
/* -------------------------------------------------------------------------- */
async function enterCategory(categoryKey, towerMesh) {
  if (state.mode !== 'city') return;

  audio.playClick();

  if (categoryKey === ARCADE_KEY) {
    state.mode = 'arcade';
    zoomCameraToTower(towerMesh).eventCallback('onComplete', () => showArcadeHub());
    return;
  }

  if (!state.token) {
    authStatus.textContent = 'Sign in to enter a category tower.';
    authStatus.className = 'text-[10px] text-neon-amber mt-2';
    return;
  }

  state.currentCategory = categoryKey;
  state.mode = 'quiz';

  zoomCameraToTower(towerMesh).eventCallback('onComplete', async () => {
    try {
      const data = await apiRequest(`/questions/${categoryKey}`);
      state.questions = data.questions;
      state.questionIndex = 0;

      if (!state.questions.length) {
        exitToCity();
        return;
      }

      quizUI.show();
      renderCurrentQuestion();
    } catch (err) {
      console.error(err);
      exitToCity();
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Arcade mini-game hub                                                       */
/* -------------------------------------------------------------------------- */
function showArcadeHub() {
  const hub = document.createElement('div');
  hub.id = 'arcade-hub';
  hub.className = 'fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm';
  hub.innerHTML = `
    <div class="glass-panel rounded-2xl p-8 max-w-md w-full text-center">
      <h2 class="font-display text-lg tracking-widest text-white mb-6">ARCADE SPIRE</h2>
      <div class="flex flex-col gap-3">
        <button id="play-puzzle-grid" class="glass-panel rounded-lg px-4 py-3 text-sm hover:border-neon-cyan/60 border border-white/10">
          🧩 Neon Circuit Match
        </button>
        <button id="play-cipher-break" class="glass-panel rounded-lg px-4 py-3 text-sm hover:border-neon-magenta/60 border border-white/10">
          🔐 Cipher Break
        </button>
        <button id="arcade-exit" class="text-xs text-white/50 hover:text-neon-crimson font-display tracking-widest mt-2">
          ← RETURN TO CITY
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(hub);

  hub.querySelector('#play-puzzle-grid').addEventListener('click', () => {
    hub.remove();
    const game = new PuzzleGrid({ onComplete: () => setTimeout(() => showArcadeHub(), 1200) });
    game.mount(document.body);
  });

  hub.querySelector('#play-cipher-break').addEventListener('click', () => {
    hub.remove();
    const game = new CipherBreak({ onComplete: () => setTimeout(() => showArcadeHub(), 1200) });
    game.mount(document.body);
  });

  hub.querySelector('#arcade-exit').addEventListener('click', () => {
    hub.remove();
    exitToCity();
  });
}

function renderCurrentQuestion() {
  const question = state.questions[state.questionIndex];
  quizUI.renderQuestion(question, state.questionIndex + 1, state.questions.length);
}

quizUI.onAnswerSelected = async (selectedIndex, selectedCard) => {
  const question = state.questions[state.questionIndex];

  try {
    const result = await apiRequest('/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ questionId: question._id, selectedIndex }),
    });

    quizUI.applyResult({
      selectedCard,
      correctIndex: result.correctOptionIndex,
      isCorrect: result.correct,
    });

    if (result.correct) {
      audio.playCorrect();
      scene.triggerCorrectBurst();
    } else {
      audio.playIncorrect();
      scene.triggerIncorrectGlitch();
      quizUI.triggerLocalGlitchFlash();
    }

    updateHud({
      username: state.user.username,
      xp: result.totalXp,
      level: result.level,
    });

    if (result.newBadges && result.newBadges.length) {
      showAchievementToasts(result.newBadges);
    }

    if (state.battleSocket && state.battleSocket.readyState === WebSocket.OPEN) {
      state.battleSocket.send(
        JSON.stringify({ type: 'score_update', score: result.totalXp, correct: result.correct })
      );
      // Tell the room this player is done with the current question. Once
      // every connected player has sent this, the Go relay broadcasts a
      // single "round_advance" event back (handled in the battle socket's
      // message listener below) so opponents' progress stays visibly in sync.
      state.battleSocket.send(JSON.stringify({ type: 'next_round_ready' }));
    }

    setTimeout(() => {
      state.questionIndex += 1;
      if (state.questionIndex < state.questions.length) {
        renderCurrentQuestion();
      } else {
        exitToCity();
      }
    }, 1200);
  } catch (err) {
    console.error(err);
  }
};

quizUI.onExit = () => exitToCity();

function exitToCity() {
  quizUI.hide();
  state.mode = 'city';
  state.currentCategory = null;
  zoomCameraToCity();
}

/* -------------------------------------------------------------------------- */
/* Hint button (calls the Python analytics/assist service)                    */
/* -------------------------------------------------------------------------- */
const hintBtn = document.getElementById('hint-btn');
const hintTextEl = document.getElementById('hint-text');

hintBtn.addEventListener('click', async () => {
  const question = state.questions[state.questionIndex];
  if (!question) return;

  hintTextEl.textContent = 'Thinking…';
  try {
    const res = await fetch(`${ANALYTICS_BASE}/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionText: question.questionText,
        options: question.options,
        category: question.category,
      }),
    });
    const data = await res.json();
    hintTextEl.textContent = data.hint || 'No hint available right now.';
  } catch (err) {
    hintTextEl.textContent = 'Hint service unavailable — is analytics-python running?';
  }
});

/* -------------------------------------------------------------------------- */
/* Battle mode (connects to the Go multiplayer WebSocket service)             */
/* -------------------------------------------------------------------------- */
const battleBtn = document.getElementById('battle-btn');

battleBtn.addEventListener('click', () => {
  if (state.battleSocket) {
    state.battleSocket.close();
    state.battleSocket = null;
    battleBtn.textContent = '⚔ BATTLE MODE';
    return;
  }

  const roomId = prompt('Enter a battle room name to share with your opponent:', 'neon-arena-1');
  if (!roomId || !state.user) return;

  const socket = new WebSocket(
    `${MULTIPLAYER_WS}?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(state.user.username)}`
  );

  socket.addEventListener('open', () => {
    battleBtn.textContent = `⚔ IN "${roomId}"`;
  });

  socket.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'player_joined' || msg.type === 'player_left') {
        hintTextEl.textContent = `${msg.username} ${msg.type === 'player_joined' ? 'joined' : 'left'} the battle (${msg.playerCount} online).`;
      } else if (msg.type === 'score_update') {
        hintTextEl.textContent = `⚔ ${msg.username} just scored ${msg.score} XP (${msg.correct ? 'correct' : 'missed'})!`;
      } else if (msg.type === 'round_advance') {
        hintTextEl.textContent = '⚔ All battlers are ready — next round!';
      }
    } catch (err) {
      console.error('battle socket parse error', err);
    }
  });

  socket.addEventListener('close', () => {
    battleBtn.textContent = '⚔ BATTLE MODE';
    state.battleSocket = null;
  });

  state.battleSocket = socket;
});

/* -------------------------------------------------------------------------- */
/* Bootstrap: restore session if a token already exists                       */
/* -------------------------------------------------------------------------- */
(async function bootstrap() {
  if (!state.token) return;
  try {
    // No dedicated "me" endpoint in v1 — leaderboard/profile calls would
    // normally hydrate this. For now we just confirm the token is usable
    // by attempting a lightweight authenticated request on first tower entry.
    authStatus.textContent = 'Session restored.';
    authStatus.className = 'text-[10px] text-neon-cyan mt-2';
  } catch (err) {
    localStorage.removeItem('quiznest_token');
    state.token = null;
  }
})();
