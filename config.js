require('dotenv').config();

module.exports = {
  focusNFe: {
    baseUrl: process.env.FOCUS_NFE_AMBIENTE === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br',
    token: process.env.FOCUS_NFE_AMBIENTE === 'producao'
      ? process.env.FOCUS_NFE_TOKEN_PRODUCAO
      : process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO,
    ambiente: process.env.FOCUS_NFE_AMBIENTE || 'homologacao',
    cnpj: process.env.FOCUS_NFE_CNPJ || ''
  },
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  webhook: {
    secret: process.env.WOOCOMMERCE_WEBHOOK_SECRET || ''
  },
  woocommerce: {
    url: process.env.WOOCOMMERCE_URL || '',
    apiUrl: process.env.WOOCOMMERCE_API_URL || '',
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || ''
  },
  emitente: {
    cnpj: process.env.PRESTADOR_CNPJ || process.env.FOCUS_NFE_CNPJ || '',
    inscricao_municipal: process.env.PRESTADOR_IM || process.env.EMITENTE_INSCRICAO_MUNICIPAL || '',
    razao_social: process.env.PRESTADOR_RAZAO || '',
    codigo_municipio: process.env.PRESTADOR_MUNICIPIO || process.env.EMITENTE_CODIGO_MUNICIPIO || '',
    email: process.env.PRESTADOR_EMAIL || '',
    telefone: process.env.PRESTADOR_TELEFONE || '',
    optante_simples_nacional: process.env.EMITENTE_SIMPLES_NACIONAL !== 'false',
    nome_fantasia: process.env.EMITENTE_NOME_FANTASIA || process.env.PRESTADOR_RAZAO || '',
    logradouro: process.env.EMITENTE_LOGRADOURO || '',
    numero: process.env.EMITENTE_NUMERO || '',
    bairro: process.env.EMITENTE_BAIRRO || '',
    municipio: process.env.EMITENTE_MUNICIPIO || '',
    uf: process.env.EMITENTE_UF || '',
    cep: process.env.EMITENTE_CEP || '',
    inscricao_estadual: process.env.EMITENTE_INSCRICAO_ESTADUAL || ''
  },
  fiscal: {
    item_lista_servico: process.env.ITEM_LISTA_SERVICO || '',
    codigo_tributario_municipio: process.env.CODIGO_TRIBUTARIO_MUNICIPIO || '',
    aliquota: parseFloat(process.env.ALIQUOTA || '0') || 0,
    tomador_municipio: process.env.TOMADOR_MUNICIPIO || process.env.PRESTADOR_MUNICIPIO || '',
    // Configurações para NFe (produto)
    cfop_padrao: process.env.CFOP_PADRAO || '5102', // CFOP padrão para venda de produto
    ncm_padrao: process.env.NCM_PADRAO || '49019900', // NCM padrão (livros, impressos, etc)
    icms_situacao_tributaria: process.env.ICMS_SITUACAO_TRIBUTARIA || '0300', // 0300 = Imune (Simples Nacional)
    icms_origem: process.env.ICMS_ORIGEM || '0', // 0 = Nacional
    pis_situacao_tributaria: process.env.PIS_SITUACAO_TRIBUTARIA || '07', // 07 = Isenta
    cofins_situacao_tributaria: process.env.COFINS_SITUACAO_TRIBUTARIA || '07', // 07 = Isenta
    regime_tributario: process.env.REGIME_TRIBUTARIO || '1', // 1 = Simples Nacional
    codigo_nbs: process.env.CODIGO_NBS || '122051900'
  }
};

