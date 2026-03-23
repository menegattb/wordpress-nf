require('dotenv').config();
const { processarLoteAsync } = require('../src/controllers/nfseController');
const logger = require('../src/services/logger');

async function test() {
  console.log('--- Iniciando Teste de Emissão Assíncrona (Simulação Local) ---');
  
  // pedido_ids, tipoNF, jobId, tenantId
  const pedidoIds = ['fake_123'];
  const tipoNF = 'produto';
  const jobId = 'test_job_' + Date.now();
  
  console.log(`Simulando Job: ${jobId} para tipo: ${tipoNF}`);
  
  try {
    // Nota: buscarPedidoWC vai falhar se não houver pedido real, 
    // mas queremos ver se o fluxo entra no loop e loga corretamente.
    await processarLoteAsync(pedidoIds, tipoNF, jobId, null);
    console.log('--- Fim da Simulação ---');
  } catch (error) {
    console.error('Erro no teste:', error);
  }
}

test();
