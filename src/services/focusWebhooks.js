const axios = require('axios');
const config = require('../../config');
const logger = require('./logger');

/**
 * Configuração da API Focus NFe para webhooks
 */
function getApiConfig(ambiente = null) {
  const ambienteAtual = ambiente || process.env.FOCUS_NFE_AMBIENTE || config.focusNFe.ambiente || 'homologacao';
  const baseUrl = ambienteAtual === 'producao' 
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
  
  let token = null;
  
  if (ambienteAtual === 'producao') {
    token = process.env.FOCUS_NFE_TOKEN_PRODUCAO;
    
    if (!token || token === 'undefined' || token.trim() === '') {
      throw new Error('Token de PRODUÇÃO não configurado para webhooks');
    }
  } else {
    token = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token;
  }
  
  return {
    baseUrl: `${baseUrl}/v2`,
    token,
    ambiente: ambienteAtual
  };
}

/**
 * Cria cliente HTTP para Focus NFe
 */
function createApiClient(ambiente = null) {
  const apiConfig = getApiConfig(ambiente);
  
  if (!apiConfig.token) {
    throw new Error('Token Focus NFe não configurado');
  }
  
  return axios.create({
    baseURL: apiConfig.baseUrl,
    auth: {
      username: apiConfig.token,
      password: ''
    },
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
}

/**
 * Cria um webhook na Focus NFe
 * @param {Object} dados - Dados do webhook
 * @param {string} dados.event - Tipo de evento (nfe, nfse, nfsen, etc)
 * @param {string} dados.url - URL que receberá as notificações
 * @param {string} [dados.cnpj] - CNPJ da empresa (opcional)
 * @param {string} [dados.cpf] - CPF da empresa (opcional)
 * @param {string} [dados.authorization] - Token de autorização (opcional)
 * @param {string} [dados.authorization_header] - Nome do header de autorização (opcional)
 * @param {string} [ambiente] - Ambiente (homologacao ou producao)
 */
async function criarWebhook(dados, ambiente = null) {
  try {
    const client = createApiClient(ambiente);
    const apiConfig = getApiConfig(ambiente);
    
    logger.info('🔗 [WEBHOOK] Criando webhook na Focus NFe', {
      event: dados.event,
      url: dados.url,
      ambiente: apiConfig.ambiente
    });
    
    const response = await client.post('/hooks', dados);
    
    logger.info('✅ [WEBHOOK] Webhook criado com sucesso', {
      hook_id: response.data.id,
      event: response.data.event,
      url: response.data.url,
      ambiente: apiConfig.ambiente
    });
    
    return {
      sucesso: true,
      hook: response.data
    };
  } catch (error) {
    const statusCode = error.response?.status;
    const erro = error.response?.data || error.message;
    
    logger.error('❌ [WEBHOOK] Erro ao criar webhook', {
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: statusCode,
      ambiente: ambiente || 'padrão'
    });
    
    return {
      sucesso: false,
      erro: erro,
      erro_status: statusCode,
      mensagem: error.response?.data?.mensagem || error.message
    };
  }
}

/**
 * Lista todos os webhooks cadastrados
 * @param {string} [ambiente] - Ambiente (homologacao ou producao)
 */
async function listarWebhooks(ambiente = null) {
  try {
    const client = createApiClient(ambiente);
    const apiConfig = getApiConfig(ambiente);
    
    logger.info('🔗 [WEBHOOK] Listando webhooks da Focus NFe', {
      ambiente: apiConfig.ambiente
    });
    
    const response = await client.get('/hooks');
    
    logger.info('✅ [WEBHOOK] Webhooks listados com sucesso', {
      total: Array.isArray(response.data) ? response.data.length : 1,
      ambiente: apiConfig.ambiente
    });
    
    return {
      sucesso: true,
      hooks: Array.isArray(response.data) ? response.data : [response.data]
    };
  } catch (error) {
    const statusCode = error.response?.status;
    const erro = error.response?.data || error.message;
    
    logger.error('❌ [WEBHOOK] Erro ao listar webhooks', {
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: statusCode,
      ambiente: ambiente || 'padrão'
    });
    
    return {
      sucesso: false,
      erro: erro,
      erro_status: statusCode,
      mensagem: error.response?.data?.mensagem || error.message
    };
  }
}

/**
 * Consulta um webhook específico
 * @param {string} hookId - ID do webhook
 * @param {string} [ambiente] - Ambiente (homologacao ou producao)
 */
async function consultarWebhook(hookId, ambiente = null) {
  try {
    const client = createApiClient(ambiente);
    const apiConfig = getApiConfig(ambiente);
    
    logger.info('🔗 [WEBHOOK] Consultando webhook', {
      hook_id: hookId,
      ambiente: apiConfig.ambiente
    });
    
    const response = await client.get(`/hooks/${hookId}`);
    
    logger.info('✅ [WEBHOOK] Webhook consultado com sucesso', {
      hook_id: hookId,
      ambiente: apiConfig.ambiente
    });
    
    return {
      sucesso: true,
      hook: response.data
    };
  } catch (error) {
    const statusCode = error.response?.status;
    const erro = error.response?.data || error.message;
    
    logger.error('❌ [WEBHOOK] Erro ao consultar webhook', {
      hook_id: hookId,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: statusCode,
      ambiente: ambiente || 'padrão'
    });
    
    return {
      sucesso: false,
      erro: erro,
      erro_status: statusCode,
      mensagem: error.response?.data?.mensagem || error.message
    };
  }
}

/**
 * Deleta um webhook
 * @param {string} hookId - ID do webhook
 * @param {string} [ambiente] - Ambiente (homologacao ou producao)
 */
async function deletarWebhook(hookId, ambiente = null) {
  try {
    const client = createApiClient(ambiente);
    const apiConfig = getApiConfig(ambiente);
    
    logger.info('🔗 [WEBHOOK] Deletando webhook', {
      hook_id: hookId,
      ambiente: apiConfig.ambiente
    });
    
    const response = await client.delete(`/hooks/${hookId}`);
    
    logger.info('✅ [WEBHOOK] Webhook deletado com sucesso', {
      hook_id: hookId,
      ambiente: apiConfig.ambiente
    });
    
    return {
      sucesso: true,
      hook: response.data
    };
  } catch (error) {
    const statusCode = error.response?.status;
    const erro = error.response?.data || error.message;
    
    logger.error('❌ [WEBHOOK] Erro ao deletar webhook', {
      hook_id: hookId,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: statusCode,
      ambiente: ambiente || 'padrão'
    });
    
    return {
      sucesso: false,
      erro: erro,
      erro_status: statusCode,
      mensagem: error.response?.data?.mensagem || error.message
    };
  }
}

/**
 * Solicita reenvio de notificação para uma nota específica
 * @param {string} referencia - Referência da nota
 * @param {string} tipoNota - Tipo de nota (nfe, nfse, etc)
 * @param {string} [ambiente] - Ambiente (homologacao ou producao)
 */
async function reenviarNotificacao(referencia, tipoNota, ambiente = null) {
  try {
    const client = createApiClient(ambiente);
    const apiConfig = getApiConfig(ambiente);
    
    logger.info('🔗 [WEBHOOK] Reenviando notificação', {
      referencia,
      tipo_nota: tipoNota,
      ambiente: apiConfig.ambiente
    });
    
    const response = await client.post(`/${tipoNota}/${referencia}/hook`, {});
    
    logger.info('✅ [WEBHOOK] Notificação reenviada com sucesso', {
      referencia,
      tipo_nota: tipoNota,
      hooks_acionados: Array.isArray(response.data) ? response.data.length : 0,
      ambiente: apiConfig.ambiente
    });
    
    return {
      sucesso: true,
      hooks: Array.isArray(response.data) ? response.data : [response.data]
    };
  } catch (error) {
    const statusCode = error.response?.status;
    const erro = error.response?.data || error.message;
    
    logger.error('❌ [WEBHOOK] Erro ao reenviar notificação', {
      referencia,
      tipo_nota: tipoNota,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: statusCode,
      ambiente: ambiente || 'padrão'
    });
    
    return {
      sucesso: false,
      erro: erro,
      erro_status: statusCode,
      mensagem: error.response?.data?.mensagem || error.message
    };
  }
}

module.exports = {
  criarWebhook,
  listarWebhooks,
  consultarWebhook,
  deletarWebhook,
  reenviarNotificacao
};

