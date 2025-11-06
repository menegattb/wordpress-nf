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
  const servicos = (pedidoWC.line_items || []).map((item, index) => ({
    numero_item: index + 1,
    codigo: item.sku || item.id?.toString() || `ITEM-${index + 1}`,
    nome: item.name,
    quantidade: parseFloat(item.quantity || 1),
    valor_unitario: parseFloat(item.price || 0),
    total: parseFloat(item.total || 0),
    subtotal: parseFloat(item.subtotal || 0),
    // Campos específicos para NFSe
    codigo_tributacao_municipio: item.meta_data?.find(m => m.key === 'codigo_tributacao')?.value || null,
    item_lista_servico: item.meta_data?.find(m => m.key === 'item_lista_servico')?.value || null,
    discriminacao: item.meta_data?.find(m => m.key === 'discriminacao')?.value || item.name
  }));
  
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

module.exports = {
  mapearWooCommerceParaPedido,
  mapearPedidoParaNFSe
};

