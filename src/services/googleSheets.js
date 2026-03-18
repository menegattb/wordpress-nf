const { google } = require('googleapis');
const logger = require('./logger');

class GoogleSheetsService {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        this.sheetName = 'Pedidos';
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            // Tentar carregar credenciais do banco de dados primeiro
            let credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
            let sheetsId = this.spreadsheetId || process.env.GOOGLE_SHEETS_ID;

            try {
                const { buscarConfiguracao } = require('../config/database');
                const dbId = await buscarConfiguracao('GOOGLE_SHEETS_ID');
                const dbCred = await buscarConfiguracao('GOOGLE_SHEETS_CREDENTIALS');
                if (dbId) sheetsId = dbId;
                if (dbCred) credentialsJson = dbCred;
            } catch (e) { /* db not available, use env */ }

            this.spreadsheetId = sheetsId;

            if (!credentialsJson || !this.spreadsheetId) {
                logger.warn('Credenciais do Google Sheets não configuradas');
                return;
            }

            const credentials = JSON.parse(credentialsJson);
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            const authClient = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: authClient });

            // Verificar e criar cabeçalhos se necessário
            await this.ensureHeaders();

            this.initialized = true;
            logger.info('Google Sheets Service inicializado com sucesso', { service: 'googleSheets' });
        } catch (error) {
            logger.error('Falha ao inicializar Google Sheets Service', { error: error.message });
            throw error;
        }
    }

    async ensureHeaders() {
        if (!this.sheets) return;

        const headers = [
            'ID Pedido', 'Data', 'Cliente', 'CPF/CNPJ', 'Email',
            'Serviço', 'Valor', 'Status Woo', 'Status Nota',
            'Número Nota', 'Link PDF', 'Mensagem Erro', 'JSON Pedido'
        ];

        try {
            // 1. Verificar se a aba existe
            const meta = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const sheetExists = meta.data.sheets.some(
                s => s.properties.title === this.sheetName
            );

            if (!sheetExists) {
                logger.info(`Aba '${this.sheetName}' não existe. Criando...`, { service: 'googleSheets' });
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    requestBody: {
                        requests: [{
                            addSheet: {
                                properties: { title: this.sheetName }
                            }
                        }]
                    }
                });
            }

            // 2. Verificar se já tem cabeçalhos
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1:M1`
            });

            const rows = res.data.values;
            if (!rows || rows.length === 0) {
                // Criar cabeçalhos
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A1:M1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [headers] }
                });
                logger.info('Cabeçalhos criados na planilha', { service: 'googleSheets' });
            }
        } catch (error) {
            logger.error('Erro ao verificar/criar aba e cabeçalhos', { error: error.message });
            // Se falhar aqui, as próximas chamadas darão erro de range
        }
    }

    async getPedidos(limiteLinhas = 1000) {
        await this.init();
        if (!this.sheets) return [];

        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A2:M`, // Buscar todas as linhas com dados
            });

            const rows = res.data.values || [];
            return rows.map((row, index) => ({
                rowIndex: index + 2, // +2 porque começa na linha 2 (1 é header)
                id: row[0],
                data: row[1],
                cliente: row[2],
                cpf_cnpj: row[3],
                email: row[4],
                servico: row[5],
                valor: row[6],
                status_woo: row[7],
                status_nota: row[8],
                numero_nota: row[9],
                link_pdf: row[10],
                mensagem_erro: row[11],
                json_pedido: row[12] ? JSON.parse(row[12]) : null
            }));
        } catch (error) {
            logger.error('Erro ao buscar pedidos do Sheets', { error: error.message });
            return [];
        }
    }

    /**
     * Lê todos os dados de uma aba específica
     * @param {string} nomeAba Nome da aba
     * @returns {Array<Array<string>>} Matriz de dados
     */
    async lerAba(nomeAba) {
        await this.init();
        if (!this.sheets) return [];

        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${nomeAba}!A:Z` // Ler colunas A a Z
            });
            return res.data.values || [];
        } catch (error) {
            logger.error(`Erro ao ler aba '${nomeAba}'`, { error: error.message });
            // Retorna vazio ou lança erro dependendo da preferência. Lançar ajuda debug.
            throw new Error(`Erro ao ler aba '${nomeAba}': ${error.message}`);
        }
    }

    // Processamento em LOTE para evitar Rate Limits (429)
    async upsertPedidosLote(pedidosNovos) {
        await this.init();
        if (!this.sheets || pedidosNovos.length === 0) return { inseridos: 0, atualizados: 0 };

        logger.info(`Iniciando upsert em lote para ${pedidosNovos.length} pedidos...`, { service: 'googleSheets' });

        try {
            // 1. Buscar APENAS IDs existentes para mapear (coluna A) - Leitura Otimizada
            // Assumindo que temos menos de 10k pedidos. Se tiver mais, teria que paginar ou buscar tudo mesmo.
            const resIds = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:A`
            });

            const rows = resIds.data.values || [];
            const mapIds = new Map(); // ID -> RowIndex

            // Mapear ID para Linha (ignora header linha 1)
            rows.forEach((row, idx) => {
                if (idx > 0 && row[0]) {
                    mapIds.set(String(row[0]), idx + 1); // Sheets é 1-based no índice visual, mas API A1 usa numero da linha
                }
            });

            const toAppend = [];
            const toUpdate = [];

            // 2. Separar quem insere e quem atualiza
            for (const pedido of pedidosNovos) {
                const pid = String(pedido.pedido_id);
                const rowIndex = mapIds.get(pid);

                // Preparar dados da linha
                const rowData = [
                    pedido.pedido_id,
                    pedido.data_emissao || new Date().toISOString().split('T')[0],
                    pedido.nome || pedido.razao_social,
                    pedido.cpf_cnpj,
                    pedido.email,
                    pedido.servicos ? pedido.servicos.map(s => s.discriminacao).join('; ') : '',
                    pedido.valor_total,
                    pedido.status_wc || '',
                    // Se existe, não mudar status_nota se já tiver processado algo?
                    // Nesse design simplificado, mantemos o status se já existe, ou 'Pendente' se novo.
                    // ATENCAO: não temos o status_nota antigo aqui pq só buscamos ID. 
                    // Para simplificar e evitar leitura completa (pesada), assumimos 'Pendente' se for novo.
                    // Se for update, PRECISARÍAMOS saber o status anterior para não sobrescrever.
                    // SOLUÇÃO: Vamos assumir que sincronização SÓ ATUALIZA DADOS DO WOO, e não mexe no status da nota.
                    // MAS precisamos preservar o valor atual da coluna de Nota. 
                    // O `batchUpdate` permite atualizar células específicas? Sim.
                    // Para evitar buscar TUDO, vamos usar update apenas nas colunas de dados do Woo (A até H e M) e deixar I, J, K, L quietas.
                ];

                // Dados completos para Append
                const fullRowData = [
                    ...rowData,
                    'Pendente', // Status Nota
                    '',         // Numero
                    '',         // Link
                    '',         // Msg Erro
                    JSON.stringify(pedido) // JSON
                ];

                if (rowIndex) {
                    // JÁ EXISTE: Atualizar apenas colunas variáveis do Woo (A-H) e o JSON (M)
                    // Colunas I, J, K, L (Status Nota e afins) não devem ser tocadas.
                    // Range: A{row}:H{row} e M{row}
                    toUpdate.push({
                        range: `${this.sheetName}!A${rowIndex}:H${rowIndex}`,
                        values: [rowData] // rowData tem 8 elementos iniciais iguais
                    });

                    // Atualizar JSON na coluna M
                    toUpdate.push({
                        range: `${this.sheetName}!M${rowIndex}`,
                        values: [[JSON.stringify(pedido)]]
                    });

                } else {
                    // NOVO: Adicionar ao array de append
                    toAppend.push(fullRowData);
                }
            }

            let insertedCount = 0;
            let updatedCount = 0;

            // 3. Executar Append em Lote
            if (toAppend.length > 0) {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A1`,
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: { values: toAppend }
                });
                insertedCount = toAppend.length;
            }

            // 4. Executar Update em Lote (batchUpdate)
            if (toUpdate.length > 0) {
                // O endpoint values.batchUpdate aceita várias ranges
                await this.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    requestBody: {
                        valueInputOption: 'RAW',
                        data: toUpdate
                    }
                });
                // Cada pedido gera 2 updates (dados + json), então dividimos por 2
                updatedCount = toUpdate.length / 2;
            }

            return { inseridos: insertedCount, atualizados: updatedCount };

        } catch (error) {
            logger.error('Erro no upsert em lote', { error: error.message });
            throw error;
        }
    }

    // Manter método individual antigo para compatibilidade se necessário, ou redirecionar
    async upsertPedido(pedido) {
        return this.upsertPedidosLote([pedido]);
    }

    async atualizarStatusNota(pedidoId, status, numero = '', link = '', erro = '', { force = false } = {}) {
        await this.init();

        const resData = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A:I`
        });

        const rows = resData.data.values || [];
        let rowIndex = -1;
        let statusAtual = '';

        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] == pedidoId) {
                rowIndex = i + 1;
                statusAtual = rows[i][8] || '';
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`Pedido ${pedidoId} não encontrado na planilha para atualização.`);
        }

        const isStatusManual = statusAtual.startsWith('[M] ');
        const isNovaAtualizacaoManual = status.startsWith('[M] ');

        if (isStatusManual && !isNovaAtualizacaoManual && !force) {
            logger.info('Status manual detectado, ignorando atualização automática', {
                pedido_id: pedidoId,
                status_manual: statusAtual,
                status_automatico_ignorado: status
            });
            return;
        }

        const updates = [
            status,
            numero,
            link,
            erro
        ];

        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!I${rowIndex}:L${rowIndex}`,
                valueInputOption: 'RAW',
                requestBody: { values: [updates] }
            });
            logger.info('Status atualizado no Sheets', { pedido_id: pedidoId, status });
        } catch (error) {
            logger.error('Erro ao atualizar status no Sheets', { error: error.message });
            throw error;
        }
    }

    async removerPedidosNubank(mes, ano) {
        await this.init();
        if (!this.sheets) return { removidos: 0 };

        logger.info(`Removendo pedidos Nubank de ${mes}/${ano}...`);

        try {
            // 1. Buscar todas as linhas (ID e Data)
            // Precisamos dos IDs para saber se é Nubank (NBK-*) e da Data para filtrar o mês
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A2:B`, // A: ID, B: Data
            });

            const rows = res.data.values || [];
            const rowsToDelete = [];

            // 2. Identificar linhas para deletar
            rows.forEach((row, index) => {
                const id = row[0] || '';
                const data = row[1] || '';
                const rowIndex = index + 2; // +2 porque começa em A2 (1-header) e index é 0-based

                // Verificar ID
                const isNubank = id.startsWith('NBK-');

                if (isNubank) {
                    // Data formato esperado: YYYY-MM-DD
                    const [anoRow, mesRow] = data.split('-');

                    // Converter nome do mês para número se necessário
                    const mesesNomes = { 'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12' };
                    const mesNumero = mesesNomes[String(mes).toLowerCase()] || mes;

                    if (anoRow == ano && mesRow == mesNumero) {
                        rowsToDelete.push(rowIndex);
                    }
                }
            });

            if (rowsToDelete.length === 0) {
                return { removidos: 0 };
            }

            logger.info(`Encontrados ${rowsToDelete.length} pedidos Nubank para remover.`);

            // 3. Deletar linhas
            // IMPORTANTE: Deletar de baixo para cima para não alterar índices das linhas acima
            rowsToDelete.sort((a, b) => b - a);

            // Podemos agrupar em ranges contíguos para economizar requests, 
            // mas deleteDimension por index único em batch também funciona
            const requests = rowsToDelete.map(rowIndex => ({
                deleteDimension: {
                    range: {
                        sheetId: 0, // Assumindo SheetID 0 (primeira aba). Melbor buscar ID real.
                        dimension: 'ROWS',
                        startIndex: rowIndex - 1, // API usa 0-based inclusive
                        endIndex: rowIndex        // API usa 0-based exclusive
                    }
                }
            }));

            // Precisamos do sheetId real (inteiro), não o nome.
            // O padrão da primeira aba é 0, mas se mudou, precisamos buscar.
            const meta = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheet = meta.data.sheets.find(s => s.properties.title === this.sheetName);
            const sheetId = sheet ? sheet.properties.sheetId : 0;

            // Atualizar sheetId nos requests
            requests.forEach(req => req.deleteDimension.range.sheetId = sheetId);

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: requests
                }
            });

            return { removidos: rowsToDelete.length };

        } catch (error) {
            logger.error('Erro ao remover pedidos Nubank', { error: error.message });
            throw error;
        }
    }

    /**
     * Atualiza endereço de um pedido específico na planilha
     */
    async atualizarEnderecoPedido(pedidoId, endereco, cpf_cnpj, nif) {
        await this.init();

        // Buscar todos os pedidos para encontrar o índice da linha
        const resData = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A:M`
        });

        const rows = resData.data.values || [];
        let rowIndex = -1;
        let jsonPedidoAtual = null;

        // Encontrar a linha do pedido (comparar como string para evitar problemas de tipo)
        const pedidoIdStr = String(pedidoId);
        for (let i = 0; i < rows.length; i++) {
            const idNaLinha = rows[i][0] ? String(rows[i][0]) : '';
            if (idNaLinha === pedidoIdStr) {
                rowIndex = i + 1;
                // Coluna M (índice 12) contém o json_pedido
                if (rows[i][12]) {
                    try {
                        jsonPedidoAtual = JSON.parse(rows[i][12]);
                    } catch (e) {
                        logger.error('Erro ao parsear json_pedido ao atualizar endereço', {
                            pedido_id: pedidoId,
                            error: e.message,
                            json_raw: rows[i][12]?.substring(0, 100)
                        });
                        throw new Error('Erro ao ler dados do pedido na planilha');
                    }
                }
                break;
            }
        }

        if (rowIndex === -1) {
            logger.error('Pedido não encontrado na planilha', {
                pedido_id: pedidoId,
                total_linhas: rows.length,
                primeiros_ids: rows.slice(0, 5).map(r => r[0])
            });
            throw new Error(`Pedido ${pedidoId} não encontrado na planilha`);
        }

        if (!jsonPedidoAtual) {
            logger.error('Dados do pedido não encontrados na planilha', {
                pedido_id: pedidoId,
                row_index: rowIndex,
                tem_json: !!rows[rowIndex - 1]?.[12]
            });
            throw new Error(`Dados do pedido ${pedidoId} não encontrados na planilha`);
        }

        // Atualizar endereço e documentos no json_pedido
        jsonPedidoAtual.endereco = endereco;
        if (cpf_cnpj !== undefined) {
            jsonPedidoAtual.cpf_cnpj = cpf_cnpj;
        }
        if (nif !== undefined) {
            jsonPedidoAtual.nif = nif;
        }

        // Atualizar coluna M com o novo json_pedido
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!M${rowIndex}`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[JSON.stringify(jsonPedidoAtual)]]
            }
        });

        logger.info('Endereço atualizado no Sheets', {
            pedido_id: pedidoId,
            endereco: endereco.cidade || endereco.nome_cidade_ext
        });

        return jsonPedidoAtual;
    }

}

module.exports = new GoogleSheetsService();
