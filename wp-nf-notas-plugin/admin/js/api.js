/**
 * NF Notas API - Cliente para API SaaS (plugin WordPress)
 * Usa nfNotasConfig (apiUrl, token) injetado via wp_localize_script
 */

(function() {
    const config = window.nfNotasConfig || {};
    const API_BASE_URL = (config.apiUrl || '').replace(/\/$/, '');
    const API_TOKEN = config.token || '';

    function apiRequest(endpoint, options = {}) {
        if (!API_BASE_URL || !API_TOKEN) {
            return Promise.resolve({ sucesso: false, erro: 'API não configurada. Configure URL e token em NF Notas > Token API.' });
        }

        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + API_TOKEN,
            ...(options.headers || {})
        };

        let body = options.body;
        if (body && typeof body === 'object' && !(body instanceof FormData)) {
            body = JSON.stringify(body);
        }

        return fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.method !== 'GET' ? body : undefined
        })
        .then(res => res.json())
        .then(data => {
            if (data.sucesso === false && data.erro) {
                return data;
            }
            return data.sucesso !== undefined ? data : { sucesso: true, dados: data };
        })
        .catch(err => ({ sucesso: false, erro: err.message }));
    }

    window.NFNotasAPI = {
        get: (endpoint) => apiRequest(endpoint),
        post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body }),
        put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body }),
        delete: (endpoint, body) => apiRequest(endpoint, { method: 'DELETE', body }),
        request: apiRequest,
        isConfigured: () => !!(API_BASE_URL && API_TOKEN)
    };
})();
