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
            const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
            if (!credentialsJson || !this.spreadsheetId) {
                logger.warn('Credenciais do Google Sheets não configuradas no .env');
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

    async atualizarStatusNota(pedidoId, status, numero = '', link = '', erro = '') {
        await this.init();
        // Para atualizar status, precisamos achar a linha.
        // Otimização: buscar apenas coluna A
        const resIds = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A:A`
        });

        const rows = resIds.data.values || [];
        let rowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] == pedidoId) {
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`Pedido ${pedidoId} não encontrado na planilha para atualização.`);
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
                    // Verificar Mês/Ano
                    // Data formato esperado: YYYY-MM-DD
                    const [anoRow, mesRow] = data.split('-');

                    // Comparação frouxa (string == string)
                    if (anoRow == ano && mesRow == mes) {
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

}

module.exports = new GoogleSheetsService();
