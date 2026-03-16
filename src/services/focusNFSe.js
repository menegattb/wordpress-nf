const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const config = require('../../config');
const logger = require('./logger');
const { validarCamposNFSe } = require('./validator');
const { mapearPedidoParaNFSe } = require('../utils/mapeador');
const { salvarNFSe, atualizarNFSe, buscarNFSePorReferencia } = require('../config/database');

/**
 * Configuração da API Focus NFe
 * @param {Object} configOverride - Opcional: { token, ambiente } para multi-tenant
 */
function getApiConfig(configOverride = null) {
  let ambiente;
  let token;

  if (configOverride && (configOverride.token || configOverride.ambiente)) {
    ambiente = configOverride.ambiente || 'homologacao';
    token = configOverride.token;
    if (!token || token === 'undefined' || token.trim() === '') {
      throw new Error('Token Focus NFe não configurado no configOverride');
    }
  } else {
    ambiente = process.env.FOCUS_NFE_AMBIENTE || config.focusNFe.ambiente || 'homologacao';
    if (ambiente === 'producao') {
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
      token = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token;
    }
  }

  const baseUrl = ambiente === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';

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
 * @param {Object} configOverride - Opcional: { token, ambiente } para multi-tenant
 */
function createApiClient(configOverride = null) {
  const apiConfig = getApiConfig(configOverride);

  if (!apiConfig.token) {
    throw new Error('Token Focus NFe não configurado');
  }

  logger.debug('Criando cliente HTTP Focus NFe', {
    service: 'focusNFe',
    action: 'createApiClient',
    baseURL: apiConfig.baseUrl,
    token_preview: apiConfig.token.substring(0, 10) + '...'
  });

  const client = axios.create({
    baseURL: apiConfig.baseUrl,
    auth: {
      username: apiConfig.token,
      password: ''
    },
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 9000 // 9 segundos (limite Vercel free = 10s)
  });

  // Retry com backoff em erros de rede, 429 (rate limit) e 5xx
  axiosRetry(client, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      if (axiosRetry.isNetworkOrIdempotentRequestError(error)) return true;
      const status = error.response?.status;
      if (status === 429 || (status >= 500 && status < 600)) return true;
      return false;
    },
    onRetry: (retryCount, error, config) => {
      logger.warn('Retry Focus NFe (NFSe)', {
        service: 'focusNFe',
        action: 'retry',
        retryCount,
        url: config?.url,
        status: error.response?.status
      });
    }
  });

  return client;
}

/**
 * Remove campos de telefone problemáticos do payload NFSe
 * Evita erro RNG6110: campo fone vazio no XML
 */
function limparCamposTelefonePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const limpo = { ...payload };
  const camposRemovidos = [];
  const camposModificados = [];

  // Limpar no nível raiz (caso raro, mas possível)
  if ('fone' in limpo) {
    camposRemovidos.push('fone (raiz)');
    delete limpo.fone;
  }

  // Limpar em tomador
  if (limpo.tomador && typeof limpo.tomador === 'object') {
    const tomadorOriginal = { ...limpo.tomador };
    
    // Remover fone se existir
    if ('fone' in limpo.tomador) {
      camposRemovidos.push('tomador.fone');
      delete limpo.tomador.fone;
    }
    
    // Limpar telefone se estiver vazio ou inválido
    if (limpo.tomador.telefone !== undefined) {
      const telefone = String(limpo.tomador.telefone || '').trim();
      if (telefone === '' || telefone === 'null' || telefone === 'undefined' || telefone.length < 10) {
        camposRemovidos.push('tomador.telefone (inválido)');
        delete limpo.tomador.telefone;
      } else if (telefone !== String(tomadorOriginal.telefone || '').trim()) {
        camposModificados.push(`tomador.telefone: "${tomadorOriginal.telefone}" → "${telefone}"`);
      }
    }
  }

  // Limpar em destinatario (se existir)
  if (limpo.destinatario && typeof limpo.destinatario === 'object') {
    if ('fone' in limpo.destinatario) {
      camposRemovidos.push('destinatario.fone');
      delete limpo.destinatario.fone;
    }
    
    if (limpo.destinatario.telefone !== undefined) {
      const telefone = String(limpo.destinatario.telefone || '').trim();
      if (telefone === '' || telefone === 'null' || telefone === 'undefined' || telefone.length < 10) {
        camposRemovidos.push('destinatario.telefone (inválido)');
        delete limpo.destinatario.telefone;
      }
    }
  }

  // Log detalhado se houver alterações
  if (camposRemovidos.length > 0 || camposModificados.length > 0) {
    logger.warn('Campos de telefone limpos do payload NFSe', {
      service: 'focusNFe',
      action: 'limpar_campos_telefone',
      campos_removidos: camposRemovidos,
      campos_modificados: camposModificados,
      payload_antes: JSON.stringify(payload.tomador || {}),
      payload_depois: JSON.stringify(limpo.tomador || {})
    });
  }

  return limpo;
}

