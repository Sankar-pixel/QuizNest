const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5184';

export async function fetchQuestions(categoryId, limit = 4) {
  try {
    const endpoint = `${API_BASE}/quiz/${categoryId}?limit=${limit}`;
    const res = await fetch(endpoint);
    console.debug('[API] fetchQuestions', endpoint, res.status);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[API] fetchQuestions returned empty or invalid data for', categoryId, data);
      return [];
    }

    return data.map((item) => {
      const hasAnswers = Array.isArray(item.answers) && item.answers.length > 0;
      const hasOptions = Array.isArray(item.options) && item.options.length > 0;
      const answers = hasAnswers ? item.answers : hasOptions ? item.options : [];
      const correctIndex = typeof item.correctIndex === 'number'
        ? item.correctIndex
        : typeof item.answer === 'string'
          ? answers.indexOf(item.answer)
          : -1;

      return {
        question: item.question || item.Question || '',
        answers,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        explanation: item.explanation || item.Explanation || null,
        difficulty: item.difficulty || item.Difficulty || 'medium',
      };
    });
  } catch (err) {
    console.warn('Falling back to local questions (backend not running?)', err);
    return FALLBACK_QUESTIONS[categoryId] || [];
  }
}

export async function submitScore({ username, categoryId, xpEarned }) {
  const res = await fetch(`${API_BASE}/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, categoryId, xpEarned }),
  });

  if (!res.ok) {
    throw new Error(`Leaderboard submit failed: ${res.status}`);
  }

  return await res.json();
}

export async function fetchLeaderboardTop(limit = 10) {
  try {
    const res = await fetch(`${API_BASE}/leaderboard/top?limit=${limit}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Leaderboard fetch failed', err);
    return [];
  }
}

export async function createUser(username) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    throw new Error(`User create failed: ${res.status}`);
  }

  return await res.json();
}

export async function fetchLeaderboardSearch(username, limit = 10) {
  if (!username || !username.trim()) return [];
  try {
    const res = await fetch(`${API_BASE}/leaderboard/search?username=${encodeURIComponent(username)}&limit=${limit}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Leaderboard search failed', err);
    return [];
  }
}

export async function fetchUser(username) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`);
  if (!res.ok) {
    throw new Error(`User fetch failed: ${res.status}`);
  }
  return await res.json();
}

// Small local fallback so the frontend is playable even before the
// backend is wired up — handy while you're building the 3D side first.
const FALLBACK_QUESTIONS = {
  programming: [
    {
      question: 'Which data structure uses LIFO order?',
      answers: ['Queue', 'Stack', 'Linked List', 'Tree'],
      correctIndex: 1,
    },
    {
      question: 'What does "DOM" stand for?',
      answers: ['Document Object Model', 'Data Order Map', 'Direct Output Mode', 'Digital Object Memory'],
      correctIndex: 0,
    },
  ],
  science: [
    {
      question: 'What do plants use to turn sunlight into energy?',
      answers: ['Photosynthesis', 'Respiration', 'Fermentation', 'Evaporation'],
      correctIndex: 0,
    },
  ],
  mathematics: [
    {
      question: 'What is 8 × 7?',
      answers: ['54', '56', '64', '72'],
      correctIndex: 1,
    },
  ],
  history: [
    {
      question: 'Who was the first President of the United States?',
      answers: ['Thomas Jefferson', 'George Washington', 'Abraham Lincoln', 'John Adams'],
      correctIndex: 1,
    },
  ],
  geography: [
    {
      question: 'Which continent is the Sahara Desert located on?',
      answers: ['Asia', 'South America', 'Africa', 'Australia'],
      correctIndex: 2,
    },
  ],
  entertainment: [
    {
      question: 'Which instrument has six strings and is often used in rock music?',
      answers: ['Violin', 'Piano', 'Guitar', 'Flute'],
      correctIndex: 2,
    },
  ],
};
