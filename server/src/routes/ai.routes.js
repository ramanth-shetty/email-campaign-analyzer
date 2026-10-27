const router = require("express").Router();
const requireAuth = require("../middleware/requireAuth");
const {
  generate,
  getInsight,
  regenerate,
} = require("../controllers/ai.controller");

router.post("/insights/:campaignId", requireAuth, generate);
router.get("/insights/:campaignId", requireAuth, getInsight);
router.post("/insights/:campaignId/regenerate", requireAuth, regenerate);

module.exports = router;
