const logger = require('./logger');

/**
 * Remove caracteres não numéricos
 */
function limparDocumento(doc) {
  return (doc || '').replace(/\D/g, '');
}

/**
 * Valida CPF
 */
function validarCPF(cpf) {
  cpf = limparDocumento(cpf);
  
  if (cpf.length !== 11) {
    return { valido: false, erro: 'CPF deve ter 11 dígitos' };
  }
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) {
    return { valido: false, erro: 'CPF inválido (todos os dígitos iguais)' };
  }
  
  // Validação do primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) {
    return { valido: false, erro: 'CPF inválido (primeiro dígito verificador)' };
  }
  
  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) {
    return { valido: false, erro: 'CPF inválido (segundo dígito verificador)' };
  }
  
  return { valido: true, documento: cpf, tipo: 'CPF' };
}

/**
 * Valida CNPJ
 */
function validarCNPJ(cnpj) {
  cnpj = limparDocumento(cnpj);
  
  if (cnpj.length !== 14) {
    return { valido: false, erro: 'CNPJ deve ter 14 dígitos' };
  }
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cnpj)) {
    return { valido: false, erro: 'CNPJ inválido (todos os dígitos iguais)' };
  }
  
  // Validação do primeiro dígito verificador
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) {
    return { valido: false, erro: 'CNPJ inválido (primeiro dígito verificador)' };
  }
  
  // Validação do segundo dígito verificador
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(1))) {
    return { valido: false, erro: 'CNPJ inválido (segundo dígito verificador)' };
  }
  
  return { valido: true, documento: cnpj, tipo: 'CNPJ' };
}

/**
 * Valida CPF ou CNPJ
 */
function validarCPFCNPJ(documento) {
  if (!documento) {
    return { valido: false, erro: 'Documento não informado', tipo: 'INVALIDO' };
  }
  
  const limpo = limparDocumento(documento);
  
  if (limpo.length === 11) {
    return validarCPF(limpo);
  } else if (limpo.length === 14) {
    return validarCNPJ(limpo);
  }
  
  return { valido: false, erro: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos', tipo: 'INVALIDO' };
}

/**
 * Formata CPF
 */
function formatarCPF(cpf) {
  cpf = limparDocumento(cpf);
  if (cpf.length !== 11) return cpf;
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ
 */
function formatarCNPJ(cnpj) {
  cnpj = limparDocumento(cnpj);
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Valida email
 */
function validarEmail(email) {
  if (!email) return { valido: false, erro: 'Email não informado' };
  
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valido: false, erro: 'Formato de email inválido' };
  }
  
  return { valido: true };
}

/**
 * Valida CEP
 */
function validarCEP(cep) {
  const limpo = limparDocumento(cep);
  
  if (limpo.length !== 8) {
    return { valido: false, erro: 'CEP deve ter 8 dígitos' };
  }
  
  return { valido: true, documento: limpo };
}

/**
 * Valida formato de data (YYYY-MM-DD ou ISO 8601)
 */
function validarData(data) {
  if (!data) return { valido: false, erro: 'Data não informada' };
  
  // Aceita YYYY-MM-DD ou ISO 8601
  const regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!regex.test(data)) {
    return { valido: false, erro: 'Formato de data inválido. Use YYYY-MM-DD ou ISO 8601' };
  }
  
  const date = new Date(data);
  if (isNaN(date.getTime())) {
    return { valido: false, erro: 'Data inválida' };
  }
  
  return { valido: true, data: date };
}

/**
 * Valida número positivo
 */
function validarNumeroPositivo(valor, campo = 'valor') {
  if (valor === null || valor === undefined) {
    return { valido: false, erro: `${campo} não informado` };
  }
  
  const num = parseFloat(valor);
  
  if (isNaN(num)) {
    return { valido: false, erro: `${campo} deve ser um número` };
  }
  
  if (num < 0) {
    return { valido: false, erro: `${campo} deve ser positivo` };
  }
  
  return { valido: true, valor: num };
}

/**
 * Valida campos obrigatórios de NFSe conforme documentação Focus
 * Atualizado para estrutura que está funcionando (servico singular)
 */
