const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

// PATCH /api/users/me
async function updateProfile(req, res) {
  const { name, email } = req.body;
  if (!name && !email) return res.status(400).json({ error: 'Provide name or email to update' });

  if (email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: req.user.id } } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { ...(name && { name }), ...(email && { email }) },
    select: { id: true, email: true, name: true },
  });
  res.json(user);
}

// PATCH /api/users/me/password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  res.json({ message: 'Password updated' });
}

// GET /api/users/me
async function getMe(req, res) {
  res.json(req.user);
}

module.exports = { updateProfile, changePassword, getMe };
