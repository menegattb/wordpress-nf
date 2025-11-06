require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./src/services/logger');

// Importar rotas
const webhookRoutes = require('./src/routes/webhook');
const nfseRoutes = require('./src/routes/nfse');
const pedidoRoutes = require('./src/routes/pedidos');
const woocommerceRoutes = require('./src/routes/woocommerce');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
  // Log no console para debug
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    ip: req.ip,
    query: req.query,
    body: req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) : undefined
  });
  
  logger.info(`${req.method} ${req.path}`, {
    service: 'server',
    action: 'request',
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Rotas
app.use('/api/webhook', webhookRoutes);
app.use('/api/nfse', nfseRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/woocommerce', woocommerceRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ambiente: process.env.FOCUS_NFE_AMBIENTE || 'homologacao',
    timestamp: new Date().toISOString()
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    nome: 'WordPress NF - API de Emissão de NFSe',
    versao: '1.0.0',
    rotas: {
      webhook: '/api/webhook/woocommerce',
      nfse: '/api/nfse',
      pedidos: '/api/pedidos',
      woocommerce: '/api/woocommerce'
    }
  });
});

// Middleware de erro
app.use((err, req, res, next) => {
  logger.error('Erro no servidor', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    erro: err.message || 'Erro interno do servidor'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

// Executar migrations na inicialização (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  const { migrate } = require('./src/config/database');
  migrate().catch(err => {
    // Não é crítico se não houver banco configurado
    if (!err.message.includes('missing_connection_string')) {
      logger.error('Erro ao executar migrations', { error: err.message });
    }
  });
}

app.listen(PORT, () => {
  logger.info(`Servidor iniciado na porta ${PORT}`, {
    service: 'server',
    action: 'startup',
    port: PORT,
    ambiente: process.env.FOCUS_NFE_AMBIENTE || 'homologacao'
  });
  
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.FOCUS_NFE_AMBIENTE || 'homologacao'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 Webhook: http://localhost:${PORT}/api/webhook/woocommerce`);
  console.log(`🧾 API NFSe: http://localhost:${PORT}/api/nfse\n`);
});

module.exports = app;

