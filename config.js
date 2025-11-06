require('dotenv').config();

module.exports = {
  focusNFe: {
    baseUrl: process.env.FOCUS_NFE_AMBIENTE === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br',
    token: process.env.FOCUS_NFE_AMBIENTE === 'producao'
      ? process.env.FOCUS_NFE_TOKEN_PRODUCAO
      : (process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA'),
    ambiente: process.env.FOCUS_NFE_AMBIENTE || 'homologacao',
    cnpj: process.env.FOCUS_NFE_CNPJ || '51581345000117'
  },
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  webhook: {
    secret: process.env.WOOCOMMERCE_WEBHOOK_SECRET || ''
  },
  woocommerce: {
    url: process.env.WOOCOMMERCE_URL || 'https://meditandojunto.com',
    apiUrl: process.env.WOOCOMMERCE_API_URL || 'https://meditandojunto.com/wp-json/wc/v3',
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || 'ck_65ddd6aac5d176eef45ab47c031410b95e57f163',
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || 'cs_7f4c98b0ef10421de9774ee3410981a8f9308839'
  },
  emitente: {
    cnpj: process.env.PRESTADOR_CNPJ || process.env.FOCUS_NFE_CNPJ || '51581345000117',
    inscricao_municipal: process.env.PRESTADOR_IM || process.env.EMITENTE_INSCRICAO_MUNICIPAL || '032.392-6',
    razao_social: process.env.PRESTADOR_RAZAO || 'Lungta Psicoterapia Ltda',
    codigo_municipio: process.env.PRESTADOR_MUNICIPIO || process.env.EMITENTE_CODIGO_MUNICIPIO || '2607208',
    email: process.env.PRESTADOR_EMAIL || '',
    telefone: process.env.PRESTADOR_TELEFONE || '',
    optante_simples_nacional: process.env.EMITENTE_SIMPLES_NACIONAL !== 'false'
  },
  fiscal: {
    item_lista_servico: process.env.ITEM_LISTA_SERVICO || '70101', // Removido zero à esquerda (5 caracteres)
    codigo_tributario_municipio: process.env.CODIGO_TRIBUTARIO_MUNICIPIO || '101',
    aliquota: parseFloat(process.env.ALIQUOTA || '3'),
    tomador_municipio: process.env.TOMADOR_MUNICIPIO || process.env.PRESTADOR_MUNICIPIO || '2607208'
  }
};

