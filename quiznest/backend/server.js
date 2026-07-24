// backend/server.js
// Express API for QuizNest — handles auth, question delivery, server-side
// answer verification (anti-cheat), and leaderboard aggregation.

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { User, Question, Achievement } = require('./models/Schemas');
const { requireAdmin } = require('./middleware/admin');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quiznest';
const JWT_SECRET = process.env.JWT_SECRET;
const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:8000';
const INTERNAL_ADMIN_KEY = process.env.INTERNAL_ADMIN_KEY || '';
const MIN_QUESTION_POOL = 10;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Add it to your .env file.');
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* Database connection                                                        */
/* -------------------------------------------------------------------------- */
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      console.log('[db] connected to MongoDB');
      await ensureAchievementCatalog();
      console.log('[db] achievement catalog ready');
    })
    .catch((err) => {
      console.error('[db] connection error:', err.message);
      process.exit(1);
    });
}

/* -------------------------------------------------------------------------- */
/* XP / Level helpers                                                         */
/* -------------------------------------------------------------------------- */
// Simple curve: each level requires progressively more XP.
// Level N requires N * 500 cumulative XP.
function levelFromXp(xp) {
  let level = 1;
  while (xp >= level * 500) {
    xp -= level * 500;
    level += 1;
  }
  return level;
}

/* -------------------------------------------------------------------------- */
/* Achievements                                                               */
/* -------------------------------------------------------------------------- */
// Static rule set: each entry's `check` decides eligibility from the user's
// live stats. Definitions are also mirrored into the Achievement collection
// (via ensureAchievementCatalog) so the frontend can fetch display metadata.
const ACHIEVEMENT_RULES = [
  {
    key: 'first_blood',
    title: 'First Blood',
    description: 'Answer your first question correctly.',
    icon: '⚡',
    color: '#39ff88',
    check: (u) => u.stats.correctAnswers >= 1,
  },
  {
    key: 'streak_5',
    title: 'Combo Breaker',
    description: 'Reach a 5-answer correct streak.',
    icon: '🔥',
    color: '#ffb400',
    check: (u) => u.stats.bestStreak >= 5,
  },
  {
    key: 'streak_10',
    title: 'Unstoppable',
    description: 'Reach a 10-answer correct streak.',
    icon: '💠',
    color: '#00f6ff',
    check: (u) => u.stats.bestStreak >= 10,
  },
  {
    key: 'level_5',
    title: 'Rising Runner',
    description: 'Reach Level 5.',
    icon: '🚀',
    color: '#ff2fd4',
    check: (u) => u.level >= 5,
  },
  {
    key: 'centurion',
    title: 'Centurion',
    description: 'Answer 100 questions total.',
    icon: '🛡️',
    color: '#ff2b4e',
    check: (u) => u.stats.questionsAnswered >= 100,
  },
];

async function ensureAchievementCatalog() {
  for (const rule of ACHIEVEMENT_RULES) {
    await Achievement.findOneAndUpdate(
      { key: rule.key },
      {
        key: rule.key,
        title: rule.title,
        description: rule.description,
        icon: rule.icon,
        color: rule.color,
      },
      { upsert: true }
    );
  }
}

/** Evaluates all rules against a user, awards any newly-earned badges, and
 * returns the list of badge keys earned during THIS call (empty if none). */
function evaluateNewAchievements(user) {
  const newlyEarned = [];
  for (const rule of ACHIEVEMENT_RULES) {
    if (!user.badges.includes(rule.key) && rule.check(user)) {
      user.badges.push(rule.key);
      newlyEarned.push(rule.key);
    }
  }
  return newlyEarned;
}

/* -------------------------------------------------------------------------- */
/* Auth middleware                                                            */
/* -------------------------------------------------------------------------- */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/* -------------------------------------------------------------------------- */
/* Auth routes                                                                */
/* -------------------------------------------------------------------------- */

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || password.length < 6) {
      return res.status(400).json({
        error: 'Username and a password of at least 6 characters are required.',
      });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, password: passwordHash });

    const token = jwt.sign({ sub: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, xp: user.xp, level: user.level },
    });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ sub: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user._id, username: user.username, xp: user.xp, level: user.level },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/* -------------------------------------------------------------------------- */
/* Auto question generation                                                   */
/* -------------------------------------------------------------------------- */
/**
 * If a category has fewer than MIN_QUESTION_POOL questions, ask the Python
 * analytics service to generate more (via a real LLM if one is configured
 * there, or its built-in template generator otherwise). Best-effort: on any
 * failure we log and continue serving whatever already exists, so a flaky
 * or not-yet-started analytics service never blocks quiz play entirely.
 */
