const express = require('express');
const authRoutes = require('./authRoutes');
const complaintRoutes = require('./complaintRoutes');
const municipalOfficeRoutes = require('./municipalOfficeRoutes');
const adminRoutes = require('./adminRoutes');
const notificationRoutes = require('./notificationRoutes');
const userRoutes = require('./userRoutes');
const publicRoutes = require('./publicRoutes');
const sensitiveLocationRoutes = require('./sensitiveLocationRoutes');
const logsRoutes = require('./logsRoutes');
const publicController = require('../controllers/publicController');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/municipal-offices', municipalOfficeRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/public', publicRoutes);
router.get('/developers', publicController.getDevelopers);
router.use('/sensitive-locations', sensitiveLocationRoutes);
router.use('/logs', logsRoutes);

module.exports = router;
