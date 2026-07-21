// frontend/src/main.js
// Application coordinator: wires together the WebGL scene, audio engine,
// quiz UI, GSAP camera choreography, auth, and all backend fetch calls.

import gsap from 'gsap';
import { CityScene } from './engine/Scene.js';
import { AudioEngine } from './engine/Audio.js';
import { QuizUI } from './ui/QuizUI.js';

const API_BASE = window.QUIZNEST_API_BASE || 'http://localhost:4000/api';

/* -------------------------------------------------------------------------- */
/* Application state                                                          */
/* -------------------------------------------------------------------------- */
const state = {
  token: localStorage.getItem('quiznest_token') || null,
  user: null,
  currentCategory: null,
  questions: [],
  questionIndex: 0,
  mode: 'city', // 'city' | 'quiz'
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
  if (state.mode === 'quiz') return;
  if (!state.token) {
    authStatus.textContent = 'Sign in to enter a category tower.';
    authStatus.className = 'text-[10px] text-neon-amber mt-2';
    return;
  }

  audio.playClick();
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
