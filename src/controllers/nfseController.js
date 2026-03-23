const logger = require('../services/logger');
const { emitirNFSe, consultarNFSe, cancelarNFSe, listarTodasNFSe } = require('../services/focusNFSe');
const { emitirNFe, consultarNFe, cancelarNFe, listarTodasNFe } = require('../services/focusNFe');
const { listarNFSe, listarNFe, buscarNFePorChave, buscarPedidoPorPedidoId } = require('../config/database');
const { buscarPedidoPorId, atualizarPedido } = require('../config/database');
const { validarCPFCNPJ } = require('../services/validator');
const { buscarPedidoPorId: buscarPedidoWC } = require('../services/woocommerce');
const { mapearWooCommerceParaPedido } = require('../utils/mapeador');
const { getConfigForTenant } = require('../services/tenantService');
const { verificarLimite, registrarEmissao } = require('../services/usageService');
const config = require('../../config');

/**
 * Emite NFSe em lote para múltiplos pedidos
 */
/**
 * Emite NFSe em lote para múltiplos pedidos
 */
async function emitirNFSeLote(req, res) {
  try {
    const { pedido_ids, tipo_nf } = req.body;

    if (!pedido_ids || !Array.isArray(pedido_ids) || pedido_ids.length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Lista de pedido_ids é obrigatória'
      });
    }

    // Default para servico se não especificado
    const tipoNF = tipo_nf || 'servico';

    // UNIFICAR PROCESSO ASSÍNCRONO PARA QUASE TUDO (PRODUTO E SERVIÇO)
    // Isso evita timeouts da Vercel (10s) que acontecem no fluxo síncrono anterior
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    logger.info(`Recebida solicitação de emissão assíncrona`, {
      service: 'auto_emitir',
      action: 'lote_recebido',
      job_id: jobId,
      tenant_id: req.tenant_id || 'global',
      total_pedidos: pedido_ids.length,
      tipo_nf: tipoNF,
      ambiente: process.env.FOCUS_NFE_AMBIENTE,
      pedido_ids_preview: pedido_ids.slice(0, 20)
    });

    // Retornar IMEDIATAMENTE (Fire and Forget)
    res.status(202).json({
      sucesso: true,
      processamento_async: true,
      job_id: jobId,
      mensagem: 'Processamento iniciado em segundo plano. Você pode acompanhar o progresso nos logs.',
      total_pedidos: pedido_ids.length,
      tipo_nf: tipoNF
    });

    // Iniciar processamento em background (sem await)
    processarLoteAsync(pedido_ids, tipoNF, jobId, req.tenant_id).catch(err => {
      logger.error(`Erro fatal no processamento do job ${jobId}`, {
        erro: err.message,
        stack: err.stack
      });
    });

    return;
  } catch (error) {
    logger.error('Erro ao iniciar emissão em lote', {
      error: error.message
    });

    if (!res.headersSent) {
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
}

/**
 * Função auxiliar para processar lote em background
 */
async function processarLoteAsync(pedido_ids, tipoNF, jobId, tenantId = null) {
  const cfg = tenantId ? await getConfigForTenant(tenantId) : config;
  const configFiscal = cfg.fiscal || config.fiscal;
  const configFocus = tenantId && cfg.focusNFe ? { token: cfg.focusNFe.token, ambiente: cfg.focusNFe.ambiente } : null;
  const credentials = tenantId && cfg.woocommerce?.apiUrl ? cfg.woocommerce : null;

  const inicioLote = Date.now();
  const isProduto = tipoNF === 'produto' || tipoNF === 'nfe';
  const tipoNotaLabel = isProduto ? 'NFe' : 'NFSe';
  
  let sucesso = 0;
  let erros = 0;

  logger.info(`[JOB:${jobId}] Iniciando processamento background para ${tipoNotaLabel}`, {
    service: 'auto_emitir',
    action: 'job_inicio',
    job_id: jobId,
    tenant_id: tenantId || 'global',
    total: pedido_ids.length,
    tipo: tipoNF,
    ambiente: configFocus?.ambiente || process.env.FOCUS_NFE_AMBIENTE
  });

  for (let i = 0; i < pedido_ids.length; i++) {
    const pedidoIdWC = pedido_ids[i];
    const progresso = `[${i + 1}/${pedido_ids.length}]`;
    let pedidoInternoId = null;

    // Pequeno delay para não sobrecarregar API e permitir logging visível
    if (i > 0) await new Promise(r => setTimeout(r, 1000));

    try {
      // Resolver ID interno do banco de dados (pedidoIdWC é o ID do WooCommerce)
      const pedidoExistente = await buscarPedidoPorPedidoId(pedidoIdWC, tenantId);
      if (pedidoExistente) {
        pedidoInternoId = pedidoExistente.id;
        // Marcar como processando no banco local
        await atualizarPedido(pedidoInternoId, { status: 'processando' });
      }

      logger.info(`${progresso} Processando pedido ${pedidoIdWC} (${tipoNotaLabel})`, {
        service: 'auto_emitir',
        action: 'pedido_processando',
        job_id: jobId,
        tenant_id: tenantId || 'global',
        pedido_id: pedidoIdWC,
        progresso_atual: i + 1,
        total: pedido_ids.length,
        status_job: 'em_andamento'
      });

      const resultadoWC = await buscarPedidoWC(pedidoIdWC, credentials);

      if (!resultadoWC.sucesso) {
        throw new Error(`Erro ao buscar pedido no WooCommerce: ${resultadoWC.erro?.message || JSON.stringify(resultadoWC.erro)}`);
      }

      const pedidoMapeado = mapearWooCommerceParaPedido(resultadoWC.pedido || resultadoWC.dados);

      const limiteCheck = await verificarLimite(tenantId);
      if (!limiteCheck.pode) {
        throw new Error(`Limite atingido: ${limiteCheck.mensagem}`);
      }

      // Emitir Nota (NFe ou NFSe)
      let resultadoEmissao;
      const tempoInicioEmissao = Date.now();
      if (isProduto) {
        resultadoEmissao = await emitirNFe(pedidoMapeado, cfg.emitente, configFiscal, configFocus);
      } else {
        resultadoEmissao = await emitirNFSe(pedidoMapeado, cfg.emitente, configFiscal, tipoNF, configFocus);
      }

      const tempoProcessamento = Date.now() - tempoInicioEmissao;

      if (resultadoEmissao.sucesso) {
        await registrarEmissao(tenantId);
        logger.info(`${progresso} ${tipoNotaLabel} emitida com sucesso para ${pedidoIdWC}`, {
          service: 'auto_emitir',
          action: 'pedido_emitido',
          job_id: jobId,
          tenant_id: tenantId || 'global',
          pedido_id: pedidoIdWC,
          referencia: resultadoEmissao.referencia,
          status: resultadoEmissao.status,
          numero: resultadoEmissao.numero || resultadoEmissao.chave_nfe || resultadoEmissao.chave_nfse,
          tempo_ms: tempoProcessamento
        });
        sucesso++;

        // Atualizar status no banco local com ID INTERNO
        if (pedidoInternoId) {
          try {
            let statusBanco = 'processando';
            if (resultadoEmissao.status === 'autorizado' || resultadoEmissao.status === 'concluido') {
              statusBanco = 'emitida';
            } else if (resultadoEmissao.status === 'erro_autorizacao' || resultadoEmissao.status === 'rejeitado') {
              statusBanco = 'erro';
            }

            await atualizarPedido(pedidoInternoId, {
              status: statusBanco,
              referencia: resultadoEmissao.referencia,
              tipo_nota: isProduto ? 'nfe' : 'nfse',
              dados_emissao: resultadoEmissao.dados
            });
          } catch (dbErr) {
            logger.error(`${progresso} Erro ao atualizar status no banco local`, { error: dbErr.message });
          }
        }
      } else {
        throw new Error(resultadoEmissao.erro || resultadoEmissao.mensagem || 'Falha na emissão pela Focus NFe');
      }

    } catch (error) {
      erros++;
      logger.error(`${progresso} Falha no processamento do pedido ${pedidoIdWC}`, {
        service: 'auto_emitir',
        action: 'pedido_erro',
        job_id: jobId,
        tenant_id: tenantId || 'global',
        pedido_id: pedidoIdWC,
        erro: error.message
      });

      // Atualizar para erro no banco local se tivermos o ID INTERNO
      if (pedidoInternoId) {
        try {
          await atualizarPedido(pedidoInternoId, { 
            status: 'erro',
            logs: `Erro em ${new Date().toLocaleString('pt-BR')}: ${error.message}`
          });
        } catch (dbErr) {
          logger.error(`${progresso} Erro ao marcar falha no banco local`, { error: dbErr.message });
        }
      }
    }
  }

  const tempoTotal = Date.now() - inicioLote;
  logger.info(`[JOB:${jobId}] Processamento concluído de ${tipoNotaLabel}`, {
    service: 'auto_emitir',
    action: 'job_concluido',
    job_id: jobId,
    tenant_id: tenantId || 'global',
    total: pedido_ids.length,
    sucessos: sucesso,
    erros: erros,
    tempo_ms: tempoTotal,
    status_job: 'concluido'
  });
}

/**
 * Emite NFSe manualmente
 */
async function emitirNFSeManual(req, res) {
  try {
    const dadosPedido = req.body;
    const tenantId = req.tenant_id || null;
    const cfg = tenantId ? await getConfigForTenant(tenantId) : config;
    const configFiscal = cfg.fiscal || config.fiscal;
    const configFocus = tenantId && cfg.focusNFe ? { token: cfg.focusNFe.token, ambiente: cfg.focusNFe.ambiente } : null;

    logger.focusNFe('emitir_nfse_manual', 'Emissão manual de NFSe solicitada', {
      pedido_id: dadosPedido.pedido_id
    });

    // Validar documento
    if (dadosPedido.cpf_cnpj) {
      const documento = validarCPFCNPJ(dadosPedido.cpf_cnpj);
      if (!documento.valido) {
        return res.status(400).json({
          erro: 'Documento inválido',
          detalhes: documento.erro
        });
      }
    }

    // Verificar limite de notas
    const limiteCheck = await verificarLimite(tenantId);
    if (!limiteCheck.pode) {
      return res.status(402).json({
        sucesso: false,
        erro: 'limite_atingido',
        mensagem: limiteCheck.mensagem,
        usado: limiteCheck.usado,
        limite: limiteCheck.limite,
        upgrade_url: (process.env.APP_URL || '').replace(/\/$/, '') + '/landing'
      });
    }

    // Emitir NFSe
    const resultado = await emitirNFSe(dadosPedido, cfg.emitente, configFiscal, 'servico', configFocus);

    if (resultado.sucesso) {
      await registrarEmissao(tenantId);
    }

    if (resultado.sucesso && dadosPedido.pedido_id_db) {
      // Atualizar status do pedido
      await atualizarPedido(dadosPedido.pedido_id_db, {
        status: resultado.status === 'autorizado' ? 'emitida' : 'processando'
      });
    }

    res.json(resultado);

  } catch (error) {
    logger.error('Erro ao emitir NFSe manual', {
      error: error.message
    });

    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Consulta status de NFSe
 */
async function consultarStatus(req, res) {
  try {
    const { referencia } = req.params;
    const tenantId = req.tenant_id || null;
    const cfg = tenantId ? await getConfigForTenant(tenantId) : null;
    const configFocus = tenantId && cfg?.focusNFe ? { token: cfg.focusNFe.token, ambiente: cfg.focusNFe.ambiente } : null;

    logger.focusNFe('consultar_status', 'Consulta de status solicitada', {
      referencia
    });

    const resultado = await consultarNFSe(referencia, configFocus);
    res.json(resultado);

  } catch (error) {
    logger.error('Erro ao consultar status', {
      error: error.message
    });

    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Cancela NFSe
 */
async function cancelar(req, res) {
  try {
    const { referencia } = req.params;
    const { justificativa } = req.body;
    const tenantId = req.tenant_id || null;
    const cfg = tenantId ? await getConfigForTenant(tenantId) : null;
    const configFocus = tenantId && cfg?.focusNFe ? { token: cfg.focusNFe.token, ambiente: cfg.focusNFe.ambiente } : null;

    if (!justificativa) {
      return res.status(400).json({
        erro: 'Justificativa é obrigatória'
      });
    }

    logger.focusNFe('cancelar_nfse', 'Cancelamento solicitado', {
      referencia
    });

    const resultado = await cancelarNFSe(referencia, justificativa, configFocus);
    res.json(resultado);

  } catch (error) {
    logger.error('Erro ao cancelar NFSe', {
      error: error.message
    });

    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Emite NF de teste (serviço ou produto) com dados de teste variados
 */
async function emitirTeste(req, res) {
  try {
    const { tipo_nf } = req.body;
    const tipoNF = tipo_nf || 'servico';

    logger.info('Emissão de teste solicitada', {
      tipo_nf: tipoNF
    });

    // Dados de teste - nome varia a cada execução
    const nomesTeste = ['João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Souza'];
    const nomeAleatorio = nomesTeste[Math.floor(Math.random() * nomesTeste.length)];

    const dadosTeste = {
      pedido_id: `TEST-${Date.now()}`,
      data_pedido: new Date().toISOString(),
      data_emissao: new Date().toISOString().split('T')[0],

      // Dados do cliente
      nome: nomeAleatorio,
      razao_social: nomeAleatorio,
      cpf_cnpj: '09762992911',
      email: 'teste@exemplo.com',
      telefone: '11999999999',

      // Endereço (usando Ipojuca/PE para consistência)
      endereco: {
        rua: 'Rua Teste',
        numero: '123',
        complemento: '',
        bairro: 'Centro',
        cidade: 'Ipojuca',
        estado: 'PE',
        cep: '55590000',
        pais: 'Brasil'
      },

      // Serviços/Produtos
      servicos: tipoNF === 'produto' ? [
        {
          nome: 'Produto de Teste',
          codigo: 'PROD001',
          quantidade: 1,
          valor_unitario: 100.00,
          total: 100.00,
          meta_data: [
            { key: 'ncm', value: '49019900' },
            { key: 'cfop', value: '5102' }
          ]
        }
      ] : [
        {
          nome: 'Serviço de Teste',
          codigo: 'TEST001',
          quantidade: 1,
          valor_unitario: 100.00,
          total: 100.00,
          item_lista_servico: '70101',
          codigo_tributario_municipio: '101',
          discriminacao: 'Serviço de Teste'
        }
      ],

      valor_total: 100.00,
      valor_servicos: tipoNF === 'servico' ? 100.00 : undefined,
      frete: 0,
      valor_desconto: 0,
      metodo_pagamento: 'teste'
    };

    const tenantId = req.tenant_id || null;
    const cfg = tenantId ? await getConfigForTenant(tenantId) : config;
    const configFiscal = cfg.fiscal || config.fiscal;
    const configFocus = tenantId && cfg.focusNFe ? { token: cfg.focusNFe.token, ambiente: cfg.focusNFe.ambiente } : null;

    const limiteCheck = await verificarLimite(tenantId);
    if (!limiteCheck.pode) {
      return res.status(402).json({
        sucesso: false,
        erro: 'limite_atingido',
        mensagem: limiteCheck.mensagem,
        usado: limiteCheck.usado,
        limite: limiteCheck.limite,
        upgrade_url: (process.env.APP_URL || '').replace(/\/$/, '') + '/landing'
      });
    }

    let resultado;

    if (tipoNF === 'produto') {
      // Emitir NFe de produto
      resultado = await emitirNFe(dadosTeste, cfg.emitente, configFiscal, configFocus);
    } else {
      // Emitir NFSe de serviço
      resultado = await emitirNFSe(dadosTeste, cfg.emitente, configFiscal, tipoNF, configFocus);
    }

    if (resultado && resultado.sucesso) {
      await registrarEmissao(tenantId);
    }

    res.json(resultado);

  } catch (error) {
    logger.error('Erro ao emitir NF de teste', {
      error: error.message
    });

    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Busca notas na Focus NFe e banco local
 */
async function buscarNotas(req, res) {
  try {
    const { referencia, chave, data_inicio, data_fim, status, tipo_nota, apenas_banco_local } = req.query;

    // Se apenas_banco_local não for enviado ou for 'false', buscar na Focus NFe
    const apenasBancoLocal = apenas_banco_local === 'true' || apenas_banco_local === '1';

    logger.info('🔍 [BUSCAR NOTAS] Busca de notas solicitada', {
      referencia,
      chave,
      data_inicio,
      data_fim,
      status,
      tipo_nota,
      apenas_banco_local_param: apenas_banco_local,
      apenas_banco_local_interpretado: apenasBancoLocal,
      buscar_na_focus: !apenasBancoLocal,
      ip: req.ip,
      user_agent: req.get('user-agent')
    });

    // Preparar filtros
    const filtros = {
      tenant_id: req.tenant_id
    };
    if (referencia) filtros.referencia = referencia;
    if (chave) filtros.chave = chave;
    if (data_inicio) filtros.data_inicio = data_inicio;
    if (data_fim) filtros.data_fim = data_fim;
    if (status) filtros.status = status;

    // Se apenas_banco_local for true, buscar apenas do banco local (notas recebidas via webhook)
    if (apenasBancoLocal) {
      logger.info('🔍 [BUSCAR NOTAS] Buscando apenas do banco local (notas recebidas via webhook)');

      const promises = [];

      // Buscar NFSe do banco local
      if (!tipo_nota || tipo_nota === 'nfse') {
        promises.push(
          Promise.resolve(listarNFSe({
            ...filtros,
            ...(status ? { status_focus: status } : {}),
            limite: 1000,
            offset: 0
          }))
            .then(result => {
              const dados = Array.isArray(result) ? result : (result?.dados || result?.rows || []);
              logger.info('🔍 [BUSCAR NOTAS] NFSe do banco local encontradas', {
                total: dados.length
              });
              return { tipo: 'nfse', origem: 'banco_local', resultado: { sucesso: true, dados } };
            })
            .catch(err => {
              logger.warn('🔍 [BUSCAR NOTAS] Erro ao buscar NFSe do banco local', {
                erro: err.message
              });
              return { tipo: 'nfse', origem: 'banco_local', resultado: { sucesso: false, erro: err.message } };
            })
        );
      }

      // Buscar NFe do banco local
      if (!tipo_nota || tipo_nota === 'nfe') {
        promises.push(
          Promise.resolve(listarNFe({
            ...filtros,
            ...(status ? { status_focus: status } : {}),
            limite: 1000,
            offset: 0
          }))
            .then(result => {
              const dados = Array.isArray(result) ? result : (result?.dados || result?.rows || []);
              logger.info('🔍 [BUSCAR NOTAS] NFe do banco local encontradas', {
                total: dados.length
              });
              return { tipo: 'nfe', origem: 'banco_local', resultado: { sucesso: true, dados } };
            })
            .catch(err => {
              logger.warn('🔍 [BUSCAR NOTAS] Erro ao buscar NFe do banco local', {
                erro: err.message
              });
              return { tipo: 'nfe', origem: 'banco_local', resultado: { sucesso: false, erro: err.message } };
            })
        );
      }

      const resultados = await Promise.all(promises);

      // Processar e combinar resultados (mesmo código de antes)
      const todasNotas = [];

      resultados.forEach(({ tipo, origem, resultado }) => {
        if (resultado && resultado.sucesso) {
          const notas = resultado.dados || [];
          notas.forEach(nota => {
            todasNotas.push({
              ...nota,
              tipo_nota: tipo,
              origem: origem || 'banco_local'
            });
          });
        }
      });

      // Remover duplicatas por referência
      const notasUnicas = [];
      const referenciasVistas = new Set();

      todasNotas.forEach(nota => {
        const ref = nota.referencia || nota.ref;
        if (ref && !referenciasVistas.has(ref)) {
          referenciasVistas.add(ref);
          notasUnicas.push(nota);
        } else if (!ref) {
          notasUnicas.push(nota);
        }
      });

      logger.info('✅ [BUSCAR NOTAS] Busca do banco local concluída', {
        total_encontradas: notasUnicas.length
      });

      return res.json({
        sucesso: true,
        dados: notasUnicas,
        total: notasUnicas.length,
        origem: 'banco_local'
      });
    }

    // Buscar na Focus NFe e banco local em paralelo
    // IMPORTANTE: Buscar em AMBOS os ambientes (homologação E produção)
    const promises = [];

    // Salvar ambiente atual
    const ambienteAtual = process.env.FOCUS_NFE_AMBIENTE || 'homologacao';

    logger.info('🔍 [BUSCAR NOTAS] Iniciando buscas paralelas', {
      buscar_nfse: !tipo_nota || tipo_nota === 'nfse',
      buscar_nfe: !tipo_nota || tipo_nota === 'nfe',
      filtros_aplicados: filtros,
      ambiente_atual: ambienteAtual,
      buscando_ambos_ambientes: true
    });

    // Buscar NFSe
    if (!tipo_nota || tipo_nota === 'nfse') {
      logger.info('🔍 [BUSCAR NOTAS] Buscando NFSe em ambos os ambientes...');

      // Buscar NFSe em HOMOLOGAÇÃO
      const buscarNFSeHomologacao = () => {
        const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE;
        process.env.FOCUS_NFE_AMBIENTE = 'homologacao';
        logger.info('🔍 [BUSCAR NOTAS] Iniciando busca NFSe (HOMOLOGAÇÃO)...');
        return listarTodasNFSe(filtros)
          .then(result => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.info('🔍 [BUSCAR NOTAS] NFSe da Focus NFe (HOMOLOGAÇÃO) encontradas', {
              total: result.notas?.length || 0,
              sucesso: result.sucesso,
              ambiente: 'homologacao',
              resultado_completo: result
            });
            // Adicionar ambiente às notas
            if (result.notas && Array.isArray(result.notas)) {
              result.notas = result.notas.map(nota => ({ ...nota, ambiente: 'homologacao' }));
            }
            return { tipo: 'nfse', origem: 'focus_nfe', ambiente: 'homologacao', resultado: result };
          })
          .catch(err => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.error('🔍 [BUSCAR NOTAS] Erro ao buscar NFSe da Focus NFe (HOMOLOGAÇÃO)', {
              erro: err.message,
              stack: err.stack,
              ambiente: 'homologacao',
              erro_completo: err
            });
            return { tipo: 'nfse', origem: 'focus_nfe', ambiente: 'homologacao', resultado: { sucesso: false, erro: err.message, erro_completo: err.toString() } };
          });
      };

      // Buscar NFSe em PRODUÇÃO
      const buscarNFSeProducao = () => {
        const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE;
        process.env.FOCUS_NFE_AMBIENTE = 'producao';
        logger.info('🔍 [BUSCAR NOTAS] Iniciando busca NFSe (PRODUÇÃO)...');
        return listarTodasNFSe(filtros)
          .then(result => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.info('🔍 [BUSCAR NOTAS] NFSe da Focus NFe (PRODUÇÃO) encontradas', {
              total: result.notas?.length || 0,
              sucesso: result.sucesso,
              ambiente: 'producao',
              resultado_completo: result
            });
            // Adicionar ambiente às notas
            if (result.notas && Array.isArray(result.notas)) {
              result.notas = result.notas.map(nota => ({ ...nota, ambiente: 'producao' }));
            }
            return { tipo: 'nfse', origem: 'focus_nfe', ambiente: 'producao', resultado: result };
          })
          .catch(err => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.error('🔍 [BUSCAR NOTAS] Erro ao buscar NFSe da Focus NFe (PRODUÇÃO)', {
              erro: err.message,
              stack: err.stack,
              ambiente: 'producao',
              erro_completo: err
            });
            return { tipo: 'nfse', origem: 'focus_nfe', ambiente: 'producao', resultado: { sucesso: false, erro: err.message, erro_completo: err.toString() } };
          });
      };

      promises.push(
        buscarNFSeHomologacao(),
        buscarNFSeProducao(),
        Promise.resolve(listarNFSe({
          ...filtros,
          ...(status ? { status_focus: status } : {}),
          limite: 1000,
          offset: 0
        }))
          .then(result => {
            const dados = Array.isArray(result) ? result : (result?.dados || result?.rows || []);
            logger.info('🔍 [BUSCAR NOTAS] NFSe do banco local encontradas', {
              total: dados.length
            });
            return { tipo: 'nfse', origem: 'banco_local', resultado: { sucesso: true, dados } };
          })
          .catch(err => {
            logger.warn('🔍 [BUSCAR NOTAS] Erro ao buscar NFSe do banco local', {
              erro: err.message
            });
            return { tipo: 'nfse', origem: 'banco_local', resultado: { sucesso: false, erro: err.message } };
          })
      );
    }

    // Buscar NFe
    if (!tipo_nota || tipo_nota === 'nfe') {
      logger.info('🔍 [BUSCAR NOTAS] Buscando NFe em ambos os ambientes...');

      // Buscar NFe em HOMOLOGAÇÃO
      const buscarNFeHomologacao = () => {
        const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE;
        process.env.FOCUS_NFE_AMBIENTE = 'homologacao';
        logger.info('🔍 [BUSCAR NOTAS] Iniciando busca NFe (HOMOLOGAÇÃO)...');
        return listarTodasNFe(filtros)
          .then(result => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.info('🔍 [BUSCAR NOTAS] NFe da Focus NFe (HOMOLOGAÇÃO) encontradas', {
              total: result.notas?.length || 0,
              sucesso: result.sucesso,
              ambiente: 'homologacao',
              resultado_completo: result
            });
            // Adicionar ambiente às notas
            if (result.notas && Array.isArray(result.notas)) {
              result.notas = result.notas.map(nota => ({ ...nota, ambiente: 'homologacao' }));
            }
            return { tipo: 'nfe', origem: 'focus_nfe', ambiente: 'homologacao', resultado: result };
          })
          .catch(err => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.error('🔍 [BUSCAR NOTAS] Erro ao buscar NFe da Focus NFe (HOMOLOGAÇÃO)', {
              erro: err.message,
              stack: err.stack,
              ambiente: 'homologacao',
              erro_completo: err
            });
            return { tipo: 'nfe', origem: 'focus_nfe', ambiente: 'homologacao', resultado: { sucesso: false, erro: err.message, erro_completo: err.toString() } };
          });
      };

      // Buscar NFe em PRODUÇÃO
      const buscarNFeProducao = () => {
        const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE;
        process.env.FOCUS_NFE_AMBIENTE = 'producao';
        logger.info('🔍 [BUSCAR NOTAS] Iniciando busca NFe (PRODUÇÃO)...');
        return listarTodasNFe(filtros)
          .then(result => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.info('🔍 [BUSCAR NOTAS] NFe da Focus NFe (PRODUÇÃO) encontradas', {
              total: result.notas?.length || 0,
              sucesso: result.sucesso,
              ambiente: 'producao',
              resultado_completo: result
            });
            // Adicionar ambiente às notas
            if (result.notas && Array.isArray(result.notas)) {
              result.notas = result.notas.map(nota => ({ ...nota, ambiente: 'producao' }));
            }
            return { tipo: 'nfe', origem: 'focus_nfe', ambiente: 'producao', resultado: result };
          })
          .catch(err => {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
            logger.error('🔍 [BUSCAR NOTAS] Erro ao buscar NFe da Focus NFe (PRODUÇÃO)', {
              erro: err.message,
              stack: err.stack,
              ambiente: 'producao',
              erro_completo: err
            });
            return { tipo: 'nfe', origem: 'focus_nfe', ambiente: 'producao', resultado: { sucesso: false, erro: err.message, erro_completo: err.toString() } };
          });
      };

      promises.push(
        buscarNFeHomologacao(),
        buscarNFeProducao(),
        Promise.resolve(listarNFe({
          ...filtros,
          ...(status ? { status_focus: status } : {}),
          limite: 1000,
          offset: 0
        }))
          .then(result => {
            const dados = Array.isArray(result) ? result : (result?.dados || result?.rows || []);
            logger.info('🔍 [BUSCAR NOTAS] NFe do banco local encontradas', {
              total: dados.length
            });
            return { tipo: 'nfe', origem: 'banco_local', resultado: { sucesso: true, dados } };
          })
          .catch(err => {
            logger.warn('🔍 [BUSCAR NOTAS] Erro ao buscar NFe do banco local', {
              erro: err.message
            });
            return { tipo: 'nfe', origem: 'banco_local', resultado: { sucesso: false, erro: err.message } };
          })
      );
    }

    const resultados = await Promise.allSettled(promises);
    logger.info('🔍 [BUSCAR NOTAS] Todas as buscas concluídas', {
      total_resultados: resultados.length,
      resultados_detalhados: resultados.map((r, index) => {
        if (r.status === 'fulfilled') {
          return {
            status: 'fulfilled',
            tipo: r.value.tipo,
            origem: r.value.origem,
            ambiente: r.value.ambiente,
            sucesso: r.value.resultado?.sucesso,
            total_notas: r.value.resultado?.notas?.length || r.value.resultado?.dados?.length || 0,
            erro: r.value.resultado?.erro || null
          };
        } else {
          return {
            status: 'rejected',
            erro: r.reason?.message || 'Erro desconhecido',
            stack: r.reason?.stack
          };
        }
      })
    });

    // Converter resultados para formato esperado
    const resultadosProcessados = resultados.map(r => {
      if (r.status === 'fulfilled') {
        return r.value;
      } else {
        logger.error('🔍 [BUSCAR NOTAS] Erro em uma das buscas', {
          erro: r.reason?.message || 'Erro desconhecido',
          stack: r.reason?.stack
        });
        return {
          tipo: 'desconhecido',
          origem: 'erro',
          resultado: {
            sucesso: false,
            erro: r.reason?.message || 'Erro desconhecido'
          }
        };
      }
    });

    // Processar e combinar resultados
    const todasNotas = [];

    resultadosProcessados.forEach(({ tipo, origem, ambiente, resultado }) => {
      logger.debug('🔍 [BUSCAR NOTAS] Processando resultado', {
        tipo,
        origem,
        ambiente,
        sucesso: resultado?.sucesso,
        tem_notas: !!resultado?.notas,
        tem_dados: !!resultado?.dados,
        total_notas: resultado?.notas?.length || resultado?.dados?.length || 0,
        erro: resultado?.erro || null
      });

      if (resultado && resultado.sucesso) {
        const notas = origem === 'focus_nfe'
          ? (resultado.notas || [])
          : (resultado.dados || []);

        logger.info('🔍 [BUSCAR NOTAS] Processando notas encontradas', {
          tipo,
          origem,
          ambiente,
          total_notas: notas.length
        });

        notas.forEach(nota => {
          // Adicionar metadados
          const notaCompleta = {
            ...nota,
            tipo_nota: tipo,
            origem: origem,
            referencia: nota.referencia || nota.ref || nota.referencia,
            ambiente: nota.ambiente || ambiente || resultado.ambiente || 'homologacao'
          };

          // Aplicar filtro de referência se especificado
          if (referencia && notaCompleta.referencia && !notaCompleta.referencia.includes(referencia)) {
            return; // Pular esta nota
          }

          // Aplicar filtro de chave se especificado
          if (chave) {
            const chaveNota = notaCompleta.chave_nfe || notaCompleta.chave_nfse ||
              notaCompleta.chave ||
              (notaCompleta.dados_completos && (notaCompleta.dados_completos.chave_nfe || notaCompleta.dados_completos.chave_nfse));
            if (!chaveNota || !chaveNota.includes(chave)) {
              return; // Pular esta nota
            }
          }

          todasNotas.push(notaCompleta);
        });
      } else {
        logger.warn('🔍 [BUSCAR NOTAS] Resultado não processado (sem sucesso ou erro)', {
          tipo,
          origem,
          ambiente,
          sucesso: resultado?.sucesso,
          erro: resultado?.erro || resultado?.mensagem || 'Desconhecido'
        });
      }
    });

    logger.info('🔍 [BUSCAR NOTAS] Total de notas coletadas antes de remover duplicatas', {
      total: todasNotas.length,
      por_origem: {
        focus_nfe: todasNotas.filter(n => n.origem === 'focus_nfe').length,
        banco_local: todasNotas.filter(n => n.origem === 'banco_local').length
      },
      por_ambiente: {
        homologacao: todasNotas.filter(n => n.ambiente === 'homologacao').length,
        producao: todasNotas.filter(n => n.ambiente === 'producao').length
      }
    });

    // Remover duplicatas (mesma referência e tipo)
    const notasUnicas = [];
    const visto = new Set();

    todasNotas.forEach(nota => {
      const key = `${nota.tipo_nota}-${nota.referencia}`;
      if (!visto.has(key)) {
        visto.add(key);
        // Priorizar nota do banco local se existir duplicata
        const duplicata = notasUnicas.find(n => n.tipo_nota === nota.tipo_nota && n.referencia === nota.referencia);
        if (duplicata) {
          if (nota.origem === 'banco_local') {
            const index = notasUnicas.indexOf(duplicata);
            notasUnicas[index] = nota;
          }
        } else {
          notasUnicas.push(nota);
        }
      }
    });

    // Ordenar por data (mais recente primeiro)
    notasUnicas.sort((a, b) => {
      const dataA = new Date(a.created_at || a.data_emissao || 0);
      const dataB = new Date(b.created_at || b.data_emissao || 0);
      return dataB - dataA;
    });

    // Contar por tipo e origem
    const estatisticas = {
      total: notasUnicas.length,
      por_tipo: {},
      por_origem: {}
    };

    notasUnicas.forEach(nota => {
      const tipo = nota.tipo_nota || 'desconhecido';
      const origem = nota.origem || 'desconhecido';

      estatisticas.por_tipo[tipo] = (estatisticas.por_tipo[tipo] || 0) + 1;
      estatisticas.por_origem[origem] = (estatisticas.por_origem[origem] || 0) + 1;
    });

    logger.info('✅ [BUSCAR NOTAS] Busca de notas concluída com sucesso', {
      total_encontradas: notasUnicas.length,
      tipo_nota,
      filtros_aplicados: filtros,
      estatisticas
    });

    res.json({
      sucesso: true,
      dados: notasUnicas,
      total: notasUnicas.length
    });

  } catch (error) {
    logger.error('❌ [BUSCAR NOTAS] Erro ao buscar notas', {
      error: error.message,
      stack: error.stack,
      filtros_aplicados: req.query
    });

    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Cancela uma nota (NFe ou NFSe)
 */
async function cancelarNota(req, res) {
  try {
    const { referencia } = req.params;
    const { tipo_nota, justificativa, ambiente } = req.body;

    logger.info('🚫 [CANCELAR NOTA] Cancelamento de nota solicitado', {
      referencia,
      tipo_nota,
      justificativa_length: justificativa?.length || 0,
      ip: req.ip,
      user_agent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    });

    if (!justificativa) {
      logger.warn('🚫 [CANCELAR NOTA] Justificativa não fornecida', {
        referencia,
        tipo_nota
      });
      return res.status(400).json({
        erro: 'Justificativa é obrigatória'
      });
    }

    if (justificativa.length < 15) {
      logger.warn('🚫 [CANCELAR NOTA] Justificativa muito curta', {
        referencia,
        tipo_nota,
        length: justificativa.length
      });
      return res.status(400).json({
        erro: 'Justificativa deve ter no mínimo 15 caracteres'
      });
    }

    if (justificativa.length > 255) {
      logger.warn('🚫 [CANCELAR NOTA] Justificativa muito longa', {
        referencia,
        tipo_nota,
        length: justificativa.length
      });
      return res.status(400).json({
        erro: 'Justificativa deve ter no máximo 255 caracteres'
      });
    }

    if (!tipo_nota || (tipo_nota !== 'nfe' && tipo_nota !== 'nfse')) {
      logger.warn('🚫 [CANCELAR NOTA] Tipo de nota inválido', {
        referencia,
        tipo_nota_fornecido: tipo_nota
      });
      return res.status(400).json({
        erro: 'tipo_nota é obrigatório e deve ser "nfe" ou "nfse"'
      });
    }

    logger.info('📤 [CANCELAR NOTA] Enviando requisição de cancelamento para Focus NFe', {
      referencia,
      tipo_nota,
      ambiente: ambiente || 'não especificado',
      justificativa_preview: justificativa.substring(0, 50) + (justificativa.length > 50 ? '...' : '')
    });

    // Se ambiente foi especificado, usar temporariamente
    const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE;
    if (ambiente && (ambiente === 'homologacao' || ambiente === 'producao')) {
      process.env.FOCUS_NFE_AMBIENTE = ambiente;
      logger.info('📤 [CANCELAR NOTA] Ambiente temporário definido para cancelamento', {
        ambiente_original: ambienteOriginal,
        ambiente_temporario: ambiente
      });
    }

    let resultado;
    const inicioCancelamento = Date.now();

    try {
      if (tipo_nota === 'nfe') {
        resultado = await cancelarNFe(referencia, justificativa);
      } else {
        resultado = await cancelarNFSe(referencia, justificativa);
      }
    } finally {
      // Restaurar ambiente original
      if (ambiente && (ambiente === 'homologacao' || ambiente === 'producao')) {
        process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
        logger.info('📤 [CANCELAR NOTA] Ambiente restaurado', {
          ambiente_restaurado: ambienteOriginal
        });
      }
    }

    const tempoDecorrido = Date.now() - inicioCancelamento;

    if (resultado.sucesso) {
      logger.info('✅ [CANCELAR NOTA] Nota cancelada com sucesso', {
        referencia,
        tipo_nota,
        status_focus: resultado.status,
        status_sefaz: resultado.status_sefaz,
        mensagem_sefaz: resultado.mensagem_sefaz,
        caminho_xml_cancelamento: resultado.caminho_xml_cancelamento,
        tempo_decorrido_ms: tempoDecorrido,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('❌ [CANCELAR NOTA] Erro ao cancelar nota', {
        referencia,
        tipo_nota,
        erro: resultado.erro,
        mensagem: resultado.mensagem,
        tempo_decorrido_ms: tempoDecorrido,
        timestamp: new Date().toISOString()
      });
    }

    res.json(resultado);

  } catch (error) {
    logger.error('❌ [CANCELAR NOTA] Erro ao processar cancelamento', {
      referencia: req.params.referencia,
      tipo_nota: req.body.tipo_nota,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Cancela uma nota por chave NFe (busca a referência automaticamente)
 */
async function cancelarNotaPorChave(req, res) {
  try {
    const { chave_nfe } = req.params;
    const { justificativa, ambiente } = req.body;

    logger.info('🚫 [CANCELAR POR CHAVE] Cancelamento de nota por chave solicitado', {
      chave_nfe,
      justificativa_length: justificativa?.length || 0,
      ambiente: ambiente || 'não especificado',
      ip: req.ip,
      user_agent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    });

    if (!justificativa) {
      return res.status(400).json({
        erro: 'Justificativa é obrigatória'
      });
    }

    if (justificativa.length < 15) {
      return res.status(400).json({
        erro: 'Justificativa deve ter no mínimo 15 caracteres'
      });
    }

    if (justificativa.length > 255) {
      return res.status(400).json({
        erro: 'Justificativa deve ter no máximo 255 caracteres'
      });
    }

    // Buscar nota pela chave no banco local
    let nota = await buscarNFePorChave(chave_nfe);
    let referencia = null;
    let ambienteNota = ambiente || 'producao'; // Padrão produção para notas por chave

    if (nota) {
      referencia = nota.referencia;
      ambienteNota = nota.ambiente || ambienteNota;
      logger.info('✅ [CANCELAR POR CHAVE] Nota encontrada no banco local', {
        chave_nfe,
        referencia,
        ambiente: ambienteNota
      });
    } else {
      // Se não encontrou no banco, tentar buscar na Focus NFe
      logger.info('🔍 [CANCELAR POR CHAVE] Nota não encontrada no banco local, buscando na Focus NFe', {
        chave_nfe
      });

      // Tentar buscar em ambos os ambientes
      const ambientesParaBuscar = ambiente ? [ambiente] : ['producao', 'homologacao'];

      for (const amb of ambientesParaBuscar) {
        try {
          const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE;
          process.env.FOCUS_NFE_AMBIENTE = amb;

          logger.info(`🔍 [CANCELAR POR CHAVE] Buscando notas no ambiente ${amb}`, {
            chave_nfe,
            ambiente: amb
          });

          // Listar todas as notas e procurar pela chave
          // Tentar buscar sem filtros primeiro, depois com filtros de data se necessário
          let resultado = await listarTodasNFe({});

          logger.info(`🔍 [CANCELAR POR CHAVE] Resultado da busca no ambiente ${amb}`, {
            ambiente: amb,
            sucesso: resultado.sucesso,
            total_notas: resultado.notas?.length || 0,
            tem_notas: !!resultado.notas,
            erro: resultado.erro || null,
            erro_status: resultado.erro_status || null
          });

          // Se retornou 0 notas mas não houve erro, pode ser que a API não retornou todas
          // Tentar buscar com filtro de data (últimos 30 dias) para ver se retorna algo
          if (resultado.sucesso && (!resultado.notas || resultado.notas.length === 0) && !resultado.erro) {
            logger.info(`🔍 [CANCELAR POR CHAVE] Nenhuma nota encontrada, tentando buscar dos últimos 30 dias`, {
              ambiente: amb
            });

            const dataFim = new Date();
            const dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - 30); // Últimos 30 dias

            const resultadoComData = await listarTodasNFe({
              data_inicio: dataInicio.toISOString().split('T')[0],
              data_fim: dataFim.toISOString().split('T')[0]
            });

            if (resultadoComData.sucesso && resultadoComData.notas && resultadoComData.notas.length > 0) {
              logger.info(`🔍 [CANCELAR POR CHAVE] Encontradas ${resultadoComData.notas.length} notas nos últimos 30 dias`, {
                ambiente: amb
              });
              resultado = resultadoComData;
            }
          }

          if (resultado.sucesso && resultado.notas && resultado.notas.length > 0) {
            logger.debug(`🔍 [CANCELAR POR CHAVE] Procurando chave em ${resultado.notas.length} notas`, {
              ambiente: amb,
              chave_procurada: chave_nfe,
              primeiras_chaves: resultado.notas.slice(0, 5).map(n => ({
                referencia: n.referencia || n.ref,
                chave_nfe: n.chave_nfe || n.chave || n.dados_completos?.chave_nfe
              }))
            });

            const notaEncontrada = resultado.notas.find(n => {
              const chaveNota = n.chave_nfe || n.chave || (n.dados_completos && n.dados_completos.chave_nfe);
              return chaveNota === chave_nfe;
            });

            if (notaEncontrada) {
              referencia = notaEncontrada.referencia || notaEncontrada.ref;
              ambienteNota = amb;
              logger.info('✅ [CANCELAR POR CHAVE] Nota encontrada na Focus NFe', {
                chave_nfe,
                referencia,
                ambiente: ambienteNota,
                nota_encontrada: {
                  referencia: notaEncontrada.referencia || notaEncontrada.ref,
                  chave: notaEncontrada.chave_nfe || notaEncontrada.chave
                }
              });
              process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
              break;
            } else {
              logger.warn(`⚠️ [CANCELAR POR CHAVE] Chave não encontrada nas ${resultado.notas.length} notas do ambiente ${amb}`, {
                chave_procurada: chave_nfe,
                ambiente: amb
              });
            }
          } else {
            logger.warn(`⚠️ [CANCELAR POR CHAVE] Nenhuma nota retornada do ambiente ${amb}`, {
              ambiente: amb,
              sucesso: resultado.sucesso,
              erro: resultado.erro || null,
              total_notas: resultado.notas?.length || 0
            });
          }

          process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
        } catch (error) {
          logger.error('❌ [CANCELAR POR CHAVE] Erro ao buscar no ambiente', {
            ambiente: amb,
            erro: error.message,
            stack: error.stack
          });
        }
      }
    }

    if (!referencia) {
      logger.error('❌ [CANCELAR POR CHAVE] Nota não encontrada', {
        chave_nfe,
        ambiente_buscado: ambiente || 'ambos (produção e homologação)',
        sugestao: 'A nota pode não estar no banco local nem na lista retornada pela Focus NFe. Isso pode acontecer se: 1) A nota foi emitida em outro ambiente, 2) A API não retornou todas as notas, 3) A chave está incorreta. Se você conhece a referência da nota, use o endpoint /api/nfse/cancelar/:referencia'
      });
      return res.status(404).json({
        sucesso: false,
        erro: `Nota com chave ${chave_nfe} não encontrada`,
        chave_nfe,
        ambiente_buscado: ambiente || 'ambos (produção e homologação)',
        detalhes: 'A nota não foi encontrada no banco local nem na lista retornada pela Focus NFe. Isso pode acontecer se:',
        possiveis_causas: [
          'A nota foi emitida em outro ambiente (homologação vs produção)',
          'A API da Focus NFe não retornou todas as notas na listagem',
          'A chave informada está incorreta',
          'A nota não existe mais ou foi excluída'
        ],
        sugestao: 'Se você conhece a referência da nota (ex: PED-123), use o endpoint /api/nfse/cancelar/:referencia com tipo_nota=nfe e ambiente=producao (ou homologacao)',
        exemplo: 'DELETE /api/nfse/cancelar/PED-123 com body: { "tipo_nota": "nfe", "justificativa": "...", "ambiente": "producao" }'
      });
    }

    // Agora cancelar usando a referência encontrada
    logger.info('📤 [CANCELAR POR CHAVE] Cancelando nota pela referência encontrada', {
      chave_nfe,
      referencia,
      ambiente: ambienteNota
    });

    const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE;
    process.env.FOCUS_NFE_AMBIENTE = ambienteNota;

    try {
      const resultado = await cancelarNFe(referencia, justificativa);

      res.json({
        ...resultado,
        chave_nfe,
        referencia_encontrada: referencia,
        ambiente_utilizado: ambienteNota
      });
    } finally {
      process.env.FOCUS_NFE_AMBIENTE = ambienteOriginal;
    }

  } catch (error) {
    logger.error('❌ [CANCELAR POR CHAVE] Erro ao processar cancelamento por chave', {
      error: error.message,
      stack: error.stack,
      chave_nfe: req.params.chave_nfe
    });

    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Sincroniza notas da Focus NFe para o banco local
 * Útil para importar notas já existentes que não estão no banco local
 */
async function sincronizarNotas(req, res) {
  try {
    const { tipo_nota } = req.query;

    logger.info('🔄 [SINCRONIZAR] Iniciando sincronização de notas da Focus NFe', {
      tipo_nota: tipo_nota || 'ambos'
    });

    const resultados = {
      nfse: { importadas: 0, erros: 0 },
      nfe: { importadas: 0, erros: 0 }
    };

    // Sincronizar NFSe
    if (!tipo_nota || tipo_nota === 'nfse') {
      try {
        const notasFocus = await listarTodasNFSe();
        if (notasFocus.sucesso && notasFocus.dados) {
          const { salvarNFSe, buscarNFSePorReferencia } = require('../config/database');

          for (const nota of notasFocus.dados) {
            try {
              // Verificar se já existe no banco local
              const existente = await buscarNFSePorReferencia(nota.ref || nota.referencia);
              if (!existente) {
                // Salvar no banco local
                await salvarNFSe({
                  referencia: nota.ref || nota.referencia,
                  chave_nfse: nota.numero || null,
                  status_focus: nota.status || 'autorizado',
                  status_sefaz: nota.status_sefaz || null,
                  mensagem_sefaz: nota.mensagem_sefaz || null,
                  caminho_xml: nota.caminho_xml_nota_fiscal || nota.url_xml || null,
                  caminho_pdf: nota.caminho_pdf_nota_fiscal || nota.url_pdf || null,
                  dados_completos: nota,
                  ambiente: nota.ambiente || 'homologacao'
                });
                resultados.nfse.importadas++;
              }
            } catch (err) {
              resultados.nfse.erros++;
              logger.warn('🔄 [SINCRONIZAR] Erro ao importar NFSe', {
                referencia: nota.ref || nota.referencia,
                erro: err.message
              });
            }
          }
        }
      } catch (err) {
        logger.error('🔄 [SINCRONIZAR] Erro ao listar NFSe da Focus NFe', { erro: err.message });
      }
    }

    // Sincronizar NFe
    if (!tipo_nota || tipo_nota === 'nfe') {
      try {
        const notasFocus = await listarTodasNFe();
        if (notasFocus.sucesso && notasFocus.dados) {
          const { salvarNFe, buscarNFePorReferencia } = require('../config/database');

          for (const nota of notasFocus.dados) {
            try {
              // Verificar se já existe no banco local
              const existente = await buscarNFePorReferencia(nota.ref || nota.referencia);
              if (!existente) {
                // Salvar no banco local
                await salvarNFe({
                  referencia: nota.ref || nota.referencia,
                  chave_nfe: nota.chave_nfe || null,
                  status_focus: nota.status || 'autorizado',
                  status_sefaz: nota.status_sefaz || null,
                  mensagem_sefaz: nota.mensagem_sefaz || null,
                  caminho_xml_nota_fiscal: nota.caminho_xml_nota_fiscal || nota.url_xml || null,
                  caminho_danfe: nota.caminho_danfe || nota.url_danfe || null,
                  dados_completos: nota,
                  ambiente: nota.ambiente || 'homologacao'
                });
                resultados.nfe.importadas++;
              }
            } catch (err) {
              resultados.nfe.erros++;
              logger.warn('🔄 [SINCRONIZAR] Erro ao importar NFe', {
                referencia: nota.ref || nota.referencia,
                erro: err.message
              });
            }
          }
        }
      } catch (err) {
        logger.error('🔄 [SINCRONIZAR] Erro ao listar NFe da Focus NFe', { erro: err.message });
      }
    }

    logger.info('🔄 [SINCRONIZAR] Sincronização concluída', resultados);

    res.json({
      sucesso: true,
      mensagem: 'Sincronização concluída',
      resultados
    });

  } catch (error) {
    logger.error('🔄 [SINCRONIZAR] Erro na sincronização', {
      error: error.message
    });

    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Atualiza status de todas as notas pendentes (processando_autorizacao)
 */
async function atualizarStatusPendentes(req, res) {
  try {
    logger.info('🔄 [ATUALIZAR STATUS] Iniciando atualização de notas pendentes');

    const { listarNFSe: listarNFSeDB, listarNFe: listarNFeDB, atualizarNFSe, atualizarNFe } = require('../config/database');

    let atualizadas = 0;
    let erros = 0;
    const detalhes = [];

    // Buscar NFSe pendentes
    const nfsePendentes = await listarNFSeDB({ status_focus: 'processando_autorizacao', limite: 100 });
    const listaNFSe = nfsePendentes.dados || nfsePendentes || [];

    for (const nota of listaNFSe) {
      try {
        const resultado = await consultarNFSe(nota.referencia);
        if (resultado.sucesso && resultado.status !== 'processando_autorizacao') {
          await atualizarNFSe(nota.referencia, {
            status_focus: resultado.status,
            chave_nfse: resultado.numero || resultado.chave_nfse,
            caminho_xml: resultado.caminho_xml_nota_fiscal || resultado.url_xml,
            caminho_pdf: resultado.caminho_pdf_nota_fiscal || resultado.url_pdf,
            dados_completos: resultado.dados
          });
          atualizadas++;
          detalhes.push({ ref: nota.referencia, tipo: 'nfse', status_novo: resultado.status });
        }
      } catch (err) {
        erros++;
      }
    }

    // Buscar NFe pendentes
    const nfePendentes = await listarNFeDB({ status_focus: 'processando_autorizacao', limite: 100 });
    const listaNFe = nfePendentes.dados || nfePendentes || [];

    for (const nota of listaNFe) {
      try {
        const resultado = await consultarNFe(nota.referencia);
        if (resultado.sucesso && resultado.status !== 'processando_autorizacao') {
          await atualizarNFe(nota.referencia, {
            status_focus: resultado.status,
            chave_nfe: resultado.chave_nfe,
            status_sefaz: resultado.status_sefaz,
            mensagem_sefaz: resultado.mensagem_sefaz,
            caminho_xml_nota_fiscal: resultado.caminho_xml_nota_fiscal,
            caminho_danfe: resultado.caminho_danfe,
            dados_completos: resultado.dados
          });
          atualizadas++;
          detalhes.push({ ref: nota.referencia, tipo: 'nfe', status_novo: resultado.status });
        }
      } catch (err) {
        erros++;
      }
    }

    logger.info('✅ [ATUALIZAR STATUS] Atualização concluída', {
      total_pendentes: listaNFSe.length + listaNFe.length,
      atualizadas,
      erros
    });

    res.json({
      sucesso: true,
      mensagem: 'Status atualizados',
      total_pendentes: listaNFSe.length + listaNFe.length,
      atualizadas,
      erros,
      detalhes
    });

  } catch (error) {
    logger.error('Erro ao atualizar status pendentes', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

module.exports = {
  emitirNFSeManual,
  consultarStatus,
  cancelar,
  emitirNFSeLote,
  emitirTeste,
  buscarNotas,
  cancelarNota,
  cancelarNotaPorChave,
  sincronizarNotas,
  atualizarStatusPendentes
};

