const logger = require('../services/logger');
const { validarCPFCNPJ, limparDocumento, validarCEP } = require('../services/validator');
const { buscarCodigoMunicipioPorCEP, buscarCodigoMunicipioPorCidadeEstado } = require('../services/cepService');

/**
 * Mapeia dados do WooCommerce para formato interno
 */
function mapearWooCommerceParaPedido(pedidoWC) {
  logger.mapping('Iniciando mapeamento WooCommerce → Pedido interno', {
    pedido_id: pedidoWC.id || pedidoWC.number
  });
  
  const billing = pedidoWC.billing || {};
  const shipping = pedidoWC.shipping || {};
  const metaData = pedidoWC.meta_data || [];
  
  // Extrair CPF/CNPJ dos meta_data
  let cpfCnpj = null;
  const cpfField = metaData.find(m => 
    m.key && (
      m.key.toLowerCase().includes('cpf') || 
      m.key.toLowerCase().includes('cnpj') ||
      m.key.toLowerCase() === '_billing_cpf' ||
      m.key.toLowerCase() === '_billing_cnpj'
    )
  );
  
  if (cpfField) {
    cpfCnpj = cpfField.value;
  } else if (billing.cpf) {
    cpfCnpj = billing.cpf;
  } else if (billing.cnpj) {
    cpfCnpj = billing.cnpj;
  }
  
  // Mapear produtos como serviços
  const servicos = (pedidoWC.line_items || []).map((item, index) => {
    // Extrair categorias do item
    let categorias = [];
    if (item.categories && Array.isArray(item.categories)) {
      categorias = item.categories.map(cat => cat.name || cat).filter(Boolean);
    } else if (item.category && typeof item.category === 'string') {
      categorias = [item.category];
    } else if (item.meta_data) {
      // Tentar buscar categoria dos meta_data
      const categoriaMeta = item.meta_data.find(m => 
        m.key && (m.key.toLowerCase().includes('categoria') || m.key.toLowerCase().includes('category'))
      );
      if (categoriaMeta && categoriaMeta.value) {
        categorias = Array.isArray(categoriaMeta.value) ? categoriaMeta.value : [categoriaMeta.value];
      }
    }
    
    return {
      numero_item: index + 1,
      codigo: item.sku || item.id?.toString() || `ITEM-${index + 1}`,
      nome: item.name,
      quantidade: parseFloat(item.quantity || 1),
      valor_unitario: parseFloat(item.price || 0),
      total: parseFloat(item.total || 0),
      subtotal: parseFloat(item.subtotal || 0),
      // Categorias
      categorias: categorias,
      // Campos específicos para NFSe
      codigo_tributacao_municipio: item.meta_data?.find(m => m.key === 'codigo_tributacao')?.value || null,
      item_lista_servico: item.meta_data?.find(m => m.key === 'item_lista_servico')?.value || null,
      discriminacao: item.meta_data?.find(m => m.key === 'discriminacao')?.value || item.name,
      // Preservar meta_data para uso em NFe (NCM, CFOP, etc)
      meta_data: item.meta_data || []
    };
  });
  
  // Nota: WooCommerce pode armazenar bairro em diferentes campos dependendo da configuração
  // Tentar buscar em ordem: campos customizados, address_2, ou usar city como fallback
  const bairroWC = billing.city || shipping.city || billing.address_2 || shipping.address_2 || '';
  
  const pedido = {
    pedido_id: pedidoWC.id?.toString() || pedidoWC.number?.toString() || `WC-${Date.now()}`,
    data_pedido: pedidoWC.date_created || new Date().toISOString(),
    data_emissao: pedidoWC.date_created || new Date().toISOString().split('T')[0],
    
    // Cliente/Tomador
    nome: billing.first_name && billing.last_name 
      ? `${billing.first_name} ${billing.last_name}`.trim()
      : billing.company || 'CONSUMIDOR FINAL',
    razao_social: billing.company || (billing.first_name && billing.last_name 
      ? `${billing.first_name} ${billing.last_name}`.trim()
      : 'CONSUMIDOR FINAL'),
    cpf_cnpj: cpfCnpj || '',
    email: billing.email || '',
    telefone: (billing.phone || '').replace(/\D/g, ''),
    
    // Endereço
    endereco: {
      rua: billing.address_1 || shipping.address_1 || '',
      numero: billing.address_2 || shipping.address_2 || billing.number || shipping.number || 'S/N',
      complemento: billing.address_2 || shipping.address_2 || '',
      bairro: bairroWC, // Será corrigido pela API do CEP se disponível
      cidade: billing.city || shipping.city || '',
      estado: billing.state || shipping.state || '',
      cep: (billing.postcode || shipping.postcode || '').replace(/\D/g, ''),
      pais: billing.country || shipping.country || 'Brasil'
    },
    
    // Serviços
    servicos: servicos,
    
    // Valores
    valor_total: parseFloat(pedidoWC.total || 0),
    valor_servicos: parseFloat(pedidoWC.total || 0),
    frete: parseFloat(pedidoWC.shipping_total || 0),
    desconto_total: parseFloat(pedidoWC.discount_total || 0),
    
    // Outros
    forma_pagamento: pedidoWC.payment_method || 'pix',
    observacoes: pedidoWC.customer_note || pedidoWC.note || '',
    status_wc: pedidoWC.status || 'pending'
  };
  
  logger.mapping('Mapeamento WooCommerce concluído', {
    pedido_id: pedido.pedido_id,
    cliente: pedido.nome,
    total: pedido.valor_total,
    servicos_count: servicos.length
  });
  
  return pedido;
}

