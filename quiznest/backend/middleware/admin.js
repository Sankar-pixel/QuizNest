// backend/middleware/admin.js
// Gatekeeper for admin-only routes. Must run AFTER the `authenticate`
// middleware, since it relies on req.userId already being set.

const { User } = require('../models/Schemas');

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('isAdmin');
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin access.' });
  }
}

module.exports = { requireAdmin };
