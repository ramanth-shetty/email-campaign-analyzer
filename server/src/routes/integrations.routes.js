const router = require("express").Router();
const requireAuth = require("../middleware/requireAuth");
const {
  connect,
  sync,
  status,
  disconnect,
} = require("../controllers/integrations.controller");

router.post("/mailchimp/connect", requireAuth, connect);
router.post("/mailchimp/sync", requireAuth, sync);
router.get("/mailchimp/status", requireAuth, status);
router.delete("/mailchimp", requireAuth, disconnect);

module.exports = router;
