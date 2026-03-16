const axios = require('axios');
const logger = require('./logger');

// Cache simples em memória para evitar múltiplas chamadas
const cacheCEP = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Busca código IBGE do município por CEP usando ViaCEP
 * @param {string} cep - CEP no formato 12345678 (sem hífen)
 * @returns {Promise<{codigoIBGE: string, cidade: string, uf: string, bairro: string}>} Objeto com código IBGE, cidade, UF e bairro
 */
async function buscarCodigoMunicipioPorCEP(cep) {
  // Limpar e validar CEP
  const cepLimpo = cep.replace(/\D/g, '');

  if (!cepLimpo || cepLimpo.length !== 8) {
    throw new Error(`CEP inválido: ${cep}. CEP deve ter 8 dígitos.`);
  }

  // Verificar cache
  const cacheKey = cepLimpo;
  const cached = cacheCEP.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    logger.debug('Código IBGE obtido do cache', {
      service: 'cepService',
      action: 'buscarCodigoMunicipioPorCEP',
      cep: cepLimpo,
      codigo_ibge: cached.codigoIbge,
      cidade: cached.cidade,
      uf: cached.uf
    });
    return {
      codigoIBGE: cached.codigoIbge,
      cidade: cached.cidade,
      uf: cached.uf,
      bairro: cached.bairro || ''
    };
  }

  logger.cep('Buscando código IBGE por CEP', {
    cep: cepLimpo
  });

  try {
    const response = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
      timeout: 2000 // 2 segundos (reduzido de 5s para agilidade)
    });

    if (response.data.erro) {
      throw new Error(`CEP não encontrado: ${cepLimpo}`);
    }

    let codigoIBGE = response.data.ibge;
    let cidade = response.data.localidade;
    const uf = response.data.uf;
    const bairro = response.data.bairro || '';

    // FIX: Tratamento especial para o Distrito Federal (DF)
    // O IBGE e a Focus NFe exigem "Brasília" (5300108).
    // ViaCEP pode retornar "Núcleo Bandeirante", "Taguatinga", etc.
    if (uf === 'DF') {
      logger.cep('Endereço no DF detectado via CEP - Normalizando para Brasília', {
        cep: cepLimpo,
        cidade_original: cidade,
        cidade_nova: 'Brasília',
        codigo_ibge: '5300108'
      });
      cidade = 'Brasília';
      codigoIBGE = '5300108';
    }

    if (!codigoIBGE) {
      // ViaCEP pode não retornar IBGE em alguns casos, tentar buscar por cidade/estado
      logger.warn('ViaCEP não retornou código IBGE, tentando buscar por cidade/estado', {
        service: 'cepService',
        action: 'buscarCodigoMunicipioPorCEP',
        cep: cepLimpo,
        cidade: cidade,
        estado: uf
      });

      const resultado = await buscarCodigoMunicipioPorCidadeEstado(cidade, uf);
      return {
        codigoIBGE: resultado.codigoIBGE,
        cidade: cidade,
        uf: uf,
        bairro: bairro
      };
    }

    // Validar formato do código IBGE (deve ter 7 dígitos)
    if (codigoIBGE.length !== 7) {
      throw new Error(`Código IBGE inválido retornado pela API: ${codigoIBGE}. Esperado 7 dígitos.`);
    }

    // Salvar no cache
    cacheCEP.set(cacheKey, {
      codigoIbge: codigoIBGE,
      cidade: cidade,
      uf: uf,
      bairro: bairro,
      timestamp: Date.now()
    });

    logger.cep('Código IBGE encontrado', {
      cep: cepLimpo,
      codigo_ibge: codigoIBGE,
      cidade: cidade,
      estado: uf,
      bairro: bairro
    });

    return {
      codigoIBGE: codigoIBGE,
      cidade: cidade,
      uf: uf,
      bairro: bairro
    };

  } catch (error) {
    logger.error('Erro ao buscar CEP na API ViaCEP, tentando fallback para cidade/estado', {
      service: 'cepService',
      action: 'buscarCodigoMunicipioPorCEP',
      cep: cepLimpo,
      erro: error.message
    });

    // Fallback: Se ViaCEP falhar (ex: 502), tentar buscar apenas com base no que tivermos (impossível sem cidade/uf)
    // Mas se o erro foi de conexão, não temos cidade/uf.
    // Retornamos null para que quem chamou tente outra estratégia ou use dados do pedido
    // Porem, se falhar aqui, o mapeador provavelmente vai usar os dados brutos do pedido.

    // Melhor: disparar erro mas logado. O mapeador deve tratar.
    throw error;
  }
}