/**
 * Mapeia dados do pedido interno para formato Focus NFSe
 * Baseado no código Google Apps Script que está funcionando
 */
async function mapearPedidoParaNFSe(dadosPedido, configEmitente, configFiscal, tipoNF = 'servico') {
  logger.mapping('Iniciando mapeamento Pedido → Focus NFSe', {
    pedido_id: dadosPedido.pedido_id
  });
  
  // Validar documento do tomador
  const documento = validarCPFCNPJ(dadosPedido.cpf_cnpj);
  if (!documento.valido) {
    throw new Error(`Documento do tomador inválido: ${documento.erro}`);
  }
  
  // Gera data no formato YYYY-MM-DD (apenas data, sem hora)
  // Formato correto conforme documentação Focus NFe NFSe
  let dataEmissao;
  if (dadosPedido.data_emissao) {
    // Se já tiver data_emissao, usar ela (formato YYYY-MM-DD)
    const dataFornecida = new Date(dadosPedido.data_emissao);
    if (!isNaN(dataFornecida.getTime())) {
      const ano = dataFornecida.getFullYear();
      const mes = String(dataFornecida.getMonth() + 1).padStart(2, '0');
      const dia = String(dataFornecida.getDate()).padStart(2, '0');
      dataEmissao = `${ano}-${mes}-${dia}`;
    } else {
      // Se a data_emissao já estiver no formato YYYY-MM-DD, usar diretamente
      dataEmissao = dadosPedido.data_emissao.split('T')[0];
    }
  } else {
    // Se não tiver, usar data atual
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    dataEmissao = `${ano}-${mes}-${dia}`;
  }
  
  // Calcular valor total dos serviços
  const valorServicos = dadosPedido.valor_servicos || 
    (dadosPedido.servicos || []).reduce((sum, s) => sum + parseFloat(s.total || s.valor_total || 0), 0) ||
    parseFloat(dadosPedido.valor_total || 0);
  
  // Mapear tomador com estrutura correta
  // Extrair e limpar CEP - garantir que sempre tenha 8 dígitos
  let cepTomador = limparDocumento(dadosPedido.endereco?.cep || '');
  if (!cepTomador || cepTomador === '') {
    throw new Error('CEP do tomador é obrigatório. Informe o CEP no endereço do pedido.');
  }
  // Garantir 8 dígitos
  cepTomador = cepTomador.replace(/\D/g, '').padStart(8, '0').substring(0, 8);
  
  // Buscar código IBGE do município do tomador via API
  logger.mapping('Buscando código IBGE do município do tomador', {
    pedido_id: dadosPedido.pedido_id,
    cep: cepTomador,
    cidade: dadosPedido.endereco?.cidade,
    estado: dadosPedido.endereco?.estado
  });
  
  let dadosMunicipio;
  try {
    // Tentar buscar por CEP primeiro
    dadosMunicipio = await buscarCodigoMunicipioPorCEP(cepTomador);
  } catch (cepError) {
    // Se falhar por CEP, tentar buscar por cidade/estado
    const cidade = dadosPedido.endereco?.cidade;
    const estado = dadosPedido.endereco?.estado;
    
    if (cidade && estado) {
      logger.mapping('Falha ao buscar por CEP, tentando por cidade/estado', {
        pedido_id: dadosPedido.pedido_id,
        cep_error: cepError.message,
        cidade,
        estado
      });
      
      try {
        dadosMunicipio = await buscarCodigoMunicipioPorCidadeEstado(cidade, estado);
      } catch (cidadeError) {
        throw new Error(
          `Não foi possível obter o código IBGE do município do tomador. ` +
          `CEP: ${cepTomador}, Cidade: ${cidade || 'não informada'}, Estado: ${estado || 'não informado'}. ` +
          `Erros: CEP - ${cepError.message}; Cidade/Estado - ${cidadeError.message}. ` +
          `Por favor, verifique os dados do endereço do pedido ou informe o código IBGE manualmente.`
        );
      }
    } else {
      throw new Error(
        `Não foi possível obter o código IBGE do município do tomador pelo CEP ${cepTomador}. ` +
        `Erro: ${cepError.message}. ` +
        `É necessário informar cidade e estado no endereço do pedido para tentar busca alternativa, ` +
        `ou informar o código IBGE manualmente.`
      );
    }
  }
  
  const codigoMunicipioTomador = dadosMunicipio.codigoIBGE;
  const ufCorreta = dadosMunicipio.uf;
  const cidadeCorreta = dadosMunicipio.cidade;
  const bairroDaAPI = dadosMunicipio.bairro || '';
  
  // Validar e corrigir UF se necessário
  const ufInformada = dadosPedido.endereco?.estado;
  if (ufInformada && ufInformada.toUpperCase() !== ufCorreta.toUpperCase()) {
    logger.warn('UF informada no pedido difere da UF retornada pela API do CEP. Usando UF da API.', {
      service: 'mapeador',
      action: 'mapeamento',
      pedido_id: dadosPedido.pedido_id,
      uf_informada: ufInformada,
      uf_correta: ufCorreta,
      cep: cepTomador
    });
  }
  
  // Usar bairro da API se disponível, senão usar do pedido
  const bairroInformado = dadosPedido.endereco?.bairro || '';
  const bairroCorreto = bairroDaAPI || bairroInformado;
  
  if (bairroDaAPI && bairroInformado && bairroDaAPI.toLowerCase() !== bairroInformado.toLowerCase()) {
    logger.warn('Bairro informado no pedido difere do bairro retornado pela API do CEP. Usando bairro da API.', {
      service: 'mapeador',
      action: 'mapeamento',
      pedido_id: dadosPedido.pedido_id,
      bairro_informado: bairroInformado,
      bairro_api: bairroDaAPI,
      cep: cepTomador
    });
  }
  
  // Validar que o código do município do tomador não é o mesmo do prestador
  if (codigoMunicipioTomador === configEmitente.codigo_municipio) {
    logger.warn('Código do município do tomador é o mesmo do prestador', {
      service: 'mapeador',
      action: 'mapeamento',
      pedido_id: dadosPedido.pedido_id,
      codigo_municipio: codigoMunicipioTomador
    });
  }
  
  const tomador = {
    cpf: documento.tipo === 'CPF' ? documento.documento : undefined,
    cnpj: documento.tipo === 'CNPJ' ? documento.documento : undefined,
    razao_social: dadosPedido.razao_social || dadosPedido.nome || 'Cliente',
    email: dadosPedido.email || undefined,
    endereco: {
      logradouro: dadosPedido.endereco?.rua || '',
      numero: dadosPedido.endereco?.numero || '',
      bairro: bairroCorreto, // Usar bairro da API quando disponível (mais confiável)
      uf: ufCorreta, // Usar UF retornada pela API (corrige inconsistências)
      codigo_municipio: codigoMunicipioTomador, // Código obtido via API
      cep: cepTomador // CEP sempre presente com 8 dígitos
    }
  };
  
  // Remover campos undefined do tomador (mas não do endereco)
  Object.keys(tomador).forEach(key => {
    if (tomador[key] === undefined && key !== 'endereco') {
      delete tomador[key];
    }
  });
  
  // Limpar campos vazios do endereco (exceto CEP e codigo_municipio que são obrigatórios)
  Object.keys(tomador.endereco).forEach(key => {
    if (key !== 'cep' && key !== 'codigo_municipio') {
      if (tomador.endereco[key] === undefined || tomador.endereco[key] === '') {
        delete tomador.endereco[key];
      }
    }
  });
  
  // Garantir que CEP e codigo_municipio sempre estejam presentes
  if (!tomador.endereco.cep || tomador.endereco.cep === '') {
    throw new Error('CEP do tomador é obrigatório e não pode estar vazio.');
  }
  if (!tomador.endereco.codigo_municipio) {
    throw new Error('Código IBGE do município do tomador é obrigatório e não foi obtido.');
  }
  
  // Discriminação dos serviços (juntar todos os produtos em uma string)
  const discriminacao = (dadosPedido.servicos || [])
    .map(item => item.discriminacao || item.nome || 'Serviço não especificado')
    .join('; ') || 'Serviço não especificado';
  
  // Estrutura NFSe conforme código que está funcionando
  const nfse = {
    data_emissao: dataEmissao,
    natureza_operacao: dadosPedido.natureza_operacao || "1",
    optante_simples_nacional: configEmitente.optante_simples_nacional !== false,
    
    // Prestador
    // Nota: inscricao_municipal não deve ser enviada se não houver informações complementares
    // registradas no CNC NFS-e (conforme erro E0120 da SEFAZ)
    prestador: {
      cnpj: configEmitente.cnpj,
      codigo_municipio: configEmitente.codigo_municipio
      // inscricao_municipal removido - não deve ser enviado se não houver informações complementares
    },
    
    // Tomador
    tomador: tomador,
    
    // Serviço (singular, conforme código funcionando)
    servico: {
      valor_servicos: parseFloat(valorServicos.toFixed(2)),
      discriminacao: discriminacao,
      item_lista_servico: configFiscal?.item_lista_servico || '70101', // Removido zero à esquerda (5 caracteres)
      codigo_tributario_municipio: configFiscal?.codigo_tributario_municipio || '101',
      codigo_municipio: configEmitente.codigo_municipio,
      aliquota: configFiscal?.aliquota || 3,
      iss_retido: false
    }
  };
  
  logger.mapping('Mapeamento para Focus NFSe concluído', {
    pedido_id: dadosPedido.pedido_id,
    tomador: tomador.razao_social,
    valor_servicos: valorServicos
  });
  
  return nfse;
}