/**
 * Emite uma NFSe
 * @param {Object} configFocus - Opcional: { token, ambiente } para multi-tenant
 */
async function emitirNFSe(dadosPedido, configEmitente, configFiscal = null, tipoNF = 'servico', configFocus = null) {
  const inicioEmissao = Date.now(); // Marcar início da emissão para calcular tempo total

  // Obter configuração da API antes do try para estar disponível no catch
  let apiConfig = null;
  try {
    apiConfig = getApiConfig(configFocus);
  } catch (configError) {
    logger.error('Erro ao obter configuração da API', {
      service: 'focusNFe',
      action: 'emitir_nfse',
      error: configError.message
    });
    throw configError;
  }

  // Em homologação, adicionar timestamp para permitir múltiplas emissões do mesmo pedido
  // Em produção, usar referência fixa para evitar duplicatas
  const isHomologacao = apiConfig.ambiente === 'homologacao';
  const timestampSufixo = isHomologacao ? `-${Date.now()}` : '';
  const referencia = dadosPedido.referencia || `NFSE-${dadosPedido.pedido_id || Date.now()}${timestampSufixo}`;

  logger.info(`Referência gerada para NFSe: ${referencia} (ambiente: ${apiConfig.ambiente})`, {
    service: 'focusNFe',
    action: 'emitir_nfse',
    pedido_id: dadosPedido.pedido_id,
    ambiente: apiConfig.ambiente,
    is_homologacao: isHomologacao
  });

  // Log detalhado no início da emissão
  logger.focusNFe('emitir_nfse', 'Iniciando emissão manual de NFSe', {
    pedido_id: dadosPedido.pedido_id,
    referencia,
    tipo_nf: tipoNF,
    ambiente: apiConfig.ambiente,
    cliente: dadosPedido.nome || dadosPedido.razao_social || 'N/A',
    cpf_cnpj: dadosPedido.cpf_cnpj || 'N/A',
    valor_total: dadosPedido.valor_total || dadosPedido.valor_servicos || 0,
    quantidade_servicos: dadosPedido.servicos?.length || 0,
    timestamp: new Date().toISOString()
  });

  try {
    // Mapear dados para formato Focus NFSe
    logger.focusNFe('emitir_nfse', 'Mapeando dados para formato Focus NFSe', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      dados_pedido_recebido: {
        cliente: dadosPedido.nome || dadosPedido.razao_social,
        cpf_cnpj: dadosPedido.cpf_cnpj,
        valor_total: dadosPedido.valor_total || dadosPedido.valor_servicos,
        quantidade_servicos: dadosPedido.servicos?.length || 0,
        endereco_cidade: dadosPedido.endereco?.cidade,
        endereco_estado: dadosPedido.endereco?.estado,
        endereco_cep: dadosPedido.endereco?.cep
      }
    });

    const fiscalConfig = configFiscal || config.fiscal;
    const inicioMapeamento = Date.now();
    const nfseData = await mapearPedidoParaNFSe(dadosPedido, configEmitente, fiscalConfig, tipoNF);
    const tempoMapeamento = Date.now() - inicioMapeamento;

    // Validação final: verificar que não há campos proibidos no payload
    // 'base_calculo' e 'valor_iss' foram removidos desta lista pois são exigidos por alguns municípios (ex: Ipojuca/PE)
    const camposProibidos = ['base_calculo_iss', 'valor_deducao', 'deducao', 'reducao'];
    const camposEncontrados = camposProibidos.filter(campo =>
      nfseData.servico && nfseData.servico[campo] !== undefined
    );

    if (camposEncontrados.length > 0) {
      logger.error('ERRO CRÍTICO: Campos proibidos encontrados no payload após sanitização', {
        service: 'focusNFe',
        action: 'emitir_nfse',
        pedido_id: dadosPedido.pedido_id,
        referencia,
        campos_proibidos: camposEncontrados,
        servico_keys: Object.keys(nfseData.servico || {})
      });
      throw new Error(`Campos proibidos encontrados no payload: ${camposEncontrados.join(', ')}. Isso não deveria acontecer após sanitização.`);
    }

    logger.focusNFe('emitir_nfse', 'Dados mapeados com sucesso', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      tempo_mapeamento_ms: tempoMapeamento,
      payload_resumo: {
        prestador_cnpj: nfseData.prestador?.cnpj,
        tomador_razao_social: nfseData.tomador?.razao_social,
        tomador_cpf_cnpj: nfseData.tomador?.cpf || nfseData.tomador?.cnpj,
        valor_servicos: nfseData.servico?.valor_servicos,
        item_lista_servico: nfseData.servico?.item_lista_servico,
        discriminacao: nfseData.servico?.discriminacao?.substring(0, 50) + (nfseData.servico?.discriminacao?.length > 50 ? '...' : ''),
        servico_keys: Object.keys(nfseData.servico || {})
      }
    });

    // Validação básica (campos obrigatórios)
    logger.focusNFe('emitir_nfse', 'Validando campos obrigatórios', {
      pedido_id: dadosPedido.pedido_id,
      referencia
    });

    const validacoes = [];

    // Validação básica dos campos essenciais
    if (!nfseData.prestador?.cnpj) {
      validacoes.push('CNPJ do prestador é obrigatório');
      logger.warn('Validação falhou: CNPJ do prestador', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'prestador_cnpj'
      });
    }
    if (!nfseData.tomador?.cpf && !nfseData.tomador?.cnpj) {
      validacoes.push('CPF ou CNPJ do tomador é obrigatório');
      logger.warn('Validação falhou: CPF/CNPJ do tomador', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'tomador_cpf_cnpj'
      });
    }
    if (!nfseData.servico?.valor_servicos) {
      validacoes.push('Valor dos serviços é obrigatório');
      logger.warn('Validação falhou: Valor dos serviços', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'servico_valor_servicos'
      });
    }

    // Validar campos obrigatórios adicionais
    if (!nfseData.prestador?.codigo_municipio) {
      validacoes.push('Código do município do prestador é obrigatório');
      logger.warn('Validação falhou: Código município prestador', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'prestador_codigo_municipio'
      });
    }

    // FIX: Permitir envio sem código do município do tomador (Focus NFe pode aceitar ou rejeitar)
    // if (!nfseData.tomador?.endereco?.codigo_municipio) {
    //   validacoes.push('Código do município do tomador é obrigatório');
    //   logger.warn('Validação falhou: Código município tomador', {
    //     pedido_id: dadosPedido.pedido_id,
    //     referencia,
    //     validacao: 'tomador_codigo_municipio'
    //   });
    // }

    // FIX: Permitir envio sem CEP do tomador
    // if (!nfseData.tomador?.endereco?.cep) {
    //   validacoes.push('CEP do tomador é obrigatório');
    //   logger.warn('Validação falhou: CEP tomador', {
    //     pedido_id: dadosPedido.pedido_id,
    //     referencia,
    //     validacao: 'tomador_cep'
    //   });
    // }

    if (!nfseData.tomador?.razao_social) {
      validacoes.push('Razão social do tomador é obrigatória');
      logger.warn('Validação falhou: Razão social tomador', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'tomador_razao_social'
      });
    }
    if (!nfseData.servico?.discriminacao) {
      validacoes.push('Discriminação do serviço é obrigatória');
      logger.warn('Validação falhou: Discriminação serviço', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'servico_discriminacao'
      });
    }
    if (!nfseData.servico?.item_lista_servico) {
      validacoes.push('Item da lista de serviço é obrigatório');
      logger.warn('Validação falhou: Item lista serviço', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'servico_item_lista_servico'
      });
    }

    // Validar formato do CEP (apenas se existir)
    const cepTomador = nfseData.tomador?.endereco?.cep?.replace(/\D/g, '') || '';
    if (cepTomador && cepTomador.length !== 8) {
      // validacoes.push(`CEP do tomador deve ter 8 dígitos. Valor recebido: ${nfseData.tomador?.endereco?.cep}`);
      logger.warn('Aviso: Formato CEP irregular (tentando enviar mesmo assim)', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'cep_formato',
        cep_recebido: nfseData.tomador?.endereco?.cep
      });
    }

    // Detectar se é endereço internacional
    const temCodigoPaisExt = !!(nfseData.tomador?.endereco?.codigo_pais_ext);
    const temNomeCidadeExt = !!(nfseData.tomador?.endereco?.nome_cidade_ext);
    const paisOriginal = dadosPedido.endereco?.pais || '';
    const paisUpper = String(paisOriginal).toUpperCase().trim();
    const isPaisInternacional = paisUpper !== 'BR' && 
                               paisUpper !== 'BRASIL' && 
                               paisUpper !== '' &&
                               paisUpper !== 'BRAZIL';
    const isEnderecoInternacional = temCodigoPaisExt || temNomeCidadeExt || isPaisInternacional;

    // Validar formato do código do município
    // Para endereços internacionais: aceitar codigo_municipio="0000000"
    // Para endereços brasileiros: validar formato de 7 dígitos
    if (isEnderecoInternacional) {
      // Para endereços internacionais: garantir que codigo_municipio está como "0000000"
      const codMunicipioTomador = nfseData.tomador?.endereco?.codigo_municipio?.toString() || '';
      if (codMunicipioTomador !== '0000000') {
        if (nfseData.tomador?.endereco) {
          nfseData.tomador.endereco.codigo_municipio = '0000000';
          logger.mapping('codigo_municipio definido como 0000000 para endereço internacional', {
            pedido_id: dadosPedido.pedido_id,
            referencia,
            codigo_municipio_anterior: codMunicipioTomador || 'ausente'
          });
        }
      }
    } else {
      // Para endereços brasileiros: validar formato de 7 dígitos
      const codMunicipioTomador = nfseData.tomador?.endereco?.codigo_municipio?.toString().replace(/\D/g, '') || '';
      if (codMunicipioTomador && codMunicipioTomador.length !== 7) {
        // validacoes.push(`Código do município do tomador deve ter 7 dígitos (IBGE). Valor recebido: ${nfseData.tomador?.endereco?.codigo_municipio}`);
        logger.warn('Aviso: Formato código município irregular (tentando enviar mesmo assim)', {
          pedido_id: dadosPedido.pedido_id,
          referencia,
          validacao: 'codigo_municipio_tomador_formato',
          codigo_recebido: nfseData.tomador?.endereco?.codigo_municipio
        });
      }
    }

    const codMunicipioPrestador = nfseData.prestador?.codigo_municipio?.toString().replace(/\D/g, '') || '';
    if (codMunicipioPrestador.length !== 7) {
      validacoes.push(`Código do município do prestador deve ter 7 dígitos (IBGE). Valor recebido: ${nfseData.prestador?.codigo_municipio}`);
      logger.warn('Validação falhou: Formato código município prestador', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        validacao: 'codigo_municipio_prestador_formato',
        codigo_recebido: nfseData.prestador?.codigo_municipio,
        codigo_limpo: codMunicipioPrestador,
        codigo_length: codMunicipioPrestador.length
      });
    }

    // Se houver erros de validação, lançar exceção
    if (validacoes.length > 0) {
      logger.error('Validações falharam', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        total_erros: validacoes.length,
        erros: validacoes
      });
      throw new Error(validacoes.join('; '));
    }

    logger.focusNFe('emitir_nfse', 'Todas as validações passaram', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      validacoes_ok: true
    });

    // Validar token antes de criar cliente
    if (!apiConfig.token) {
      throw new Error('Token Focus NFe não configurado. Verifique FOCUS_NFE_TOKEN_HOMOLOGACAO ou FOCUS_NFE_TOKEN_PRODUCAO');
    }

    const api = createApiClient(configFocus);

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

    // Log completo do payload antes de enviar (para debug)
    logger.focusNFe('emitir_nfse', 'Enviando requisição para Focus NFe', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      tipo_nf: tipoNF,
      url: `${apiConfig.baseUrl}/nfse?ref=${referencia}`,
      payload_keys: Object.keys(nfseData),
      prestador_cnpj: nfseData.prestador?.cnpj,
      tomador_doc: nfseData.tomador?.cpf || nfseData.tomador?.cnpj,
      valor_servicos: nfseData.servico?.valor_servicos
    });

    // FIX: Garantir que telefone esteja presente ANTES da limpeza
    // Se não houver telefone válido, adicionar telefone padrão primeiro
    // Telefone padrão: +55 81 98875‑1104 (processado para 81988751104)
    if (nfseData.tomador) {
      const telefoneAtual = nfseData.tomador.telefone;
      const telefoneValido = telefoneAtual && 
                            String(telefoneAtual).trim() !== '' && 
                            String(telefoneAtual).replace(/\D/g, '').length >= 10;
      
      if (!telefoneValido) {
        // Telefone padrão fornecido pelo usuário: +55 81 98875‑1104
        const telefonePadrao = '81988751104'; // DDD 81 + número (11 dígitos válidos)
        nfseData.tomador.telefone = telefonePadrao;
        logger.warn('Telefone padrão adicionado ao tomador ANTES da limpeza para evitar erro RNG6110', {
          service: 'focusNFe',
          action: 'emitir_nfse',
          referencia,
          telefone_anterior: telefoneAtual || 'ausente',
          telefone_adicionado: telefonePadrao,
          motivo: 'Campo telefone ausente ou inválido - Focus NFe adiciona fone vazio no XML se não houver telefone válido'
        });
      }
    }

    // FIX: Limpar campos de telefone problemáticos antes do envio
    // Evita erro RNG6110: campo fone vazio no XML
    const nfseDataLimpo = limparCamposTelefonePayload(nfseData);

    // FIX: Garantir novamente que telefone esteja presente APÓS limpeza
    // A limpeza pode ter removido o telefone se estiver inválido
    if (nfseDataLimpo.tomador && !nfseDataLimpo.tomador.telefone) {
      const telefonePadrao = '81988751104';
      nfseDataLimpo.tomador.telefone = telefonePadrao;
      logger.warn('Telefone padrão adicionado APÓS limpeza (telefone foi removido na limpeza)', {
        service: 'focusNFe',
        action: 'emitir_nfse',
        referencia,
        telefone_adicionado: telefonePadrao
      });
    }

    // Log final do payload limpo (apenas se houver diferenças)
    if (JSON.stringify(nfseData) !== JSON.stringify(nfseDataLimpo)) {
      logger.debug('Payload limpo antes do envio', {
        service: 'focusNFe',
        action: 'emitir_nfse',
        referencia,
        diferenca_detectada: true,
        tomador_keys_antes: Object.keys(nfseData.tomador || {}),
        tomador_keys_depois: Object.keys(nfseDataLimpo.tomador || {})
      });
    }

    // Verificação final: garantir que não há campos fone
    const temFone = 'fone' in nfseDataLimpo || 
                    (nfseDataLimpo.tomador && 'fone' in nfseDataLimpo.tomador) ||
                    (nfseDataLimpo.destinatario && 'fone' in nfseDataLimpo.destinatario);

    if (temFone) {
      logger.error('ERRO: Campo fone ainda presente após limpeza!', {
        service: 'focusNFe',
        action: 'emitir_nfse',
        referencia,
        payload_tomador: JSON.stringify(nfseDataLimpo.tomador || {})
      });
    }

    // Log FINAL do payload antes do envio (para debug do erro RNG6110)
    logger.debug('Payload FINAL antes do envio para Focus NFe', {
      service: 'focusNFe',
      action: 'emitir_nfse',
      referencia,
      tem_tomador: !!nfseDataLimpo.tomador,
      tem_telefone: !!(nfseDataLimpo.tomador && nfseDataLimpo.tomador.telefone),
      telefone_value: nfseDataLimpo.tomador?.telefone || 'AUSENTE',
      tem_fone: !!(nfseDataLimpo.tomador && nfseDataLimpo.tomador.fone),
      fone_value: nfseDataLimpo.tomador?.fone || 'AUSENTE',
      tomador_keys: nfseDataLimpo.tomador ? Object.keys(nfseDataLimpo.tomador) : [],
      payload_tomador_completo: JSON.stringify(nfseDataLimpo.tomador || {})
    });

    const inicioEnvio = Date.now();
    const response = await api.post(`/nfse?ref=${referencia}`, nfseDataLimpo);
    const tempoResposta = Date.now() - inicioEnvio;

    logger.focusNFe('emitir_nfse', 'Resposta recebida da Focus NFe', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      tipo_nf: tipoNF,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz,
      mensagem_sefaz: response.data.mensagem_sefaz || null,
      status_code: response.status,
      tempo_resposta_ms: tempoResposta,
      numero_rps: response.data.numero_rps || response.data.numero || null,
      codigo_verificacao: response.data.codigo_verificacao || null,
      chave_nfse: response.data.chave_nfse || null,
      caminho_xml: response.data.caminho_xml || response.data.caminho_xml_nota_fiscal || null,
      caminho_pdf: response.data.caminho_pdf || response.data.caminho_pdf_nota_fiscal || null,
      tem_erros: !!response.data.erros,
      erros: response.data.erros || null
    });

    // Salvar no banco de dados
    logger.focusNFe('emitir_nfse', 'Tentando salvar NFSe no banco de dados', {
      pedido_id: dadosPedido.pedido_id,
      pedido_id_db: dadosPedido.pedido_id_db,
      referencia,
      ambiente: apiConfig.ambiente || 'homologacao',
      tem_dados_completos: !!response.data,
      dados_completos_keys: response.data ? Object.keys(response.data).slice(0, 10) : []
    });

    let nfse;
    try {
      nfse = await salvarNFSe({
        pedido_id: dadosPedido.pedido_id_db || null,
        referencia: referencia,
        chave_nfse: response.data.chave_nfse || null,
        status_focus: response.data.status || 'processando_autorizacao',
        status_sefaz: response.data.status_sefaz || null,
        mensagem_sefaz: response.data.mensagem_sefaz || null,
        caminho_xml: response.data.caminho_xml || null,
        caminho_pdf: response.data.caminho_pdf || null,
        dados_completos: response.data,
        ambiente: apiConfig.ambiente || 'homologacao'
      });

      logger.focusNFe('emitir_nfse', 'NFSe registrada no banco de dados com sucesso', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        nfse_id: nfse?.id,
        status: response.data.status,
        ambiente: apiConfig.ambiente || 'homologacao'
      });
    } catch (dbError) {
      logger.error('ERRO ao salvar NFSe no banco de dados (continuando mesmo assim)', {
        pedido_id: dadosPedido.pedido_id,
        referencia,
        erro: dbError.message,
        stack: dbError.stack,
        ambiente: apiConfig.ambiente || 'homologacao',
        contexto: 'salvamento_apos_emissao'
      });
      // NÃO lançar erro - a nota foi emitida com sucesso na Focus NFe
      // Apenas logar o erro e continuar
      nfse = null; // Marcar como null para indicar que não foi salvo no banco
    }

    // Log final de sucesso com todas as informações
    logger.focusNFe('emitir_nfse', 'NFSe emitida com sucesso', {
      pedido_id: dadosPedido.pedido_id,
      referencia,
      status: response.data.status,
      status_sefaz: response.data.status_sefaz,
      mensagem_sefaz: response.data.mensagem_sefaz || 'Autorizado',
      numero_rps: response.data.numero_rps || response.data.numero || null,
      codigo_verificacao: response.data.codigo_verificacao || null,
      chave_nfse: response.data.chave_nfse || null,
      caminho_xml: response.data.caminho_xml || response.data.caminho_xml_nota_fiscal || null,
      caminho_pdf: response.data.caminho_pdf || response.data.caminho_pdf_nota_fiscal || null,
      tempo_resposta_ms: tempoResposta,
      ambiente: apiConfig.ambiente || 'homologacao',
      cliente: dadosPedido.nome || dadosPedido.razao_social,
      valor_total: dadosPedido.valor_total || dadosPedido.valor_servicos
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
      nfse_id: nfse?.id || null
    };

  } catch (error) {
    const erro = error.response?.data || error.message;
    const tempoTotal = Date.now() - inicioEmissao;

    // Log completo do erro em modo desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n═══════════ ERRO COMPLETO (DEBUG) ═══════════');
      console.log('Status Code:', error.response?.status);
      console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Request URL:', error.config?.url);
      console.log('Request Method:', error.config?.method);
      if (error.config?.data) {
        try {
          console.log('Request Payload:', JSON.stringify(JSON.parse(error.config.data), null, 2));
        } catch (e) {
          console.log('Request Payload:', error.config.data);
        }
      }
      console.log('═══════════════════════════════════════════════\n');
    }

    logger.error('Erro ao emitir NFSe', {
      service: 'focusNFe',
      action: 'emitir_nfse',
      pedido_id: dadosPedido.pedido_id,
      referencia: referencia || 'N/A',
      cliente: dadosPedido.nome || dadosPedido.razao_social || 'N/A',
      valor_total: dadosPedido.valor_total || dadosPedido.valor_servicos || 0,
      erro: typeof erro === 'string' ? erro : JSON.stringify(erro),
      status_code: error.response?.status,
      error_message: error.message,
      stack: error.stack,
      ambiente: apiConfig?.ambiente || 'homologacao',
      tempo_total_ms: tempoTotal,
      erro_detalhado: error.response?.data || null,
      url_request: error.config?.url || null,
      metodo_request: error.config?.method || null,
      has_response: !!error.response
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

    // Extrair detalhes do erro
    const erroData = error.response?.data || {};
    const codigoErro = erroData.Codigo || erroData.codigo || erroData.Cod || erroData.cod || erroData.code || null;
    const mensagemErro = erroData.Descricao || erroData.descricao || erroData.Desc || erroData.desc || erroData.mensagem || error.message;
    const mensagemSefaz = erroData.mensagem_sefaz || erroData.Mensagem || null;

    logger.debug('Detalhes do erro recebido', {
      service: 'focusNFe',
      action: 'emitir_nfse',
      codigoErro,
      mensagemErro,
      erroData: JSON.stringify(erroData)
    });

    // Verificar se é erro "already_processed" (nota já foi autorizada)
    const isAlreadyProcessed = codigoErro === 'already_processed' ||
      (mensagemErro && mensagemErro.toLowerCase().includes('já foi autorizada')) ||
      (mensagemErro && mensagemErro.toLowerCase().includes('already')) ||
      (mensagemErro && mensagemErro.toLowerCase().includes('referência já foi'));

    if (isAlreadyProcessed) {
      logger.info('NFSe já foi autorizada anteriormente, consultando dados existentes', {
        service: 'focusNFe',
        action: 'emitir_nfse',
        pedido_id: dadosPedido.pedido_id,
        referencia
      });

      // Consultar a nota existente e salvar no banco local
      try {
        const notaExistente = await consultarNFSe(referencia);
        if (notaExistente.sucesso) {
          // Salvar no banco local
          await salvarNFSe({
            pedido_id: dadosPedido.pedido_id_db || null,
            referencia: referencia,
            chave_nfse: notaExistente.chave_nfse,
            status_focus: notaExistente.status || 'autorizado',
            status_sefaz: notaExistente.status_sefaz,
            mensagem_sefaz: notaExistente.mensagem_sefaz,
            caminho_xml: notaExistente.caminho_xml,
            caminho_pdf: notaExistente.caminho_pdf,
            dados_completos: notaExistente.dados,
            ambiente: apiConfig.ambiente || 'homologacao'
          });

          return {
            sucesso: true,
            referencia: referencia,
            status: notaExistente.status || 'autorizado',
            status_sefaz: notaExistente.status_sefaz,
            mensagem_sefaz: notaExistente.mensagem_sefaz,
            chave_nfse: notaExistente.chave_nfse,
            caminho_xml: notaExistente.caminho_xml,
            caminho_pdf: notaExistente.caminho_pdf,
            dados: notaExistente.dados,
            ja_existia: true
          };
        }
      } catch (consultaError) {
        logger.error('Erro ao consultar NFSe existente', { error: consultaError.message });
      }
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
 * @param {Object} configFocus - Opcional: { token, ambiente } para multi-tenant
 */
async function consultarNFSe(referencia, configFocus = null) {
  logger.focusNFe('consultar_nfse', 'Consultando status da NFSe', {
    referencia
  });

  try {
    const api = createApiClient(configFocus);

    // Usar completa=1 para obter todos os dados da nota
    const response = await api.get(`/nfse/${referencia}.json?completa=1`);

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
 * @param {Object} configFocus - Opcional: { token, ambiente } para multi-tenant
 */
async function cancelarNFSe(referencia, justificativa, configFocus = null) {
  logger.focusNFe('cancelar_nfse', 'Cancelando NFSe', {
    referencia,
    justificativa
  });

  try {
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter pelo menos 15 caracteres');
    }

    const api = createApiClient(configFocus);

    const response = await api.delete(`/nfse/${referencia}.json`, {
      data: {
        justificativa: justificativa
      }
    });

    console.log('>>> FOCUS API RESPONSE (CANCELAMENTO):', JSON.stringify(response.data, null, 2));

    logger.focusNFe('cancelar_nfse', 'NFSe cancelada', {
      referencia,
      status: response.data.status,
      response_data: response.data
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
    console.error('>>> FOCUS API ERROR (CANCELAMENTO):', JSON.stringify(erro, null, 2));

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

/**
 * Lista todas as NFSe da Focus NFe com paginação automática
 * @param {Object} filtros - Filtros opcionais (data_inicio, data_fim, status, etc)
 * @param {Object} configFocus - Opcional: { token, ambiente } para multi-tenant
 * @returns {Promise<Object>} Lista de NFSe
 */
async function listarTodasNFSe(filtros = {}, configFocus = null) {
  logger.focusNFe('listar_todas_nfse', 'Listando todas as NFSe da Focus NFe', {
    filtros
  });

  try {
    const api = createApiClient(configFocus);
    const apiConfig = getApiConfig(configFocus);

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
      const url = `/nfse.json?${queryString}`;

      logger.debug(`Buscando NFSe da Focus NFe (página ${Math.floor(offset / limitePorPagina) + 1})`, {
        service: 'focusNFe',
        action: 'listar_todas_nfse',
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
        action: 'listar_todas_nfse',
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
              action: 'listar_todas_nfse',
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

      logger.info(`NFSe encontradas na página ${Math.floor(offset / limitePorPagina) + 1}`, {
        service: 'focusNFe',
        action: 'listar_todas_nfse',
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

    logger.focusNFe('listar_todas_nfse', 'NFSe listadas com sucesso', {
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
      const cfg = getApiConfig(configFocus);
      logger.focusNFe('listar_todas_nfse', 'Nenhuma NFSe encontrada na Focus NFe', {
        ambiente: cfg.ambiente,
        status_code: 404
      });

      return {
        sucesso: true,
        notas: [],
        total: 0,
        ambiente: cfg.ambiente,
        mensagem: 'Nenhuma NFSe encontrada'
      };
    }

    logger.focusNFe('listar_todas_nfse', 'Erro ao listar NFSe', {
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

/**
 * Testa conexão com a API Focus NFe
 * Faz uma requisição de teste para validar token e ambiente
 * @param {Object} configFocus - Opcional: { token, ambiente } para multi-tenant
 */
async function testarConexao(configFocus = null) {
  logger.focusNFe('testar_conexao', 'Iniciando teste de conexão', {});

  try {
    const apiConfig = getApiConfig(configFocus);
    const api = createApiClient(configFocus);

    // Usar uma referência que não existe para testar autenticação
    // Se retornar 404, significa que o token está válido (autenticação OK, nota não existe)
    // Se retornar 401/403, significa que o token está inválido
    const referenciaTeste = `teste-conexao-${Date.now()}`;

    logger.debug('Testando conexão Focus NFe', {
      service: 'focusNFe',
      action: 'testar_conexao',
      ambiente: apiConfig.ambiente,
      referencia_teste: referenciaTeste,
      baseUrl: apiConfig.baseUrl
    });

    try {
      // Tentar consultar uma nota que não existe
      const response = await api.get(`/nfse/${referenciaTeste}.json`);

      // Se chegou aqui, a nota existe (improvável, mas possível)
      logger.focusNFe('testar_conexao', 'Conexão OK - Nota encontrada (inesperado)', {
        status: response.status
      });

      return {
        sucesso: true,
        mensagem: 'Conexão estabelecida com sucesso',
        status: response.status,
        ambiente: apiConfig.ambiente,
        token_preview: apiConfig.token ? apiConfig.token.substring(0, 10) + '...' : 'N/A'
      };

    } catch (error) {
      // Analisar o status code do erro
      const statusCode = error.response?.status;

      if (statusCode === 404) {
        // 404 = Nota não encontrada, mas autenticação OK
        logger.focusNFe('testar_conexao', 'Conexão OK - Token válido', {
          status: statusCode,
          ambiente: apiConfig.ambiente
        });

        return {
          sucesso: true,
          mensagem: 'Conexão estabelecida com sucesso. Token válido.',
          status: statusCode,
          ambiente: apiConfig.ambiente,
          token_preview: apiConfig.token ? apiConfig.token.substring(0, 10) + '...' : 'N/A',
          detalhes: 'A autenticação foi validada com sucesso. A API respondeu corretamente.'
        };

      } else if (statusCode === 401 || statusCode === 403) {
        // 401/403 = Token inválido ou sem permissão
        logger.focusNFe('testar_conexao', 'Erro de autenticação - Token inválido', {
          status: statusCode,
          ambiente: apiConfig.ambiente,
          erro: error.response?.data || error.message
        });

        return {
          sucesso: false,
          erro: 'Token inválido ou sem permissão',
          status: statusCode,
          ambiente: apiConfig.ambiente,
          mensagem: error.response?.data?.mensagem || error.response?.data?.codigo || 'Token inválido ou sem permissão para acessar a API',
          detalhes: 'Verifique se o token está correto e se tem permissão para acessar a API FocusNFe.'
        };

      } else if (statusCode) {
        // Outro erro HTTP
        logger.focusNFe('testar_conexao', 'Erro na conexão', {
          status: statusCode,
          ambiente: apiConfig.ambiente,
          erro: error.response?.data || error.message
        });

        return {
          sucesso: false,
          erro: `Erro HTTP ${statusCode}`,
          status: statusCode,
          ambiente: apiConfig.ambiente,
          mensagem: error.response?.data?.mensagem || error.message || `Erro ao conectar com a API (status ${statusCode})`,
          detalhes: error.response?.data || 'Erro desconhecido ao testar conexão'
        };

      } else {
        // Erro de rede ou timeout
        logger.focusNFe('testar_conexao', 'Erro de rede ou timeout', {
          ambiente: apiConfig.ambiente,
          erro: error.message
        });

        return {
          sucesso: false,
          erro: 'Erro de conexão',
          ambiente: apiConfig.ambiente,
          mensagem: error.message || 'Erro ao conectar com a API FocusNFe. Verifique sua conexão com a internet.',
          detalhes: 'Não foi possível estabelecer conexão com o servidor da FocusNFe.'
        };
      }
    }

  } catch (error) {
    // Erro ao obter configuração ou criar cliente
    logger.error('Erro ao testar conexão Focus NFe', {
      service: 'focusNFe',
      action: 'testar_conexao',
      error: error.message
    });

    return {
      sucesso: false,
      erro: error.message,
      mensagem: error.message || 'Erro ao configurar conexão com FocusNFe',
      detalhes: 'Verifique se o token e ambiente estão configurados corretamente.'
    };
  }
}

module.exports = {
  emitirNFSe,
  consultarNFSe,
  cancelarNFSe,
  listarTodasNFSe,
  getApiConfig,
  testarConexao
};

