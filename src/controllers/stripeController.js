/**
 * Controller para Stripe: checkout e webhooks
 */

const crypto = require('crypto');
const logger = require('../services/logger');
const { salvarTenant, salvarSubscription, buscarTenantPorTokenHash } = require('../config/database');
const { hashToken } = require('../middleware/tenantAuth');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

function generateToken() {
  return 'nf_' + crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/stripe/create-checkout-session
 * Cria sessão de checkout Stripe
 */
async function createCheckoutSession(req, res) {
  try {
    const { customer_email, nome, site_url, success_url, cancel_url } = req.body || {};

    if (!customer_email) {
      return res.status(400).json({
        sucesso: false,
        erro: 'customer_email é obrigatório'
      });
    }

    const session = await stripeService.createCheckoutSession({
      customer_email,
      success_url: success_url || `${process.env.APP_URL || ''}/obrigado`,
      cancel_url: cancel_url || `${process.env.APP_URL || ''}/`,
      metadata: { nome: nome || '', site_url: site_url || '' }
    });

    res.json({
      sucesso: true,
      url: session.url,
      session_id: session.id
    });
  } catch (error) {
    logger.error('Erro ao criar checkout session', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Processa webhook do Stripe (chamado com raw body)
 */
async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET não configurado');
    return res.status(500).send('Webhook secret não configurado');
  }

  let event;
  try {
    const stripe = stripeService.getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.warn('Webhook Stripe: assinatura inválida', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        logger.debug('Webhook Stripe não tratado', { type: event.type });
    }
    res.json({ received: true });
  } catch (error) {
    logger.error('Erro ao processar webhook Stripe', {
      type: event.type,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ erro: error.message });
  }
}

async function handleCheckoutCompleted(session) {
  const customerEmail = session.customer_email || session.customer_details?.email;
  const metadata = session.metadata || session.subscription_data?.metadata || {};
  const nome = metadata.nome || '';
  const siteUrl = metadata.site_url || '';

  if (!customerEmail) {
    logger.error('Checkout completed sem email');
    return;
  }

  const subscriptionId = session.subscription;
  if (!subscriptionId) {
    logger.error('Checkout completed sem subscription_id');
    return;
  }

  const stripe = stripeService.getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = subscription.customer;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  const token = generateToken();
  const tokenHash = hashToken(token);

  const tenant = await salvarTenant({
    token_hash: tokenHash,
    nome,
    site_url: siteUrl,
    email: customerEmail,
    stripe_customer_id: customerId
  });

  await salvarSubscription({
    tenant_id: tenant.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plano: 'basico',
    status: 'ativa',
    notas_incluidas: 100,
    periodo_inicio: currentPeriodStart,
    periodo_fim: currentPeriodEnd
  });

  logger.info('Tenant criado via Stripe', {
    tenant_id: tenant.id,
    email: customerEmail,
    subscription_id: subscriptionId
  });

  if (emailService && typeof emailService.enviarToken === 'function') {
    await emailService.enviarToken(customerEmail, token, nome, siteUrl).catch(err => {
      logger.error('Erro ao enviar email com token', { error: err.message });
    });
  } else {
    logger.warn('Email service não configurado - token não enviado por email', {
      tenant_id: tenant.id,
      token_preview: token.substring(0, 12) + '...'
    });
  }
}

async function handleSubscriptionUpdated(subscription) {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  const { query } = require('../config/database');
  const result = await query(
    `UPDATE subscriptions SET status = $1, periodo_inicio = $2, periodo_fim = $3, updated_at = NOW()
     WHERE stripe_subscription_id = $4 RETURNING *`,
    [status === 'active' ? 'ativa' : status, currentPeriodStart, currentPeriodEnd, subscriptionId]
  );

  if (result.rows.length > 0) {
    logger.info('Subscription atualizada', { subscription_id: subscriptionId, status });
  }
}

async function handleSubscriptionDeleted(subscription) {
  const subscriptionId = subscription.id;

  const { query } = require('../config/database');
  await query(
    `UPDATE subscriptions SET status = 'cancelada', updated_at = NOW() WHERE stripe_subscription_id = $1`,
    [subscriptionId]
  );

  logger.info('Subscription cancelada', { subscription_id: subscriptionId });
}

module.exports = {
  createCheckoutSession,
  handleWebhook
};
