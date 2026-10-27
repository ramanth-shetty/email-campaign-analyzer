const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/register
async function register(req, res) {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const accessToken = signAccessToken({ sub: user.id });
  const refreshToken = signRefreshToken({ sub: user.id });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(refreshToken) },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({ accessToken, user });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = signAccessToken({ sub: user.id });
  const refreshToken = signRefreshToken({ sub: user.id });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(refreshToken) },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: { id: user.id, email: user.email, name: user.name },
  });
}

// POST /api/auth/refresh
async function refresh(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.refreshTokenHash !== hashToken(token)) {
    return res.status(401).json({ error: 'Refresh token revoked' });
  }

  const accessToken = signAccessToken({ sub: user.id });
  res.json({ accessToken });
}

// POST /api/auth/logout
async function logout(req, res) {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      await prisma.user.update({
        where: { id: payload.sub },
        data: { refreshTokenHash: null },
      });
    } catch {
      // token already invalid — still clear cookie
    }
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
}

module.exports = { register, login, refresh, logout };
