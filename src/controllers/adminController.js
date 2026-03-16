/**
 * Controller do painel administrativo
 */

const crypto = require('crypto');
const logger = require('../services/logger');
const { listarTenantsComUso, salvarTenant, hasDatabase } = require('../config/database');
const { hashToken } = require('../middleware/tenantAuth');

function generateToken() {
  return 'nf_' + crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/admin/dashboard
 * Retorna lista de clientes com uso e status de pagamento
 */
async function getDashboard(req, res) {
  try {
    const clientes = await listarTenantsComUso();

    const dados = clientes.map(c => ({
      id: c.id,
      nome: c.nome || '(sem nome)',
      site_url: c.site_url || '-',
      email: c.email || '-',
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
 * Cria novo cliente (tenant) - admin autenticado
 * Body: { nome?, site_url? }
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

    const tenant = await salvarTenant({
      token_hash: tokenHash,
      nome: nome || '',
      site_url: site_url || ''
    });

    if (!tenant) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao salvar tenant'
      });
    }

    logger.info('Cliente criado pelo admin', {
      tenant_id: tenant.id,
      nome: tenant.nome,
      site_url: tenant.site_url,
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
        api_url: process.env.APP_URL || 'https://wp-nf.vercel.app'
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

module.exports = {
  getDashboard,
  criarCliente
};
