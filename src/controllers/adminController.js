/**
 * Controller do painel administrativo
 */

const logger = require('../services/logger');
const { listarTenantsComUso } = require('../config/database');

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

module.exports = {
  getDashboard
};