async function ensureQuestionsForCategory(category) {
  const existingCount = await Question.countDocuments({ category });
  if (existingCount >= MIN_QUESTION_POOL) return;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (INTERNAL_ADMIN_KEY) headers['X-Internal-Key'] = INTERNAL_ADMIN_KEY;

    const res = await fetch(`${ANALYTICS_URL}/generate-questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ category, count: MIN_QUESTION_POOL - existingCount + 5 }),
    });

    if (!res.ok) {
      console.warn(`[auto-generate] analytics service responded ${res.status} for "${category}"`);
      return;
    }

    const data = await res.json();
    console.log(
      `[auto-generate] inserted ${data.insertedCount} questions for "${category}" via ${data.mode} mode`
    );
  } catch (err) {
    console.warn(`[auto-generate] could not reach analytics service: ${err.message}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Question routes                                                            */
/* -------------------------------------------------------------------------- */

// GET /api/questions/:category
// Returns 10 random questions for a category, WITHOUT correctOptionIndex.
app.get('/api/questions/:category', authenticate, async (req, res) => {
  try {
    const { category } = req.params;

    await ensureQuestionsForCategory(category);

    const questions = await Question.aggregate([
      { $match: { category } },
      { $sample: { size: 10 } },
      {
        $project: {
          category: 1,
          questionText: 1,
          options: 1,
          difficulty: 1,
          xpValue: 1,
          // correctOptionIndex intentionally omitted — client never sees it
        },
      },
    ]);

    res.json({ category, questions });
  } catch (err) {
    console.error('[questions]', err);
    res.status(500).json({ error: 'Failed to fetch questions.' });
  }
});

/* -------------------------------------------------------------------------- */
/* Quiz submission (anti-cheat: verification happens only here)               */
/* -------------------------------------------------------------------------- */

// POST /api/quiz/submit  { questionId, selectedIndex }
app.post('/api/quiz/submit', authenticate, async (req, res) => {
  try {
    const { questionId, selectedIndex } = req.body;

    if (questionId === undefined || selectedIndex === undefined) {
      return res.status(400).json({ error: 'questionId and selectedIndex are required.' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const isCorrect = question.correctOptionIndex === selectedIndex;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.stats.questionsAnswered += 1;

    let xpAwarded = 0;
    if (isCorrect) {
      user.stats.correctAnswers += 1;
      user.stats.streak += 1;
      user.stats.bestStreak = Math.max(user.stats.bestStreak, user.stats.streak);

      // Small streak bonus keeps consecutive correct answers feeling rewarded.
      const streakBonus = Math.min(user.stats.streak - 1, 5) * 10;
      xpAwarded = question.xpValue + streakBonus;
      user.xp += xpAwarded;
      user.level = levelFromXp(user.xp);
    } else {
      user.stats.streak = 0;
    }

    const newBadges = evaluateNewAchievements(user);

    await user.save();

    res.json({
      correct: isCorrect,
      correctOptionIndex: question.correctOptionIndex,
      xpAwarded,
      totalXp: user.xp,
      level: user.level,
      streak: user.stats.streak,
      newBadges, // array of achievement keys earned on this submission, if any
    });
  } catch (err) {
    console.error('[submit]', err);
    res.status(500).json({ error: 'Failed to submit answer.' });
  }
});

/* -------------------------------------------------------------------------- */
/* Achievements catalog (public — used by frontend to render badge details)   */
/* -------------------------------------------------------------------------- */

// GET /api/achievements
app.get('/api/achievements', async (req, res) => {
  try {
    const achievements = await Achievement.find({}).sort({ title: 1 });
    res.json({ achievements });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch achievements.' });
  }
});

/* -------------------------------------------------------------------------- */
/* Admin routes — question bank + user management                            */
/* All routes below require a valid JWT AND user.isAdmin === true.            */
/* -------------------------------------------------------------------------- */

// GET /api/admin/questions — list all questions (includes correct answers)
app.get('/api/admin/questions', authenticate, requireAdmin, async (req, res) => {
  const questions = await Question.find({}).sort({ category: 1, createdAt: -1 });
  res.json({ questions });
});

// POST /api/admin/questions — create a new question
app.post('/api/admin/questions', authenticate, requireAdmin, async (req, res) => {
  try {
    const question = await Question.create(req.body);
    res.status(201).json({ question });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/questions/:id — update a question
app.put('/api/admin/questions/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!question) return res.status(404).json({ error: 'Question not found.' });
    res.json({ question });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/questions/:id
app.delete('/api/admin/questions/:id', authenticate, requireAdmin, async (req, res) => {
  const deleted = await Question.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Question not found.' });
  res.json({ success: true });
});

// POST /api/admin/generate-questions — manually trigger generation for a category
app.post('/api/admin/generate-questions', authenticate, requireAdmin, async (req, res) => {
  const { category, count } = req.body;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (INTERNAL_ADMIN_KEY) headers['X-Internal-Key'] = INTERNAL_ADMIN_KEY;

    const analyticsRes = await fetch(`${ANALYTICS_URL}/generate-questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ category, count: count || 10 }),
    });

    const data = await analyticsRes.json();
    if (!analyticsRes.ok) {
      return res.status(analyticsRes.status).json(data);
    }
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `Could not reach analytics service: ${err.message}` });
  }
});

// GET /api/admin/users — list all users (for moderation / granting admin)
app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  const users = await User.find({}).select('-password').sort({ xp: -1 });
  res.json({ users });
});

// PUT /api/admin/users/:id/admin — toggle a user's admin flag
app.put('/api/admin/users/:id/admin', authenticate, requireAdmin, async (req, res) => {
  const { isAdmin } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isAdmin: !!isAdmin },
    { new: true }
  ).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

/* -------------------------------------------------------------------------- */
/* Leaderboard                                                                */
/* -------------------------------------------------------------------------- */

// GET /api/leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topUsers = await User.find({})
      .sort({ xp: -1 })
      .limit(10)
      .select('username xp level');

    res.json({
      leaderboard: topUsers.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        xp: u.xp,
        level: u.level,
      })),
    });
  } catch (err) {
    console.error('[leaderboard]', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

/* -------------------------------------------------------------------------- */
/* Health check + startup                                                     */
/* -------------------------------------------------------------------------- */

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[server] QuizNest API listening on port ${PORT}`);
  });
}

module.exports = {
  app,
  levelFromXp,
  ACHIEVEMENT_RULES,
  evaluateNewAchievements,
  ensureQuestionsForCategory,
};