function validarCamposNFSe(dados) {
  const erros = [];
  
  // Data de emissão
  if (!dados.data_emissao) {
    erros.push('Campo obrigatório faltando: data_emissao');
  }
  
  // Prestador
  if (!dados.prestador) {
    erros.push('Campo obrigatório faltando: prestador');
  } else {
    if (!dados.prestador.cnpj) {
      erros.push('Prestador deve ter CNPJ');
    } else {
      const validacao = validarCNPJ(dados.prestador.cnpj);
      if (!validacao.valido) {
        erros.push(`prestador.cnpj: ${validacao.erro}`);
      }
    }
    // inscricao_municipal não é obrigatório se não houver informações complementares
    // (conforme erro E0120 da SEFAZ)
    if (!dados.prestador.codigo_municipio) {
      erros.push('Prestador deve ter codigo_municipio');
    }
  }
  
  // Tomador
  if (!dados.tomador) {
    erros.push('Campo obrigatório faltando: tomador');
  } else {
    if (!dados.tomador.cnpj && !dados.tomador.cpf) {
      erros.push('Tomador deve ter CPF ou CNPJ');
    } else {
      const doc = dados.tomador.cnpj || dados.tomador.cpf;
      const validacao = validarCPFCNPJ(doc);
      if (!validacao.valido) {
        erros.push(`tomador.${validacao.tipo === 'CPF' ? 'cpf' : 'cnpj'}: ${validacao.erro}`);
      }
    }
    
    if (!dados.tomador.razao_social) {
      erros.push('Tomador deve ter razao_social');
    }
    
    if (dados.tomador.endereco) {
      if (!dados.tomador.endereco.codigo_municipio) {
        erros.push('Tomador.endereco deve ter codigo_municipio');
      } else {
        // Validar formato do código IBGE (deve ter 7 dígitos)
        const codigoMunicipio = dados.tomador.endereco.codigo_municipio.toString().replace(/\D/g, '');
        if (codigoMunicipio.length !== 7) {
          erros.push(`Tomador.endereco.codigo_municipio deve ter 7 dígitos (código IBGE). Valor recebido: ${dados.tomador.endereco.codigo_municipio}`);
        }
      }
      
      // Validar CEP se presente
      if (dados.tomador.endereco.cep) {
        const cepValidacao = validarCEP(dados.tomador.endereco.cep);
        if (!cepValidacao.valido) {
          erros.push(`Tomador.endereco.cep: ${cepValidacao.erro}`);
        }
      }
    }
  }
  
  // Serviço (singular, conforme estrutura funcionando)
  if (!dados.servico) {
    erros.push('Campo obrigatório faltando: servico');
  } else {
    if (!dados.servico.discriminacao) {
      erros.push('servico.discriminacao: obrigatório');
    }
    if (!dados.servico.codigo_tributario_municipio) {
      erros.push('servico.codigo_tributario_municipio: obrigatório');
    }
    if (!dados.servico.item_lista_servico) {
      erros.push('servico.item_lista_servico: obrigatório');
    }
    if (dados.servico.valor_servicos === undefined || dados.servico.valor_servicos === null) {
      erros.push('servico.valor_servicos: obrigatório');
    } else {
      const validacao = validarNumeroPositivo(dados.servico.valor_servicos, 'servico.valor_servicos');
      if (!validacao.valido) {
        erros.push(`servico.valor_servicos: ${validacao.erro}`);
      }
    }
    if (!dados.servico.codigo_municipio) {
      erros.push('servico.codigo_municipio: obrigatório');
    }
  }
  
  if (erros.length > 0) {
    logger.validation('Erros de validação encontrados', {
      erros,
      dados: dados
    });
    
    return {
      valido: false,
      erros
    };
  }
  
  logger.validation('Validação de campos obrigatórios concluída com sucesso', {
    dados: dados
  });
  
  return { valido: true };
}

module.exports = {
  validarCPF,
  validarCNPJ,
  validarCPFCNPJ,
  formatarCPF,
  formatarCNPJ,
  validarEmail,
  validarCEP,
  validarData,
  validarNumeroPositivo,
  validarCamposNFSe,
  limparDocumento
};

