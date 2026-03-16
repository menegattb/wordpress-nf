const sheetsService = require('../services/googleSheets');
const woocommerceService = require('../services/woocommerce');
const nfseController = require('./nfseController'); // Reutilizar lógica de emissão se possível
const logger = require('../services/logger');
const { parseEndereco } = require('../utils/parseEndereco');
const { getConfigForTenant } = require('../services/tenantService');
const { verificarLimite, registrarEmissao } = require('../services/usageService');

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
            // Produtos excluídos da emissão para jan/fev/mar 2026
            const produtosExcluidos = [
                'perder-se-e-encontrar-se-na-danca-das-emocoes',
                'perder se e encontrar se na danca das emocoes',
                'danca das emocoes'
            ];
            const mesesExcluirProdutos = ['2026-01', '2026-02', '2026-03'];

            const parseDateStr = (dt) => {
                if (!dt) return null;
                const str = String(dt).trim();
                let dia, mes, ano;
                const matchBR = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
                const matchCorrupt = str.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})/);
                const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (matchBR) { [, dia, mes, ano] = matchBR; }
                else if (matchCorrupt) { [, dia, mes, ano] = matchCorrupt; }
                else if (matchISO) { [, ano, mes, dia] = matchISO; }
                return (ano && mes) ? `${ano}-${mes}` : null;
            };

            const normalizarTexto = (t) => (t || '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();

            const pedidosFiltrados = pedidos.filter(p => {
                const valor = parseFloat(p.valor && typeof p.valor === 'string'
                    ? p.valor.replace('R$', '').replace('.', '').replace(',', '.')
                    : p.valor);
                if (valor <= 0) return false;

                const mesAno = parseDateStr(p.data);
                if (!mesAno || !mesesExcluirProdutos.includes(mesAno)) return true;

                // Para jan/fev/mar 2026: excluir produtos específicos
                const servicoNorm = normalizarTexto(p.servico);
                if (produtosExcluidos.some(exc => servicoNorm.includes(normalizarTexto(exc)))) return false;

                let dados = {};
                if (p.json_pedido && typeof p.json_pedido === 'object') dados = p.json_pedido;
                else if (typeof p.json_pedido === 'string') { try { dados = JSON.parse(p.json_pedido); } catch(e) {} }

                if (dados.servicos && Array.isArray(dados.servicos)) {
                    for (const s of dados.servicos) {
                        const nome = normalizarTexto(s.nome || s.discriminacao || '');
                        if (produtosExcluidos.some(exc => nome.includes(normalizarTexto(exc)))) return false;
                    }
                }

                return true;
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
            const tenantId = req.tenant_id || null;
            const cfg = tenantId ? await getConfigForTenant(tenantId) : null;
            const credentials = tenantId && cfg?.woocommerce?.apiUrl ? cfg.woocommerce : null;

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

                const resposta = await buscarPedidos(params, credentials);
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

                    // Filtro: categorias que não geram nota
                    const categoriasProibidas = [
                        'livro faíscas', 'livro faiscas', 'livros faíscas', 'livros faiscas',
                        'presencial sem nota'
                    ];
                    const temCategoriaProibida = (p.line_items || []).some(item => {
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

                    if (temCategoriaProibida) {
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
            const tenantId = req.tenant_id || null;
            const cfg = tenantId ? await getConfigForTenant(tenantId) : config;
            const configEmitente = cfg.emitente;
            const configFiscal = cfg.fiscal;
            const configFocus = tenantId && cfg.focusNFe ? { token: cfg.focusNFe.token, ambiente: cfg.focusNFe.ambiente } : null;

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

            // 2.5 Verificar limite de notas
            const limiteCheck = await verificarLimite(tenantId);
            if (!limiteCheck.pode) {
                return res.status(402).json({
                    sucesso: false,
                    erro: 'limite_atingido',
                    mensagem: limiteCheck.mensagem,
                    usado: limiteCheck.usado,
                    limite: limiteCheck.limite,
                    upgrade_url: (process.env.APP_URL || '').replace(/\/$/, '') + '/landing'
                });
            }

            // 4. Tentar emitir — se falhar por ref já usada, gerar nova ref e tentar de novo
            let resultado;
            try {
                resultado = await focusNFe.emitirNFSe(dadosPedido, configEmitente, configFiscal, 'servico', configFocus);
            } catch (primeiroErro) {
                const msg = (primeiroErro.message || '').toLowerCase();
                const refConflito = msg.includes('already') || msg.includes('já foi') ||
                    msg.includes('referência') || msg.includes('ref') ||
                    msg.includes('422') || msg.includes('conflito');

                if (refConflito || !resultado) {
                    const sufixo = Date.now().toString(36);
                    dadosPedido.referencia = `NFSE-${pedido_id}-R${sufixo}`;
                    logger.info('Ref já usada, tentando com nova referência', {
                        pedido_id,
                        erro_original: primeiroErro.message,
                        nova_referencia: dadosPedido.referencia
                    });
                    resultado = await focusNFe.emitirNFSe(dadosPedido, configEmitente, configFiscal, 'servico', configFocus);
                } else {
                    throw primeiroErro;
                }
            }

            // Se resultado indica erro (sucesso=false), tentar com nova ref
            if (resultado && resultado.sucesso === false) {
                const sufixo = Date.now().toString(36);
                dadosPedido.referencia = `NFSE-${pedido_id}-R${sufixo}`;
                logger.info('Emissão falhou, retentando com nova referência', {
                    pedido_id,
                    erro: resultado.erro || resultado.mensagem_sefaz,
                    nova_referencia: dadosPedido.referencia
                });
                resultado = await focusNFe.emitirNFSe(dadosPedido, configEmitente, configFiscal, 'servico', configFocus);
            }

            // 4.5 Registrar emissão após sucesso
            if (resultado && resultado.sucesso) {
                await registrarEmissao(tenantId);
            }

            // 5. Atualizar planilha com resultado
            const statusSheet = (resultado.status === 'autorizado') ? 'Autorizada' : 'Processando...';

            await sheetsService.atualizarStatusNota(
                pedido_id,
                statusSheet,
                resultado.numero || '',
                resultado.url_danfe || resultado.caminho_xml_nota_fiscal || '',
                '',
                { force: true }
            );

            res.json({
                sucesso: true,
                status: resultado.status || 'enviado',
                numero: resultado.numero || '',
                link_pdf: resultado.url_danfe || resultado.caminho_xml_nota_fiscal || ''
            });

        } catch (error) {
            logger.error('Erro na emissão Excel', { error: error.message });

            try {
                await sheetsService.atualizarStatusNota(pedido_id, 'Erro', '', '', error.message, { force: true });
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
            const firstRowLower = (linhas[0] || []).map(c => (c || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
            const temHeader = linhas.length > 0 && firstRowLower.some(c =>
                c.includes('data') || c.includes('cliente') || c.includes('nome') ||
                c.includes('cpf') || c.includes('valor') || c.includes('email') ||
                c.includes('endere') || c === 'id' || c.includes('servic')
            );

            const dadosBrutos = temHeader ? linhas.slice(1) : linhas;

            logger.info(`Nubank: temHeader=${temHeader}, totalLinhas=${linhas.length}, dadosBrutos=${dadosBrutos.length}`);
            if (linhas.length > 0) {
                logger.info(`Nubank header (linha 0): ${JSON.stringify(linhas[0])}`);
            }
            if (dadosBrutos.length > 0) {
                logger.info(`Nubank primeira linha dados: ${JSON.stringify(dadosBrutos[0])}`);
            }

            // Detectar layout baseado no header
            const headerRow = temHeader ? linhas[0] : null;
            let layout7Colunas = false;

            if (headerRow) {
                const headers = headerRow.map(h => (h || '').toString().toLowerCase().trim());
                logger.info(`Nubank headers detectados: ${JSON.stringify(headers)}`);
                const enderecoIdx = headers.findIndex(h => h.includes('endere'));
                if (enderecoIdx >= 0) {
                    layout7Colunas = true;
                    logger.info(`Nubank: coluna Endereço encontrada no índice ${enderecoIdx}, layout 7 colunas`);
                }
            } else {
                const primeiraLinha = dadosBrutos.find(r => r[1]);
                const valorCol7 = primeiraLinha && primeiraLinha[7] != null ? String(primeiraLinha[7]).trim() : '';
                layout7Colunas = valorCol7 !== '' && /\d/.test(valorCol7);
            }

            logger.info(`Nubank: layout7Colunas=${layout7Colunas}`);

            const pedidosNubank = [];

            // Mapeamento mês nome -> número para ID estável
            const mesesMap = { 'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12' };
            const mesNum = mesesMap[mes.toLowerCase()] || '00';

            // Detectar mapeamento de colunas dinamicamente pelo header
            let colMap = { data: 1, cliente: 2, cpf: 3, endereco: -1, email: 4, servico: 5, valor: 6 };

            if (headerRow) {
                const headers = headerRow.map(h => (h || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
                const find = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                const iData = find(['data']);
                const iCliente = find(['cliente', 'nome']);
                const iCpf = find(['cpf', 'cnpj', 'documento']);
                const iEndereco = find(['endere']);
                const iEmail = find(['email', 'e-mail']);
                const iServico = find(['servic', 'descri']);
                const iValor = find(['valor', 'total', 'preco']);

                if (iData >= 0) colMap.data = iData;
                if (iCliente >= 0) colMap.cliente = iCliente;
                if (iCpf >= 0) colMap.cpf = iCpf;
                if (iEndereco >= 0) { colMap.endereco = iEndereco; layout7Colunas = true; }
                if (iEmail >= 0) colMap.email = iEmail;
                if (iServico >= 0) colMap.servico = iServico;
                if (iValor >= 0) colMap.valor = iValor;

                logger.info(`Nubank colMap detectado: ${JSON.stringify(colMap)}`);
            }

            dadosBrutos.forEach((row, index) => {
                if (!row[colMap.data] && !row[0]) return;

                const dataCell = row[colMap.data] || row[0] || '';

                // Log das 3 primeiras linhas
                if (index < 3) {
                    logger.info(`Nubank row[${index}]: ${JSON.stringify(row.slice(0, 10))}`);
                    logger.info(`  -> data=${dataCell}, cliente=${row[colMap.cliente]}, cpf=${row[colMap.cpf]}, valor=${row[colMap.valor]}`);
                }

                let dataIso = '';
                try {
                    const dataStr = String(dataCell).trim();
                    if (dataStr.includes('/')) {
                        const parts = dataStr.split('/');
                        if (parts.length === 3) {
                            const anoPart = parts[2].split(' ')[0];
                            dataIso = `${anoPart}-${parts[1]}-${parts[0]}`;
                        }
                    } else if (dataStr.includes('-')) {
                        dataIso = dataStr.split(' ')[0];
                    }
                } catch (e) { }

                let valor = 0;
                if (row[colMap.valor]) {
                    let v = row[colMap.valor].toString().replace('R$', '').trim();
                    v = v.replace(/\./g, '');
                    v = v.replace(',', '.');
                    valor = parseFloat(v) || 0;
                }

                // ID estável: reimportação atualiza em vez de duplicar
                const pedidoId = `NBK-${ano}${mesNum}-${index + 1}`;
                const nomeCliente = row[colMap.cliente] || row[colMap.cpf] || 'Cliente Nubank';

                const pedido = {
                    pedido_id: pedidoId,
                    data_pedido: dataIso,
                    data_emissao: dataIso,
                    nome: nomeCliente,
                    razao_social: nomeCliente,
                    cpf_cnpj: row[colMap.cpf] || '',
                    email: row[colMap.email] || '',
                    valor_total: valor,
                    valor_servicos: valor,
                    status_wc: 'completed',
                    origem: 'nubank',
                    servicos: [{
                        nome: row[colMap.servico] || 'Serviço Prestado',
                        discriminacao: row[colMap.servico] || 'Serviço Prestado',
                        valor_unitario: valor,
                        quantidade: 1
                    }]
                };

                if (layout7Colunas && colMap.endereco >= 0 && row[colMap.endereco] != null && String(row[colMap.endereco]).trim() !== '') {
                    pedido.endereco = parseEndereco(row[colMap.endereco]);
                }

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
                            'Cancelamento Manual Necessário',
                            pedidoSheet.numero_nota || '',
                            pedidoSheet.link_pdf || '',
                            'Município não aceita cancelamento via API. Cancele no site da prefeitura.',
                            { force: true }
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
                    '',
                    { force: true }
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
            logger.info(`Verificando status para pedido ${pedido_id}`);

            const focusNFe = require('../services/focusNFSe');

            // Tentar ref padrão e também refs com sufixo (reemissões)
            const refsParaTentar = [`NFSE-${pedido_id}`];

            // Buscar no banco local se há refs alternativas
            try {
                const db = require('../services/database');
                const nfses = await db.query(
                    'SELECT DISTINCT ref FROM nfse WHERE ref LIKE ? ORDER BY id DESC LIMIT 5',
                    [`NFSE-${pedido_id}%`]
                );
                if (nfses && nfses.length > 0) {
                    nfses.forEach(n => {
                        if (n.ref && !refsParaTentar.includes(n.ref)) refsParaTentar.push(n.ref);
                    });
                }
            } catch (e) { /* banco não disponível, seguir com ref padrão */ }

            let resultado = null;
            for (const ref of refsParaTentar) {
                try {
                    const r = await focusNFe.consultarNFSe(ref);
                    if (r.sucesso) {
                        resultado = r;
                        break;
                    }
                } catch (e) { /* tentar próxima ref */ }
            }

            if (!resultado || !resultado.sucesso) {
                return res.status(404).json({ sucesso: false, erro: `Nota não encontrada na Focus NFe (refs tentadas: ${refsParaTentar.join(', ')})` });
            }

            const statusSheet = (resultado.status === 'autorizado') ? 'Autorizada' :
                (resultado.status === 'cancelado') ? 'Cancelada' :
                    (resultado.status === 'erro_autorizacao') ? 'Erro' : 'Processando...';

            await sheetsService.atualizarStatusNota(
                pedido_id,
                statusSheet,
                resultado.numero || '',
                resultado.caminho_pdf || resultado.url_danfe || '',
                resultado.mensagem_sefaz || '',
                { force: true }
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
    },

    // Alterar status manualmente (com flag [M] para prioridade manual)
    async statusManual(req, res) {
        const { pedido_id, status } = req.body;

        if (!pedido_id || !status) {
            return res.status(400).json({ sucesso: false, erro: 'pedido_id e status são obrigatórios' });
        }

        const statusPermitidos = ['Pendente', 'Processando...', 'Autorizada', 'Cancelada', 'Erro'];
        if (!statusPermitidos.includes(status)) {
            return res.status(400).json({ sucesso: false, erro: `Status inválido. Permitidos: ${statusPermitidos.join(', ')}` });
        }

        try {
            // Salvar com prefixo [M] para indicar override manual
            const statusManual = `[M] ${status}`;
            await sheetsService.atualizarStatusNota(pedido_id, statusManual);
            logger.info('Status manual definido', { pedido_id, status: statusManual });
            res.json({ sucesso: true, status: statusManual });
        } catch (error) {
            logger.error('Erro ao definir status manual', { error: error.message, pedido_id });
            res.status(500).json({ sucesso: false, erro: error.message });
        }
    },

    // Atualizar endereço de um pedido
    async atualizarEndereco(req, res) {
        try {
            const { pedido_id } = req.params;
            const { endereco, nif, cpf_cnpj } = req.body;

            if (!endereco) {
                return res.status(400).json({
                    erro: 'Endereço é obrigatório'
                });
            }

            if (!pedido_id) {
                return res.status(400).json({
                    erro: 'ID do pedido é obrigatório'
                });
            }

            logger.info('Atualizando endereço de pedido do Excel', {
                pedido_id,
                cidade: endereco.cidade || endereco.nome_cidade_ext
            });

            const pedidoAtualizado = await sheetsService.atualizarEnderecoPedido(
                pedido_id,
                endereco,
                cpf_cnpj,
                nif
            );

            res.json({
                sucesso: true,
                pedido: pedidoAtualizado
            });

        } catch (error) {
            logger.error('Erro ao atualizar endereço do pedido do Excel', {
                error: error.message
            });

            res.status(500).json({
                erro: error.message
            });
        }
    }
};

module.exports = excelController;
