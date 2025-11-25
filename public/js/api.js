// API Module - Funções para chamar APIs do backend

const API_BASE_URL = '';

/**
 * Função genérica para fazer requisições
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
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
     * Lista logs relacionados a pedidos
     */
    async listarLogs(filtros = {}) {
        const params = new URLSearchParams();
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
     * Sincroniza pedidos do WooCommerce para o banco local
     */
    async sincronizarDoWooCommerce() {
        return await apiRequest('/api/pedidos/sincronizar-woocommerce', {
            method: 'POST'
        });
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

// Exportar APIs
window.API = {
    NFSe: NFSeAPI,
    Pedidos: PedidosAPI,
    WooCommerce: WooCommerceAPI,
    Config: ConfigAPI
};

