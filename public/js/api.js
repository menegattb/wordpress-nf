// API Module - Funções para chamar APIs do backend

const API_BASE_URL = '';

function getAdminTenantId() {
    const match = window.location.pathname.match(/\/admin\/cliente\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Função genérica para fazer requisições
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const tenantId = getAdminTenantId();
    const extraHeaders = {};
    if (tenantId) {
        extraHeaders['X-Admin-Tenant'] = tenantId;
    }
    const config = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...extraHeaders,
            ...options.headers
        },
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            // 402 = limite atingido - retornar dados para exibir mensagem com link de upgrade
            if (response.status === 402 && data.erro === 'limite_atingido') {
                return {
                    sucesso: false,
                    erro: 'limite_atingido',
                    mensagem: data.mensagem || 'Limite de notas atingido.',
                    upgrade_url: data.upgrade_url || '',
                    usado: data.usado,
                    limite: data.limite
                };
            }
            throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
        }

        // Se a resposta já tem a estrutura esperada (sucesso, pedidos, etc), retornar diretamente
        // Caso contrário, envolver em { sucesso: true, dados: data }
        if (data.sucesso !== undefined || data.pedidos !== undefined || data.categorias !== undefined) {
            return data;
        }

        return { sucesso: true, dados: data };
    } catch (error) {
        console.error('Erro na requisição:', error);
        // Mostrar erro via Toast se disponível e não for "abort" (cancelamento)
        if (window.Toast && error.name !== 'AbortError') {
            window.Toast.error(`Erro: ${error.message}`);
        }
        return { sucesso: false, erro: error.message };
    }
}

/**
 * API de NFSe
 */
const NFSeAPI = {
    /**
     * Lista todas as notas (NFSe e NFe)
     */
    async listar(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.limite) params.append('limite', filtros.limite);
        if (filtros.offset) params.append('offset', filtros.offset);
        if (filtros.status_focus) params.append('status_focus', filtros.status_focus);
        if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
        if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
        if (filtros.ambiente) params.append('ambiente', filtros.ambiente);

        const query = params.toString();
        return await apiRequest(`/api/pedidos/notas/listar${query ? '?' + query : ''}`);
    },

    /**
     * Consulta status de uma NFSe por referência
     */
    async consultar(referencia) {
        return await apiRequest(`/api/nfse/consulta/${referencia}`);
    },

    /**
     * Emite uma NFSe
     */
    async emitir(dadosPedido) {
        return await apiRequest('/api/nfse/emitir', {
            method: 'POST',
            body: dadosPedido
        });
    },

    /**
     * Cancela uma NFSe ou NFe
     */
    async cancelar(referencia, tipoNota, justificativa, ambiente = null) {
        return await apiRequest(`/api/nfse/cancelar/${referencia}`, {
            method: 'DELETE',
            body: {
                tipo_nota: tipoNota,
                justificativa,
                ...(ambiente ? { ambiente } : {})
            }
        });
    },

    /**
     * Emite NFSe em lote
     */
    async emitirLote(pedidoIds, tipoNF) {
        return await apiRequest('/api/nfse/emitir-lote', {
            method: 'POST',
            body: {
                pedido_ids: pedidoIds,
                tipo_nf: tipoNF || 'servico'
            }
        });
    },

    /**
     * Emite NF de teste (serviço ou produto)
     */
    async emitirTeste(tipoNF) {
        return await apiRequest('/api/nfse/emitir-teste', {
            method: 'POST',
            body: {
                tipo_nf: tipoNF || 'servico'
            }
        });
    },

    /**
     * Sincroniza todas as notas da Focus NFe com o banco local
     */
    async sincronizar(filtros = {}) {
        return await apiRequest('/api/nfse/sincronizar', {
            method: 'POST',
            body: filtros
        });
    },

    /**
     * Atualiza status de notas pendentes (processando_autorizacao)
     */
    async atualizarStatus() {
        return await apiRequest('/api/nfse/atualizar-status', {
            method: 'POST'
        });
    },

    /**
     * Busca notas na Focus NFe e banco local
     */
    async buscar(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.referencia) params.append('referencia', filtros.referencia);
        if (filtros.chave) params.append('chave', filtros.chave);
        if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
        if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
        if (filtros.status) params.append('status', filtros.status);
        if (filtros.tipo_nota) params.append('tipo_nota', filtros.tipo_nota);
        // Sempre enviar apenas_banco_local (true ou false)
        if (filtros.apenas_banco_local !== undefined) {
            params.append('apenas_banco_local', filtros.apenas_banco_local ? 'true' : 'false');
        }

        const query = params.toString();
        return await apiRequest(`/api/nfse/buscar${query ? '?' + query : ''}`);
    },

    /**
     * Cancela uma nota (NFe ou NFSe) por referência
     */
    async cancelar(referencia, tipoNota, justificativa, ambiente = null) {
        return await apiRequest(`/api/nfse/cancelar/${referencia}`, {
            method: 'DELETE',
            body: {
                tipo_nota: tipoNota,
                justificativa: justificativa,
                ...(ambiente ? { ambiente } : {})
            }
        });
    },

    /**
     * Cancela uma nota por chave NFe/NFSe
     */
    async cancelarPorChave(chave_nfe, justificativa, ambiente = null) {
        return await apiRequest(`/api/nfse/cancelar-por-chave/${chave_nfe}`, {
            method: 'DELETE',
            body: {
                justificativa: justificativa,
                ...(ambiente ? { ambiente } : {})
            }
        });
    }
};

