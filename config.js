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
    optante_simples_nacional: process.env.EMITENTE_SIMPLES_NACIONAL !== 'false',
    // Campos adicionais para NFe
    nome_fantasia: process.env.EMITENTE_NOME_FANTASIA || process.env.PRESTADOR_RAZAO || 'Lungta Psicoterapia',
    logradouro: process.env.EMITENTE_LOGRADOURO || '',
    numero: process.env.EMITENTE_NUMERO || '',
    bairro: process.env.EMITENTE_BAIRRO || '',
    municipio: process.env.EMITENTE_MUNICIPIO || 'Ipojuca',
    uf: process.env.EMITENTE_UF || 'PE',
    cep: process.env.EMITENTE_CEP || '',
    inscricao_estadual: process.env.EMITENTE_INSCRICAO_ESTADUAL || '128257946'
  },
  fiscal: {
    item_lista_servico: process.env.ITEM_LISTA_SERVICO || '8.02', // Formato correto para Ipojuca/PE: "8.02" (com ponto)
    codigo_tributario_municipio: process.env.CODIGO_TRIBUTARIO_MUNICIPIO || '802', // Código correto para Ipojuca/PE
    aliquota: parseFloat(process.env.ALIQUOTA || '0.02'), // 2% = 0.02 (decimal), não 3 ou "2%"
    tomador_municipio: process.env.TOMADOR_MUNICIPIO || process.env.PRESTADOR_MUNICIPIO || '2607208',
    // Configurações para NFe (produto)
    cfop_padrao: process.env.CFOP_PADRAO || '5102', // CFOP padrão para venda de produto
    ncm_padrao: process.env.NCM_PADRAO || '49019900', // NCM padrão (livros, impressos, etc)
    icms_situacao_tributaria: process.env.ICMS_SITUACAO_TRIBUTARIA || '0300', // 0300 = Imune (Simples Nacional)
    icms_origem: process.env.ICMS_ORIGEM || '0', // 0 = Nacional
    pis_situacao_tributaria: process.env.PIS_SITUACAO_TRIBUTARIA || '07', // 07 = Isenta
    cofins_situacao_tributaria: process.env.COFINS_SITUACAO_TRIBUTARIA || '07', // 07 = Isenta
    regime_tributario: process.env.REGIME_TRIBUTARIO || '1' // 1 = Simples Nacional
  }
};

