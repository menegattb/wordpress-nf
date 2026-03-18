/**
 * Controller do painel administrativo
 */

const crypto = require('crypto');
const logger = require('../services/logger');
const { listarTenantsComUso, salvarTenant, hasDatabase, listarConfiguracoesTenant, salvarConfiguracaoTenant } = require('../config/database');
const { hashToken } = require('../middleware/tenantAuth');

function generateToken() {
  return 'nf_' + crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/admin/dashboard
 */
async function getDashboard(req, res) {
  try {
    const clientes = await listarTenantsComUso();
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    const dados = clientes.map(c => ({
      id: c.id,
      nome: c.nome || '(sem nome)',
      site_url: c.site_url || '-',
      email: c.email || '-',
      webhook_id: c.webhook_id || null,
      webhook_url: c.webhook_id ? `${appUrl}/api/webhook/woocommerce/${c.webhook_id}` : null,
      criado_em: c.created_at,
      notas_mes_atual: parseInt(c.notas_mes_atual, 10) || 0,
      limite_mensal: parseInt(c.notas_incluidas, 10) || 100,
      status_assinatura: c.status_assinatura || 'sem_assinatura',
      plano: c.plano || '-',
      periodo_fim: c.periodo_fim
    }));

    res.json({
      sucesso: true,
      clientes: dados,
      total_clientes: dados.length
    });
  } catch (error) {
    logger.error('Erro ao buscar dashboard admin', {
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
 * POST /api/admin/criar-cliente
 */
async function criarCliente(req, res) {
  try {
    if (!hasDatabase()) {
      return res.status(503).json({
        sucesso: false,
        erro: 'Banco de dados não configurado',
        mensagem: 'Configure POSTGRES_URL para criar clientes'
      });
    }

    const { nome, site_url } = req.body || {};

    const token = generateToken();
    const tokenHash = hashToken(token);
    const webhookId = crypto.randomUUID();

    const tenant = await salvarTenant({
      token_hash: tokenHash,
      nome: nome || '',
      site_url: site_url || '',
      webhook_id: webhookId
    });

    if (!tenant) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao salvar tenant'
      });
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    logger.info('Cliente criado pelo admin', {
      tenant_id: tenant.id,
      nome: tenant.nome,
      site_url: tenant.site_url,
      webhook_id: webhookId,
      admin: req.session?.usuario
    });

    res.status(201).json({
      sucesso: true,
      mensagem: 'Cliente criado. Envie o token ao cliente - ele não será exibido novamente.',
      dados: {
        tenant_id: tenant.id,
        nome: tenant.nome,
        site_url: tenant.site_url,
        token,
        webhook_id: webhookId,
        webhook_url: `${appUrl}/api/webhook/woocommerce/${webhookId}`,
        api_url: appUrl
      }
    });
  } catch (error) {
    logger.error('Erro ao criar cliente', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

const WOO_CONFIG_KEYS = [
  'WOOCOMMERCE_URL',
  'WOOCOMMERCE_API_URL',
  'WOOCOMMERCE_CONSUMER_KEY',
  'WOOCOMMERCE_CONSUMER_SECRET'
];

/**
 * GET /api/admin/tenant/:id/config
 */
async function getClienteConfig(req, res) {
  try {
    const tenantId = parseInt(req.params.id, 10);
    if (isNaN(tenantId)) {
      return res.status(400).json({ sucesso: false, erro: 'ID inválido' });
    }

    const flat = await listarConfiguracoesTenant(tenantId);

    res.json({
      sucesso: true,
      tenant_id: tenantId,
      config: {
        woocommerce_url: flat.WOOCOMMERCE_URL || '',
        woocommerce_api_url: flat.WOOCOMMERCE_API_URL || '',
        woocommerce_consumer_key: flat.WOOCOMMERCE_CONSUMER_KEY || '',
        woocommerce_consumer_secret: flat.WOOCOMMERCE_CONSUMER_SECRET || ''
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar config do tenant', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * POST /api/admin/tenant/:id/config
 */
async function salvarClienteConfig(req, res) {
  try {
    const tenantId = parseInt(req.params.id, 10);
    if (isNaN(tenantId)) {
      return res.status(400).json({ sucesso: false, erro: 'ID inválido' });
    }

    const body = req.body || {};
    const mapping = {
      woocommerce_url: 'WOOCOMMERCE_URL',
      woocommerce_api_url: 'WOOCOMMERCE_API_URL',
      woocommerce_consumer_key: 'WOOCOMMERCE_CONSUMER_KEY',
      woocommerce_consumer_secret: 'WOOCOMMERCE_CONSUMER_SECRET'
    };

    for (const [bodyKey, dbKey] of Object.entries(mapping)) {
      if (body[bodyKey] !== undefined) {
        await salvarConfiguracaoTenant(tenantId, dbKey, body[bodyKey]);
      }
    }

    // Invalidar cache do tenant
    try {
      const { invalidateCache } = require('../services/tenantService');
      if (invalidateCache) invalidateCache(tenantId);
    } catch (e) { /* cache not available */ }

    logger.info('Config do tenant atualizada pelo admin', {
      tenant_id: tenantId,
      admin: req.session?.usuario,
      keys: Object.keys(body)
    });

    res.json({ sucesso: true, mensagem: 'Configuração salva' });
  } catch (error) {
    logger.error('Erro ao salvar config do tenant', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

module.exports = {
  getDashboard,
  criarCliente,
  getClienteConfig,
  salvarClienteConfig
};