/**
 * Mapeia dados do pedido interno para formato Focus NFe (Produto)
 * Conforme documentação Focus NFe API v2
 */
async function mapearPedidoParaNFe(dadosPedido, configEmitente, configFiscal) {
  logger.mapping('Iniciando mapeamento Pedido → Focus NFe', {
    pedido_id: dadosPedido.pedido_id
  });
  
  // Validar documento do destinatário
  const documento = validarCPFCNPJ(dadosPedido.cpf_cnpj);
  if (!documento.valido) {
    throw new Error(`Documento do destinatário inválido: ${documento.erro}`);
  }
  
  // Gerar data no formato ISO
  let dataEmissao;
  // Sempre usar data/hora atual para evitar erro "Data anterior ao permitido"
  // A SEFAZ não permite emitir notas com data no passado
  const agora = new Date();
  const offset = -agora.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}${String(offsetMinutes).padStart(2, '0')}`;
  
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  const hora = String(agora.getHours()).padStart(2, '0');
  const minuto = String(agora.getMinutes()).padStart(2, '0');
  
  dataEmissao = `${ano}-${mes}-${dia}T${hora}:${minuto}${offsetStr}`;
  
  // Log se a data do pedido for diferente da data atual (para rastreamento)
  if (dadosPedido.data_emissao) {
    const dataPedido = new Date(dadosPedido.data_emissao);
    if (!isNaN(dataPedido.getTime()) && dataPedido < agora) {
      logger.warn('Data do pedido está no passado, usando data atual para evitar rejeição da SEFAZ', {
        service: 'mapeador',
        action: 'mapearPedidoParaNFe',
        pedido_id: dadosPedido.pedido_id,
        data_pedido: dadosPedido.data_emissao,
        data_usada: dataEmissao
      });
    }
  }
  
  // Validar e preparar CEP do destinatário
  // NÃO buscar código IBGE aqui - enviar primeiro com dados fornecidos
  // Se Focus NFe rejeitar, o retry em focusNFe.js buscará o código IBGE
  let cepDestinatario = limparDocumento(dadosPedido.endereco?.cep || '');
  if (!cepDestinatario || cepDestinatario === '') {
    throw new Error('CEP do destinatário é obrigatório. Informe o CEP no endereço do pedido.');
  }
  cepDestinatario = cepDestinatario.replace(/\D/g, '').padStart(8, '0').substring(0, 8);
  
  const cidadeDestinatario = dadosPedido.endereco?.cidade || '';
  const estadoDestinatario = dadosPedido.endereco?.estado || '';
  
  // Usar dados fornecidos diretamente - não buscar código IBGE aqui
  // O Focus NFe validará e, se rejeitar por código IBGE, o retry buscará
  const dadosMunicipioDestinatario = {
    codigoIBGE: null, // Não buscamos aqui - será buscado no retry se necessário
    cidade: cidadeDestinatario,
    uf: estadoDestinatario,
    bairro: dadosPedido.endereco?.bairro || ''
  };
  
  logger.debug('Usando dados fornecidos do destinatário (sem busca prévia de código IBGE)', {
    service: 'mapeador',
    action: 'mapearPedidoParaNFe',
    pedido_id: dadosPedido.pedido_id,
    cep: cepDestinatario,
    cidade: cidadeDestinatario,
    estado: estadoDestinatario
  });
  
  // Usar dados do emitente configurados diretamente - não buscar via API para evitar timeout
  let cepEmitente = limparDocumento(configEmitente.cep || '');
  if (cepEmitente && cepEmitente !== '') {
    cepEmitente = cepEmitente.replace(/\D/g, '').padStart(8, '0').substring(0, 8);
  }
  
  // Usar dados configurados do emitente diretamente
  const dadosMunicipioEmitente = {
    codigoIBGE: configEmitente.codigo_municipio,
    uf: configEmitente.uf || 'PE',
    cidade: configEmitente.municipio || 'Ipojuca'
  };
  
  logger.debug('Usando dados configurados do emitente (sem busca via API)', {
    service: 'mapeador',
    action: 'mapearPedidoParaNFe',
    codigo_municipio: dadosMunicipioEmitente.codigoIBGE,
    cidade: dadosMunicipioEmitente.cidade,
    uf: dadosMunicipioEmitente.uf
  });
  
  // Mapear produtos para items da NFe
  const items = (dadosPedido.servicos || []).map((produto, index) => {
    // Extrair NCM dos meta_data do produto
    const ncm = produto.meta_data?.find(m => 
      m.key && (m.key.toLowerCase() === 'ncm' || m.key.toLowerCase() === 'codigo_ncm')
    )?.value || configFiscal?.ncm_padrao || '49019900';
    
    // Extrair CFOP dos meta_data
    const cfop = produto.meta_data?.find(m => 
      m.key && m.key.toLowerCase() === 'cfop'
    )?.value || configFiscal?.cfop_padrao || '5102';
    
    const quantidade = parseFloat(produto.quantidade || 1);
    const valorUnitario = parseFloat(produto.valor_unitario || produto.total || 0);
    const valorBruto = parseFloat(produto.total || valorUnitario * quantidade);
    
    return {
      numero_item: index + 1,
      codigo_produto: produto.codigo || produto.sku || `PROD-${index + 1}`,
      descricao: produto.nome || produto.descricacao || 'Produto',
      cfop: parseInt(cfop),
      unidade_comercial: 'UN', // Padrão
      quantidade_comercial: quantidade,
      valor_unitario_comercial: valorUnitario,
      valor_unitario_tributavel: valorUnitario,
      unidade_tributavel: 'UN', // Padrão
      codigo_ncm: parseInt(ncm.replace(/\D/g, '').substring(0, 8)),
      quantidade_tributavel: quantidade,
      valor_bruto: valorBruto,
      icms_origem: parseInt(configFiscal?.icms_origem || '0'),
      icms_situacao_tributaria: parseInt(configFiscal?.icms_situacao_tributaria || '400'),
      pis_situacao_tributaria: configFiscal?.pis_situacao_tributaria || '07',
      cofins_situacao_tributaria: configFiscal?.cofins_situacao_tributaria || '07',
      inclui_no_total: 1
    };
  });
  
  if (items.length === 0) {
    throw new Error('A NFe deve ter pelo menos um item');
  }
  
  // Calcular totais
  const valorProdutos = items.reduce((sum, item) => sum + parseFloat(item.valor_bruto || 0), 0);
  const valorFrete = parseFloat(dadosPedido.frete || 0);
  const valorTotal = valorProdutos + valorFrete;
  
  // Determinar indicador de inscrição estadual do destinatário
  let indicadorInscricaoEstadual = 9; // Não contribuinte
  if (documento.tipo === 'CNPJ') {
    indicadorInscricaoEstadual = 1; // Contribuinte ICMS
  }
  
  // Determinar se é consumidor final
  // Se não contribuinte (indicador = 9), deve ser consumidor final (1)
  // Se contribuinte (indicador = 1), pode ser normal (0) ou consumidor final (1)
  // Por padrão, se não contribuinte, é consumidor final
  const consumidorFinal = indicadorInscricaoEstadual === 9 ? 1 : (dadosPedido.consumidor_final !== undefined ? dadosPedido.consumidor_final : 0);
  
  // Tratar inscrição estadual do emitente
  // Só enviar se estiver configurada (não enviar "ISENTO" automaticamente)
  // Se estiver vazia, não enviar o campo (será removido na limpeza)
  let inscricaoEstadualEmitente = configEmitente.inscricao_estadual || '';
  if (inscricaoEstadualEmitente && inscricaoEstadualEmitente.trim() !== '') {
    inscricaoEstadualEmitente = inscricaoEstadualEmitente.trim();
  } else {
    // Se estiver vazia, deixar undefined para não enviar o campo
    inscricaoEstadualEmitente = undefined;
  }
  
  // Estrutura NFe conforme documentação
  const nfe = {
    natureza_operacao: dadosPedido.natureza_operacao || 'Remessa',
    data_emissao: dataEmissao,
    data_entrada_saida: dataEmissao,
    tipo_documento: 1, // 1 = Saída
    local_destino: 1, // 1 = Operação interna (pode ser ajustado conforme necessário)
    finalidade_emissao: 1, // 1 = Normal
    consumidor_final: consumidorFinal, // 0 = Normal, 1 = Consumidor final (1 se não contribuinte)
    presenca_comprador: 2, // 2 = Operação não presencial, pela Internet
    
    // Emitente
    cnpj_emitente: configEmitente.cnpj,
    nome_emitente: configEmitente.razao_social,
    nome_fantasia_emitente: configEmitente.nome_fantasia || configEmitente.razao_social,
    municipio_emitente: dadosMunicipioEmitente.cidade || configEmitente.municipio || 'Ipojuca',
    uf_emitente: dadosMunicipioEmitente.uf || configEmitente.uf || 'PE',
    regime_tributario_emitente: parseInt(configFiscal?.regime_tributario || '1'),
    
    // Destinatário
    nome_destinatario: dadosPedido.razao_social || dadosPedido.nome || 'CONSUMIDOR FINAL',
    cpf_destinatario: documento.tipo === 'CPF' ? documento.documento : undefined,
    cnpj_destinatario: documento.tipo === 'CNPJ' ? documento.documento : undefined,
    inscricao_estadual_destinatario: dadosPedido.inscricao_estadual || undefined,
    indicador_inscricao_estadual_destinatario: indicadorInscricaoEstadual,
    telefone_destinatario: dadosPedido.telefone ? parseInt(dadosPedido.telefone.replace(/\D/g, '')) : undefined,
    logradouro_destinatario: dadosPedido.endereco?.rua || undefined,
    numero_destinatario: dadosPedido.endereco?.numero || 'S/N',
    bairro_destinatario: dadosMunicipioDestinatario.bairro || dadosPedido.endereco?.bairro || undefined,
    municipio_destinatario: dadosMunicipioDestinatario.cidade || dadosPedido.endereco?.cidade || '',
    uf_destinatario: dadosMunicipioDestinatario.uf || dadosPedido.endereco?.estado || '',
    pais_destinatario: dadosPedido.endereco?.pais || 'Brasil',
    cep_destinatario: cepDestinatario, // Manter como string para preservar zeros à esquerda
    
    // Itens
    items: items,
    
    // Totais
    valor_frete: valorFrete,
    valor_seguro: 0,
    valor_total: parseFloat(valorTotal.toFixed(2)),
    valor_produtos: parseFloat(valorProdutos.toFixed(2)),
    modalidade_frete: 0 // 0 = Por conta do emitente
  };
  
  // Adicionar campos do emitente apenas se não estiverem vazios
  if (configEmitente.logradouro && configEmitente.logradouro.trim() !== '') {
    nfe.logradouro_emitente = configEmitente.logradouro;
  }
  if (configEmitente.numero && configEmitente.numero.trim() !== '') {
    nfe.numero_emitente = configEmitente.numero;
  }
  if (configEmitente.bairro && configEmitente.bairro.trim() !== '') {
    nfe.bairro_emitente = configEmitente.bairro;
  }
  // CEP do emitente - só adicionar se não for "00000000"
  if (cepEmitente && cepEmitente !== '00000000') {
    nfe.cep_emitente = cepEmitente;
  }
  // Inscrição estadual do emitente - só adicionar se estiver configurada
  if (inscricaoEstadualEmitente !== undefined) {
    nfe.inscricao_estadual_emitente = inscricaoEstadualEmitente;
  }
  
  // Remover campos undefined e strings vazias
  Object.keys(nfe).forEach(key => {
    if (nfe[key] === undefined || nfe[key] === '') {
      delete nfe[key];
    }
  });
  
  logger.mapping('Mapeamento para Focus NFe concluído', {
    pedido_id: dadosPedido.pedido_id,
    destinatario: nfe.nome_destinatario,
    valor_total: nfe.valor_total,
    items_count: items.length,
    consumidor_final: nfe.consumidor_final,
    indicador_inscricao_estadual: nfe.indicador_inscricao_estadual_destinatario
  });
  
  return nfe;
}

module.exports = {
  mapearWooCommerceParaPedido,
  mapearPedidoParaNFSe,
  mapearPedidoParaNFe
};

