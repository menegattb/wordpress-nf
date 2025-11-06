const axios = require('axios');
const config = require('../../config');
const logger = require('./logger');
const { validarCamposNFSe } = require('./validator');
const { mapearPedidoParaNFSe } = require('../utils/mapeador');
const { salvarNFSe, atualizarNFSe, buscarNFSePorReferencia } = require('../config/database');

/**
 * Configuração da API Focus NFe
 */
function getApiConfig() {
  const ambiente = process.env.FOCUS_NFE_AMBIENTE || config.focusNFe.ambiente || 'homologacao';
  const baseUrl = ambiente === 'producao' 
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
  
  // Tentar obter token do ambiente, se não tiver, usar do config.js
  let token = null;
  
  if (ambiente === 'producao') {
    token = process.env.FOCUS_NFE_TOKEN_PRODUCAO || config.focusNFe.token;
  } else {
    // Homologação: tentar variável de ambiente primeiro, depois config.js, depois padrão
    token = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
  }
  
  // Verificar se o token do config.js está vazio/undefined e usar padrão
  if (!token || token === 'undefined' || token.trim() === '') {
    if (ambiente === 'homologacao') {
      token = '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
    } else {
      token = config.focusNFe.token;
    }
  }
  
  if (!token) {
    throw new Error('Token Focus NFe não configurado. Configure FOCUS_NFE_TOKEN_HOMOLOGACAO ou FOCUS_NFE_TOKEN_PRODUCAO');
  }
  
  logger.debug('Configuração Focus NFe', {
    service: 'focusNFe',
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
 * Cria cliente HTTP para Focus NFe
 */
function createApiClient() {
  const apiConfig = getApiConfig();
  
  if (!apiConfig.token) {
    throw new Error('Token Focus NFe não configurado');
  }
  
  logger.debug('Criando cliente HTTP Focus NFe', {
    service: 'focusNFe',
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
 * Emite uma NFSe
 */
async function emitirNFSe(dadosPedido, configEmitente, configFiscal = null) {
  const referencia = dadosPedido.referencia || `PED-${dadosPedido.pedido_id || Date.now()}`;
  
  // Obter configuração da API antes do try para estar disponível no catch
  let apiConfig = null;
  try {
    apiConfig = getApiConfig();
  } catch (configError) {
    logger.error('Erro ao obter configuração da API', {
      service: 'focusNFe',
      action: 'emitir_nfse',
      error: configError.message
    });
    throw configError;
  }
  
  logger.focusNFe('emitir_nfse', 'Iniciando emissão de NFSe', {
    pedido_id: dadosPedido.pedido_id,
    referencia
  });
  
  try {
    // Mapear dados para formato Focus NFSe
    logger.focusNFe('emitir_nfse', 'Mapeando dados para formato Focus NFSe', {
      pedido_id: dadosPedido.pedido_id,
      referencia
    });
    
    const fiscalConfig = configFiscal || config.fiscal;
    const nfseData = await mapearPedidoParaNFSe(dadosPedido, configEmitente, fiscalConfig);
    
    // Validação básica (campos obrigatórios)
    logger.focusNFe('emitir_nfse', 'Validando campos obrigatórios', {
      pedido_id: dadosPedido.pedido_id,
      referencia
    });
    
    // Validação básica dos campos essenciais
    if (!nfseData.prestador?.cnpj) {
      throw new Error('CNPJ do prestador é obrigatório');
    }
    if (!nfseData.tomador?.cpf && !nfseData.tomador?.cnpj) {
      throw new Error('CPF ou CNPJ do tomador é obrigatório');
    }
    if (!nfseData.servico?.valor_servicos) {
      throw new Error('Valor dos serviços é obrigatório');
    }
    
    // Validar campos obrigatórios adicionais
    if (!nfseData.prestador?.codigo_municipio) {
      throw new Error('Código do município do prestador é obrigatório');
    }
    if (!nfseData.tomador?.endereco?.codigo_municipio) {
      throw new Error('Código do município do tomador é obrigatório');
    }
    if (!nfseData.tomador?.endereco?.cep) {
      throw new Error('CEP do tomador é obrigatório');
    }
    if (!nfseData.tomador?.razao_social) {
      throw new Error('Razão social do tomador é obrigatória');
    }
    if (!nfseData.servico?.discriminacao) {
      throw new Error('Discriminação do serviço é obrigatória');
    }
    if (!nfseData.servico?.item_lista_servico) {
      throw new Error('Item da lista de serviço é obrigatório');
    }
    
    // Validar formato do CEP (deve ter 8 dígitos)
    const cepTomador = nfseData.tomador?.endereco?.cep?.replace(/\D/g, '') || '';
    if (cepTomador.length !== 8) {
      throw new Error(`CEP do tomador deve ter 8 dígitos. Valor recebido: ${nfseData.tomador?.endereco?.cep}`);
    }
    
    // Validar formato do código do município (deve ter 7 dígitos)
    const codMunicipioTomador = nfseData.tomador?.endereco?.codigo_municipio?.toString().replace(/\D/g, '') || '';
    if (codMunicipioTomador.length !== 7) {
      throw new Error(`Código do município do tomador deve ter 7 dígitos (IBGE). Valor recebido: ${nfseData.tomador?.endereco?.codigo_municipio}`);
    }
    
    const codMunicipioPrestador = nfseData.prestador?.codigo_municipio?.toString().replace(/\D/g, '') || '';
    if (codMunicipioPrestador.length !== 7) {
      throw new Error(`Código do município do prestador deve ter 7 dígitos (IBGE). Valor recebido: ${nfseData.prestador?.codigo_municipio}`);
    }
    
    // Validar token antes de criar cliente
    if (!apiConfig.token) {
      throw new Error('Token Focus NFe não configurado. Verifique FOCUS_NFE_TOKEN_HOMOLOGACAO ou FOCUS_NFE_TOKEN_PRODUCAO');
    }
    
    const api = createApiClient();
    
    logger.focusNFe('emitir_nfse', `Enviando NFSe para Focus NFe (${apiConfig.ambiente})`, {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      url: `${apiConfig.baseUrl}/nfse?ref=${referencia}`,
      token_preview: apiConfig.token ? apiConfig.token.substring(0, 10) + '...' : 'N/A'
    });
    
    // Log do payload que será enviado (sem dados sensíveis)
    logger.debug('Payload NFSe', {
      service: 'focusNFe',
      action: 'emitir_nfse',
      referencia,
      prestador_cnpj: nfseData.prestador?.cnpj,
      tomador: nfseData.tomador?.razao_social,
      valor_servicos: nfseData.servico?.valor_servicos
    });
    
    // Log COMPLETO do payload para debug (em modo desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n═══════════ PAYLOAD COMPLETO (DEBUG) ═══════════');
      console.log(JSON.stringify(nfseData, null, 2));
      console.log('═══════════════════════════════════════════════\n');
      
      logger.debug('Payload completo (JSON)', {
        service: 'focusNFe',
        action: 'emitir_nfse',
        referencia,
        payload: JSON.stringify(nfseData, null, 2)
      });
    }
    
    // Log do request completo antes de enviar
    logger.debug('Request completo', {
      service: 'focusNFe',
      action: 'emitir_nfse',
      metodo: 'POST',
      url: `${apiConfig.baseUrl}/nfse?ref=${referencia}`,
      has_token: !!apiConfig.token,
      token_length: apiConfig.token ? apiConfig.token.length : 0
    });
    
    const response = await api.post(`/nfse?ref=${referencia}`, nfseData);
    
    logger.focusNFe('emitir_nfse', 'Resposta recebida da Focus NFe', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz,
      status_code: response.status
    });
    
    // Salvar no banco de dados
    const nfse = await salvarNFSe({
      pedido_id: dadosPedido.pedido_id_db || null,
      referencia: referencia,
      chave_nfse: response.data.chave_nfse || null,
      status_focus: response.data.status || 'processando_autorizacao',
      status_sefaz: response.data.status_sefaz || null,
      mensagem_sefaz: response.data.mensagem_sefaz || null,
      caminho_xml: response.data.caminho_xml || null,
      caminho_pdf: response.data.caminho_pdf || null,
      dados_completos: response.data
    });
    
    logger.focusNFe('emitir_nfse', 'NFSe registrada no banco de dados', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      status: response.data.status
    });
    
    return {
      sucesso: true,
      referencia: referencia,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz,
      mensagem_sefaz: response.data.mensagem_sefaz,
      chave_nfse: response.data.chave_nfse || null,
      caminho_xml: response.data.caminho_xml || null,
      caminho_pdf: response.data.caminho_pdf || null,
      dados: response.data,
      nfse_id: nfse.id
    };
    
  } catch (error) {
    const erro = error.response?.data || error.message;
    
    // Log completo do erro em modo desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n═══════════ ERRO COMPLETO (DEBUG) ═══════════');
      console.log('Status Code:', error.response?.status);
      console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Request URL:', error.config?.url);
      console.log('Request Method:', error.config?.method);
      if (error.config?.data) {
        console.log('Request Payload:', JSON.stringify(JSON.parse(error.config.data), null, 2));
      }
      console.log('═══════════════════════════════════════════════\n');
    }
    
    logger.focusNFe('emitir_nfse', 'Erro ao emitir NFSe', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: error.response?.status,
      error_message: error.message,
      has_response: !!error.response,
      response_data: error.response?.data,
      response_data_full: JSON.stringify(error.response?.data, null, 2),
      request_url: error.config?.url,
      request_method: error.config?.method,
      api_config: {
        ambiente: apiConfig?.ambiente,
        baseUrl: apiConfig?.baseUrl,
        has_token: !!apiConfig?.token,
        token_length: apiConfig?.token ? apiConfig.token.length : 0
      }
    });
    
    // Se o erro for de autenticação, logar detalhes
    if (error.response?.status === 401 || error.response?.status === 403) {
      const ambienteAtual = apiConfig?.ambiente || 'homologacao';
      logger.error('ERRO DE AUTENTICAÇÃO - Verifique o token', {
        service: 'focusNFe',
        action: 'emitir_nfse',
        status_code: error.response.status,
        error_data: error.response.data,
        token_config: {
          ambiente: ambienteAtual,
          token_preview: apiConfig?.token ? apiConfig.token.substring(0, 15) + '...' : 'TOKEN NÃO ENCONTRADO',
          token_length: apiConfig?.token ? apiConfig.token.length : 0,
          env_token_exists: ambienteAtual === 'producao' ? !!process.env.FOCUS_NFE_TOKEN_PRODUCAO : !!process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO
        }
      });
    }
    
    // Salvar erro no banco se possível
    try {
      await salvarNFSe({
        pedido_id: dadosPedido.pedido_id_db || null,
        referencia: referencia,
        status_focus: 'erro_autorizacao',
        status_sefaz: error.response?.status?.toString(),
        mensagem_sefaz: typeof erro === 'string' ? erro : JSON.stringify(erro),
        dados_completos: { erro }
      });
    } catch (dbError) {
      logger.error('Erro ao salvar NFSe com erro no banco', { error: dbError.message });
    }
    
    // Extrair detalhes do erro
    const erroData = error.response?.data || {};
    const codigoErro = erroData.Codigo || erroData.codigo || erroData.Cod || erroData.cod || null;
    const mensagemErro = erroData.Descricao || erroData.descricao || erroData.Desc || erroData.desc || erroData.mensagem || error.message;
    const mensagemSefaz = erroData.mensagem_sefaz || erroData.Mensagem || null;
    
    return {
      sucesso: false,
      referencia: referencia,
      erro: erro,
      erro_data: erroData,
      codigo_erro: codigoErro,
      mensagem: mensagemErro,
      mensagem_sefaz: mensagemSefaz,
      dados_completos: erroData
    };
  }
}

/**
 * Consulta status de uma NFSe
 */
async function consultarNFSe(referencia) {
  logger.focusNFe('consultar_nfse', 'Consultando status da NFSe', {
    referencia
  });
  
  try {
    const api = createApiClient();
    
    const response = await api.get(`/nfse/${referencia}.json`);
    
    logger.focusNFe('consultar_nfse', 'Status consultado', {
      referencia,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz
    });
    
    // Atualizar no banco de dados
    const nfseExistente = await buscarNFSePorReferencia(referencia);
    if (nfseExistente) {
      await atualizarNFSe(referencia, {
        chave_nfse: response.data.chave_nfse || nfseExistente.chave_nfse,
        status_focus: response.data.status,
        status_sefaz: response.data.status_sefaz || null,
        mensagem_sefaz: response.data.mensagem_sefaz || null,
        caminho_xml: response.data.caminho_xml || response.data.caminho_xml_nota_fiscal || nfseExistente.caminho_xml,
        caminho_pdf: response.data.caminho_pdf || response.data.caminho_danfe || nfseExistente.caminho_pdf,
        dados_completos: response.data
      });
    }
    
    return {
      sucesso: true,
      referencia: referencia,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz,
      mensagem_sefaz: response.data.mensagem_sefaz,
      chave_nfse: response.data.chave_nfse,
      caminho_xml: response.data.caminho_xml || response.data.caminho_xml_nota_fiscal,
      caminho_pdf: response.data.caminho_pdf || response.data.caminho_danfe,
      dados: response.data
    };
    
  } catch (error) {
    const erro = error.response?.data || error.message;
    
    logger.focusNFe('consultar_nfse', 'Erro ao consultar NFSe', {
      referencia,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: error.response?.status
    });
    
    return {
      sucesso: false,
      referencia: referencia,
      erro: erro,
      mensagem: error.response?.data?.mensagem || error.message
    };
  }
}

/**
 * Cancela uma NFSe
 */
async function cancelarNFSe(referencia, justificativa) {
  logger.focusNFe('cancelar_nfse', 'Cancelando NFSe', {
    referencia,
    justificativa
  });
  
  try {
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter pelo menos 15 caracteres');
    }
    
    const api = createApiClient();
    
    const response = await api.delete(`/nfse/${referencia}.json`, {
      data: {
        justificativa: justificativa
      }
    });
    
    logger.focusNFe('cancelar_nfse', 'NFSe cancelada', {
      referencia,
      status: response.data.status
    });
    
    // Atualizar no banco
    await atualizarNFSe(referencia, {
      status_focus: response.data.status || 'cancelado',
      status_sefaz: response.data.status_sefaz,
      mensagem_sefaz: response.data.mensagem_sefaz,
      dados_completos: response.data
    });
    
    return {
      sucesso: true,
      referencia: referencia,
      status: response.data.status,
      dados: response.data
    };
    
  } catch (error) {
    const erro = error.response?.data || error.message;
    
    logger.focusNFe('cancelar_nfse', 'Erro ao cancelar NFSe', {
      referencia,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro)
    });
    
    return {
      sucesso: false,
      referencia: referencia,
      erro: erro
    };
  }
}

module.exports = {
  emitirNFSe,
  consultarNFSe,
  cancelarNFSe,
  getApiConfig
};

