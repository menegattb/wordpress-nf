const { mapearPedidoParaNFSe, sanitizarPayloadNFSe } = require('./src/utils/mapeador'); // Adjust path if needed, assuming running from root
const logger = require('./src/services/logger');

// Mock logger to avoid cluttering or errors
logger.mapping = console.log;
logger.warn = console.warn;
logger.debug = console.debug;
logger.info = console.info;

// Mock dependencies if necessary... 
// Actually mapeador requires ../services/validator and ../services/cepService
// We might need to mock those if we can't load them directly.
// But let's try to run it. If it fails on require, I'll mock them.

async function test() {
    const pedido = {
        pedido_id: 'TEST-123',
        data_emissao: '2025-12-20',
        valor_total: 100.00,
        servicos: [
            {
                nome: 'Serviço Teste',
                subtotal: 100.00,
                discriminacao: 'Serviço Teste'
            }
        ],
        endereco: {
            cep: '51030420', // Example CEP
            rua: 'Rua Teste',
            numero: '123',
            bairro: 'Boa Viagem',
            cidade: 'Recife',
            estado: 'PE'
        },
        cpf_cnpj: '00000000000', // Need valid CPF for validator mock or use real one? 
        // 00039809013 from user example
        razao_social: 'Cliente Teste'
    };
    pedido.cpf_cnpj = '04320651561'; // Use the one from the success XML to pass validation

    const configEmitente = {
        cnpj: '51581345000117',
        codigo_municipio: '2607208', // Ipojuca
        inscricao_municipal: '0323926',
        optante_simples_nacional: true
    };

    const configFiscal = {
        aliquota: 0.02, // Test decimal conversion
        item_lista_servico: '8.02'
    };

    try {
        console.log('--- Testing Mapping ---');
        // We need to mock cepService because it makes network calls or DB lookups
        // We can override the require cache or just hope it works? 
        // It's better to just mock the function if we could.
        // Since we are running a script, we can't easily mock inner requires without a library like proxyquire.
        // But let's see if we can just run it. The cepService might fail.

        // Actually, let's just modify the sanitizar function first, because that is a pure logic fix we can see by inspection.
        // But running the code helps verify the aliquota.

        const result = await mapearPedidoParaNFSe(pedido, configEmitente, configFiscal);
        console.log('Result Aliquota:', result.servico.aliquota);
        console.log('Result BaseCalculo:', result.servico.base_calculo);
        console.log('Result ValorIss:', result.servico.valor_iss);
        console.log('Result Keys:', Object.keys(result.servico));

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
