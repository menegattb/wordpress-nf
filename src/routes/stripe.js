/**
 * Rotas Stripe: checkout e webhooks
 */

const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');

/**
 * POST /api/stripe/create-checkout-session
 * Cria sessão de checkout para assinatura
 * Body: { customer_email, nome?, site_url?, success_url?, cancel_url? }
 */
router.post('/create-checkout-session', stripeController.createCheckoutSession);

module.exports = router;
