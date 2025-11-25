const logger = require('../services/logger');
const { listarPedidos, buscarPedidoPorId, buscarPedidoPorPedidoId, listarNFSe, listarNFe, atualizarPedido, listarLogs, salvarNFSe, salvarNFe, buscarNFSePorReferencia, buscarNFePorReferencia, salvarPedido } = require('../config/database');
const { listarTodasNFSe, consultarNFSe } = require('../services/focusNFSe');
const { listarTodasNFe, consultarNFe } = require('../services/focusNFe');
const woocommerce = require('../services/woocommerce');

/**
 * Lista pedidos
 */
async function listar(req, res) {
  try {
    const { limite = 50, offset = 0, status, origem } = req.query;
    
    const pedidos = await listarPedidos({
      limite: parseInt(limite),
      offset: parseInt(offset),
      status,
      origem
    });
    
    res.json(pedidos);
    
  } catch (error) {
    logger.error('Erro ao listar pedidos', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Busca pedido por ID
 */
async function buscarPorId(req, res) {
  try {
    const { id } = req.params;
    
    const pedido = await buscarPedidoPorId(id);
    
    if (!pedido) {
      return res.status(404).json({
        erro: 'Pedido não encontrado'
      });
    }
    
    res.json(pedido);
    
  } catch (error) {
    logger.error('Erro ao buscar pedido', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Lista NFSe
 */
async function listarNFSeRoute(req, res) {
  try {
    const { limite = 50, offset = 0, status_focus, pedido_id, data_inicio, data_fim, ambiente } = req.query;
    
    // Validação de parâmetros de data
    if (data_inicio && !/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) {
      return res.status(400).json({
        erro: 'Formato de data_inicio inválido. Use YYYY-MM-DD'
      });
    }
    
    if (data_fim && !/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) {
      return res.status(400).json({
        erro: 'Formato de data_fim inválido. Use YYYY-MM-DD'
      });
    }
    
    if (data_inicio && data_fim && new Date(data_inicio) > new Date(data_fim)) {
      return res.status(400).json({
        erro: 'data_inicio não pode ser maior que data_fim'
      });
    }
    
    const resultado = await listarNFSe({
      limite: parseInt(limite),
      offset: parseInt(offset),
      status_focus,
      pedido_id: pedido_id ? parseInt(pedido_id) : undefined,
      data_inicio,
      data_fim,
      ambiente
    });
    
    res.json({
      sucesso: true,
      ...resultado
    });
    
  } catch (error) {
    logger.error('Erro ao listar NFSe', {
      error: error.message,
      stack: error.stack
    });
    
    const statusCode = error.message.includes('inválido') || error.message.includes('inválida') ? 400 : 500;
    
    res.status(statusCode).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Atualiza status de um pedido
 */
async function atualizarStatus(req, res) {
  try {
    const { id } = req.params; // Este é o pedido_id (ID do WooCommerce)
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        erro: 'Status é obrigatório'
      });
    }
    
    // Buscar pedido pelo pedido_id (ID do WooCommerce)
    const pedido = await buscarPedidoPorPedidoId(id);
    
    if (!pedido) {
      return res.status(404).json({
        erro: 'Pedido não encontrado'
      });
    }
    
    // Atualizar status usando o ID interno
    const pedidoAtualizado = await atualizarPedido(pedido.id, { status });
    
    res.json({
      sucesso: true,
      pedido: pedidoAtualizado
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar status do pedido', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Lista todas as notas (NFSe e NFe) combinadas
 */
async function listarTodasNotas(req, res) {
  try {
    const { limite = 50, offset = 0, status_focus, pedido_id, data_inicio, data_fim, ambiente } = req.query;
    
    // Validação de parâmetros de data
    if (data_inicio && !/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) {
      return res.status(400).json({
        erro: 'Formato de data_inicio inválido. Use YYYY-MM-DD'
      });
    }
    
    if (data_fim && !/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) {
      return res.status(400).json({
        erro: 'Formato de data_fim inválido. Use YYYY-MM-DD'
      });
    }
    
    if (data_inicio && data_fim && new Date(data_inicio) > new Date(data_fim)) {
      return res.status(400).json({
        erro: 'data_inicio não pode ser maior que data_fim'
      });
    }
    
    // Preparar filtros comuns
    const filtros = {
      limite: 1000, // Buscar mais para combinar e ordenar
      offset: 0,
      status_focus,
      pedido_id: pedido_id ? parseInt(pedido_id) : undefined,
      data_inicio,
      data_fim,
      ambiente
    };
    
    // Buscar NFSe e NFe em paralelo
    const [resultadoNFSe, resultadoNFe] = await Promise.all([
      listarNFSe(filtros),
      listarNFe(filtros)
    ]);
    
    // Adicionar tipo_nota a cada item
    const notasNFSe = (resultadoNFSe.dados || []).map(nota => ({
      ...nota,
      tipo_nota: 'nfse'
    }));
    
    const notasNFe = (resultadoNFe.dados || []).map(nota => ({
      ...nota,
      tipo_nota: 'nfe'
    }));
    
    // Combinar e ordenar por data (mais recente primeiro)
    const todasNotas = [...notasNFSe, ...notasNFe].sort((a, b) => {
      const dataA = new Date(a.created_at);
      const dataB = new Date(b.created_at);
      return dataB - dataA; // Ordem decrescente (mais recente primeiro)
    });
    
    // Aplicar paginação após ordenação
    const total = todasNotas.length;
    const offsetNum = parseInt(offset);
    const limiteNum = parseInt(limite);
    const notasPaginadas = todasNotas.slice(offsetNum, offsetNum + limiteNum);
    
    res.json({
      sucesso: true,
      dados: notasPaginadas,
      total: total,
      limite: limiteNum,
      offset: offsetNum
    });
    
  } catch (error) {
    logger.error('Erro ao listar todas as notas', {
      error: error.message,
      stack: error.stack
    });
    
    const statusCode = error.message.includes('inválido') || error.message.includes('inválida') ? 400 : 500;
    
    res.status(statusCode).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Lista logs relacionados a pedidos
 */
async function listarLogsPedidos(req, res) {
  try {
    const { pedido_ids, mes, limite = 100 } = req.query;
    
    let filtros = {
      limite: parseInt(limite),
      offset: 0
    };
    
    // Se pedido_ids for fornecido, filtrar por eles
    if (pedido_ids) {
      const ids = Array.isArray(pedido_ids) ? pedido_ids : pedido_ids.split(',');
      // Buscar logs para cada pedido_id
      const todosLogs = [];
      for (const pedidoId of ids) {
        const logs = await listarLogs({
          ...filtros,
          pedido_id: pedidoId.trim()
        });
        todosLogs.push(...logs);
      }
      
      // Ordenar por data (mais recente primeiro)
      todosLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      return res.json(todosLogs.slice(0, parseInt(limite)));
    }
    
    // Se mes for fornecido (formato YYYY-MM), filtrar por data
    if (mes) {
      const [ano, mesNum] = mes.split('-');
      // Criar datas no início e fim do mês (UTC)
      const dataInicio = new Date(Date.UTC(parseInt(ano), parseInt(mesNum) - 1, 1, 0, 0, 0, 0));
      const dataFim = new Date(Date.UTC(parseInt(ano), parseInt(mesNum), 0, 23, 59, 59, 999));
      
      // Buscar mais logs para garantir que temos todos do mês
      const logs = await listarLogs({ ...filtros, limite: 1000 });
      
      // Filtrar por data
      const logsFiltrados = logs.filter(log => {
        if (!log.created_at) return false;
        const dataLog = new Date(log.created_at);
        return dataLog >= dataInicio && dataLog <= dataFim;
      });
      
      // Ordenar por data (mais recente primeiro)
      logsFiltrados.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      return res.json(logsFiltrados.slice(0, parseInt(limite)));
    }
    
    // Sem filtros, retornar logs recentes
    const logs = await listarLogs(filtros);
    res.json(logs);
    
  } catch (error) {
    logger.error('Erro ao listar logs de pedidos', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Sincroniza todas as notas da Focus NFe com o banco local
 * Busca todas as notas (NFSe e NFe) da Focus NFe em AMBOS os ambientes e atualiza/cria registros no banco local
 * Para cada nota encontrada, consulta os dados completos antes de salvar
 */
async function sincronizarNotas(req, res) {
  try {
    const { ambiente, data_inicio, data_fim } = req.body;
    
    logger.info('🔄 [SINCRONIZAR] Iniciando sincronização de notas da Focus NFe', {
      ambiente_solicitado: ambiente,
      data_inicio,
      data_fim,
      sincronizando_ambos_ambientes: !ambiente || ambiente === 'ambos'
    });
    
    // Preparar filtros para busca na Focus NFe
    const filtros = {};
    if (data_inicio) {
      filtros.data_inicio = data_inicio;
    }
    if (data_fim) {
      filtros.data_fim = data_fim;
    }
    
    // Salvar ambiente atual
    const ambienteOriginal = process.env.FOCUS_NFE_AMBIENTE || 'homologacao';
    
    // Determinar quais ambientes sincronizar
    const ambientesParaSincronizar = [];
    if (!ambiente || ambiente === 'ambos') {
      ambientesParaSincronizar.push('homologacao', 'producao');
    } else {
      ambientesParaSincronizar.push(ambiente);
    }
    
    logger.info('🔄 [SINCRONIZAR] Ambientes que serão sincronizados', {
      ambientes: ambientesParaSincronizar,
      ambiente_original: ambienteOriginal
    });
    
    // Buscar notas de todos os ambientes
    const promessasBusca = [];
    
    for (const amb of ambientesParaSincronizar) {
      // Buscar NFSe
      promessasBusca.push(
        (async () => {
          const ambienteOriginalTemp = process.env.FOCUS_NFE_AMBIENTE;
          process.env.FOCUS_NFE_AMBIENTE = amb;
          try {
            const resultado = await listarTodasNFSe(filtros);
            return { tipo: 'nfse', ambiente: amb, resultado };
          } finally {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginalTemp;
          }
        })()
      );
      
      // Buscar NFe
      promessasBusca.push(
        (async () => {
          const ambienteOriginalTemp = process.env.FOCUS_NFE_AMBIENTE;
          process.env.FOCUS_NFE_AMBIENTE = amb;
          try {
            const resultado = await listarTodasNFe(filtros);
            return { tipo: 'nfe', ambiente: amb, resultado };
          } finally {
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginalTemp;
          }
        })()
      );
    }
    
    const resultadosBusca = await Promise.all(promessasBusca);
    
    // Separar resultados por tipo e ambiente
    const resultadoNFSeHomologacao = resultadosBusca.find(r => r.tipo === 'nfse' && r.ambiente === 'homologacao')?.resultado || { sucesso: false, notas: [] };
    const resultadoNFSeProducao = resultadosBusca.find(r => r.tipo === 'nfse' && r.ambiente === 'producao')?.resultado || { sucesso: false, notas: [] };
    const resultadoNFeHomologacao = resultadosBusca.find(r => r.tipo === 'nfe' && r.ambiente === 'homologacao')?.resultado || { sucesso: false, notas: [] };
    const resultadoNFeProducao = resultadosBusca.find(r => r.tipo === 'nfe' && r.ambiente === 'producao')?.resultado || { sucesso: false, notas: [] };
    
    // Combinar notas de ambos os ambientes
    const todasNFSe = [
      ...(resultadoNFSeHomologacao.notas || []).map(n => ({ ...n, ambiente: 'homologacao' })),
      ...(resultadoNFSeProducao.notas || []).map(n => ({ ...n, ambiente: 'producao' }))
    ];
    
    const todasNFe = [
      ...(resultadoNFeHomologacao.notas || []).map(n => ({ ...n, ambiente: 'homologacao' })),
      ...(resultadoNFeProducao.notas || []).map(n => ({ ...n, ambiente: 'producao' }))
    ];
    
    logger.info('🔄 [SINCRONIZAR] Notas encontradas na Focus NFe', {
      nfse_homologacao: resultadoNFSeHomologacao.notas?.length || 0,
      nfse_producao: resultadoNFSeProducao.notas?.length || 0,
      nfe_homologacao: resultadoNFeHomologacao.notas?.length || 0,
      nfe_producao: resultadoNFeProducao.notas?.length || 0,
      total_nfse: todasNFSe.length,
      total_nfe: todasNFe.length
    });
    
    let nfseCriadas = 0;
    let nfseAtualizadas = 0;
    let nfseErros = 0;
    let nfeCriadas = 0;
    let nfeAtualizadas = 0;
    let nfeErros = 0;
    
    // Sincronizar NFSe
    if (todasNFSe.length > 0) {
      logger.info(`🔄 [SINCRONIZAR] Sincronizando ${todasNFSe.length} NFSe de ambos os ambientes`);
      
      for (const notaFocus of todasNFSe) {
        try {
          const referencia = notaFocus.referencia || notaFocus.ref;
          const ambienteNota = notaFocus.ambiente || 'homologacao';
          
          if (!referencia) {
            logger.warn('🔄 [SINCRONIZAR] NFSe sem referência, pulando', { nota: notaFocus });
            nfseErros++;
            continue;
          }
          
          // Consultar dados completos da nota antes de salvar
          let dadosCompletos = notaFocus;
          try {
            const ambienteOriginalTemp = process.env.FOCUS_NFE_AMBIENTE;
            process.env.FOCUS_NFE_AMBIENTE = ambienteNota;
            const consulta = await consultarNFSe(referencia);
            if (consulta.sucesso && consulta.dados) {
              dadosCompletos = consulta.dados;
              logger.debug('🔄 [SINCRONIZAR] Dados completos obtidos para NFSe', {
                referencia,
                ambiente: ambienteNota
              });
            }
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginalTemp;
          } catch (errorConsulta) {
            logger.warn('🔄 [SINCRONIZAR] Erro ao consultar dados completos da NFSe, usando dados da listagem', {
              referencia,
              ambiente: ambienteNota,
              erro: errorConsulta.message
            });
            // Continuar com os dados da listagem
          }
          
          // Verificar se já existe no banco
          const notaExistente = await buscarNFSePorReferencia(referencia);
          
          if (notaExistente) {
            // Atualizar nota existente
            await salvarNFSe({
              pedido_id: notaExistente.pedido_id || null,
              referencia: referencia,
              chave_nfse: dadosCompletos.chave_nfse || dadosCompletos.codigo_verificacao || dadosCompletos.numero || notaExistente.chave_nfse,
              status_focus: dadosCompletos.status || notaExistente.status_focus,
              status_sefaz: dadosCompletos.status_sefaz || notaExistente.status_sefaz,
              mensagem_sefaz: dadosCompletos.mensagem_sefaz || notaExistente.mensagem_sefaz,
              caminho_xml: dadosCompletos.caminho_xml || dadosCompletos.caminho_xml_nota_fiscal || dadosCompletos.caminho_xml_nota_fsical || notaExistente.caminho_xml,
              caminho_pdf: dadosCompletos.caminho_pdf || dadosCompletos.caminho_danfe || notaExistente.caminho_pdf,
              dados_completos: dadosCompletos,
              ambiente: ambienteNota
            });
            nfseAtualizadas++;
          } else {
            // Criar nova nota
            await salvarNFSe({
              pedido_id: null,
              referencia: referencia,
              chave_nfse: dadosCompletos.chave_nfse || dadosCompletos.codigo_verificacao || dadosCompletos.numero || null,
              status_focus: dadosCompletos.status || 'processando_autorizacao',
              status_sefaz: dadosCompletos.status_sefaz || null,
              mensagem_sefaz: dadosCompletos.mensagem_sefaz || null,
              caminho_xml: dadosCompletos.caminho_xml || dadosCompletos.caminho_xml_nota_fiscal || dadosCompletos.caminho_xml_nota_fsical || null,
              caminho_pdf: dadosCompletos.caminho_pdf || dadosCompletos.caminho_danfe || null,
              dados_completos: dadosCompletos,
              ambiente: ambienteNota
            });
            nfseCriadas++;
          }
        } catch (error) {
          logger.error('🔄 [SINCRONIZAR] Erro ao sincronizar NFSe', {
            referencia: notaFocus.referencia || notaFocus.ref,
            ambiente: notaFocus.ambiente,
            error: error.message,
            stack: error.stack
          });
          nfseErros++;
        }
      }
    } else {
      logger.info('🔄 [SINCRONIZAR] Nenhuma NFSe encontrada na Focus NFe para sincronizar');
    }
    
    // Sincronizar NFe
    if (todasNFe.length > 0) {
      logger.info(`🔄 [SINCRONIZAR] Sincronizando ${todasNFe.length} NFe de ambos os ambientes`);
      
      for (const notaFocus of todasNFe) {
        try {
          const referencia = notaFocus.referencia || notaFocus.ref;
          const ambienteNota = notaFocus.ambiente || 'homologacao';
          
          if (!referencia) {
            logger.warn('🔄 [SINCRONIZAR] NFe sem referência, pulando', { nota: notaFocus });
            nfeErros++;
            continue;
          }
          
          // Consultar dados completos da nota antes de salvar
          let dadosCompletos = notaFocus;
          try {
            const ambienteOriginalTemp = process.env.FOCUS_NFE_AMBIENTE;
            process.env.FOCUS_NFE_AMBIENTE = ambienteNota;
            const consulta = await consultarNFe(referencia);
            if (consulta.sucesso && consulta.dados) {
              dadosCompletos = consulta.dados;
              logger.debug('🔄 [SINCRONIZAR] Dados completos obtidos para NFe', {
                referencia,
                ambiente: ambienteNota
              });
            }
            process.env.FOCUS_NFE_AMBIENTE = ambienteOriginalTemp;
          } catch (errorConsulta) {
            logger.warn('🔄 [SINCRONIZAR] Erro ao consultar dados completos da NFe, usando dados da listagem', {
              referencia,
              ambiente: ambienteNota,
              erro: errorConsulta.message
            });
            // Continuar com os dados da listagem
          }
          
          // Verificar se já existe no banco
          const notaExistente = await buscarNFePorReferencia(referencia);
          
          if (notaExistente) {
            // Atualizar nota existente
            await salvarNFe({
              pedido_id: notaExistente.pedido_id || null,
              referencia: referencia,
              chave_nfe: dadosCompletos.chave_nfe || dadosCompletos.chave || notaExistente.chave_nfe,
              status_focus: dadosCompletos.status || notaExistente.status_focus,
              status_sefaz: dadosCompletos.status_sefaz || notaExistente.status_sefaz,
              mensagem_sefaz: dadosCompletos.mensagem_sefaz || notaExistente.mensagem_sefaz,
              caminho_xml_nota_fiscal: dadosCompletos.caminho_xml_nota_fiscal || dadosCompletos.caminho_xml || notaExistente.caminho_xml_nota_fiscal,
              caminho_danfe: dadosCompletos.caminho_danfe || dadosCompletos.caminho_pdf || notaExistente.caminho_danfe,
              dados_completos: dadosCompletos,
              ambiente: ambienteNota
            });
            nfeAtualizadas++;
          } else {
            // Criar nova nota
            await salvarNFe({
              pedido_id: null,
              referencia: referencia,
              chave_nfe: dadosCompletos.chave_nfe || dadosCompletos.chave || null,
              status_focus: dadosCompletos.status || 'processando_autorizacao',
              status_sefaz: dadosCompletos.status_sefaz || null,
              mensagem_sefaz: dadosCompletos.mensagem_sefaz || null,
              caminho_xml_nota_fiscal: dadosCompletos.caminho_xml_nota_fiscal || dadosCompletos.caminho_xml || null,
              caminho_danfe: dadosCompletos.caminho_danfe || dadosCompletos.caminho_pdf || null,
              dados_completos: dadosCompletos,
              ambiente: ambienteNota
            });
            nfeCriadas++;
          }
        } catch (error) {
          logger.error('🔄 [SINCRONIZAR] Erro ao sincronizar NFe', {
            referencia: notaFocus.referencia || notaFocus.ref,
            ambiente: notaFocus.ambiente,
            error: error.message,
            stack: error.stack
          });
          nfeErros++;
        }
      }
    } else {
      logger.info('🔄 [SINCRONIZAR] Nenhuma NFe encontrada na Focus NFe para sincronizar');
    }
    
    const totalNFSe = todasNFSe.length;
    const totalNFe = todasNFe.length;
    const totalProcessadas = nfseCriadas + nfseAtualizadas + nfeCriadas + nfeAtualizadas;
    const totalErros = nfseErros + nfeErros;
    
    logger.info('✅ [SINCRONIZAR] Sincronização de notas concluída', {
      total_nfse: totalNFSe,
      total_nfe: totalNFe,
      nfse_criadas: nfseCriadas,
      nfse_atualizadas: nfseAtualizadas,
      nfse_erros: nfseErros,
      nfe_criadas: nfeCriadas,
      nfe_atualizadas: nfeAtualizadas,
      nfe_erros: nfeErros,
      total_processadas: totalProcessadas,
      total_erros: totalErros,
      ambientes_sincronizados: ambientesParaSincronizar
    });
    
    res.json({
      sucesso: true,
      mensagem: 'Sincronização concluída',
      resumo: {
        nfse: {
          total_encontradas: totalNFSe,
          criadas: nfseCriadas,
          atualizadas: nfseAtualizadas,
          erros: nfseErros
        },
        nfe: {
          total_encontradas: totalNFe,
          criadas: nfeCriadas,
          atualizadas: nfeAtualizadas,
          erros: nfeErros
        },
        total_processadas: totalProcessadas,
        total_erros: totalErros,
        ambientes_sincronizados: ambientesParaSincronizar
      }
    });
    
  } catch (error) {
    logger.error('Erro ao sincronizar notas', {
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
 * Sincroniza pedidos do WooCommerce para o banco local
 */
async function sincronizarPedidosWooCommerce(req, res) {
  try {
    logger.info('🔄 [SINCRONIZAR PEDIDOS] Iniciando sincronização de pedidos do WooCommerce');
    
    let todosPedidos = [];
    let page = 1;
    const perPage = 100;
    
    // Buscar todos os pedidos do WooCommerce (paginado)
    while (true) {
      const resultado = await woocommerce.listarPedidos({
        per_page: perPage,
        page: page,
        orderby: 'date',
        order: 'desc'
      });
      
      let pedidos = [];
      if (resultado.sucesso && Array.isArray(resultado.pedidos)) {
        pedidos = resultado.pedidos;
      } else if (Array.isArray(resultado)) {
        pedidos = resultado;
      } else {
        break;
      }
      
      if (!pedidos || pedidos.length === 0) {
        break;
      }
      
      todosPedidos = todosPedidos.concat(pedidos);
      
      if (pedidos.length < perPage) {
        break;
      }
      
      page++;
    }
    
    logger.info(`🔄 [SINCRONIZAR PEDIDOS] ${todosPedidos.length} pedidos encontrados no WooCommerce`);
    
    // Salvar/atualizar cada pedido no banco
    let salvos = 0;
    let atualizados = 0;
    let erros = 0;
    
    for (const pedido of todosPedidos) {
      try {
        const pedidoId = String(pedido.id || pedido.number);
        
        // Verificar se já existe
        const existente = await buscarPedidoPorPedidoId(pedidoId);
        
        if (existente) {
          // Atualizar
          await atualizarPedido(existente.id, {
            dados_pedido: pedido
          });
          atualizados++;
        } else {
          // Criar novo
          await salvarPedido({
            pedido_id: pedidoId,
            origem: 'woocommerce',
            dados_pedido: pedido,
            status: 'pendente'
          });
          salvos++;
        }
      } catch (err) {
        erros++;
        logger.warn('🔄 [SINCRONIZAR PEDIDOS] Erro ao salvar pedido', {
          pedido_id: pedido.id,
          erro: err.message
        });
      }
    }
    
    logger.info('✅ [SINCRONIZAR PEDIDOS] Sincronização concluída', {
      total: todosPedidos.length,
      salvos,
      atualizados,
      erros
    });
    
    res.json({
      sucesso: true,
      mensagem: 'Sincronização concluída',
      total: todosPedidos.length,
      salvos,
      atualizados,
      erros
    });
    
  } catch (error) {
    logger.error('Erro ao sincronizar pedidos do WooCommerce', {
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
 * Lista pedidos do banco local (com dados completos do WooCommerce)
 */
async function listarPedidosBanco(req, res) {
  try {
    const { limite = 1000, offset = 0 } = req.query;
    
    const resultado = await listarPedidos({
      limite: parseInt(limite),
      offset: parseInt(offset)
    });
    
    // Extrair dados_pedido para formato mais útil
    const pedidos = (resultado.dados || resultado || []).map(p => {
      // Se dados_pedido existe, usar ele; senão usar o próprio pedido
      const dadosPedido = p.dados_pedido || p;
      return {
        ...dadosPedido,
        _id_banco: p.id,
        _status_emissao: p.status,
        _tem_nfse: p.tem_nfse,
        _tem_nfe: p.tem_nfe
      };
    });
    
    res.json({
      sucesso: true,
      total: pedidos.length,
      dados: pedidos
    });
    
  } catch (error) {
    logger.error('Erro ao listar pedidos do banco', {
      error: error.message
    });
    
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

module.exports = {
  listar,
  buscarPorId,
  listarNFSe: listarNFSeRoute,
  listarTodasNotas,
  atualizarStatus,
  listarLogsPedidos,
  sincronizarNotas,
  sincronizarPedidosWooCommerce,
  listarPedidosBanco
};

