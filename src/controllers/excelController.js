const sheetsService = require('../services/googleSheets');
const woocommerceService = require('../services/woocommerce');
const nfseController = require('./nfseController'); // Reutilizar lógica de emissão se possível
const logger = require('../services/logger');

// Função auxiliar para mapear pedido da planilha para o formato esperado pelo emitirNFSe
function mapSheetToEmission(sheetRow) {
    if (!sheetRow.json_pedido) {
        throw new Error('Dados brutos do pedido não encontrados na planilha.');
    }
    return sheetRow.json_pedido;
}

const excelController = {
    // Listar pedidos da planilha
    async listar(req, res) {
        try {
            const pedidos = await sheetsService.getPedidos();
            // Filtrar pedidos com valor 0
            const pedidosFiltrados = pedidos.filter(p => {
                const valor = parseFloat(p.valor && typeof p.valor === 'string'
                    ? p.valor.replace('R$', '').replace('.', '').replace(',', '.')
                    : p.valor);
                return valor > 0;
            }).sort((a, b) => {
                // Função auxiliar para converter data em timestamp (ignorando horas)
                const getTimestamp = (dt) => {
                    if (!dt) return 0;
                    const str = String(dt).trim();

                    let dia, mes, ano;

                    // Formato DD/MM/YYYY
                    const matchBR = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

                    // Formato Corrompido: 01T11:14:34/12/2025 (DD T HH:MM:SS / MM / YYYY)
                    const matchCorrupt = str.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})/);

                    if (matchBR) {
                        [, dia, mes, ano] = matchBR;
                    }
                    else if (matchCorrupt) {
                        [, dia, mes, ano] = matchCorrupt;
                    }
                    else {
                        // Formato ISO YYYY-MM-DD (pega os primeiros 10 chars)
                        const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                        if (matchISO) {
                            [, ano, mes, dia] = matchISO;
                        }
                    }

                    if (dia && mes && ano) {
                        // Criar data UTC meio-dia para evitar problemas de timezone
                        return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)).getTime();
                    }

                    return 0;
                };

                const timeA = getTimestamp(a.data);
                const timeB = getTimestamp(b.data);

                // Ordenar por data decrescente (mais recente primeiro)
                return timeB - timeA;
            });
            res.json({ sucesso: true, dados: pedidosFiltrados });
        } catch (error) {
            logger.error('Erro ao listar pedidos do Excel', { error: error.message });
            res.status(500).json({ sucesso: false, erro: error.message });
        }
    },

    // Sincronizar WooCommerce -> Planilha
    async sincronizar(req, res) {
        try {
            const { dias } = req.body;
            let pedidosWoo = [];

            // Usar função de busca do serviço existente
            const { buscarPedidos } = require('../services/woocommerce');

            // Se dias for um número, usa o filtro de data. Se for 'todos', busca tudo.
            // Para simplificar, o frontend vai mandar um número grande ou 'todos'.
            // Vamos implementar loop de paginação para garantir que pegue tudo.

            const params = {
                per_page: 100, // Máximo permitido
                page: 1,
                tatus: 'completed' // Já filtrar no Woo se possível, mas a API padrão pode não aceitar 'status' filtro dependendo da versão, vamos manter filtro manual por segurança ou testar.
                // A função buscarPedidos aceita filtros e passa params.
            };

            if (dias && dias !== 'todos' && !isNaN(dias)) {
                const afterDate = new Date();
                afterDate.setDate(afterDate.getDate() - parseInt(dias));
                params.after = afterDate.toISOString();
                logger.info(`Iniciando busca sincronizada. Dias: ${dias}, After: ${params.after}`);
            } else {
                logger.info(`Iniciando busca completa (todas as páginas).`);
            }

            let page = 1;
            let hasMore = true;

            while (hasMore) {
                params.page = page;
                logger.info(`Buscando página ${page} do WooCommerce...`);

                const resposta = await buscarPedidos(params);
                const novosPedidos = resposta.pedidos || [];

                if (novosPedidos.length === 0) {
                    hasMore = false;
                } else {
                    pedidosWoo = pedidosWoo.concat(novosPedidos);

                    // Se a API retornou total_pages, podemos usar. Ou apenas verificar se retornou menos que o per_page.
                    // buscarPedidos retorna total_pages
                    if (page >= (resposta.total_pages || 1)) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                }
            }

            logger.info(`Total recuperado do Woo: ${pedidosWoo.length} pedidos. Iniciando processamento...`);

            const resultados = { inseridos: 0, atualizados: 0, erros: 0, ignorados: 0 };

            // Mapear usando o mapeador existente para garantir formato correto
            const { mapearWooCommerceParaPedido } = require('../utils/mapeador');

            const pedidosParaProcessar = [];

            for (const p of pedidosWoo) {
                try {
                    // Filtro: Apenas pedidos concluídos
                    if (p.status !== 'completed') {
                        continue;
                    }

                    // Filtro: "Livro Faíscas"
                    const categoriasProibidas = ['livro faíscas', 'livro faiscas', 'livros faíscas', 'livros faiscas'];
                    const temLivroFaiscas = (p.line_items || []).some(item => {
                        const nomeItem = (item.name || '').toLowerCase();
                        if (categoriasProibidas.some(cat => nomeItem.includes(cat))) return true;

                        if (item.categories && Array.isArray(item.categories)) {
                            return item.categories.some(cat => {
                                const nomeCat = (cat.name || cat || '').toLowerCase();
                                return categoriasProibidas.some(proibida => nomeCat.includes(proibida));
                            });
                        }
                        return false;
                    });

                    if (temLivroFaiscas) {
                        resultados.ignorados++;
                        continue;
                    }

                    const pedidoMapeado = mapearWooCommerceParaPedido(p);
                    pedidosParaProcessar.push(pedidoMapeado);

                } catch (err) {
                    logger.error(`Erro ao mapear pedido ${p.id}`, { error: err.message });
                    resultados.erros++;
                }
            }

            // Processar em LOTE
            if (pedidosParaProcessar.length > 0) {
                try {
                    logger.info(`Enviando lote de ${pedidosParaProcessar.length} pedidos para o Sheets...`);
                    const resultadoLote = await sheetsService.upsertPedidosLote(pedidosParaProcessar);
                    resultados.inseridos += resultadoLote.inseridos;
                    resultados.atualizados += resultadoLote.atualizados;
                } catch (err) {
                    logger.error('Erro crítico no lote do Sheets', { error: err.message });
                    resultados.erros += pedidosParaProcessar.length;
                }
            }

            logger.info('Resumo sincronização:', resultados);
            res.json({ sucesso: true, resumo: resultados });

        } catch (error) {
            logger.error('Erro na sincronização Excel', { error: error.message });
            res.status(500).json({ sucesso: false, erro: error.message });
        }
    },

    // Emitir nota a partir de uma linha da planilha
    async emitir(req, res) {
        const { pedido_id } = req.body;

        try {
            // 1. Buscar dados na planilha
            const pedidos = await sheetsService.getPedidos();
            const pedidoSheet = pedidos.find(p => p.id == pedido_id);

            if (!pedidoSheet) {
                return res.status(404).json({ sucesso: false, erro: 'Pedido não encontrado na planilha' });
            }

            logger.info(`Iniciando emissão para pedido ${pedido_id}. Dados planilha:`, {
                id: pedidoSheet.id,
                cliente: pedidoSheet.cliente,
                cpf_cnpj_sheet: pedidoSheet.cpf_cnpj,
                tem_json: !!pedidoSheet.json_pedido
            });

            // 2. Preparar payload
            // Reutilizar controller existente é complicado pois ele espera req/res
            // Melhor chamar a função de serviço/negócio diretamente
            // Mas a lógica de emissão está acoplada no Controller.
            // Vamos instanciar os dados e chamar a função interna se extrairmos,
            // ou simular a chamada. Por segurança, vamos reutilizar a lógica copiando-a ou
            // refatorando nfseController. Para MVP, vamos importar focusNFe.

            const focusNFe = require('../services/focusNFSe');
            const { mapearPedidoParaNFSe } = require('../utils/mapeador');
            const config = require('../../config');

            const configEmitente = config.emitente;
            const configFiscal = config.fiscal;

            // 3. Atualizar status para "Processando"
            await sheetsService.atualizarStatusNota(pedido_id, 'Processando...');

            const dadosPedido = pedidoSheet.json_pedido || {};

            // Garantir CPF/CNPJ da coluna se não estiver no JSON
            if (!dadosPedido.cpf_cnpj && pedidoSheet.cpf_cnpj) {
                logger.info(`CPF/CNPJ ausente no JSON, usando da planilha: ${pedidoSheet.cpf_cnpj}`);
                dadosPedido.cpf_cnpj = pedidoSheet.cpf_cnpj;
            }
            // Garantir nome
            if ((!dadosPedido.nome && !dadosPedido.razao_social) && pedidoSheet.cliente) {
                dadosPedido.nome = pedidoSheet.cliente;
                dadosPedido.razao_social = pedidoSheet.cliente;
            }

            logger.info('Dados finais para mapeamento:', {
                cpf_cnpj_final: dadosPedido.cpf_cnpj,
                nome_final: dadosPedido.nome || dadosPedido.razao_social
            });
            // 3. Validar payload (opcional, apenas para garantir log de erro claro antes)
            try {
                // Normalização final de CPF/CNPJ antes do mapeamento
                if (!dadosPedido.cpf_cnpj) {
                    // Tentar encontrar em outros campos comuns
                    dadosPedido.cpf_cnpj = dadosPedido.cpf || dadosPedido.cnpj || pedidoSheet.cpf_cnpj || '';
                }

                // Garantir string e limpar espaços
                if (dadosPedido.cpf_cnpj && typeof dadosPedido.cpf_cnpj === 'string') {
                    dadosPedido.cpf_cnpj = dadosPedido.cpf_cnpj.trim();
                }

                await mapearPedidoParaNFSe(dadosPedido, configEmitente, configFiscal);
            } catch (errMap) {
                logger.error(`Erro na validação pré-emissão pedido ${dadosPedido.pedido_id}: ${errMap.message}`);
                throw errMap;
            }

            // 4. Enviar para Focus (passando dados BRUTOS enriquecidos, pois o service faz o mapeamento internamente)
            const resultado = await focusNFe.emitirNFSe(dadosPedido, configEmitente, configFiscal); // Isso retorna a resposta da Focus

            // 5. Atualizar planilha com resultado
            // 5. Atualizar planilha com resultado
            // Se chegou aqui, a API retornou sucesso (não lançou exceção). 
            // Mesmo que o status não seja 'autorizado' imediato, a nota foi enviada.
            const statusSheet = (resultado.status === 'autorizado') ? 'Autorizada' : 'Processando...';

            await sheetsService.atualizarStatusNota(
                pedido_id,
                statusSheet,
                resultado.numero || '',
                resultado.url_danfe || resultado.caminho_xml_nota_fiscal || '',
                '' // Limpar erros anteriores
            );

            res.json({
                sucesso: true,
                status: resultado.status || 'enviado',
                numero: resultado.numero || '',
                link_pdf: resultado.url_danfe || resultado.caminho_xml_nota_fiscal || ''
            });

        } catch (error) {
            logger.error('Erro na emissão Excel', { error: error.message });

            // Tentar salvar erro na planilha
            try {
                await sheetsService.atualizarStatusNota(pedido_id, 'Erro', '', '', error.message);
            } catch (e) { console.error('Falha ao registrar erro na planilha', e); }

            res.status(500).json({ sucesso: false, erro: error.message });
        }
    },

    // Importar Nubank (Mensal)
    async importarNubank(req, res) {
        try {
            const { mes, ano } = req.body;
            if (!mes || !ano) {
                return res.status(400).json({ sucesso: false, erro: 'Mês e Ano são obrigatórios' });
            }

            const nomeAba = `${mes}-${ano}-Nubank`; // Ex: Novembro-2025-Nubank
            logger.info(`Iniciando importação Nubank da aba: ${nomeAba}`);

            const linhas = await sheetsService.lerAba(nomeAba);
            if (!linhas || linhas.length === 0) {
                return res.status(404).json({ sucesso: false, erro: `Aba '${nomeAba}' não encontrada ou vazia.` });
            }

            // Ignorar header (linha 1) se houver
            // Assumimos que a primeira linha é header se tiver texto como "Data", "Nome"
            // Ignorar header (linha 1) se houver
            // Verifica se a primeira linha tem "Data" (col 1), "Cliente" (col 2) ou "ID" (col 0)
            const temHeader = linhas.length > 0 && (
                linhas[0][1]?.toLowerCase().includes('data') ||
                linhas[0][2]?.toLowerCase().includes('cliente') ||
                linhas[0][0]?.toLowerCase().includes('id')
            );

            const dadosBrutos = temHeader ? linhas.slice(1) : linhas;

            const pedidosNubank = [];
            const timestamp = Date.now();

            dadosBrutos.forEach((row, index) => {
                // Mapeamento Colunas NOVO (Baseado na imagem enviada)
                // Col A(0): ID (Ignorar)
                // Col B(1): Data
                // Col C(2): Cliente/Nome
                // Col D(3): CPF/CNPJ
                // Col E(4): Email
                // Col F(5): Serviço
                // Col G(6): Valor

                // Verificação básica: precisa ter Data (obrigatório)
                if (!row[1]) return;

                // Parse Data (Coluna B=1)
                let dataIso = '';
                try {
                    const dataStr = row[1] ? String(row[1]).trim() : '';
                    if (dataStr.includes('/')) {
                        const parts = dataStr.split('/');
                        if (parts.length === 3) {
                            // Tratar ano que pode vir com hora (ex: 2025 10:00:00)
                            const anoPart = parts[2].split(' ')[0];
                            dataIso = `${anoPart}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
                        }
                    } else {
                        // Tentar iso direto ou formatado YYYY-MM-DD
                        dataIso = dataStr.split(' ')[0];
                    }
                } catch (e) { }

                // Parse Valor (Coluna G=6)
                let valor = 0;
                if (row[6]) {
                    // Remover R$, pontos de milhar e trocar virgula por ponto
                    let v = row[6].toString().replace('R$', '').trim();
                    v = v.replace(/\./g, '');
                    v = v.replace(',', '.');
                    valor = parseFloat(v) || 0;
                }

                // ID Único
                const pedidoId = `NBK-${timestamp}-${index + 1}`;

                // Construir Objeto Pedido
                // Se não tiver nome, usar CPF como identificação ou nome padrão
                const nomeCliente = row[2] || row[3] || 'Cliente Nubank';
                
                const pedido = {
                    pedido_id: pedidoId,
                    data_pedido: dataIso,
                    data_emissao: dataIso,
                    nome: nomeCliente,
                    razao_social: nomeCliente,
                    cpf_cnpj: row[3] || '',
                    email: row[4] || '',
                    valor_total: valor,
                    valor_servicos: valor,
                    status_wc: 'completed',
                    origem: 'nubank',
                    servicos: [{
                        nome: row[5] || 'Serviço Prestado', // Coluna 5
                        discriminacao: row[5] || 'Serviço Prestado',
                        valor_unitario: valor,
                        quantidade: 1
                    }]
                };

                pedidosNubank.push(pedido);
            });

            if (pedidosNubank.length > 0) {
                const resultado = await sheetsService.upsertPedidosLote(pedidosNubank);
                res.json({
                    sucesso: true,
                    resumo: {
                        lidos: dadosBrutos.length,
                        processados: pedidosNubank.length,
                        inseridos: resultado.inseridos,
                        atualizados: resultado.atualizados
                    }
                });
            } else {
                res.json({ sucesso: true, resumo: { lidos: 0, processados: 0, inseridos: 0, atualizados: 0 } });
            }

        } catch (error) {
            logger.error('Erro na importação Nubank', { error: error.message });
            res.status(500).json({ sucesso: false, erro: error.message });
        }
    }
    ,

    // Remover Nubank (Mensal)
    async removerNubank(req, res) {
        try {
            const { mes, ano } = req.body;
            if (!mes || !ano) {
                return res.status(400).json({ sucesso: false, erro: 'Mês e Ano são obrigatórios' });
            }

            logger.info(`Removendo Nubank para ${mes}/${ano}`);
            const resultado = await sheetsService.removerPedidosNubank(mes, ano);

            res.json({
                sucesso: true,
                mensagem: `${resultado.removidos} pedidos removidos com sucesso.`,
                removidos: resultado.removidos
            });

        } catch (error) {
            logger.error('Erro ao remover Nubank', { error: error.message });
            res.status(500).json({ sucesso: false, erro: error.message });
        }
    },
    async cancelar(req, res) {
        const { pedido_id, justificativa, referencia: referenciaExplieta } = req.body;

        try {
            if (!pedido_id) {
                return res.status(400).json({ sucesso: false, erro: 'ID do pedido é obrigatório' });
            }

            if (!justificativa || justificativa.length < 15) {
                return res.status(400).json({ sucesso: false, erro: 'Justificativa deve ter pelo menos 15 caracteres' });
            }

            logger.info('Iniciando cancelamento de NFSe', { pedido_id, justificativa, referencia_explicita: referenciaExplieta });

            let referencia = referenciaExplieta;

            // Se não foi passada referência, buscar no banco
            if (!referencia) {
                // 1. Buscar referência da nota no banco de dados
                const nfse = await database.buscarNFSePorPedidoId(pedido_id);
                referencia = nfse ? nfse.referencia : null;
            }

            // Se ainda não tem referência (nem no banco nem explícita), tentar referência padrão
            if (!referencia) {
                logger.warn('NFSe não encontrada no banco para cancelamento, tentando referência padrão', { pedido_id });
                referencia = `PED-${pedido_id}`;
            }

            // 2. Chamar serviço de cancelamento da Focus
            const focusNFSe = require('../services/focusNFSe');
            const resultado = await focusNFSe.cancelarNFSe(referencia, justificativa);

            if (!resultado.sucesso) {
                const erroMsg = resultado.erro?.mensagem || '';
                const isLimitacaoMunicipio = erroMsg.includes('Município não possui o serviço de cancelamento');

                if (isLimitacaoMunicipio) {
                    logger.warn('Limitação municipal detectada: cancelamento via API não suportado.', { pedido_id });

                    // Atualizar planilha com status diferenciado
                    const pedidos = await sheetsService.getPedidos();
                    const pedidoSheet = pedidos.find(p => p.id == pedido_id);

                    if (pedidoSheet) {
                        await sheetsService.atualizarStatusNota(
                            pedido_id,
                            'Cancelamento Manual Necessário', // Status especial
                            pedidoSheet.numero_nota || '',
                            pedidoSheet.link_pdf || '',
                            'Município não aceita cancelamento via API. Cancele no site da prefeitura.'
                        );
                    }

                    return res.json({
                        sucesso: true,
                        mensagem: 'O município de Ipojuca não permite cancelamento via API. A nota foi marcada como "Cancelamento Manual Necessário" na planilha. Por favor, realize o cancelamento no portal da prefeitura.',
                        aviso: true
                    });
                }

                logger.error('Falha ao cancelar NFSe na Focus api', { resultado });
                throw new Error(JSON.stringify(resultado.erro || 'Erro desconhecido na API Focus'));
            }

            // 3. Atualizar status na planilha (Sucesso normal)
            // Nota: O método cancelarNFSe já atualiza o banco de dados via webhook/polling normalmente,
            // mas aqui garantimos que a planilha seja atualizada imediatamente com o status de solicitação.

            // Buscar linha na planilha para garantir que existe
            const pedidos = await sheetsService.getPedidos();
            const pedidoSheet = pedidos.find(p => p.id == pedido_id);

            if (pedidoSheet) {
                await sheetsService.atualizarStatusNota(
                    pedido_id,
                    'Cancelamento Solicitado',
                    pedidoSheet.numero_nota || '',
                    pedidoSheet.link_pdf || '',
                    ''
                );
            }

            res.json({
                sucesso: true,
                mensagem: 'Solicitação de cancelamento enviada com sucesso'
            });

        } catch (error) {
            logger.error('Erro ao cancelar NFSe:', { error: error.message, pedido_id });

            // Tentar registrar erro na planilha
            try {
                const pedidos = await sheetsService.getPedidos();
                const pedidoSheet = pedidos.find(p => p.id == pedido_id);
                if (pedidoSheet) {
                    await sheetsService.atualizarStatusNota(
                        pedido_id,
                        pedidoSheet.status_nota, // Manter status anterior
                        pedidoSheet.numero_nota || '',
                        pedidoSheet.link_pdf || '',
                        `Erro ao cancelar: ${error.message}`
                    );
                }
            } catch (e) {
                logger.error('Erro ao atualizar planilha com erro de cancelamento:', e);
            }

            res.status(500).json({
                sucesso: false,
                erro: error.message || 'Erro ao processar cancelamento'
            });
        }
    },

    // Verificar e atualizar status da nota manualmente
    async atualizarStatus(req, res) {
        const { pedido_id } = req.params;

        try {
            logger.info(`Verificando status manual para pedido ${pedido_id}`);

            // 1. Buscar dados na planilha para obter a referência
            const pedidos = await sheetsService.getPedidos();
            const pedidoSheet = pedidos.find(p => p.id == pedido_id);

            if (!pedidoSheet) {
                return res.status(404).json({ sucesso: false, erro: 'Pedido não encontrado na planilha' });
            }

            // Construir referência (mesma lógica do emitir)
            // Se foi emitido em produção, a referência é fixa: NFSE-{pedido_id}
            // Em homologação, poderia ter timestamp, mas vamos tentar a padrão primeiro.
            let referencia = `NFSE-${pedido_id}`;

            // Importar serviço
            const focusNFe = require('../services/focusNFSe');

            // Consultar na Focus
            const resultado = await focusNFe.consultarNFSe(referencia);

            if (!resultado.sucesso && resultado.erro && resultado.erro.codigo === 'nao_encontrado') {
                return res.status(404).json({ sucesso: false, erro: 'Nota não encontrada na Focus NFe com a referência: ' + referencia });
            }

            if (!resultado.sucesso) {
                return res.status(400).json({ sucesso: false, erro: resultado.erro });
            }

            // Atualizar planilha
            const statusSheet = (resultado.status === 'autorizado') ? 'Autorizada' :
                (resultado.status === 'cancelado') ? 'Cancelada' :
                    (resultado.status === 'erro_autorizacao') ? 'Erro' : 'Processando...';

            await sheetsService.atualizarStatusNota(
                pedido_id,
                statusSheet,
                resultado.numero || '',
                resultado.caminho_pdf || resultado.url_danfe || '',
                resultado.mensagem_sefaz || ''
            );

            res.json({
                sucesso: true,
                status: resultado.status,
                status_sheet: statusSheet,
                numero: resultado.numero,
                link_pdf: resultado.caminho_pdf || resultado.url_danfe
            });

        } catch (error) {
            logger.error(`Erro ao atualizar status do pedido ${pedido_id}`, { error: error.message });
            res.status(500).json({ sucesso: false, erro: error.message });
        }
    }
};

module.exports = excelController;
