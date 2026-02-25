const express = require('express');
const publicController = require('../controllers/publicController');

const router = express.Router();

router.post('/contact', publicController.sendContactMessage);
router.get('/app-config', publicController.getAppConfig);
router.get('/sensitive-locations', publicController.getSensitiveLocations);

module.exports = router;
