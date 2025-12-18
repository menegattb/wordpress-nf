const logger = require('../services/logger');
const focusNFeBackups = require('../services/focusNFeBackups');
const { listarNFe } = require('../config/database');
const archiver = require('archiver');
const axios = require('axios');
const xmlFormatter = require('xml-formatter');

/**
 * Lista backups de XMLs disponíveis
 */
async function listarBackups(req, res) {
  try {
    const { cnpj } = req.query;
    
    logger.info('🔄 [BACKUPS] Listando backups disponíveis', {
      cnpj: cnpj || 'usando configurado'
    });
    
    const resultado = await focusNFeBackups.buscarBackups(cnpj);
    
    if (resultado.sucesso) {
      // Formatar backups para facilitar uso no frontend
      const backupsFormatados = resultado.backups.map(backup => ({
        mes: backup.mes,
        mesFormatado: formatarMes(backup.mes),
        tipo: determinarTipoBackup(backup.mes),
        xmls: backup.xmls,
        danfes: backup.danfes
      }));
      
      logger.info('✅ [BACKUPS] Backups listados com sucesso', {
        total: backupsFormatados.length,
        backups: backupsFormatados
      });
      
      return res.json({
        sucesso: true,
        backups: backupsFormatados,
        total: backupsFormatados.length,
        mensagem: resultado.mensagem || (backupsFormatados.length === 0 ? 'Nenhum backup disponível ainda' : null)
      });
    } else {
      logger.error('❌ [BACKUPS] Erro ao listar backups', {
        erro: resultado.erro,
        status: resultado.status
      });
      
      return res.status(resultado.status || 500).json({
        sucesso: false,
        erro: resultado.erro || 'Erro ao buscar backups',
        mensagem: 'Não foi possível buscar os backups. Verifique as configurações da Focus NFe.'
      });
    }
    
  } catch (error) {
    logger.error('Erro ao listar backups', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Formata mês no formato AAAAMM para formato legível (ex: "Dezembro/2024")
 */
function formatarMes(mes) {
  if (!mes || mes.length !== 6) {
    return mes;
  }
  
  const ano = mes.substring(0, 4);
  const mesNum = parseInt(mes.substring(4, 6), 10);
  
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  return `${meses[mesNum - 1]}/${ano}`;
}

/**
 * Determina se o backup é mensal ou semanal
 * Backups semanais geralmente têm formato diferente ou são identificados de outra forma
 * Por enquanto, assumimos que todos são mensais (gerados no dia 1)
 */
function determinarTipoBackup(mes) {
  // Por enquanto, todos são mensais
  // Se necessário, podemos adicionar lógica para identificar backups semanais
  return 'Mensal';
}

/**
 * Formata XML para melhor legibilidade
 */
function formatarXml(xmlString) {
  try {
    if (!xmlString || typeof xmlString !== 'string') {
      return xmlString;
    }
    
    // Usar xml-formatter para formatar o XML
    const formatted = xmlFormatter(xmlString, {
      indentation: '  ',
      filter: (node) => node.type !== 'Comment',
      collapseContent: true,
      lineSeparator: '\n'
    });
    
    return formatted;
  } catch (error) {
    logger.warn('Erro ao formatar XML, retornando original', {
      erro: error.message
    });
    // Se falhar, retornar original
    return xmlString;
  }
}

/**
 * Lista notas NFe autorizadas para download de XMLs
 * Busca dos últimos 2 meses (mês atual e mês anterior)
 */
async function listarNotasNFeParaDownload(req, res) {
  try {
    const { mes, ano } = req.query;
    const dataAtual = new Date();
    
    // Se não especificar mês/ano, buscar dos últimos 2 meses
    let dataInicio, dataFim, mesesBusca;
    
    if (mes && ano) {
      // Buscar apenas do mês especificado
      dataInicio = `${ano}-${mes.padStart(2, '0')}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      dataFim = `${ano}-${mes.padStart(2, '0')}-${ultimoDia}`;
      mesesBusca = [`${mes.padStart(2, '0')}/${ano}`];
    } else {
      // Buscar dos últimos 2 meses (mês atual e anterior)
      const mesAtual = dataAtual.getMonth() + 1;
      const anoAtual = dataAtual.getFullYear();
      
      // Mês anterior
      const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
      const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;
      
      // Data início: primeiro dia do mês anterior
      dataInicio = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
      
      // Data fim: último dia do mês atual
      const ultimoDiaAtual = new Date(anoAtual, mesAtual, 0).getDate();
      dataFim = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${ultimoDiaAtual}`;
      
      mesesBusca = [
        `${String(mesAnterior).padStart(2, '0')}/${anoAnterior}`,
        `${String(mesAtual).padStart(2, '0')}/${anoAtual}`
      ];
    }
    
    logger.info('🔄 [BACKUPS] Listando notas NFe para download', {
      meses: mesesBusca,
      data_inicio: dataInicio,
      data_fim: dataFim
    });
    
    const resultado = await listarNFe({
      status_focus: 'autorizado',
      data_inicio: dataInicio,
      data_fim: dataFim,
      limite: 1000,
      offset: 0
    });
    
    const notas = resultado.dados || [];
    
    // Filtrar apenas notas com XML disponível
    const notasComXml = notas.filter(nota => {
      const caminhoXml = nota.caminho_xml_nota_fiscal || 
                        (nota.dados_completos && typeof nota.dados_completos === 'object' 
                          ? nota.dados_completos.caminho_xml_nota_fiscal 
                          : null);
      return caminhoXml && nota.status_focus === 'autorizado';
    });
    
    logger.info('✅ [BACKUPS] Notas NFe listadas para download', {
      total_encontradas: notas.length,
      total_com_xml: notasComXml.length
    });
    
    return res.json({
      sucesso: true,
      notas: notasComXml.map(nota => {
        const dadosCompletos = typeof nota.dados_completos === 'string' 
          ? JSON.parse(nota.dados_completos) 
          : (nota.dados_completos || {});
        
        return {
          referencia: nota.referencia,
          chave_nfe: nota.chave_nfe,
          caminho_xml: nota.caminho_xml_nota_fiscal || dadosCompletos.caminho_xml_nota_fiscal,
          ambiente: nota.ambiente || 'homologacao',
          created_at: nota.created_at
        };
      }),
      total: notasComXml.length,
      meses: mesesBusca,
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      }
    });
  } catch (error) {
    logger.error('Erro ao listar notas NFe para download', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

/**
 * Baixa todos os XMLs das notas NFe autorizadas em um ZIP
 * Busca dos últimos 2 meses (mês atual e mês anterior)
 */
async function baixarTodosXmls(req, res) {
  try {
    const { mes, ano } = req.query;
    const dataAtual = new Date();
    
    // Se não especificar mês/ano, buscar dos últimos 2 meses
    let dataInicio, dataFim, nomeArquivo;
    
    if (mes && ano) {
      // Buscar apenas do mês especificado
      const mesFormatado = mes.padStart(2, '0');
      dataInicio = `${ano}-${mesFormatado}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      dataFim = `${ano}-${mesFormatado}-${ultimoDia}`;
      nomeArquivo = `xmls_nfe_${mesFormatado}_${ano}.zip`;
    } else {
      // Buscar dos últimos 2 meses (mês atual e anterior)
      const mesAtual = dataAtual.getMonth() + 1;
      const anoAtual = dataAtual.getFullYear();
      
      // Mês anterior
      const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
      const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;
      
      // Data início: primeiro dia do mês anterior
      dataInicio = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
      
      // Data fim: último dia do mês atual
      const ultimoDiaAtual = new Date(anoAtual, mesAtual, 0).getDate();
      dataFim = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${ultimoDiaAtual}`;
      
      nomeArquivo = `xmls_nfe_${String(mesAnterior).padStart(2, '0')}_${anoAnterior}_a_${String(mesAtual).padStart(2, '0')}_${anoAtual}.zip`;
    }
    
    logger.info('🔄 [BACKUPS] Gerando ZIP com todos os XMLs', {
      data_inicio: dataInicio,
      data_fim: dataFim
    });
    
    const resultado = await listarNFe({
      status_focus: 'autorizado',
      data_inicio: dataInicio,
      data_fim: dataFim,
      limite: 1000,
      offset: 0
    });
    
    const notas = resultado.dados || [];
    const notasComXml = notas.filter(nota => {
      const caminhoXml = nota.caminho_xml_nota_fiscal || 
                        (nota.dados_completos && typeof nota.dados_completos === 'object' 
                          ? nota.dados_completos.caminho_xml_nota_fiscal 
                          : null);
      return caminhoXml && nota.status_focus === 'autorizado';
    });
    
    if (notasComXml.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Nenhuma nota com XML disponível encontrada'
      });
    }
    
    // Obter configuração da API
    const apiConfig = focusNFeBackups.getApiConfig();
    const baseUrl = apiConfig.baseUrl.replace('/v2', '');
    
    // Criar ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    
    // Baixar cada XML e adicionar ao ZIP
    let sucesso = 0;
    let erros = 0;
    
    for (const nota of notasComXml) {
      try {
        const dadosCompletos = typeof nota.dados_completos === 'string' 
          ? JSON.parse(nota.dados_completos) 
          : (nota.dados_completos || {});
        
        const caminhoXml = nota.caminho_xml_nota_fiscal || dadosCompletos.caminho_xml_nota_fiscal;
        const urlXml = caminhoXml.startsWith('http') 
          ? caminhoXml 
          : `${baseUrl}${caminhoXml}`;
        
        // Baixar XML da Focus NFe como texto para poder formatar
        const response = await axios.get(urlXml, {
          auth: {
            username: apiConfig.token,
            password: ''
          },
          responseType: 'text',
          timeout: 30000
        });
        
        // Formatar XML antes de adicionar ao ZIP
        const xmlFormatado = formatarXml(response.data);
        const nomeArquivo = `${nota.chave_nfe || nota.referencia}.xml`;
        archive.append(xmlFormatado, { name: nomeArquivo });
        sucesso++;
      } catch (error) {
        logger.warn('Erro ao baixar XML individual', {
          referencia: nota.referencia,
          erro: error.message
        });
        erros++;
      }
    }
    
    await archive.finalize();
    
    logger.info('✅ [BACKUPS] ZIP de XMLs gerado', {
      total: notasComXml.length,
      sucesso,
      erros
    });
    
  } catch (error) {
    logger.error('Erro ao gerar ZIP de XMLs', {
      error: error.message,
      stack: error.stack
    });
    
    if (!res.headersSent) {
      return res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
}

module.exports = {
  listarBackups,
  listarNotasNFeParaDownload,
  baixarTodosXmls
};

