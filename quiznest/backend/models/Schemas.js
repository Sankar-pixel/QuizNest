// backend/models/Schemas.js
// Mongoose model definitions for QuizNest: User progression and Question bank.

const mongoose = require('mongoose');

/* -------------------------------------------------------------------------- */
/* User Schema                                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Tracks a player's identity, progression, and cosmetic unlocks.
 * Passwords are always stored hashed (bcrypt) — never plaintext.
 */
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
    },
    password: {
      type: String,
      required: true, // stored as a bcrypt hash, never plaintext
    },
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    unlockedCustomizations: {
      // Neon color configurations the player has unlocked for their HUD / avatar
      type: [String],
      default: ['neon-cyan'],
    },
    stats: {
      questionsAnswered: { type: Number, default: 0 },
      correctAnswers: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
    },
    badges: {
      // Achievement keys the user has earned, e.g. "first_blood", "streak_10"
      type: [String],
      default: [],
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Helpful compound index for leaderboard sorting by XP descending.
UserSchema.index({ xp: -1 });

/* -------------------------------------------------------------------------- */
/* Question Schema                                                            */
/* -------------------------------------------------------------------------- */
/**
 * A single quiz question belonging to one of the six category skyscrapers.
 * correctOptionIndex is NEVER sent to the client directly — the API route
 * strips it before returning question payloads.
 */
const QuestionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        'programming',
        'science',
        'mathematics',
        'history',
        'geography',
        'entertainment',
      ],
      index: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 4,
        message: 'A question must have exactly 4 options.',
      },
    },
    correctOptionIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    xpValue: {
      type: Number,
      default: 100,
    },
  },
  { timestamps: true }
);

/* -------------------------------------------------------------------------- */
/* Achievement Schema                                                         */
/* -------------------------------------------------------------------------- */
/**
 * Static catalog of unlockable badges. `key` is what gets stored in
 * User.badges; the rest is display metadata for the frontend.
 */
const AchievementSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: '🏆' },
  color: { type: String, default: '#00f6ff' },
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Question: mongoose.model('Question', QuestionSchema),
  Achievement: mongoose.model('Achievement', AchievementSchema),
};
