// backend/tests/quiz.test.js
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { app, levelFromXp, ACHIEVEMENT_RULES, evaluateNewAchievements } = require('../server');

describe('levelFromXp', () => {
  test('starts at level 1 with 0 xp', () => {
    expect(levelFromXp(0)).toBe(1);
  });

  test('reaches level 2 after 500 xp', () => {
    expect(levelFromXp(500)).toBe(2);
  });

  test('reaches level 3 after 500 + 1000 xp', () => {
    expect(levelFromXp(1500)).toBe(3);
  });

  test('does not level up early', () => {
    expect(levelFromXp(499)).toBe(1);
  });
});

describe('evaluateNewAchievements', () => {
  function makeUser(overrides = {}) {
    return {
      badges: [],
      level: 1,
      stats: { questionsAnswered: 0, correctAnswers: 0, streak: 0, bestStreak: 0 },
      ...overrides,
    };
  }

  test('awards first_blood on the first correct answer', () => {
    const user = makeUser({ stats: { questionsAnswered: 1, correctAnswers: 1, streak: 1, bestStreak: 1 } });
    const earned = evaluateNewAchievements(user);
    expect(earned).toContain('first_blood');
    expect(user.badges).toContain('first_blood');
  });

  test('does not re-award an already-earned badge', () => {
    const user = makeUser({
      badges: ['first_blood'],
      stats: { questionsAnswered: 2, correctAnswers: 2, streak: 2, bestStreak: 2 },
    });
    const earned = evaluateNewAchievements(user);
    expect(earned).not.toContain('first_blood');
  });

  test('awards streak_5 only once bestStreak reaches 5', () => {
    const user = makeUser({ stats: { questionsAnswered: 5, correctAnswers: 5, streak: 5, bestStreak: 5 } });
    expect(evaluateNewAchievements(user)).toContain('streak_5');
  });

  test('every rule has a unique key', () => {
    const keys = ACHIEVEMENT_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('GET /api/health', () => {
  test('responds with ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
