// backend/seed.js
// Populates the Question collection with a small starter set per category.
// Run with: node seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const { Question } = require('./models/Schemas');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quiznest';

const sampleQuestions = [
  {
    category: 'programming',
    questionText: 'Which data structure uses LIFO (Last In, First Out) ordering?',
    options: ['Queue', 'Stack', 'Linked List', 'Hash Map'],
    correctOptionIndex: 1,
  },
  {
    category: 'science',
    questionText: 'What is the chemical symbol for gold?',
    options: ['Go', 'Gd', 'Au', 'Ag'],
    correctOptionIndex: 2,
  },
  {
    category: 'mathematics',
    questionText: 'What is the value of π (pi) rounded to two decimal places?',
    options: ['3.12', '3.14', '3.16', '3.18'],
    correctOptionIndex: 1,
  },
  {
    category: 'history',
    questionText: 'In what year did the Berlin Wall fall?',
    options: ['1987', '1989', '1991', '1993'],
    correctOptionIndex: 1,
  },
  {
    category: 'geography',
    questionText: 'Which is the longest river in the world?',
    options: ['Amazon', 'Yangtze', 'Nile', 'Mississippi'],
    correctOptionIndex: 2,
  },
  {
    category: 'entertainment',
    questionText: 'Which studio produced the "Toy Story" film franchise?',
    options: ['DreamWorks', 'Pixar', 'Illumination', 'Studio Ghibli'],
    correctOptionIndex: 1,
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('[seed] connected to MongoDB');

  await Question.deleteMany({});
  await Question.insertMany(sampleQuestions);

  console.log(`[seed] inserted ${sampleQuestions.length} sample questions`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
