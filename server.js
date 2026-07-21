// backend/server.js
// Express API for QuizNest — handles auth, question delivery, server-side
// answer verification (anti-cheat), and leaderboard aggregation.

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { User, Question } = require('./models/Schemas');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quiznest';
const JWT_SECRET = process.env.JWT_SECRET;
let mongoMemoryServer = null;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Add it to your .env file.');
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* Database connection                                                        */
/* -------------------------------------------------------------------------- */
async function connectDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[db] connected to MongoDB');
  } catch (err) {
    console.warn('[db] failed to connect to MongoDB, falling back to in-memory server:', err.message);

    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log('[db] connected to in-memory MongoDB');
  }
}

connectDatabase().catch((err) => {
  console.error('[db] fatal connection error:', err);
  process.exit(1);
});

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
/* Question routes                                                            */
/* -------------------------------------------------------------------------- */

// GET /api/questions/:category
// Returns up to 10 random questions for a category, WITHOUT correctOptionIndex.
app.get('/api/questions/:category', authenticate, async (req, res) => {
  try {
    const { category } = req.params;
    const availableCount = await Question.countDocuments({ category });
    const sampleSize = Math.min(10, availableCount);

    const questions = sampleSize
      ? await Question.aggregate([
          { $match: { category } },
          { $sample: { size: sampleSize } },
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
        ])
      : [];

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

    await user.save();

    res.json({
      correct: isCorrect,
      correctOptionIndex: question.correctOptionIndex,
      xpAwarded,
      totalXp: user.xp,
      level: user.level,
      streak: user.stats.streak,
    });
  } catch (err) {
    console.error('[submit]', err);
    res.status(500).json({ error: 'Failed to submit answer.' });
  }
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

app.listen(PORT, () => {
  console.log(`[server] QuizNest API listening on port ${PORT}`);
});
