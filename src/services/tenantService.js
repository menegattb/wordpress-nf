/**
 * Serviço de configuração por tenant
 * Busca config do tenant_config com fallback para config.js global
 */

const config = require('../../config');
const { listarConfiguracoesTenant } = require('../config/database');

/**
 * Converte chaves planas do tenant_config em objeto de configuração
 * compatível com config.js (focusNFe, emitente, fiscal, woocommerce)
 */
function buildConfigFromFlat(flat) {
  const get = (key) => flat[key] ?? null;

  const ambiente = get('FOCUS_NFE_AMBIENTE') || config.focusNFe.ambiente || 'homologacao';
  const tokenHomologacao = get('FOCUS_NFE_TOKEN_HOMOLOGACAO') || config.focusNFe.token;
  const tokenProducao = get('FOCUS_NFE_TOKEN_PRODUCAO');

  return {
    focusNFe: {
      baseUrl: ambiente === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br',
      token: ambiente === 'producao' ? tokenProducao : tokenHomologacao,
      ambiente,
      cnpj: get('FOCUS_NFE_CNPJ') || config.focusNFe.cnpj
    },
    emitente: {
      cnpj: get('PRESTADOR_CNPJ') || get('FOCUS_NFE_CNPJ') || config.emitente.cnpj,
      inscricao_municipal: get('PRESTADOR_IM') || config.emitente.inscricao_municipal,
      razao_social: get('PRESTADOR_RAZAO') || config.emitente.razao_social,
      codigo_municipio: get('PRESTADOR_MUNICIPIO') || config.emitente.codigo_municipio,
      email: get('PRESTADOR_EMAIL') || config.emitente.email || '',
      telefone: get('PRESTADOR_TELEFONE') || config.emitente.telefone || '',
      optante_simples_nacional: get('EMITENTE_SIMPLES_NACIONAL') !== 'false',
      nome_fantasia: get('EMITENTE_NOME_FANTASIA') || get('PRESTADOR_RAZAO') || config.emitente.nome_fantasia,
      logradouro: get('EMITENTE_LOGRADOURO') || config.emitente.logradouro || '',
      numero: get('EMITENTE_NUMERO') || config.emitente.numero || '',
      bairro: get('EMITENTE_BAIRRO') || config.emitente.bairro || '',
      municipio: get('EMITENTE_MUNICIPIO') || config.emitente.municipio || '',
      uf: get('EMITENTE_UF') || config.emitente.uf || '',
      cep: get('EMITENTE_CEP') || config.emitente.cep || '',
      inscricao_estadual: get('EMITENTE_INSCRICAO_ESTADUAL') || config.emitente.inscricao_estadual || ''
    },
    fiscal: {
      item_lista_servico: get('ITEM_LISTA_SERVICO') || config.fiscal.item_lista_servico,
      codigo_tributario_municipio: get('CODIGO_TRIBUTARIO_MUNICIPIO') || config.fiscal.codigo_tributario_municipio,
      aliquota: parseFloat(get('ALIQUOTA') || config.fiscal.aliquota),
      tomador_municipio: get('TOMADOR_MUNICIPIO') || get('PRESTADOR_MUNICIPIO') || config.fiscal.tomador_municipio,
      cfop_padrao: get('CFOP_PADRAO') || config.fiscal.cfop_padrao,
      ncm_padrao: get('NCM_PADRAO') || config.fiscal.ncm_padrao,
      icms_situacao_tributaria: get('ICMS_SITUACAO_TRIBUTARIA') || config.fiscal.icms_situacao_tributaria,
      icms_origem: get('ICMS_ORIGEM') || config.fiscal.icms_origem,
      pis_situacao_tributaria: get('PIS_SITUACAO_TRIBUTARIA') || config.fiscal.pis_situacao_tributaria,
      cofins_situacao_tributaria: get('COFINS_SITUACAO_TRIBUTARIA') || config.fiscal.cofins_situacao_tributaria,
      regime_tributario: get('REGIME_TRIBUTARIO') || config.fiscal.regime_tributario,
      codigo_nbs: get('CODIGO_NBS') || config.fiscal.codigo_nbs
    },
    woocommerce: {
      url: get('WOOCOMMERCE_URL') || config.woocommerce.url || '',
      apiUrl: get('WOOCOMMERCE_API_URL') || config.woocommerce.apiUrl || '',
      consumerKey: get('WOOCOMMERCE_CONSUMER_KEY') || config.woocommerce.consumerKey || '',
      consumerSecret: get('WOOCOMMERCE_CONSUMER_SECRET') || config.woocommerce.consumerSecret || ''
    }
  };
}

/**
 * Obtém configuração completa para um tenant
 * Prioridade: tenant_config > config.js
 *
 * @param {number} tenantId - ID do tenant
 * @returns {Promise<Object>} Config { focusNFe, emitente, fiscal, woocommerce }
 */
async function getConfigForTenant(tenantId) {
  if (!tenantId) {
    return config;
  }

  const flat = await listarConfiguracoesTenant(tenantId);

  if (Object.keys(flat).length === 0) {
    return config;
  }

  return buildConfigFromFlat(flat);
}

module.exports = {
  getConfigForTenant,
  buildConfigFromFlat
};
