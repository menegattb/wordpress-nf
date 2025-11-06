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
     * Lista todas as NFSe
     */
    async listar(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.limite) params.append('limite', filtros.limite);
        if (filtros.offset) params.append('offset', filtros.offset);
        if (filtros.status_focus) params.append('status_focus', filtros.status_focus);

        const query = params.toString();
        return await apiRequest(`/api/pedidos/nfse/listar${query ? '?' + query : ''}`);
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
     * Cancela uma NFSe
     */
    async cancelar(referencia, justificativa) {
        return await apiRequest(`/api/nfse/${referencia}`, {
            method: 'DELETE',
            body: { justificativa }
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

        const query = params.toString();
        return await apiRequest(`/api/pedidos${query ? '?' + query : ''}`);
    },

    /**
     * Busca pedido por ID
     */
    async buscarPorId(id) {
        return await apiRequest(`/api/pedidos/${id}`);
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
    }
};

/**
 * API de Configurações
 */
const ConfigAPI = {
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
    }
};

// Exportar APIs
window.API = {
    NFSe: NFSeAPI,
    Pedidos: PedidosAPI,
    WooCommerce: WooCommerceAPI,
    Config: ConfigAPI
};

