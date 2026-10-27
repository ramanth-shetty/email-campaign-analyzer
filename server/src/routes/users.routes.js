const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');
const { getMe, updateProfile, changePassword } = require('../controllers/users.controller');

router.get('/me',            requireAuth, getMe);
router.patch('/me',          requireAuth, updateProfile);
router.patch('/me/password', requireAuth, changePassword);

module.exports = router;
