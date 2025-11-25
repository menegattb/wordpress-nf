const axios = require('axios');
const config = require('../../config');
const logger = require('./logger');
const { mapearPedidoParaNFe } = require('../utils/mapeador');
const { salvarNFe, atualizarNFe, buscarNFePorReferencia } = require('../config/database');
const { buscarCodigoMunicipioPorCEP, buscarCodigoMunicipioPorCidadeEstado } = require('./cepService');

/**
 * Configuração da API Focus NFe (usa a mesma configuração do NFSe)
 */
function getApiConfig() {
  const ambiente = process.env.FOCUS_NFE_AMBIENTE || config.focusNFe.ambiente || 'homologacao';
  const baseUrl = ambiente === 'producao' 
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
  
  let token = null;
  
  if (ambiente === 'producao') {
    // Em produção, EXIGIR token de produção explicitamente
    // Não usar fallback do token de homologação para evitar erros
    token = process.env.FOCUS_NFE_TOKEN_PRODUCAO;
    
    if (!token || token === 'undefined' || token.trim() === '') {
      throw new Error(
        '⚠️ Token de PRODUÇÃO não configurado!\n\n' +
        'Para emitir notas em produção, configure a variável de ambiente:\n' +
        'FOCUS_NFE_TOKEN_PRODUCAO=seu_token_de_producao\n\n' +
        'O token de produção é diferente do token de homologação e deve ser obtido no painel da Focus NFe.'
      );
    }
  } else {
    // Homologação: pode usar fallback com token padrão
    token = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
    
    // Garantir que não está vazio
    if (!token || token === 'undefined' || token.trim() === '') {
      token = '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
    }
  }
  
  logger.debug('Configuração Focus NFe (Produto)', {
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
 * Emite uma NFe de Produto
 */
async function emitirNFe(dadosPedido, configEmitente, configFiscal = null) {
  const referencia = dadosPedido.referencia || `NFE-${dadosPedido.pedido_id || Date.now()}`;
  
  let apiConfig = null;
  try {
    apiConfig = getApiConfig();
  } catch (configError) {
    logger.error('Erro ao obter configuração da API', {
      service: 'focusNFe',
      action: 'emitir_nfe',
      error: configError.message
    });
    throw configError;
  }
  
  logger.focusNFe('emitir_nfe', 'Iniciando emissão de NFe', {
    pedido_id: dadosPedido.pedido_id,
    referencia
  });
  
  try {
    // Mapear dados para formato Focus NFe
    logger.focusNFe('emitir_nfe', 'Mapeando dados para formato Focus NFe', {
      pedido_id: dadosPedido.pedido_id,
      referencia
    });
    
    const fiscalConfig = configFiscal || config.fiscal;
    const nfeData = await mapearPedidoParaNFe(dadosPedido, configEmitente, fiscalConfig);
    
    // Validação básica dos campos essenciais
    if (!nfeData.cnpj_emitente) {
      throw new Error('CNPJ do emitente é obrigatório');
    }
    if (!nfeData.cpf_destinatario && !nfeData.cnpj_destinatario) {
      throw new Error('CPF ou CNPJ do destinatário é obrigatório');
    }
    if (!nfeData.items || nfeData.items.length === 0) {
      throw new Error('A NFe deve ter pelo menos um item');
    }
    if (!nfeData.valor_total) {
      throw new Error('Valor total é obrigatório');
    }
    
    // Validar token antes de criar cliente
    if (!apiConfig.token) {
      throw new Error('Token Focus NFe não configurado. Verifique FOCUS_NFE_TOKEN_HOMOLOGACAO ou FOCUS_NFE_TOKEN_PRODUCAO');
    }
    
    const api = createApiClient();
    
    logger.focusNFe('emitir_nfe', `Enviando NFe para Focus NFe (${apiConfig.ambiente})`, {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      url: `${apiConfig.baseUrl}/nfe?ref=${referencia}`,
      token_preview: apiConfig.token ? apiConfig.token.substring(0, 10) + '...' : 'N/A'
    });
    
    // Log do payload que será enviado (sem dados sensíveis)
    logger.debug('Payload NFe', {
      service: 'focusNFe',
      action: 'emitir_nfe',
      referencia,
      emitente_cnpj: nfeData.cnpj_emitente,
      destinatario: nfeData.nome_destinatario,
      valor_total: nfeData.valor_total,
      items_count: nfeData.items.length
    });
    
    // Log COMPLETO do payload para debug (em modo desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n═══════════ PAYLOAD COMPLETO NFe (DEBUG) ═══════════');
      console.log(JSON.stringify(nfeData, null, 2));
      console.log('═══════════════════════════════════════════════\n');
      
      logger.debug('Payload completo NFe (JSON)', {
        service: 'focusNFe',
        action: 'emitir_nfe',
        referencia,
        payload: JSON.stringify(nfeData, null, 2)
      });
    }
    
    let response;
    try {
      response = await api.post(`/nfe?ref=${referencia}`, nfeData);
    } catch (firstError) {
      // Se o erro for relacionado a código IBGE do município, tentar buscar e reenviar
      const erroData = firstError.response?.data || {};
      const mensagemErro = erroData.mensagem || erroData.Descricao || erroData.descricao || '';
      const codigoErro = erroData.codigo || erroData.Codigo || '';
      
      // Verificar se o erro é relacionado a código IBGE/município
      const mensagemErroLower = mensagemErro.toLowerCase();
      const isErroCodigoIBGE = (mensagemErroLower.includes('código') && 
                                (mensagemErroLower.includes('município') || 
                                 mensagemErroLower.includes('ibge') ||
                                 mensagemErroLower.includes('municipio'))) ||
                                (mensagemErroLower.includes('município') && mensagemErroLower.includes('inválido')) ||
                                (mensagemErroLower.includes('municipio') && mensagemErroLower.includes('invalido'));
      
      if (isErroCodigoIBGE && dadosPedido.endereco?.cep && dadosPedido.endereco?.cidade && dadosPedido.endereco?.estado) {
        logger.warn('Focus NFe rejeitou por código IBGE, tentando buscar código IBGE e reenviar', {
          service: 'focusNFe',
          action: 'emitir_nfe',
          pedido_id: dadosPedido.pedido_id,
          referencia,
          erro: mensagemErro
        });
        
        try {
          // Tentar buscar código IBGE do destinatário
          const cepDestinatario = dadosPedido.endereco.cep.replace(/\D/g, '').padStart(8, '0').substring(0, 8);
          let dadosMunicipio;
          
          try {
            dadosMunicipio = await buscarCodigoMunicipioPorCEP(cepDestinatario);
          } catch (cepError) {
            // Tentar por cidade/estado
            dadosMunicipio = await buscarCodigoMunicipioPorCidadeEstado(
              dadosPedido.endereco.cidade,
              dadosPedido.endereco.estado
            );
          }
          
          // Atualizar nfeData com dados do município encontrado (cidade/UF podem ter sido corrigidos)
          if (dadosMunicipio && dadosMunicipio.codigoIBGE) {
            // Atualizar cidade e UF com dados corretos da API (pode corrigir nomes)
            nfeData.municipio_destinatario = dadosMunicipio.cidade;
            nfeData.uf_destinatario = dadosMunicipio.uf;
            // Adicionar código IBGE se disponível (algumas APIs aceitam)
            nfeData.codigo_ibge_destinatario = dadosMunicipio.codigoIBGE;
            if (dadosMunicipio.bairro) {
              nfeData.bairro_destinatario = dadosMunicipio.bairro;
            }
            
            logger.info('Dados do município encontrados, reenviando NFe com dados corrigidos', {
              service: 'focusNFe',
              action: 'emitir_nfe',
              pedido_id: dadosPedido.pedido_id,
              codigo_ibge: dadosMunicipio.codigoIBGE,
              cidade: dadosMunicipio.cidade,
              uf: dadosMunicipio.uf,
              cidade_original: dadosPedido.endereco.cidade,
              uf_original: dadosPedido.endereco.estado
            });
            
            // Reenviar com dados corrigidos
            response = await api.post(`/nfe?ref=${referencia}`, nfeData);
          } else {
            // Se não conseguir buscar, lançar erro original
            throw firstError;
          }
        } catch (retryError) {
          // Se falhar ao buscar código IBGE, lançar erro original
          logger.error('Falha ao buscar código IBGE para retry', {
            service: 'focusNFe',
            action: 'emitir_nfe',
            pedido_id: dadosPedido.pedido_id,
            retry_error: retryError.message
          });
          throw firstError;
        }
      } else {
        // Se não for erro de código IBGE, lançar erro original
        throw firstError;
      }
    }
    
    // Verificar se há erro da SEFAZ (status_sefaz diferente de 100, 135, etc indica erro)
    const statusSefaz = response.data.status_sefaz;
    const mensagemSefaz = response.data.mensagem_sefaz || '';
    const statusFocus = response.data.status || '';
    
    // Status SEFAZ que indicam sucesso: 100 (autorizado), 135 (evento registrado)
    const statusSefazSucesso = ['100', '135'];
    const isErroSefaz = statusSefaz && !statusSefazSucesso.includes(statusSefaz.toString());
    const isErroFocus = statusFocus === 'erro_autorizacao' || statusFocus === 'denegado';
    
    // Log destacado se houver erro da SEFAZ/Focus NFe
    if (isErroSefaz || isErroFocus) {
      logger.error('⚠️ REJEIÇÃO DA SEFAZ/FOCUS NFE - Problema na configuração da empresa', {
        service: 'focusNFe',
        action: 'emitir_nfe',
        pedido_id: dadosPedido.pedido_id,
        referencia,
        status_focus: statusFocus,
        status_sefaz: statusSefaz,
        mensagem_sefaz: mensagemSefaz,
        observacao: 'Este é um problema de configuração na Focus NFe/SEFAZ, não do sistema. Verifique:',
        possiveis_causas: [
          'Empresa não habilitada para emissão de NFe na Focus NFe',
          'Certificado digital vencido ou inválido',
          'CNPJ não autorizado para emissão de NFe',
          'Configuração incorreta no painel da Focus NFe',
          'Problema com a inscrição estadual'
        ],
        response_data: response.data
      });
      
      // Log no console também para destacar
      console.log('\n⚠️ ═══════════ REJEIÇÃO SEFAZ/FOCUS NFE ═══════════');
      console.log('Status SEFAZ:', statusSefaz);
      console.log('Mensagem SEFAZ:', mensagemSefaz);
      console.log('Status Focus:', statusFocus);
      console.log('Referência:', referencia);
      console.log('⚠️ Este é um problema de configuração na Focus NFe/SEFAZ, não do sistema.');
      console.log('═══════════════════════════════════════════════\n');
    }
    
    logger.focusNFe('emitir_nfe', 'Resposta recebida da Focus NFe', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      status: statusFocus,
      status_sefaz: statusSefaz,
      mensagem_sefaz: mensagemSefaz,
      status_code: response.status,
      is_erro_sefaz: isErroSefaz,
      is_erro_focus: isErroFocus,
      response_data: response.data
    });
    
    // Salvar no banco de dados
    const nfe = await salvarNFe({
      pedido_id: dadosPedido.pedido_id_db || null,
      referencia: referencia,
      chave_nfe: response.data.chave_nfe || null,
      status_focus: statusFocus || 'processando_autorizacao',
      status_sefaz: statusSefaz || null,
      mensagem_sefaz: mensagemSefaz || null,
      caminho_xml_nota_fiscal: response.data.caminho_xml_nota_fiscal || null,
      caminho_danfe: response.data.caminho_danfe || null,
      dados_completos: response.data,
      ambiente: apiConfig.ambiente || 'homologacao'
    });
    
    logger.focusNFe('emitir_nfe', 'NFe registrada no banco de dados', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      status: statusFocus,
      status_sefaz: statusSefaz,
      mensagem_sefaz: mensagemSefaz
    });
    
    // Se houver erro da SEFAZ, retornar como erro (mesmo que a requisição HTTP tenha sido bem-sucedida)
    if (isErroSefaz || isErroFocus) {
      return {
        sucesso: false,
        referencia: referencia,
        status: statusFocus,
        status_sefaz: statusSefaz,
        mensagem_sefaz: mensagemSefaz,
        erro: mensagemSefaz || 'Erro na autorização da NFe pela SEFAZ',
        mensagem: `Rejeição da SEFAZ/Focus NFe: ${mensagemSefaz || 'Erro desconhecido'}`,
        is_erro_configuracao: true, // Indica que é problema de configuração, não do sistema
        dados: response.data,
        nfe_id: nfe.id
      };
    }
    
    return {
      sucesso: true,
      referencia: referencia,
      status: statusFocus,
      status_sefaz: statusSefaz,
      mensagem_sefaz: mensagemSefaz,
      chave_nfe: response.data.chave_nfe || null,
      caminho_xml_nota_fiscal: response.data.caminho_xml_nota_fiscal || null,
      caminho_danfe: response.data.caminho_danfe || null,
      dados: response.data,
      nfe_id: nfe.id
    };
    
  } catch (error) {
    const erro = error.response?.data || error.message;
    
    // Log completo do erro em modo desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n═══════════ ERRO COMPLETO NFe (DEBUG) ═══════════');
      console.log('Status Code:', error.response?.status);
      console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Request URL:', error.config?.url);
      console.log('Request Method:', error.config?.method);
      console.log('Error Code:', error.code);
      console.log('Error Message:', error.message);
      console.log('Has Response:', !!error.response);
      console.log('Base URL:', apiConfig?.baseUrl);
      console.log('Full URL:', error.config ? `${apiConfig?.baseUrl}${error.config.url}` : 'N/A');
      if (error.config?.data) {
        try {
          const payload = typeof error.config.data === 'string' ? JSON.parse(error.config.data) : error.config.data;
          console.log('Request Payload:', JSON.stringify(payload, null, 2));
        } catch (e) {
          console.log('Request Payload (raw):', error.config.data);
        }
      }
      console.log('═══════════════════════════════════════════════\n');
    }
    
    logger.focusNFe('emitir_nfe', 'Erro ao emitir NFe', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: error.response?.status,
      error_code: error.code, // Código do erro (ECONNREFUSED, ETIMEDOUT, etc)
      error_message: error.message,
      has_response: !!error.response,
      response_data: error.response?.data,
      response_data_full: JSON.stringify(error.response?.data, null, 2),
      request_url: error.config?.url,
      request_method: error.config?.method,
      full_url: error.config ? `${apiConfig?.baseUrl}${error.config.url}` : 'N/A',
      api_config: {
        ambiente: apiConfig?.ambiente,
        baseUrl: apiConfig?.baseUrl,
        has_token: !!apiConfig?.token,
        token_length: apiConfig?.token ? apiConfig.token.length : 0
      },
      // Informações adicionais para erros de conexão
      is_connection_error: !error.response && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND'),
      connection_error_details: !error.response ? {
        code: error.code,
        message: error.message,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      } : null
    });
    
    // Se o erro for de conexão (sem response), logar detalhes
    if (!error.response) {
      logger.error('ERRO DE CONEXÃO - Requisição não chegou ao servidor Focus NFe', {
        service: 'focusNFe',
        action: 'emitir_nfe',
        error_code: error.code,
        error_message: error.message,
        base_url: apiConfig?.baseUrl,
        full_url: error.config ? `${apiConfig?.baseUrl}${error.config.url}` : 'N/A',
        connection_details: {
          code: error.code,
          syscall: error.syscall,
          address: error.address,
          port: error.port
        },
        possible_causes: [
          'Servidor Focus NFe pode estar fora do ar',
          'Problema de conexão com a internet',
          'Firewall bloqueando a conexão',
          'URL da API incorreta',
          'Timeout na requisição'
        ]
      });
    }
    
    // Se o erro for de autenticação, logar detalhes
    if (error.response?.status === 401 || error.response?.status === 403) {
      const ambienteAtual = apiConfig?.ambiente || 'homologacao';
      logger.error('ERRO DE AUTENTICAÇÃO - Verifique o token', {
        service: 'focusNFe',
        action: 'emitir_nfe',
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
    
    // Extrair detalhes do erro
    const erroData = error.response?.data || {};
    const codigoErro = erroData.Codigo || erroData.codigo || erroData.Cod || erroData.cod || null;
    
    // Verificar se é erro "already_processed" (nota já foi autorizada)
    if (codigoErro === 'already_processed' || erroData.mensagem?.includes('já foi autorizada')) {
      logger.info('NFe já foi autorizada anteriormente, consultando dados existentes', {
        service: 'focusNFe',
        action: 'emitir_nfe',
        pedido_id: dadosPedido.pedido_id,
        referencia
      });
      
      // Consultar a nota existente e salvar no banco local
      try {
        const notaExistente = await consultarNFe(referencia);
        if (notaExistente.sucesso) {
          // Salvar no banco local
          await salvarNFe({
            pedido_id: dadosPedido.pedido_id_db || null,
            referencia: referencia,
            chave_nfe: notaExistente.chave_nfe,
            status_focus: notaExistente.status || 'autorizado',
            status_sefaz: notaExistente.status_sefaz,
            mensagem_sefaz: notaExistente.mensagem_sefaz,
            caminho_xml_nota_fiscal: notaExistente.caminho_xml_nota_fiscal,
            caminho_danfe: notaExistente.caminho_danfe,
            dados_completos: notaExistente.dados,
            ambiente: apiConfig.ambiente || 'homologacao'
          });
          
          return {
            sucesso: true,
            referencia: referencia,
            status: notaExistente.status || 'autorizado',
            status_sefaz: notaExistente.status_sefaz,
            mensagem_sefaz: notaExistente.mensagem_sefaz,
            chave_nfe: notaExistente.chave_nfe,
            caminho_xml_nota_fiscal: notaExistente.caminho_xml_nota_fiscal,
            caminho_danfe: notaExistente.caminho_danfe,
            dados: notaExistente.dados,
            ja_existia: true
          };
        }
      } catch (consultaError) {
        logger.error('Erro ao consultar NFe existente', { error: consultaError.message });
      }
    }
    
    // Salvar erro no banco se possível
    try {
      await salvarNFe({
        pedido_id: dadosPedido.pedido_id_db || null,
        referencia: referencia,
        status_focus: 'erro_autorizacao',
        status_sefaz: error.response?.status?.toString(),
        mensagem_sefaz: typeof erro === 'string' ? erro : JSON.stringify(erro),
        dados_completos: { erro }
      });
    } catch (dbError) {
      logger.error('Erro ao salvar NFe com erro no banco', { error: dbError.message });
    }
    
    // Mensagem de erro mais descritiva
    let mensagemErro;
    if (!error.response) {
      // Erro de conexão
      mensagemErro = `Erro de conexão: ${error.message || 'Não foi possível conectar ao servidor Focus NFe'}. ` +
                     `Código: ${error.code || 'N/A'}. ` +
                     `Verifique sua conexão com a internet e se o servidor Focus NFe está acessível.`;
    } else {
      // Erro com resposta do servidor
      mensagemErro = erroData.Descricao || erroData.descricao || erroData.Desc || erroData.desc || erroData.mensagem || error.message;
    }
    
    const mensagemSefaz = erroData.mensagem_sefaz || erroData.Mensagem || null;
    
    return {
      sucesso: false,
      referencia: referencia,
      erro: erro,
      erro_data: erroData,
      codigo_erro: codigoErro,
      error_code: error.code, // Código do erro de conexão
      mensagem: mensagemErro,
      mensagem_sefaz: mensagemSefaz,
      is_connection_error: !error.response,
      dados_completos: erroData
    };
  }
}

/**
 * Consulta status de uma NFe
 */
async function consultarNFe(referencia) {
  logger.focusNFe('consultar_nfe', 'Consultando status da NFe', {
    referencia
  });
  
  try {
    const api = createApiClient();
    
    // Usar completa=1 para obter todos os dados da nota
    const response = await api.get(`/nfe/${referencia}.json?completa=1`);
    
    logger.focusNFe('consultar_nfe', 'Status consultado', {
      referencia,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz
    });
    
    // Atualizar no banco de dados
    const nfeExistente = await buscarNFePorReferencia(referencia);
    if (nfeExistente) {
      await atualizarNFe(referencia, {
        chave_nfe: response.data.chave_nfe || nfeExistente.chave_nfe,
        status_focus: response.data.status,
        status_sefaz: response.data.status_sefaz || null,
        mensagem_sefaz: response.data.mensagem_sefaz || null,
        caminho_xml_nota_fiscal: response.data.caminho_xml_nota_fiscal || nfeExistente.caminho_xml_nota_fiscal,
        caminho_danfe: response.data.caminho_danfe || nfeExistente.caminho_danfe,
        dados_completos: response.data
      });
    }
    
    return {
      sucesso: true,
      referencia: referencia,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz,
      mensagem_sefaz: response.data.mensagem_sefaz,
      chave_nfe: response.data.chave_nfe,
      caminho_xml_nota_fiscal: response.data.caminho_xml_nota_fiscal,
      caminho_danfe: response.data.caminho_danfe,
      dados: response.data
    };
    
  } catch (error) {
    const erro = error.response?.data || error.message;
    
    logger.focusNFe('consultar_nfe', 'Erro ao consultar NFe', {
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
 * Cancela uma NFe
 */
async function cancelarNFe(referencia, justificativa) {
  logger.focusNFe('cancelar_nfe', 'Cancelando NFe', {
    referencia,
    justificativa
  });
  
  try {
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter pelo menos 15 caracteres');
    }
    
    const api = createApiClient();
    
    const response = await api.delete(`/nfe/${referencia}.json`, {
      data: {
        justificativa: justificativa
      }
    });
    
    logger.focusNFe('cancelar_nfe', 'NFe cancelada', {
      referencia,
      status: response.data.status
    });
    
    // Atualizar no banco
    await atualizarNFe(referencia, {
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
    
    logger.focusNFe('cancelar_nfe', 'Erro ao cancelar NFe', {
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

/**
 * Lista todas as NFe da Focus NFe com paginação automática
 * @param {Object} filtros - Filtros opcionais (data_inicio, data_fim, status, etc)
 * @returns {Promise<Object>} Lista de NFe
 */
async function listarTodasNFe(filtros = {}) {
  logger.focusNFe('listar_todas_nfe', 'Listando todas as NFe da Focus NFe', {
    filtros
  });
  
  try {
    const api = createApiClient();
    const apiConfig = getApiConfig();
    
    // Buscar todas as notas com paginação
    let todasNotas = [];
    let offset = 0;
    const limitePorPagina = 100; // Buscar 100 por vez
    let temMaisNotas = true;
    let tentativas = 0;
    const maxTentativas = 1000; // Limite de segurança (máximo 100.000 notas)
    
    while (temMaisNotas && tentativas < maxTentativas) {
      // Construir query string com filtros e paginação
      const params = new URLSearchParams();
      if (filtros.data_inicio) {
        params.append('data_inicio', filtros.data_inicio);
      }
      if (filtros.data_fim) {
        params.append('data_fim', filtros.data_fim);
      }
      if (filtros.status) {
        params.append('status', filtros.status);
      }
      params.append('limite', limitePorPagina.toString());
      params.append('offset', offset.toString());
      
      const queryString = params.toString();
      const url = `/nfe.json?${queryString}`;
      
      logger.debug(`Buscando NFe da Focus NFe (página ${Math.floor(offset / limitePorPagina) + 1})`, {
        service: 'focusNFe',
        action: 'listar_todas_nfe',
        url,
        ambiente: apiConfig.ambiente,
        offset,
        limite: limitePorPagina
      });
      
      const response = await api.get(url);
      
      // Processar resposta
      let notasPagina = [];
      
      // Log da resposta bruta para debug
      logger.debug('Resposta bruta da API Focus NFe', {
        service: 'focusNFe',
        action: 'listar_todas_nfe',
        tipo_resposta: typeof response.data,
        is_array: Array.isArray(response.data),
        is_object: response.data && typeof response.data === 'object',
        keys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : null,
        keys_count: response.data && typeof response.data === 'object' ? Object.keys(response.data).length : 0,
        ambiente: apiConfig.ambiente,
        offset,
        limite: limitePorPagina
      });
      
      // A API da Focus NFe retorna um objeto indexado por referência
      // Exemplo: {"PED-123": {...}, "PED-456": {...}}
      // Quando não há notas, retorna {} (objeto vazio)
      
      if (Array.isArray(response.data)) {
        // Se for array (formato alternativo)
        notasPagina = response.data;
      } else if (response.data && typeof response.data === 'object') {
        if (response.data.notas && Array.isArray(response.data.notas)) {
          // Se tiver propriedade 'notas' com array
          notasPagina = response.data.notas;
        } else {
          // Objeto indexado por referência (formato padrão da Focus NFe)
          const keys = Object.keys(response.data);
          
          // Se não há chaves, é um objeto vazio = não há mais notas
          if (keys.length === 0) {
            logger.info('Objeto vazio retornado - não há mais notas', {
              service: 'focusNFe',
              action: 'listar_todas_nfe',
              ambiente: apiConfig.ambiente,
              offset
            });
            temMaisNotas = false;
            break;
          }
          
          // Converter objeto em array
          notasPagina = keys.map(key => {
            const nota = response.data[key];
            // Garantir que a referência está presente
            if (!nota.referencia && !nota.ref) {
              nota.referencia = key;
              nota.ref = key;
            } else if (!nota.referencia) {
              nota.referencia = nota.ref;
            } else if (!nota.ref) {
              nota.ref = nota.referencia;
            }
            return nota;
          });
        }
      }
      
      todasNotas = todasNotas.concat(notasPagina);
      
      logger.info(`NFe encontradas na página ${Math.floor(offset / limitePorPagina) + 1}`, {
        service: 'focusNFe',
        action: 'listar_todas_nfe',
        notas_na_pagina: notasPagina.length,
        total_acumulado: todasNotas.length,
        ambiente: apiConfig.ambiente
      });
      
      // Se retornou menos que o limite, não há mais notas
      if (notasPagina.length < limitePorPagina) {
        temMaisNotas = false;
      } else {
        offset += limitePorPagina;
        tentativas++;
      }
    }
    
    logger.focusNFe('listar_todas_nfe', 'NFe listadas com sucesso', {
      total: todasNotas.length,
      ambiente: apiConfig.ambiente,
      paginas_buscadas: Math.floor(offset / limitePorPagina) + (temMaisNotas ? 1 : 0)
    });
    
    return {
      sucesso: true,
      notas: todasNotas,
      total: todasNotas.length,
      ambiente: apiConfig.ambiente
    };
    
  } catch (error) {
    const statusCode = error.response?.status;
    const erro = error.response?.data || error.message;
    
    // 404 significa que não há notas (situação normal, não é erro)
    if (statusCode === 404) {
      logger.focusNFe('listar_todas_nfe', 'Nenhuma NFe encontrada na Focus NFe', {
        ambiente: getApiConfig().ambiente,
        status_code: 404
      });
      
      return {
        sucesso: true,
        notas: [],
        total: 0,
        ambiente: getApiConfig().ambiente,
        mensagem: 'Nenhuma NFe encontrada'
      };
    }
    
    logger.focusNFe('listar_todas_nfe', 'Erro ao listar NFe', {
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: statusCode
    });
    
    return {
      sucesso: false,
      erro: erro,
      erro_status: statusCode, // Adicionar status code explicitamente
      mensagem: error.response?.data?.mensagem || error.message,
      notas: []
    };
  }
}

module.exports = {
  emitirNFe,
  consultarNFe,
  cancelarNFe,
  listarTodasNFe,
  getApiConfig
};

