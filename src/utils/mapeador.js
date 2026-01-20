const logger = require('../services/logger');
const { validarCPFCNPJ, limparDocumento, validarCEP } = require('../services/validator');
const { buscarCodigoMunicipioPorCEP, buscarCodigoMunicipioPorCidadeEstado } = require('../services/cepService');

/**
 * Sanitiza o payload NFSe removendo todos os campos proibidos
 * Garante que apenas campos permitidos sejam enviados no objeto servico
 */
function sanitizarPayloadNFSe(nfse) {
  // Lista completa de campos proibidos relacionados a cálculos
  const camposProibidos = [
    // 'base_calculo', // Permitido para Ipojuca
    // 'valor_iss',    // Permitido para Ipojuca
    'base_calculo_iss',
    'valor_deducao',
    'deducao',
    'reducao',
    'desconto_iss',
    'valor_iss_retido',
    'base_calculo_iss_retido',
    'valor_iss_retido_total',
    'base_calculo_iss_retido_total'
  ];

  // Criar novo objeto servico apenas com campos permitidos explicitamente
  const servicoLimpo = {
    valor_servicos: nfse.servico.valor_servicos,
    discriminacao: nfse.servico.discriminacao,
    item_lista_servico: nfse.servico.item_lista_servico,
    codigo_cnae: nfse.servico.codigo_cnae,
    codigo_tributario_municipio: nfse.servico.codigo_tributario_municipio,
    codigo_municipio: nfse.servico.codigo_municipio,
    aliquota: nfse.servico.aliquota,
    iss_retido: nfse.servico.iss_retido,
    // Campos necessários para Ipojuca/PE e outros municípios que exigem
    base_calculo: nfse.servico.base_calculo,
    valor_iss: nfse.servico.valor_iss
  };

  // Remover campos undefined/null
  Object.keys(servicoLimpo).forEach(key => {
    if (servicoLimpo[key] === undefined || servicoLimpo[key] === null) {
      delete servicoLimpo[key];
    }
  });

  // Verificar se há campos proibidos no objeto original e logar
  const camposEncontrados = camposProibidos.filter(campo =>
    nfse.servico[campo] !== undefined
  );

  if (camposEncontrados.length > 0) {
    logger.warn('Campos proibidos encontrados e removidos durante sanitização', {
      service: 'mapeador',
      action: 'sanitizar_payload',
      pedido_id: nfse.prestador?.cnpj ? 'N/A' : 'N/A',
      campos_removidos: camposEncontrados,
      valores_removidos: camposEncontrados.reduce((acc, campo) => {
        acc[campo] = nfse.servico[campo];
        return acc;
      }, {})
    });
  }

  // Garantir que codigo_tributario_municipio seja string
  if (servicoLimpo.codigo_tributario_municipio !== undefined) {
    servicoLimpo.codigo_tributario_municipio = String(servicoLimpo.codigo_tributario_municipio);
  }

  // Garantir que codigo_municipio seja string
  if (servicoLimpo.codigo_municipio !== undefined) {
    servicoLimpo.codigo_municipio = String(servicoLimpo.codigo_municipio);
  }

  // Garantir que item_lista_servico seja string e preserve formato "X.XX"
  if (servicoLimpo.item_lista_servico !== undefined) {
    servicoLimpo.item_lista_servico = String(servicoLimpo.item_lista_servico);
    // Validar formato se necessário
    if (!/^\d{1,2}\.\d{2}$/.test(servicoLimpo.item_lista_servico)) {
      logger.warn('Formato de item_lista_servico pode estar incorreto', {
        valor: servicoLimpo.item_lista_servico,
        formato_esperado: 'X.XX',
        exemplo: '8.02'
      });
    }
  }

  return {
    ...nfse,
    servico: servicoLimpo
  };
}

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
      numero: (billing.address_2 || shipping.address_2 || billing.number || shipping.number || 'S/N').substring(0, 10),
      complemento: billing.address_2 || shipping.address_2 || '',
      bairro: bairroWC, // Será corrigido pela API do CEP se disponível
      cidade: billing.city || shipping.city || '',
      estado: billing.state || shipping.state || '',
      cep: (billing.postcode || shipping.postcode || '').replace(/\D/g, ''),
      pais: (billing.country === 'BR' || shipping.country === 'BR') ? 'Brasil' : (billing.country || shipping.country || 'Brasil')
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
    throw new Error(`Documento do tomador inválido: ${documento.erro}. Valor recebido: "${dadosPedido.cpf_cnpj || ''}"`);
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

  // Calcular valor total dos serviços (sem desconto - base de cálculo)
  // IMPORTANTE: Para NFSe, usar o valor bruto sem desconto para evitar erro de dedução (A2)
  // O erro A2 ocorre quando há dedução na base de cálculo e o item não permite dedução
  let valorServicos;

  if (dadosPedido.valor_servicos) {
    // Se já tiver valor_servicos explícito, usar ele
    valorServicos = parseFloat(dadosPedido.valor_servicos);
  } else if (dadosPedido.servicos && dadosPedido.servicos.length > 0) {
    // Calcular a partir dos serviços - usar subtotal (sem desconto) sempre
    valorServicos = dadosPedido.servicos.reduce((sum, s) => {
      // Priorizar subtotal (sem desconto), depois total, depois valor_total
      const valorItem = parseFloat(s.subtotal || s.total || s.valor_total || 0);
      return sum + valorItem;
    }, 0);
  } else {
    // Usar valor_total do pedido (mas verificar se não tem desconto aplicado)
    // Se houver desconto_total, somar de volta ao valor_total para obter o valor bruto
    const valorTotal = parseFloat(dadosPedido.valor_total || 0);
    const descontoTotal = parseFloat(dadosPedido.desconto_total || dadosPedido.valor_desconto || 0);
    valorServicos = valorTotal + descontoTotal; // Valor bruto = total + desconto
  }

  // Garantir que valor_servicos não seja negativo e tenha exatamente 2 casas decimais
  const valorServicosFinal = Math.max(0, parseFloat(valorServicos.toFixed(2)));

  // Validar que valor_servicos é maior que zero
  if (valorServicosFinal <= 0) {
    throw new Error(`Valor dos serviços deve ser maior que zero. Valor calculado: ${valorServicosFinal}`);
  }

  // Log detalhado para debug
  logger.mapping('Cálculo do valor dos serviços', {
    pedido_id: dadosPedido.pedido_id,
    valor_servicos_informado: dadosPedido.valor_servicos,
    valor_total: dadosPedido.valor_total,
    desconto_total: dadosPedido.desconto_total || dadosPedido.valor_desconto,
    valor_servicos_calculado: valorServicos,
    valor_servicos_final: valorServicosFinal,
    servicos_count: dadosPedido.servicos?.length || 0,
    servicos_subtotais: dadosPedido.servicos?.map(s => ({
      nome: s.nome,
      subtotal: s.subtotal,
      total: s.total,
      valor_usado: s.subtotal || s.total || 0
    })) || []
  });

  // Mapear tomador com estrutura correta
  // Extrair e limpar CEP
  let cepTomador = limparDocumento(dadosPedido.endereco?.cep || '');

  // FIX: CEP não é obrigatório se houver cidade/estado para buscar o código IBGE
  // if (!cepTomador || cepTomador === '') {
  //   throw new Error('CEP do tomador é obrigatório. Informe o CEP no endereço do pedido.');
  // }

  // Garantir 8 dígitos apenas se tiver CEP
  if (cepTomador) {
    cepTomador = cepTomador.replace(/\D/g, '').padStart(8, '0').substring(0, 8);
  }

  // Buscar código IBGE do município do tomador via API
  logger.mapping('Buscando código IBGE do município do tomador', {
    pedido_id: dadosPedido.pedido_id,
    cep: cepTomador || 'Não informado',
    cidade: dadosPedido.endereco?.cidade,
    estado: dadosPedido.endereco?.estado
  });

  let dadosMunicipio;

  // 1. Tentar buscar por CEP se existir
  if (cepTomador) {
    try {
      dadosMunicipio = await buscarCodigoMunicipioPorCEP(cepTomador);
    } catch (cepError) {
      logger.warn('Falha ao buscar por CEP, tentando por cidade/estado', {
        pedido_id: dadosPedido.pedido_id,
        cep_error: cepError.message
      });
      // Deixar cair no bloco abaixo
    }
  }

  // 2. Se não achou por CEP (ou não tem CEP), buscar por Cidade/Estado
  if (!dadosMunicipio) {
    const cidade = dadosPedido.endereco?.cidade;
    const estado = dadosPedido.endereco?.estado;

    if (cidade && estado) {
      try {
        dadosMunicipio = await buscarCodigoMunicipioPorCidadeEstado(cidade, estado);
      } catch (cidadeError) {
        logger.warn('Não foi possível obter código IBGE por cidade/estado', {
          error: cidadeError.message,
          cidade,
          estado
        });
        // Não lançar erro, seguir sem código IBGE (API do Focus pode rejeitar ou aceitar se não for exigido)
      }
    } else {
      logger.warn('Não foi possível obter código IBGE: Cidade/Estado ausentes', {
        pedido_id: dadosPedido.pedido_id
      });
      // Não lançar erro
    }
  }

  const codigoMunicipioTomador = dadosMunicipio?.codigoIBGE;
  const ufCorreta = dadosMunicipio?.uf || dadosPedido.endereco?.estado || '';
  const cidadeCorreta = dadosMunicipio?.cidade || dadosPedido.endereco?.cidade || '';
  const bairroDaAPI = dadosMunicipio?.bairro || '';

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
      numero: (dadosPedido.endereco?.numero || '').substring(0, 10),
      bairro: bairroCorreto, // Usar bairro da API quando disponível (mais confiável)
      cidade: cidadeCorreta || dadosPedido.endereco?.cidade || '', // Cidade obtida via API ou do pedido
      uf: ufCorreta, // Usar UF retornada pela API (corrige inconsistências)
      codigo_municipio: codigoMunicipioTomador, // Código obtido via API
      cep: cepTomador // CEP sempre presente com 8 dígitos
    }
  };

  // FIX: Garantir que endereço do tomador esteja sempre completo
  // Se algum campo faltar, usar endereço do prestador (emitente) como fallback
  if (tomador.endereco) {
    // Campos obrigatórios do endereço - usar dados do emitente como fallback
    const enderecoOriginal = { ...tomador.endereco };
    
    tomador.endereco = {
      logradouro: tomador.endereco.logradouro || configEmitente.logradouro || '',
      numero: tomador.endereco.numero || configEmitente.numero || 'S/N',
      bairro: tomador.endereco.bairro || configEmitente.bairro || '',
      cidade: tomador.endereco.cidade || configEmitente.municipio || 'Ipojuca',
      uf: tomador.endereco.uf || configEmitente.uf || 'PE',
      codigo_municipio: tomador.endereco.codigo_municipio || configEmitente.codigo_municipio || '2607208',
      cep: tomador.endereco.cep || configEmitente.cep || '55590000'
    };

    // Log se usar dados do emitente
    const usouDadosEmitente = {
      logradouro: !enderecoOriginal.logradouro && configEmitente.logradouro,
      numero: !enderecoOriginal.numero && configEmitente.numero,
      bairro: !enderecoOriginal.bairro && configEmitente.bairro,
      cidade: !enderecoOriginal.cidade && configEmitente.municipio,
      uf: !enderecoOriginal.uf && configEmitente.uf,
      codigo_municipio: !enderecoOriginal.codigo_municipio && configEmitente.codigo_municipio,
      cep: !enderecoOriginal.cep && configEmitente.cep
    };

    const camposUsadosDoEmitente = Object.keys(usouDadosEmitente).filter(campo => usouDadosEmitente[campo]);

    if (camposUsadosDoEmitente.length > 0) {
      logger.warn('Usando endereço do prestador para completar endereço do tomador', {
        pedido_id: dadosPedido.pedido_id,
        campos_preenchidos_com_emitente: camposUsadosDoEmitente,
        endereco_original: {
          logradouro: enderecoOriginal.logradouro || 'vazio',
          numero: enderecoOriginal.numero || 'vazio',
          bairro: enderecoOriginal.bairro || 'vazio',
          cidade: enderecoOriginal.cidade || 'vazio',
          uf: enderecoOriginal.uf || 'vazio',
          codigo_municipio: enderecoOriginal.codigo_municipio || 'vazio',
          cep: enderecoOriginal.cep || 'vazio'
        },
        endereco_final: tomador.endereco
      });
    }
  }

  // FIX: Adicionar telefone apenas se estiver presente e válido (não vazio)
  // O campo telefone deve seguir o padrão TSTelefone (apenas números, sem caracteres especiais)
  // Evita erro RNG6110: "The value '' is invalid according to its datatype 'TSTelefone'"
  // IMPORTANTE: Conforme documentação Focus NFe, o campo no JSON é "telefone", não "fone"
  if (dadosPedido.telefone && dadosPedido.telefone.trim() !== '') {
    // Remover todos os caracteres não numéricos (incluindo +, espaços, hífens, parênteses, etc)
    const telefoneLimpo = dadosPedido.telefone.replace(/\D/g, '');
    // Validar que tenha pelo menos 10 dígitos (DDD + número)
    // Aceita com ou sem código do país (55)
    if (telefoneLimpo.length >= 10) {
      // Se tiver código do país (55), remover para manter apenas DDD + número
      // O Focus NFe espera formato brasileiro: DDD + número (10 ou 11 dígitos)
      const telefoneFinal = telefoneLimpo.startsWith('55') && telefoneLimpo.length > 11
        ? telefoneLimpo.substring(2) // Remove código do país
        : telefoneLimpo;
      
      // Garantir que tenha entre 10 e 11 dígitos (DDD + número com 8 ou 9 dígitos)
      if (telefoneFinal.length >= 10 && telefoneFinal.length <= 11) {
        tomador.telefone = telefoneFinal; // CORREÇÃO: usar "telefone" conforme documentação
      }
    }
  }

  // FIX: Remover campo telefone se estiver vazio ou inválido (evita erro RNG6110)
  if (tomador.telefone !== undefined) {
    if (!tomador.telefone || tomador.telefone === '' || String(tomador.telefone).trim() === '') {
      logger.warn('Removendo campo telefone vazio ou inválido do tomador', {
        pedido_id: dadosPedido.pedido_id,
        telefone_original: tomador.telefone,
        telefone_origem: dadosPedido.telefone
      });
      delete tomador.telefone;
    }
  }

  // Remover campos undefined do tomador (mas não do endereco)
  Object.keys(tomador).forEach(key => {
    if (tomador[key] === undefined && key !== 'endereco') {
      delete tomador[key];
    }
  });

  // FIX: Remover também campos que são strings vazias do tomador (exceto endereco)
  Object.keys(tomador).forEach(key => {
    if (key !== 'endereco' && typeof tomador[key] === 'string' && tomador[key].trim() === '') {
      delete tomador[key];
    }
  });

  // FIX: NÃO remover campos do endereço após garantir que está completo
  // O endereço já foi preenchido com valores padrão acima, então todos os campos devem estar presentes
  // Remover campos vazios pode causar erro RNG6110 se o Focus NFe esperar campos específicos no XML
  
  // Garantir que todos os campos obrigatórios do endereço estejam presentes e válidos
  // Se algum campo ainda estiver vazio após usar dados do emitente, usar valores padrão mínimos
  if (!tomador.endereco.logradouro || tomador.endereco.logradouro.trim() === '') {
    tomador.endereco.logradouro = 'Não informado';
  }
  if (!tomador.endereco.numero || tomador.endereco.numero.trim() === '') {
    tomador.endereco.numero = 'S/N';
  }
  if (!tomador.endereco.bairro || tomador.endereco.bairro.trim() === '') {
    tomador.endereco.bairro = 'Centro';
  }
  if (!tomador.endereco.cidade || tomador.endereco.cidade.trim() === '') {
    tomador.endereco.cidade = cidadeCorreta || dadosPedido.endereco?.cidade || 'Ipojuca';
  }
  if (!tomador.endereco.uf || tomador.endereco.uf.trim() === '') {
    tomador.endereco.uf = ufCorreta || 'PE';
  }
  if (!tomador.endereco.codigo_municipio || tomador.endereco.codigo_municipio === '') {
    tomador.endereco.codigo_municipio = codigoMunicipioTomador || configEmitente.codigo_municipio || '2607208';
  }
  if (!tomador.endereco.cep || tomador.endereco.cep.trim() === '') {
    tomador.endereco.cep = cepTomador || configEmitente.cep || '55590000';
  }

  // Log se usar valores padrão mínimos
  const enderecoCompleto = {
    logradouro: tomador.endereco.logradouro,
    numero: tomador.endereco.numero,
    bairro: tomador.endereco.bairro,
    cidade: tomador.endereco.cidade,
    uf: tomador.endereco.uf,
    codigo_municipio: tomador.endereco.codigo_municipio,
    cep: tomador.endereco.cep
  };
  
  logger.debug('Endereço do tomador garantido como completo', {
    pedido_id: dadosPedido.pedido_id,
    endereco_completo: enderecoCompleto
  });

  // Discriminação dos serviços (juntar todos os produtos em uma string)
  const discriminacao = (dadosPedido.servicos || [])
    .map(item => item.discriminacao || item.nome || 'Serviço não especificado')
    .join('; ') || 'Serviço não especificado';

  // Estrutura NFSe conforme código que está funcionando
  const nfse = {
    data_emissao: dataEmissao,
    natureza_operacao: dadosPedido.natureza_operacao || "1",
    // FIX: Adicionar regime especial 3 (ME/EPP) conforme XML de sucesso
    regime_especial_tributacao: '3',
    // FIX: Incentivador cultural = 1 (Sim) conforme XML de sucesso (atual estava indo 2)
    incentivador_cultural: '1',
    // FIX: Enviar como número (1 = Sim, 2 = Não) conforme XML de sucesso, não boolean
    optante_simples_nacional: configEmitente.optante_simples_nacional !== false ? 1 : 2,
    // FIX: Adicionar regime de apuração tributária (obrigatório para Simples Nacional - E2055)
    // Campo correto conforme documentação Focus NFe: regime_tributario_simples_nacional
    // 1 = Regime de apuração dos tributos federais e municipal pelo SN (todos os tributos dentro do SN)
    // 2 = Regime de apuração dos tributos federais pelo SN e ISSQN por fora do SN
    // 3 = Regime de apuração dos tributos federais e municipal por fora do SN
    // Garantir que sempre tenha valor quando optante do Simples Nacional (padrão: 1)
    regime_tributario_simples_nacional: (() => {
      // Se tiver configurado explicitamente, usar
      if (configFiscal?.regime_tributario_simples_nacional !== undefined && configFiscal?.regime_tributario_simples_nacional !== null) {
        return configFiscal.regime_tributario_simples_nacional;
      }
      // Se for optante do Simples Nacional, sempre enviar 1 (Opção 1 - padrão mais comum)
      if (configEmitente.optante_simples_nacional !== false) {
        return 1;
      }
      // Se não for optante, não enviar o campo
      return undefined;
    })(),

    // Prestador
    // Nota: inscricao_municipal é opcional no schema, mas alguns municípios exigem
    // Para Ipojuca/PE, vamos enviar se estiver configurada
    prestador: {
      cnpj: configEmitente.cnpj,
      codigo_municipio: configEmitente.codigo_municipio
    },

    // Tomador
    tomador: tomador,

    // Serviço (singular, conforme código funcionando)
    servico: {
      valor_servicos: valorServicosFinal,
      discriminacao: discriminacao,
      // Item da lista de serviço: formato correto é 5 dígitos sem pontos (ex: 07010)
      // IMPORTANTE: Para Ipojuca/PE, o formato deve ser exatamente 5 dígitos
      // Se vier com 6 dígitos (070101), remover o último dígito ou ajustar conforme necessário
      item_lista_servico: (() => {
        // Obter valor do config - FIX: Forçar 8.02 conforme XML de sucesso (ignorando config incorreta)
        // let item = (configFiscal?.item_lista_servico || '8.02').toString().trim();
        let item = '8.02';

        // IMPORTANTE: Para Ipojuca/PE, o formato é "8.02" (com ponto), não 5 dígitos numéricos
        // Validar formato: deve ser "X.XX" ou "XX.XX" (ex: "8.02", "14.01")
        if (!/^\d{1,2}\.\d{2}$/.test(item)) {
          // Se não estiver no formato correto, tentar identificar o problema
          const itemOriginal = configFiscal?.item_lista_servico || '8.02';
          throw new Error(`Item da lista de serviço inválido para Ipojuca/PE. Deve estar no formato "X.XX" (ex: "8.02"). Valor recebido: ${itemOriginal}`);
        }

        // Log do código formatado para debug
        logger.mapping('Item da lista de serviço formatado', {
          pedido_id: dadosPedido.pedido_id,
          valor_original: configFiscal?.item_lista_servico || '8.02',
          valor_formatado: item,
          formato: 'X.XX'
        });

        return item; // Retornar exatamente como está (ex: "8.02")
      })(),
      // FIX: Adicionar CNAE fixo conforme XML de referência (8650003 - Atividade médica/psicológica)
      codigo_cnae: configFiscal?.codigo_cnae || '8650003',
      // FIX: Remover codigo_tributario_municipio pois não aparece no XML de sucesso
      // codigo_tributario_municipio: String(configFiscal?.codigo_tributario_municipio || '802'),
      codigo_municipio: configEmitente.codigo_municipio,
      aliquota: (() => {
        // FIX: Forçar 2.00 conforme XML de sucesso (ignorando config incorreta)
        // let aliquota = configFiscal?.aliquota || 2.00; 
        let aliquota = 2.00; // Default para 2% se não definido

        // Se vier como decimal (ex: 0.02), converter para percentual (2.00)
        // O XML de referência mostra <Aliquota>2.00</Aliquota>, então o valor deve ser enviado como percentual
        if (aliquota < 1 && aliquota > 0) {
          const aliquotaOriginal = aliquota;
          aliquota = aliquota * 100;
          logger.warn('Alíquota convertida de decimal para percentual (Ajuste Ipojuca)', {
            pedido_id: dadosPedido.pedido_id,
            valor_original: aliquotaOriginal,
            valor_convertido: aliquota
          });
        }

        // Garantir formato com 2 casas decimais (ex: 2.00)
        const aliquotaFinal = parseFloat(aliquota.toFixed(2));

        logger.mapping('Alíquota processada', {
          pedido_id: dadosPedido.pedido_id,
          valor_config: configFiscal?.aliquota,
          valor_final: aliquotaFinal,
          formato: 'percentual'
        });

        return aliquotaFinal;
      })(),


      // Ipojuca/PE requer envio explícito da base de cálculo e valor do ISS
      base_calculo: valorServicosFinal,
      valor_iss: (() => {
        // Calcular ISS: valor * (aliquota / 100)
        // Aliquota aqui é 2.00 (percentual) ou convertida para tal
        let aliq = 2.00; // Valor default hardcoded acima

        // Recalcular apenas para garantir consistência
        const valor = parseFloat(valorServicosFinal);
        const iss = valor * (aliq / 100);
        return parseFloat(iss.toFixed(2));
      })(),

      iss_retido: false // false = 2 (Não Retido)
      // Enviar esses campos causa erro A2 (dedução não permitida) e E183/E182 (valores inválidos)
    }
  };

  // Adicionar iss_retido apenas se for realmente true
  if (configFiscal?.iss_retido === true || configFiscal?.iss_retido === 'true') {
    nfse.servico.iss_retido = true;
  }

  // Adicionar inscrição municipal se estiver configurada (alguns municípios exigem mesmo sendo opcional)
  // Baseado no WSDL de Ipojuca/PE fornecido pelo suporte Focus NFe
  if (configEmitente.inscricao_municipal && configEmitente.inscricao_municipal.trim() !== '') {
    nfse.prestador.inscricao_municipal = configEmitente.inscricao_municipal.replace(/\D/g, ''); // Remover formatação (pontos, traços)
  }

  // Validar formato final do item_lista_servico (formato "X.XX" para Ipojuca/PE)
  if (!/^\d{1,2}\.\d{2}$/.test(nfse.servico.item_lista_servico)) {
    throw new Error(`Item da lista de serviço inválido para Ipojuca/PE. Deve estar no formato "X.XX" (ex: "8.02"). Valor recebido: ${nfse.servico.item_lista_servico}`);
  }

  // Validar que valor_servicos é positivo
  if (nfse.servico.valor_servicos <= 0) {
    throw new Error(`Valor dos serviços deve ser maior que zero. Valor: ${nfse.servico.valor_servicos}`);
  }

  // FIX: Garantir que endereço do tomador esteja sempre presente e completo antes de sanitizar
  // Isso evita erro RNG6110 e outros erros relacionados a endereço incompleto
  if (nfse.tomador) {
    // Garantir que endereço existe
    if (!nfse.tomador.endereco) {
      logger.warn('Endereço do tomador ausente - criando endereço completo com dados do prestador', {
        pedido_id: dadosPedido.pedido_id
      });
      nfse.tomador.endereco = {
        logradouro: configEmitente.logradouro || 'Não informado',
        numero: configEmitente.numero || 'S/N',
        bairro: configEmitente.bairro || 'Centro',
        cidade: configEmitente.municipio || 'Ipojuca',
        uf: configEmitente.uf || 'PE',
        codigo_municipio: configEmitente.codigo_municipio || '2607208',
        cep: configEmitente.cep || '55590000'
      };
    } else {
      // Garantir que todos os campos do endereço estejam preenchidos
      const endereco = nfse.tomador.endereco;
      if (!endereco.logradouro || endereco.logradouro.trim() === '') {
        endereco.logradouro = configEmitente.logradouro || 'Não informado';
      }
      if (!endereco.numero || endereco.numero.trim() === '') {
        endereco.numero = configEmitente.numero || 'S/N';
      }
      if (!endereco.bairro || endereco.bairro.trim() === '') {
        endereco.bairro = configEmitente.bairro || 'Centro';
      }
      if (!endereco.cidade || endereco.cidade.trim() === '') {
        endereco.cidade = configEmitente.municipio || 'Ipojuca';
      }
      if (!endereco.uf || endereco.uf.trim() === '') {
        endereco.uf = configEmitente.uf || 'PE';
      }
      if (!endereco.codigo_municipio || endereco.codigo_municipio === '') {
        endereco.codigo_municipio = configEmitente.codigo_municipio || '2607208';
      }
      if (!endereco.cep || endereco.cep.trim() === '') {
        endereco.cep = configEmitente.cep || '55590000';
      }
    }

    // FIX: Garantir que campo telefone do tomador não esteja vazio antes de sanitizar
    // Isso evita erro RNG6110 do schema XML
    // IMPORTANTE: Conforme documentação Focus NFe, o campo no JSON é "telefone", não "fone"
    if (nfse.tomador.telefone !== undefined) {
      const telefoneValue = String(nfse.tomador.telefone || '').trim();
      if (telefoneValue === '' || telefoneValue.length < 10) {
        logger.warn('Removendo campo telefone inválido do tomador antes de sanitizar', {
          pedido_id: dadosPedido.pedido_id,
          telefone_value: nfse.tomador.telefone,
          telefone_length: telefoneValue.length
        });
        delete nfse.tomador.telefone;
      }
    }
  }

  // Sanitizar payload antes de retornar
  const nfseSanitizado = sanitizarPayloadNFSe(nfse);

  // Log do item da lista de serviço para debug
  const itemListaServicoFinal = nfseSanitizado.servico.item_lista_servico;
  logger.mapping('Mapeamento para Focus NFSe concluído', {
    pedido_id: dadosPedido.pedido_id,
    tomador: tomador.razao_social,
    valor_servicos: valorServicosFinal,
    item_lista_servico: itemListaServicoFinal,
    item_lista_servico_original: configFiscal?.item_lista_servico || '8.02',
    aliquota: nfseSanitizado.servico.aliquota,
    codigo_tributario: nfseSanitizado.servico.codigo_tributario_municipio
  });

  // Log final do payload antes de retornar
  logger.mapping('Payload NFSe validado e pronto para envio', {
    pedido_id: dadosPedido.pedido_id,
    item_lista_servico: nfseSanitizado.servico.item_lista_servico,
    valor_servicos: nfseSanitizado.servico.valor_servicos,
    aliquota: nfseSanitizado.servico.aliquota,
    tem_base_calculo: nfseSanitizado.servico.base_calculo !== undefined,
    tem_valor_iss: nfseSanitizado.servico.valor_iss !== undefined,
    servico_keys: Object.keys(nfseSanitizado.servico)
  });

  return nfseSanitizado;
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

  let cidadeDestinatario = dadosPedido.endereco?.cidade || '';
  const estadoDestinatario = dadosPedido.endereco?.estado || '';

  // FIX: Normalização específica para DF
  // A SEFAZ/Focus NFe exige "Brasília" para qualquer endereço no DF (Núcleo Bandeirante, Taguatinga, etc)
  if (estadoDestinatario === 'DF') {
    logger.debug('Endereço no DF detectado no mapeamento NFe - Normalizando para Brasília', {
      cidade_original: cidadeDestinatario,
      uf: estadoDestinatario
    });
    cidadeDestinatario = 'Brasília';
  }

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

  // Determinar CFOP baseado no estado do destinatário
  // PE (mesmo estado) = 5102 (venda interna)
  // Outros estados = 6108 (venda interestadual para consumidor final CPF)
  const ufEmitente = dadosMunicipioEmitente.uf || 'PE';
  const ufDestinatario = dadosMunicipioDestinatario.uf || estadoDestinatario || '';
  const isVendaInterestadual = ufDestinatario && ufDestinatario.toUpperCase() !== ufEmitente.toUpperCase();
  const cfopCalculado = isVendaInterestadual ? '6108' : '5102';

  logger.debug('CFOP calculado baseado no estado', {
    service: 'mapeador',
    action: 'calcularCFOP',
    uf_emitente: ufEmitente,
    uf_destinatario: ufDestinatario,
    is_interestadual: isVendaInterestadual,
    cfop: cfopCalculado
  });

  // Mapear produtos para items da NFe
  const items = (dadosPedido.servicos || []).map((produto, index) => {
    // Extrair NCM dos meta_data do produto
    const ncm = produto.meta_data?.find(m =>
      m.key && (m.key.toLowerCase() === 'ncm' || m.key.toLowerCase() === 'codigo_ncm')
    )?.value || configFiscal?.ncm_padrao || '49019900';

    // Usar CFOP calculado (pode ser sobrescrito pelo meta_data do produto)
    const cfop = produto.meta_data?.find(m =>
      m.key && m.key.toLowerCase() === 'cfop'
    )?.value || cfopCalculado;

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

  // Determinar local_destino baseado no estado
  // 1 = Operação interna (mesmo estado)
  // 2 = Operação interestadual
  // 3 = Operação com exterior
  const localDestino = isVendaInterestadual ? 2 : 1;

  // Estrutura NFe conforme documentação
  const nfe = {
    natureza_operacao: dadosPedido.natureza_operacao || 'Venda de mercadoria',
    data_emissao: dataEmissao,
    data_entrada_saida: dataEmissao,
    tipo_documento: 1, // 1 = Saída
    local_destino: localDestino, // 1 = Interna, 2 = Interestadual
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
    numero_destinatario: (dadosPedido.endereco?.numero || 'S/N').substring(0, 10),
    bairro_destinatario: dadosMunicipioDestinatario.bairro || dadosPedido.endereco?.bairro || undefined,
    municipio_destinatario: dadosMunicipioDestinatario.cidade || dadosPedido.endereco?.cidade || '',
    uf_destinatario: dadosMunicipioDestinatario.uf || dadosPedido.endereco?.estado || '',
    pais_destinatario: (dadosPedido.endereco?.pais === 'BR' ? 'Brasil' : dadosPedido.endereco?.pais) || 'Brasil',
    cep_destinatario: cepDestinatario, // Manter como string para preservar zeros à esquerda

    // Itens
    items: items,

    // Totais
    valor_frete: valorFrete,
    valor_seguro: 0,
    valor_total: parseFloat(valorTotal.toFixed(2)),
    valor_produtos: parseFloat(valorProdutos.toFixed(2)),
    modalidade_frete: 0, // 0 = Por conta do emitente

    // Informações Adicionais
    informacoes_adicionais_contribuinte: 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.'
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