/**
 * API de Pedidos
 */
const PedidosAPI = {
    /**
     * Lista pedidos
     */
    async listar(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.limite) params.append('limite', filtros.limite);
        if (filtros.offset) params.append('offset', filtros.offset);
        if (filtros.status) params.append('status', filtros.status);
        if (filtros.origem) params.append('origem', filtros.origem);

        const query = params.toString();
        return await apiRequest(`/api/pedidos${query ? '?' + query : ''}`);
    },

    /**
     * Busca pedido por ID
     */
    async buscarPorId(id) {
        return await apiRequest(`/api/pedidos/${id}`);
    },

    /**
     * Atualiza status de um pedido
     */
    async atualizarStatus(id, status) {
        return await apiRequest(`/api/pedidos/${id}/status`, {
            method: 'PUT',
            body: { status }
        });
    },

    /**
     * Busca pedidos pendentes para catch-up de emissao automatica
     */
    async buscarPendentesCatchup(tipo) {
        return await apiRequest('/api/pedidos/catchup', {
            method: 'POST',
            body: { tipo }
        });
    },

    /**
     * Lista logs relacionados a pedidos
     */
    async listarLogs(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.referencia) params.append('referencia', filtros.referencia);
        if (filtros.pedido_ids) {
            if (Array.isArray(filtros.pedido_ids)) {
                filtros.pedido_ids.forEach(id => params.append('pedido_ids', id));
            } else {
                params.append('pedido_ids', filtros.pedido_ids);
            }
        }
        if (filtros.mes) params.append('mes', filtros.mes);
        if (filtros.limite) params.append('limite', filtros.limite);

        const query = params.toString();
        return await apiRequest(`/api/pedidos/logs${query ? '?' + query : ''}`);
    },

    /**
     * Lista pedidos salvos no banco local
     */
    async listarDoBanco(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.limite) params.append('limite', filtros.limite);
        if (filtros.offset) params.append('offset', filtros.offset);

        const query = params.toString();
        return await apiRequest(`/api/pedidos/banco${query ? '?' + query : ''}`);
    },

    /**
     * Sincroniza pedidos do WooCommerce para o banco local (paginado)
     * @param {number} pagina - Página a sincronizar (default: 1)
     * @param {number} porPagina - Itens por página (default: 30, max: 50)
     */
    async sincronizarDoWooCommerce(pagina = 1, porPagina = 30) {
        return await apiRequest('/api/pedidos/sincronizar-woocommerce', {
            method: 'POST',
            body: { pagina, por_pagina: porPagina }
        });
    },

    /**
     * Sincroniza TODOS os pedidos do WooCommerce (múltiplas páginas)
     */
    async sincronizarTodosDoWooCommerce(onProgress = null) {
        let pagina = 1;
        let totalSalvos = 0;
        let totalAtualizados = 0;
        let totalErros = 0;
        let semProgressoSeguido = 0;
        const MAX_PAGINAS = 500;

        while (pagina <= MAX_PAGINAS) {
            const resultado = await Promise.race([
                this.sincronizarDoWooCommerce(pagina, 30),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout na página ${pagina}`)), 30000))
            ]);

            if (!resultado.sucesso) {
                return { sucesso: false, erro: resultado.erro };
            }

            totalSalvos += resultado.salvos || 0;
            totalAtualizados += resultado.atualizados || 0;
            totalErros += resultado.erros || 0;
            const progressoPagina = (resultado.salvos || 0) + (resultado.atualizados || 0);
            semProgressoSeguido = progressoPagina === 0 ? semProgressoSeguido + 1 : 0;

            if (onProgress) {
                onProgress({
                    pagina,
                    salvos: totalSalvos,
                    atualizados: totalAtualizados,
                    erros: totalErros
                });
            }

            if (!resultado.tem_mais) break;
            if (semProgressoSeguido >= 3) {
                return {
                    sucesso: true,
                    paginas: pagina,
                    salvos: totalSalvos,
                    atualizados: totalAtualizados,
                    erros: totalErros,
                    aviso: 'Sincronização encerrada por falta de progresso'
                };
            }
            pagina++;
        }

        return {
            sucesso: true,
            paginas: pagina,
            salvos: totalSalvos,
            atualizados: totalAtualizados,
            erros: totalErros
        };
    }
};

/**
 * API de WooCommerce
 */
const WooCommerceAPI = {
    /**
     * Busca pedidos do WooCommerce
     */
    async buscarPedidos(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.status) params.append('status', filtros.status);
        if (filtros.per_page) params.append('per_page', filtros.per_page);
        if (filtros.page) params.append('page', filtros.page);
        if (filtros.orderby) params.append('orderby', filtros.orderby);
        if (filtros.order) params.append('order', filtros.order);
        if (filtros.mes) params.append('mes', filtros.mes); // Formato: YYYY-MM

        const query = params.toString();
        return await apiRequest(`/api/woocommerce/pedidos${query ? '?' + query : ''}`);
    },

    /**
     * Busca pedido específico do WooCommerce
     */
    async buscarPedidoPorId(orderId) {
        return await apiRequest(`/api/woocommerce/pedidos/${orderId}`);
    },

    /**
     * Testa conexão com WooCommerce
     */
    async testarConexao() {
        return await apiRequest('/api/woocommerce/test');
    },

    /**
     * Busca categorias de produtos
     */
    async buscarCategorias() {
        return await apiRequest('/api/woocommerce/categorias');
    },

    /**
     * Sincroniza pedidos do WooCommerce salvando no banco de dados
     */
    async sincronizarPedidos() {
        return await apiRequest('/api/woocommerce/sincronizar', {
            method: 'POST'
        });
    }
};

/**
 * API de Configurações
 */
const ConfigAPI = {
    /**
     * Busca logs do servidor
     */
    async buscarLogs(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.limite) params.append('limite', filtros.limite);
        if (filtros.nivel) params.append('nivel', filtros.nivel);
        // Suporte para filtrar por Job ID
        if (filtros.job_id) params.append('job_id', filtros.job_id);

        const query = params.toString();
        return await apiRequest(`/api/config/logs${query ? '?' + query : ''}`);
    },
    /**
     * Obtém informações do servidor
     */
    async getHealth() {
        return await apiRequest('/health');
    },

    /**
     * Obtém dados do emitente/prestador
     */
    async getEmitente() {
        return await apiRequest('/api/config/emitente');
    },

    /**
     * Obtém configurações do Focus NFe
     */
    async getFocus() {
        return await apiRequest('/api/config/focus');
    },

    async getCategoriasProduto() {
        return await apiRequest('/api/config/categorias-produto');
    },

    async salvarCategoriasProduto(categorias) {
        return await apiRequest('/api/config/categorias-produto', {
            method: 'POST',
            body: { categorias }
        });
    },

    async getCategoriasWoo() {
        return await apiRequest('/api/woocommerce/categorias');
    },

    async getAutoEmitir() {
        return await apiRequest('/api/config/auto-emitir');
    },

    async setAutoEmitir(ativo) {
        return await apiRequest('/api/config/auto-emitir', {
            method: 'POST',
            body: { ativo }
        });
    },
    
    async getAutoEmitirServico() {
        return await apiRequest('/api/config/auto-emitir-servico');
    },

    async setAutoEmitirServico(ativo) {
        return await apiRequest('/api/config/auto-emitir-servico', {
            method: 'POST',
            body: { ativo }
        });
    },

    async getCategoriasServico() {
        return await apiRequest('/api/config/categorias-servico');
    },

    async salvarCategoriasServico(categorias) {
        return await apiRequest('/api/config/categorias-servico', {
            method: 'POST',
            body: { categorias }
        });
    },

    async getGoogleSheets() {
        return await apiRequest('/api/config/google-sheets');
    },

    async salvarGoogleSheets(sheetsId, credentialsJson) {
        return await apiRequest('/api/config/google-sheets', {
            method: 'POST',
            body: { sheets_id: sheetsId, credentials_json: credentialsJson }
        });
    },

    async testarGoogleSheets() {
        return await apiRequest('/api/config/google-sheets/testar', { method: 'POST' });
    },

    /**
     * Obtém configurações do WooCommerce
     */
    async getWooCommerce() {
        return await apiRequest('/api/config/woocommerce');
    },

    /**
     * Salva configurações do Focus NFe
     */
    async salvarFocus(dados) {
        return await apiRequest('/api/config/focus', {
            method: 'POST',
            body: dados
        });
    },

    /**
     * Testa conexão com Focus NFe
     */
    async testarConexao() {
        return await apiRequest('/api/config/focus/test');
    }
};

/**
 * API de Backups
 */
const BackupsAPI = {
    /**
     * Lista backups de XMLs disponíveis
     */
    async listar() {
        return await apiRequest('/api/backups');
    },

    /**
     * Lista notas NFe autorizadas para download de XMLs individuais
     */
    async listarNotasNFe(mes, ano) {
        const params = new URLSearchParams();
        if (mes) params.append('mes', mes);
        if (ano) params.append('ano', ano);
        const query = params.toString();
        return await apiRequest(`/api/backups/notas-nfe${query ? '?' + query : ''}`);
    }
};

/**
 * API de Integração Excel
 */
const ExcelAPI = {
    async listar() {
        return await apiRequest('/api/excel/pedidos');
    },
    async sincronizar(dias = 7) {
        return await apiRequest('/api/excel/sincronizar', {
            method: 'POST',
            body: { dias }
        });
    },
    async emitir(pedidoId) {
        return await apiRequest('/api/excel/emitir', {
            method: 'POST',
            body: { pedido_id: pedidoId }
        });
    },
    async importarNubank(mes, ano) {
        return await apiRequest('/api/excel/importar-nubank', {
            method: 'POST',
            body: { mes, ano }
        });
    },
    async removerNubank(mes, ano) {
        return await apiRequest('/api/excel/remover-nubank', {
            method: 'POST',
            body: { mes, ano }
        });
    }
};

// Exportar APIs
window.API = {
    NFSe: NFSeAPI,
    Pedidos: PedidosAPI,
    WooCommerce: WooCommerceAPI,
    Config: ConfigAPI,
    Backups: BackupsAPI,
    Excel: ExcelAPI
};

