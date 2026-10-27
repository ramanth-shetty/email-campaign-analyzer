const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');
const { overview, listCampaigns, campaignDetail, trends, compare } = require('../controllers/analytics.controller');

router.get('/overview',          requireAuth, overview);
router.get('/campaigns',         requireAuth, listCampaigns);
router.get('/campaigns/:id',     requireAuth, campaignDetail);
router.get('/trends',            requireAuth, trends);
router.get('/compare',           requireAuth, compare);

module.exports = router;
