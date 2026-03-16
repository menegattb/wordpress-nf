/**
 * Serviço de controle de uso (limite de notas por assinatura)
 */

const { buscarAssinaturaAtiva, getOrCreateUsageMonthly, incrementarNotasEmitidas } = require('../config/database');
const logger = require('./logger');

const NOTAS_INCLUIDAS_PADRAO = 100;

/**
 * Verifica se o tenant pode emitir mais notas neste mês
 * @param {number|null} tenantId
 * @returns {Promise<{pode: boolean, limite: number, usado: number, mensagem?: string}>}
 */
async function verificarLimite(tenantId) {
  if (!tenantId) {
    return { pode: true, limite: 999999, usado: 0 };
  }

  try {
    const assinatura = await buscarAssinaturaAtiva(tenantId);
    const limite = assinatura ? (assinatura.notas_incluidas || NOTAS_INCLUIDAS_PADRAO) : NOTAS_INCLUIDAS_PADRAO;

    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;

    const usage = await getOrCreateUsageMonthly(tenantId, ano, mes);
    const usado = usage.notas_emitidas || 0;

    if (usado >= limite) {
      return {
        pode: false,
        limite,
        usado,
        mensagem: `Limite de ${limite} notas/mês atingido. Faça upgrade para continuar.`
      };
    }

    return { pode: true, limite, usado };
  } catch (error) {
    logger.error('Erro ao verificar limite de uso', { tenantId, error: error.message });
    return { pode: true, limite: NOTAS_INCLUIDAS_PADRAO, usado: 0 };
  }
}

/**
 * Registra emissão de nota (incrementa contador)
 */
async function registrarEmissao(tenantId) {
  if (!tenantId) return;
  try {
    await incrementarNotasEmitidas(tenantId);
  } catch (error) {
    logger.error('Erro ao registrar emissão', { tenantId, error: error.message });
  }
}

module.exports = {
  verificarLimite,
  registrarEmissao,
  NOTAS_INCLUIDAS_PADRAO
};
