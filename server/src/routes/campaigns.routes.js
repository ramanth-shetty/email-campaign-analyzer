const router = require('express').Router();
const multer = require('multer');
const requireAuth = require('../middleware/requireAuth');
const { uploadCSV } = require('../controllers/campaigns.controller');

// Store file in memory — buffer passed to csv parser
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only CSV files are accepted'), { status: 400 }));
    }
  },
});

router.post('/upload', requireAuth, upload.single('file'), uploadCSV);

module.exports = router;
