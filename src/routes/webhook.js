const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * POST /api/webhook/woocommerce
 * Recebe webhook do WooCommerce
 */
router.post('/woocommerce', webhookController.processarWebhook);

module.exports = router;