/**
 * Busca código IBGE do município por cidade e estado (fallback)
 * Usa API do IBGE para buscar o código
 * @param {string} cidade - Nome da cidade
 * @param {string} estado - Sigla do estado (2 letras)
 * @returns {Promise<{codigoIBGE: string, cidade: string, uf: string, bairro: string}>} Objeto com código IBGE, cidade, UF e bairro
 */
async function buscarCodigoMunicipioPorCidadeEstado(cidade, estado) {
  if (!cidade || !estado) {
    throw new Error('Cidade e estado são obrigatórios para buscar código IBGE.');
  }

  const uf = estado.toUpperCase();
  const nomeCidade = cidade.trim();

  logger.cep('Buscando código IBGE por cidade/estado', {
    cidade: nomeCidade,
    estado: uf
  });

  try {
    // Primeiro, buscar código da UF
    const ufResponse = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}`, {
      timeout: 3000 // 3 segundos (reduzido de 5s)
    });

    const codigoUF = ufResponse.data.id;

    if (!codigoUF) {
      throw new Error(`Estado não encontrado: ${uf}`);
    }

    // FIX: Tratamento especial para o Distrito Federal (DF)
    // O IBGE considera Brasília como o único município do DF (5300108)
    // Regiões administrativas (Guará, Taguatinga, Núcleo Bandeirante, etc) não são municípios
    if (uf === 'DF') {
      logger.cep('Endereço no DF detectado - Mapeando para Brasília', {
        cidade_original: nomeCidade,
        estado: uf,
        cidade_destino: 'Brasília',
        codigo_ibge: '5300108'
      });

      return {
        codigoIBGE: '5300108',
        cidade: 'Brasília',
        uf: 'DF',
        bairro: '' // Bairro original deve ser preservado pelo mapeador
      };
    }

    // Buscar municípios do estado
    const municipiosResponse = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${codigoUF}/municipios`,
      { timeout: 3000 } // 3 segundos
    );

    // Buscar município por nome (fazer match flexível)
    const municipio = municipiosResponse.data.find(m => {
      const nomeNormalizado = m.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cidadeNormalizada = nomeCidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nomeNormalizado === cidadeNormalizada || nomeNormalizado.includes(cidadeNormalizada);
    });

    if (!municipio) {
      throw new Error(`Município não encontrado: ${nomeCidade}/${uf}`);
    }

    const codigoIBGE = municipio.id.toString();

    if (codigoIBGE.length !== 7) {
      throw new Error(`Código IBGE inválido retornado pela API IBGE: ${codigoIBGE}. Esperado 7 dígitos.`);
    }

    logger.cep('Código IBGE encontrado por cidade/estado', {
      cidade: nomeCidade,
      estado: uf,
      codigo_ibge: codigoIBGE
    });

    return {
      codigoIBGE: codigoIBGE,
      cidade: nomeCidade,
      uf: uf,
      bairro: '' // Não temos bairro quando busca por cidade/estado
    };

  } catch (error) {
    if (error.response) {
      logger.error('Erro ao buscar município na API IBGE', {
        service: 'cepService',
        action: 'buscarCodigoMunicipioPorCidadeEstado',
        cidade: nomeCidade,
        estado: uf,
        status_code: error.response.status,
        error_data: error.response.data
      });
      throw new Error(`Erro ao consultar API IBGE: ${error.response.status} - ${error.message}`);
    } else if (error.request) {
      logger.error('API IBGE não respondeu (timeout ou indisponível)', {
        service: 'cepService',
        action: 'buscarCodigoMunicipioPorCidadeEstado',
        cidade: nomeCidade,
        estado: uf
      });
      throw new Error(`API IBGE não está disponível. Verifique sua conexão ou tente novamente mais tarde.`);
    } else {
      logger.error('Erro ao buscar código IBGE por cidade/estado', {
        service: 'cepService',
        action: 'buscarCodigoMunicipioPorCidadeEstado',
        cidade: nomeCidade,
        estado: uf,
        error: error.message
      });
      throw error;
    }
  }
}

/**
 * Limpa o cache de CEPs (útil para testes ou quando necessário)
 */
function limparCache() {
  cacheCEP.clear();
  logger.debug('Cache de CEP limpo', {
    service: 'cepService',
    action: 'limparCache'
  });
}

module.exports = {
  buscarCodigoMunicipioPorCEP,
  buscarCodigoMunicipioPorCidadeEstado,
  limparCache
};
