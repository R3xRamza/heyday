import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authMiddleware, signToken, cookieOptions } from '../middleware/auth.js';
import { triggerGmailSyncBackground } from '../lib/gmailSync.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

function validateFields(body, fields) {
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      return `${field} is required`;
    }
  }
  return null;
}

router.post('/register', (req, res) => {
  const error = validateFields(req.body, ['name', 'email', 'password']);
  if (error) return res.status(400).json({ error });

  const { name, email, password, role } = req.body;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = bcrypt.hashSync(password, 12);
  const validRoles = ['admin', 'agent', 'executive'];
  const userRole = validRoles.includes(role) ? role : 'agent';

  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), email.trim().toLowerCase(), passwordHash, userRole);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);
  res.cookie('token', token, cookieOptions);
  res.status(201).json({ user: sanitizeUser(user) });
});

router.post('/login', loginLimiter, (req, res) => {
  const error = validateFields(req.body, ['email', 'password']);
  if (error) return res.status(400).json({ error });

  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  res.cookie('token', token, cookieOptions);
  const safe = sanitizeUser(user);
  triggerGmailSyncBackground(safe);
  res.json({ user: safe });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  });
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (req.query.syncGmail !== '0') {
    triggerGmailSyncBackground(user);
  }
  res.json({ user });
});

export default router;
