/**
 * Serviço Stripe para checkout e assinaturas
 */

const Stripe = require('stripe');
const logger = require('./logger');

let stripe = null;

function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY não configurada');
    }
    stripe = new Stripe(key);
  }
  return stripe;
}

/**
 * Cria sessão de checkout para assinatura
 * @param {Object} params - { customer_email, success_url, cancel_url, metadata: { nome, site_url } }
 */
async function createCheckoutSession(params) {
  const s = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID não configurado');
  }

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer_email: params.customer_email,
    line_items: [{
      price: priceId,
      quantity: 1
    }],
    success_url: params.success_url || `${process.env.APP_URL || 'https://app.example.com'}/obrigado?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancel_url || `${process.env.APP_URL || 'https://app.example.com'}/`,
    metadata: params.metadata || {},
    subscription_data: {
      metadata: params.metadata || {}
    }
  });

  return session;
}

/**
 * Recupera dados da sessão de checkout
 */
async function retrieveCheckoutSession(sessionId) {
  const s = getStripe();
  return await s.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription']
  });
}

/**
 * Recupera assinatura
 */
async function retrieveSubscription(subscriptionId) {
  const s = getStripe();
  return await s.subscriptions.retrieve(subscriptionId);
}

module.exports = {
  getStripe,
  createCheckoutSession,
  retrieveCheckoutSession,
  retrieveSubscription
};
