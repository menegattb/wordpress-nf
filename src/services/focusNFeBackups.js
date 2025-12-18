const axios = require('axios');
const config = require('../../config');
const logger = require('./logger');

/**
 * Configuração da API Focus NFe (usa a mesma configuração do focusNFe.js)
 */
function getApiConfig() {
  const ambiente = process.env.FOCUS_NFE_AMBIENTE || config.focusNFe.ambiente || 'homologacao';
  const baseUrl = ambiente === 'producao' 
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
  
  let token = null;
  
  if (ambiente === 'producao') {
    token = process.env.FOCUS_NFE_TOKEN_PRODUCAO;
    
    if (!token || token === 'undefined' || token.trim() === '') {
      throw new Error(
        '⚠️ Token de PRODUÇÃO não configurado!\n\n' +
        'Para buscar backups em produção, configure a variável de ambiente:\n' +
        'FOCUS_NFE_TOKEN_PRODUCAO=seu_token_de_producao\n\n' +
        'O token de produção é diferente do token de homologação e deve ser obtido no painel da Focus NFe.'
      );
    }
  } else {
    token = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
    
    if (!token || token === 'undefined' || token.trim() === '') {
      token = '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
    }
  }
  
  logger.debug('Configuração Focus NFe Backups', {
    service: 'focusNFeBackups',
    action: 'getApiConfig',
    ambiente,
    token_preview: token ? `${token.substring(0, 10)}...` : 'N/A',
    baseUrl: `${baseUrl}/v2`
  });
  
  return {
    baseUrl: `${baseUrl}/v2`,
    token,
    ambiente
  };
}

/**
 * Cria cliente HTTP para Focus NFe Backups
 */
function createApiClient() {
  const apiConfig = getApiConfig();
  
  if (!apiConfig.token) {
    throw new Error('Token Focus NFe não configurado');
  }
  
  logger.debug('Criando cliente HTTP Focus NFe Backups', {
    service: 'focusNFeBackups',
    action: 'createApiClient',
    baseURL: apiConfig.baseUrl,
    token_preview: apiConfig.token.substring(0, 10) + '...'
  });
  
  return axios.create({
    baseURL: apiConfig.baseUrl,
    auth: {
      username: apiConfig.token,
      password: ''
    },
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000 // 30 segundos
  });
}

/**
 * Busca backups de XMLs das notas fiscais (NFe)
 * @param {string} cnpj - CNPJ da empresa (sem formatação)
 * @returns {Promise<Object>} Objeto com array de backups
 */
async function buscarBackups(cnpj = null) {
  const api = createApiClient();
  const cnpjFormatado = cnpj || config.focusNFe.cnpj || config.emitente.cnpj;
  
  if (!cnpjFormatado) {
    throw new Error('CNPJ não configurado. Configure FOCUS_NFE_CNPJ ou PRESTADOR_CNPJ');
  }
  
  // Remover formatação do CNPJ (apenas números)
  const cnpjLimpo = cnpjFormatado.replace(/\D/g, '');
  
  try {
    logger.info('Buscando backups de XMLs da Focus NFe', {
      service: 'focusNFeBackups',
      action: 'buscarBackups',
      cnpj: cnpjLimpo,
      url: `${api.defaults.baseURL}/backups/${cnpjLimpo}.json`
    });
    
    const response = await api.get(`/backups/${cnpjLimpo}.json`);
    
    logger.info('Backups encontrados', {
      service: 'focusNFeBackups',
      action: 'buscarBackups',
      total: response.data?.backups?.length || 0,
      cnpj: cnpjLimpo
    });
    
    return {
      sucesso: true,
      backups: response.data?.backups || [],
      total: response.data?.backups?.length || 0
    };
    
  } catch (error) {
    const statusCode = error.response?.status;
    const erro = error.response?.data || error.message;
    
    // 404 significa que não há backups (situação normal, não é erro)
    if (statusCode === 404) {
      logger.info('Nenhum backup encontrado na Focus NFe (404)', {
        service: 'focusNFeBackups',
        action: 'buscarBackups',
        cnpj: cnpjLimpo,
        status_code: 404,
        mensagem: 'Nenhum backup disponível ainda'
      });
      
      return {
        sucesso: true,
        backups: [],
        total: 0,
        mensagem: 'Nenhum backup disponível. Os backups são gerados mensalmente (dia 1) e semanalmente (sábados).'
      };
    }
    
    logger.error('Erro ao buscar backups da Focus NFe', {
      service: 'focusNFeBackups',
      action: 'buscarBackups',
      cnpj: cnpjLimpo,
      error: error.message,
      status: statusCode,
      data: erro
    });
    
    return {
      sucesso: false,
      erro: erro,
      status: statusCode
    };
  }
}

module.exports = {
  buscarBackups,
  getApiConfig
};

