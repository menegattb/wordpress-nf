// Main App - Lógica principal e navegação

/**
 * Parseia strings de data em múltiplos formatos, incluindo o formato corrupto
 * do Google Sheets (DDThh:mm:ss/MM/YYYY). Retorna Date ou null se inválida.
 */
function parseDateSafe(str) {
    if (!str) return null;
    const s = String(str).trim();

    // Formato corrupto do Google Sheets: DDThh:mm:ss/MM/YYYY
    const matchCorrupt = s.match(/^(\d{2})T(\d{2}):(\d{2}):(\d{2})\/(\d{2})\/(\d{4})/);
    if (matchCorrupt) {
        const [, dia, hora, min, seg, mes, ano] = matchCorrupt;
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), parseInt(hora), parseInt(min), parseInt(seg));
    }

    // Formato BR: DD/MM/YYYY (com hora opcional)
    const matchBR = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchBR) {
        return new Date(parseInt(matchBR[3]), parseInt(matchBR[2]) - 1, parseInt(matchBR[1]));
    }

    // Formato ISO: YYYY-MM-DD...
    const matchISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchISO) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;
        return new Date(parseInt(matchISO[1]), parseInt(matchISO[2]) - 1, parseInt(matchISO[3]));
    }

    // Fallback
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata mensagem de erro quando limite de notas é atingido (402)
 * Retorna mensagem para exibir e URL de upgrade se disponível
 */
function formatarErroLimite(resultado) {
    if (resultado && resultado.erro === 'limite_atingido') {
        const msg = resultado.mensagem || 'Limite de notas atingido. Faça upgrade para continuar.';
        const url = resultado.upgrade_url || '';
        return { mensagem: msg, upgrade_url: url };
    }
    return null;
}

let estadoAtual = {
    secaoAtiva: 'meus-dados',
    paginaAtual: 1,
    filtros: {},
    dados: {
        requisicoes: [],
        pedidos: [],
        meusDados: null
    }
};

/**
 * Verifica autenticação ao carregar a página - LOGIN DESABILITADO
 */
async function verificarAutenticacao() {
    // LOGIN DESABILITADO - sempre retorna true
    return true;

    // Código comentado - pode ser reativado depois
    // try {
    //     const response = await fetch('/api/auth/status', {
    //         credentials: 'include'
    //     });
    //     const data = await response.json();
    //     
    //     if (!data.autenticado) {
    //         // Redirecionar para login se não estiver autenticado
    //         window.location.href = '/login';
    //         return false;
    //     }
    //     return true;
    // } catch (error) {
    //     console.error('Erro ao verificar autenticação:', error);
    //     window.location.href = '/login';
    //     return false;
    // }
}

/**
 * Realiza logout do usuário
 */
async function logout() {
    if (!confirm('Deseja realmente sair?')) {
        return;
    }

    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.sucesso) {
            window.location.href = '/login';
        } else {
            alert('Erro ao realizar logout: ' + (data.erro || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        // Mesmo com erro, redirecionar para login
        window.location.href = '/login';
    }
}

/**
 * Inicialização da aplicação
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Se estiver em /admin/cliente/:id, mostrar banner de contexto
    const adminTenantId = typeof getAdminTenantId === 'function' ? getAdminTenantId() : null;
    if (adminTenantId) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#1e3a5f;color:#93c5fd;padding:10px 24px;font-size:0.9375rem;display:flex;align-items:center;justify-content:space-between;font-family:inherit;';
        banner.innerHTML = '<span id="admin-banner-text">Visualizando cliente #' + adminTenantId + '</span><a href="/admin" style="color:#93c5fd;font-weight:600;text-decoration:none;padding:4px 12px;border:1px solid #93c5fd;border-radius:6px;">Voltar ao admin</a>';
        document.body.insertBefore(banner, document.body.firstChild);
        // Buscar nome do cliente
        fetch('/api/admin/tenant/' + adminTenantId + '/config', { credentials: 'include' })
            .then(r => r.json())
            .then(() => {
                fetch('/api/admin/dashboard', { credentials: 'include' })
                    .then(r => r.json())
                    .then(d => {
                        if (d.sucesso) {
                            const c = (d.clientes || []).find(x => x.id === parseInt(adminTenantId));
                            if (c) document.getElementById('admin-banner-text').textContent = 'Visualizando: ' + c.nome;
                        }
                    }).catch(() => {});
            }).catch(() => {});
    }

    // Verificar se Components está disponível
    if (!window.Components) {
        console.error('Components não está disponível no DOMContentLoaded');
        // Tentar novamente após um pequeno delay
        setTimeout(() => {
            if (window.Components) {
                inicializarNavegacao();
                carregarSecao('meus-dados');
            } else {
                console.error('Components ainda não está disponível após delay');
                document.getElementById('content-area').innerHTML = `
                    <div class="content-section">
                        <div style="padding: 20px; text-align: center; color: #dc3545;">
                            <h3>Erro ao carregar componentes</h3>
                            <p>O arquivo components.js não foi carregado corretamente.</p>
                            <p>Por favor, verifique o console do navegador (F12) para mais detalhes.</p>
                        </div>
                    </div>
                `;
            }
        }, 200);
    } else {
        inicializarNavegacao();
        carregarSecao('meus-dados');
    }
});

/**
 * Inicializa navegação da sidebar
 */
function inicializarNavegacao() {
    console.log('🔧 Inicializando navegação...');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    console.log('🔧 Itens encontrados:', sidebarItems.length);
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const secao = item.dataset.section;
            console.log('🔧 Clicou em:', secao);
            if (secao) {
                carregarSecao(secao);
            }
        });
    });
    console.log('✅ Navegação inicializada!');
}

/**
 * Atualiza sidebar para mostrar item ativo
 */
function atualizarSidebarAtivo(secao) {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === secao) {
            item.classList.add('active');
        }
    });
}

/**
 * Carrega seção específica
 */
async function carregarSecao(secao) {
    // Parar polling anterior se mudar de seção
    if (estadoAtual.secaoAtiva === 'pedidos') {
        pararPollingPedidos();
    }

    if (estadoAtual.secaoAtiva === 'notas-enviadas') {
        pararPollingNotas();
    }

    estadoAtual.secaoAtiva = secao;
    atualizarSidebarAtivo(secao);

    const contentArea = document.getElementById('content-area');
    if (!contentArea) {
        console.error('content-area não encontrado');
        return;
    }

    // Verificar se Components está disponível
    if (window.Components && window.Components.renderizarLoading) {
        contentArea.innerHTML = window.Components.renderizarLoading();
    } else {
        contentArea.innerHTML = '<div class="content-section"><div class="loading-spinner"></div><p>Carregando...</p></div>';
    }

    switch (secao) {
        case 'meus-dados':
            await carregarMeusDados();
            break;
        case 'conexao-woocommerce':
            await carregarConexaoWooCommerce();
            break;
        case 'conexao-focus':
            await carregarConexaoFocus();
            break;
        case 'backups-xml':
            await carregarBackups();
            break;
        case 'notas-enviadas':
            await carregarNotasEnviadas();
            break;
        case 'buscar-notas':
            await carregarBuscarNotas();
            break;
        case 'pedidos':
            await carregarPedidos();
            break;

        case 'pedidos-excel':
            await carregarPedidosExcel();
            // Auto-verificar notas "Processando..." na Focus NFe
            setTimeout(() => verificarTodosProcessando(), 2000);
            break;
        default:
            contentArea.innerHTML = '<div class="content-section"><h2>Seção não encontrada</h2></div>';
    }
}

/**
 * Carrega seção de Meus Dados
 */
async function carregarMeusDados() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    if (window.Components && window.Components.renderizarLoading) {
        contentArea.innerHTML = window.Components.renderizarLoading();
    } else {
        contentArea.innerHTML = '<div class="content-section"><div class="loading-spinner"></div><p>Carregando...</p></div>';
    }

    // Buscar dados do servidor
    let dadosEmitente = {
        cnpj: '',
        inscricao_municipal: '',
        razao_social: '',
        codigo_municipio: '',
        email: '',
        telefone: '',
        optante_simples_nacional: true
    };

    try {
        const resultado = await API.Config.getEmitente();
        if (resultado.sucesso && resultado.dados) {
            dadosEmitente = {
                cnpj: resultado.dados.cnpj || dadosEmitente.cnpj,
                inscricao_municipal: resultado.dados.inscricao_municipal || dadosEmitente.inscricao_municipal,
                razao_social: resultado.dados.razao_social || dadosEmitente.razao_social,
                codigo_municipio: resultado.dados.codigo_municipio || dadosEmitente.codigo_municipio,
                email: resultado.dados.email || dadosEmitente.email,
                telefone: resultado.dados.telefone || dadosEmitente.telefone,
                optante_simples_nacional: resultado.dados.optante_simples_nacional !== undefined ? resultado.dados.optante_simples_nacional : dadosEmitente.optante_simples_nacional
            };
        }
    } catch (error) {
        console.error('Erro ao carregar dados do emitente:', error);
        // Usar valores padrão em caso de erro
    }

    // Salvar no estado
    estadoAtual.dados.meusDados = dadosEmitente;

    const html = `
        <div class="content-section">
            <h2 class="section-title">Meus Dados</h2>
            <form id="form-meus-dados" style="max-width: 800px;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px;">
                    <div class="form-group">
                        <label class="form-label">CNPJ</label>
                        <input type="text" class="form-input" id="dados-cnpj" value="${dadosEmitente.cnpj}" placeholder="00.000.000/0000-00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Inscrição Municipal</label>
                        <input type="text" class="form-input" id="dados-im" value="${dadosEmitente.inscricao_municipal}" placeholder="000.000-0">
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Razão Social</label>
                        <input type="text" class="form-input" id="dados-razao-social" value="${dadosEmitente.razao_social}" placeholder="Nome da Empresa">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Código do Município (IBGE)</label>
                        <input type="text" class="form-input" id="dados-codigo-municipio" value="${dadosEmitente.codigo_municipio}" placeholder="0000000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">E-mail</label>
                        <input type="email" class="form-input" id="dados-email" value="${dadosEmitente.email}" placeholder="email@exemplo.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Telefone</label>
                        <input type="text" class="form-input" id="dados-telefone" value="${dadosEmitente.telefone}" placeholder="(00) 00000-0000">
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="dados-simples-nacional" ${dadosEmitente.optante_simples_nacional ? 'checked' : ''}>
                            <span>Optante pelo Simples Nacional</span>
                        </label>
                    </div>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="resetarMeusDados()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Salvar Alterações</button>
                </div>
            </form>
        </div>
    `;

    contentArea.innerHTML = html;

    // Adicionar event listener ao formulário
    const form = document.getElementById('form-meus-dados');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarMeusDados();
        });
    }

    estadoAtual.dados.meusDados = dadosEmitente;
}

/**
 * Salva dados do emitente
 */
async function salvarMeusDados() {
    const dados = {
        cnpj: document.getElementById('dados-cnpj').value,
        inscricao_municipal: document.getElementById('dados-im').value,
        razao_social: document.getElementById('dados-razao-social').value,
        codigo_municipio: document.getElementById('dados-codigo-municipio').value,
        email: document.getElementById('dados-email').value,
        telefone: document.getElementById('dados-telefone').value,
        optante_simples_nacional: document.getElementById('dados-simples-nacional').checked
    };

    // Por enquanto, apenas mostra mensagem (implementar API depois)
    alert('Funcionalidade de salvar dados será implementada via API.\n\nDados coletados:\n' + JSON.stringify(dados, null, 2));
}

/**
 * Reseta dados do formulário
 */
function resetarMeusDados() {
    if (estadoAtual.dados.meusDados) {
        document.getElementById('dados-cnpj').value = estadoAtual.dados.meusDados.cnpj;
        document.getElementById('dados-im').value = estadoAtual.dados.meusDados.inscricao_municipal;
        document.getElementById('dados-razao-social').value = estadoAtual.dados.meusDados.razao_social;
        document.getElementById('dados-codigo-municipio').value = estadoAtual.dados.meusDados.codigo_municipio;
        document.getElementById('dados-email').value = estadoAtual.dados.meusDados.email;
        document.getElementById('dados-telefone').value = estadoAtual.dados.meusDados.telefone;
        document.getElementById('dados-simples-nacional').checked = estadoAtual.dados.meusDados.optante_simples_nacional;
    }
}

/**
 * Carrega seção de Conexão WooCommerce
 */
async function carregarConexaoWooCommerce() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    if (window.Components && window.Components.renderizarLoading) {
        contentArea.innerHTML = window.Components.renderizarLoading();
    } else {
        contentArea.innerHTML = '<div class="content-section"><div class="loading-spinner"></div><p>Carregando...</p></div>';
    }

    // Buscar configurações do WooCommerce
    const resultado = await API.Config.getWooCommerce();
    const dadosWC = resultado.sucesso ? resultado.dados : {
        url: '',
        api_url: '',
        consumer_key: '',
        consumer_secret: ''
    };

    const html = `
        <div class="content-section">
            <h2 class="section-title">Conexão WooCommerce</h2>
            <div style="max-width: 900px;">
                <form id="form-woocommerce">
                    <div style="display: grid; gap: 20px; margin-bottom: 24px;">
                        <div class="form-group">
                            <label class="form-label">URL da Loja</label>
                            <input type="url" class="form-input" id="wc-url" value="${dadosWC.url || ''}" placeholder="https://sualoja.com">
                            <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                                URL base da sua loja WooCommerce
                            </small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">URL da API</label>
                            <input type="url" class="form-input" id="wc-api-url" value="${dadosWC.api_url || ''}" placeholder="https://sualoja.com/wp-json/wc/v3">
                            <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                                URL completa da API REST do WooCommerce
                            </small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Consumer Key</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="password" class="form-input" id="wc-consumer-key" value="${dadosWC.consumer_key || ''}" placeholder="ck_..." style="flex: 1;">
                                <button type="button" class="btn btn-secondary" onclick="toggleWooCommerceVisibility('key')" id="btn-toggle-wc-key">Mostrar</button>
                            </div>
                            <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                                Consumer Key atual: <span id="wc-key-preview">${dadosWC.consumer_key_preview || 'Não configurado'}</span>
                            </small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Consumer Secret</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="password" class="form-input" id="wc-consumer-secret" value="${dadosWC.consumer_secret || ''}" placeholder="cs_..." style="flex: 1;">
                                <button type="button" class="btn btn-secondary" onclick="toggleWooCommerceVisibility('secret')" id="btn-toggle-wc-secret">Mostrar</button>
                            </div>
                            <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                                Consumer Secret atual: <span id="wc-secret-preview">${dadosWC.consumer_secret_preview || 'Não configurado'}</span>
                            </small>
                        </div>
                    </div>
                    
                    <div style="background-color: var(--color-gray-light); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--color-gray-dark);">Como gerar as credenciais da API WooCommerce</h3>
                        <ol style="margin: 0; padding-left: 20px; color: var(--color-gray-medium); font-size: 14px; line-height: 1.8;">
                            <li>Acesse o painel administrativo do WordPress</li>
                            <li>Vá em <strong>WooCommerce > Configurações > Avançado > REST API</strong></li>
                            <li>Clique em <strong>"Adicionar chave"</strong></li>
                            <li>Preencha:
                                <ul style="margin-top: 8px; padding-left: 20px;">
                                    <li><strong>Descrição:</strong> Nome para identificar a chave (ex: "Integração NFSe")</li>
                                    <li><strong>Usuário:</strong> Selecione o usuário que terá acesso</li>
                                    <li><strong>Permissões:</strong> Selecione <strong>"Leitura/Gravação"</strong></li>
                                </ul>
                            </li>
                            <li>Clique em <strong>"Gerar chave da API"</strong></li>
                            <li>Copie o <strong>Consumer Key</strong> e <strong>Consumer Secret</strong> gerados</li>
                            <li>Cole os valores nos campos acima e salve</li>
                        </ol>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border);">
                        <button type="button" class="btn btn-primary" onclick="testarConexaoWooCommerce()" style="width: 100%; margin-bottom: 16px;">
                            Testar Conexão
                        </button>
                        <div id="resultado-teste-woocommerce" style="display: none; padding: 12px; border-radius: 4px; margin-top: 12px;"></div>
                    </div>
                    
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border);">
                        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-gray-medium);"><strong>Links úteis:</strong></p>
                            <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                                <li><a href="https://woocommerce.com/document/woocommerce-rest-api/" target="_blank" style="color: var(--color-orange); text-decoration: none;">Documentação da API REST do WooCommerce</a></li>
                                <li><a href="https://woocommerce.com/document/woocommerce-rest-api/#section-2" target="_blank" style="color: var(--color-orange); text-decoration: none;">Como gerar chaves da API</a></li>
                                <li><a href="https://woocommerce.com/document/woocommerce-rest-api/#section-3" target="_blank" style="color: var(--color-orange); text-decoration: none;">Autenticação e segurança</a></li>
                            </ul>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="resetarWooCommerce()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Configurações</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;

    // Adicionar event listener ao formulário
    const form = document.getElementById('form-woocommerce');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarWooCommerce();
        });
    }

    // Salvar dados originais para reset
    estadoAtual.dados.woocommerce = dadosWC;
}

/**
 * Toggle visibilidade dos campos WooCommerce
 */
function toggleWooCommerceVisibility(tipo) {
    const input = document.getElementById(`wc-consumer-${tipo}`);
    const btn = document.getElementById(`btn-toggle-wc-${tipo}`);

    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Ocultar';
    } else {
        input.type = 'password';
        btn.textContent = 'Mostrar';
    }
}

/**
 * Salva configurações do WooCommerce
 */
async function salvarWooCommerce() {
    const dados = {
        url: document.getElementById('wc-url').value.trim(),
        api_url: document.getElementById('wc-api-url').value.trim(),
        consumer_key: document.getElementById('wc-consumer-key').value.trim(),
        consumer_secret: document.getElementById('wc-consumer-secret').value.trim()
    };

    // Validação básica
    if (!dados.url || !dados.api_url || !dados.consumer_key || !dados.consumer_secret) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    // Por enquanto, apenas mostra mensagem (implementar API depois)
    alert('Funcionalidade de salvar configurações será implementada via API.\n\nDados coletados:\n' + JSON.stringify({
        url: dados.url,
        api_url: dados.api_url,
        consumer_key: dados.consumer_key.substring(0, 15) + '...',
        consumer_secret: dados.consumer_secret.substring(0, 15) + '...'
    }, null, 2));
}

/**
 * Testa a conexão com WooCommerce
 */
async function testarConexaoWooCommerce() {
    const resultadoDiv = document.getElementById('resultado-teste-woocommerce');
    if (!resultadoDiv) return;

    resultadoDiv.style.display = 'block';
    resultadoDiv.innerHTML = `
        <div style="padding: 12px; background-color: #f8f9fa; border-radius: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
                <span style="color: #666; font-size: 14px;">Testando conexão...</span>
            </div>
        </div>
    `;

    try {
        // Testar conexão básica
        const teste = await API.WooCommerce.testarConexao();
        console.log('Resultado do teste:', teste);

        let html = '';
        if (teste.sucesso) {
            // Testar buscar pedidos (sem filtro de status)
            const pedidos = await API.WooCommerce.buscarPedidos({ per_page: 1 });
            let categorias = { sucesso: false, erro: 'Não testado' };
            try {
                categorias = await API.WooCommerce.buscarCategorias();
            } catch (catError) {
                categorias = { sucesso: false, erro: catError.message };
            }

            html = `
                <div style="padding: 16px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; color: #155724;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #155724;">✓ Conexão bem-sucedida!</h4>
                    <div style="font-size: 14px; line-height: 1.8;">
                        <div><strong>Status HTTP:</strong> ${teste.status || 'N/A'}</div>
                        <div><strong>Total de pedidos:</strong> ${teste.total_pedidos || pedidos.total || 'N/A'}</div>
                        <div><strong>Teste de busca de pedidos:</strong> ${pedidos.sucesso ? '✓ OK' : '✗ Erro: ' + (pedidos.erro || 'Desconhecido')}</div>
                        <div><strong>Teste de busca de categorias:</strong> ${categorias.sucesso ? '✓ OK' : '⚠ Aviso: ' + (categorias.erro || 'Desconhecido')}</div>
                        ${pedidos.sucesso && pedidos.pedidos !== undefined ? `<div><strong>Pedidos encontrados:</strong> ${pedidos.total || pedidos.pedidos?.length || 0}</div>` : ''}
                        ${categorias.sucesso && categorias.categorias ? `<div><strong>Categorias encontradas:</strong> ${categorias.categorias.length}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            html = `
                <div style="padding: 16px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #721c24;">✗ Erro na conexão</h4>
                    <div style="font-size: 14px; line-height: 1.8;">
                        <div><strong>Erro:</strong> ${teste.erro || 'Erro desconhecido'}</div>
                        <div><strong>Status:</strong> ${teste.status || 'N/A'}</div>
                        <div style="margin-top: 12px; font-size: 13px;">
                            <strong>Possíveis causas:</strong>
                            <ul style="margin: 8px 0 0 20px; padding: 0;">
                                <li>Credenciais incorretas (Consumer Key/Secret)</li>
                                <li>URL da API incorreta</li>
                                <li>Permissões insuficientes na chave da API</li>
                                <li>Problemas de rede ou firewall</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }

        resultadoDiv.innerHTML = html;

    } catch (error) {
        console.error('Erro ao testar conexão:', error);
        resultadoDiv.innerHTML = `
            <div style="padding: 16px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #721c24;">✗ Erro ao testar conexão</h4>
                <div style="font-size: 14px;">${error.message}</div>
            </div>
        `;
    }
}

/**
 * Reseta configurações do WooCommerce
 */
function resetarWooCommerce() {
    if (estadoAtual.dados.woocommerce) {
        const dados = estadoAtual.dados.woocommerce;
        document.getElementById('wc-url').value = dados.url || '';
        document.getElementById('wc-api-url').value = dados.api_url || '';
        document.getElementById('wc-consumer-key').value = dados.consumer_key || '';
        document.getElementById('wc-consumer-secret').value = dados.consumer_secret || '';
    }
}

/**
 * Carrega seção de Conexão FocusNFe - Página única com todas as configurações
 */
async function carregarConexaoFocus() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    if (window.Components && window.Components.renderizarLoading) {
        contentArea.innerHTML = window.Components.renderizarLoading();
    } else {
        contentArea.innerHTML = '<div class="content-section"><div class="loading-spinner"></div><p>Carregando...</p></div>';
    }

    // Buscar configurações do FocusNFe (sempre usar do banco)
    const resultado = await API.Config.getFocus();

    const dadosFocus = resultado.sucesso ? resultado.dados : {
        ambiente: 'homologacao',
        token_homologacao: '',
        token_producao: ''
    };

    // Usar sempre o ambiente do banco (dadosFocus.ambiente)
    const ambienteAtual = dadosFocus.ambiente || 'homologacao';

    const tokenHomologacao = dadosFocus.token_homologacao || '';
    const tokenProducao = dadosFocus.token_producao || '';

    const html = `
        <div class="content-section">
            <h2 class="section-title">Conexão FocusNFe</h2>
            <div style="max-width: 900px;">
                <form id="form-focus-config">
                    <!-- Ambiente -->
                    <div class="form-group" style="margin-bottom: 32px;">
                        <label class="form-label">Ambiente</label>
                        <select class="form-select" id="focus-ambiente">
                            <option value="homologacao" ${ambienteAtual === 'homologacao' ? 'selected' : ''}>Homologação (Testes)</option>
                            <option value="producao" ${ambienteAtual === 'producao' ? 'selected' : ''}>Produção (Real)</option>
                        </select>
                        <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                            Ambiente atual: <strong>${ambienteAtual.toUpperCase()}</strong>
                            <br>
                            <span style="font-size: 12px;">
                                <strong>Homologação:</strong> Ambiente de testes, notas não têm valor fiscal<br>
                                <strong>Produção:</strong> Ambiente real, notas têm valor fiscal
                            </span>
                        </small>
            </div>
                    
                    <!-- Token de Homologação -->
                <div class="form-group" style="margin-bottom: 32px;">
                    <label class="form-label">Token de Homologação</label>
                    <input type="password" class="form-input" id="token-homologacao" value="${tokenHomologacao}" placeholder="Token de homologação">
                </div>
                    
                    <!-- Token de Produção -->
                <div class="form-group" style="margin-bottom: 32px;">
                    <label class="form-label">Token de Produção</label>
                    <input type="password" class="form-input" id="token-producao" value="${tokenProducao}" placeholder="Token de produção">
                </div>
                    
                    <!-- Informações adicionais -->
                    <div style="background-color: var(--color-gray-light); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--color-gray-dark);">Como obter os tokens</h3>
                        <ol style="margin: 0; padding-left: 20px; color: var(--color-gray-medium); font-size: 14px; line-height: 1.8;">
                            <li>Acesse o painel da FocusNFe: <a href="https://focusnfe.com.br" target="_blank" style="color: var(--color-orange);">https://focusnfe.com.br</a></li>
                            <li>Faça login na sua conta</li>
                            <li>Vá em <strong>Configurações > Tokens</strong></li>
                            <li>Copie o token de homologação ou produção conforme necessário</li>
                            <li>Cole o token no campo correspondente acima</li>
                        </ol>
                </div>
                    
                    <!-- Teste de Conexão -->
                    <div style="margin-bottom: 24px; padding-top: 24px; border-top: 1px solid var(--color-border);">
                        <button type="button" class="btn btn-secondary" onclick="testarConexaoFocus()" id="btn-testar-conexao" style="width: 100%; margin-bottom: 16px;">
                            Testar Conexão
                        </button>
                        <div id="resultado-teste-focus" style="display: none;"></div>
            </div>
                    
                    <!-- Botões de ação -->
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="resetarFocusConfig()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Configurações</button>
                </div>
                </form>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;

    // Adicionar event listener ao formulário
    const form = document.getElementById('form-focus-config');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarFocusConfig();
        });
    }

    // Salvar dados originais para reset
    estadoAtual.dados.focus = {
        ambiente: ambienteAtual,
        token_homologacao: tokenHomologacao,
        token_producao: tokenProducao
    };
}


/**
 * Toggle visibilidade do token
 */
function toggleTokenVisibility(tipo) {
    const input = document.getElementById(`token-${tipo}`);
    const btn = document.getElementById(`btn-toggle-${tipo}`);

    if (!input || !btn) return;

    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Ocultar';
    } else {
        input.type = 'password';
        btn.textContent = 'Mostrar';
    }

    // Atualizar preview
    const previewId = `token-preview-${tipo}`;
    const preview = document.getElementById(previewId);
    if (preview && input.value) {
        preview.textContent = input.value.substring(0, 10) + '...';
    }
}

/**
 * Salva configurações do FocusNFe
 */
async function salvarFocusConfig() {
    const ambiente = document.getElementById('focus-ambiente').value;
    const tokenHomologacao = document.getElementById('token-homologacao').value.trim();
    const tokenProducao = document.getElementById('token-producao').value.trim();

    // Validação básica
    if (ambiente === 'homologacao' && !tokenHomologacao) {
        alert('O token de homologação é obrigatório quando o ambiente está em homologação.');
        return;
    }

    if (ambiente === 'producao' && !tokenProducao) {
        alert('O token de produção é obrigatório quando o ambiente está em produção.');
        return;
    }

    // Mostrar loading
    const submitBtn = document.querySelector('#form-focus-config button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
        const resultado = await API.Config.salvarFocus({
            ambiente: ambiente,
            token_homologacao: tokenHomologacao,
            token_producao: tokenProducao
        });

        if (resultado.sucesso) {
            // Atualizar o select diretamente com o valor retornado
            const ambienteSalvo = resultado.dados?.ambiente || ambiente;
            const selectAmbiente = document.getElementById('focus-ambiente');
            if (selectAmbiente) {
                selectAmbiente.value = ambienteSalvo;
            }

            // Atualizar o texto "Ambiente atual" também
            const ambienteAtualText = document.querySelector('small strong');
            if (ambienteAtualText) {
                ambienteAtualText.textContent = ambienteSalvo.toUpperCase();
            }

            // Verificar se é configuração temporária (Vercel)
            if (resultado.dados?.temporario || resultado.aviso) {
                // Mostrar instruções para configurar no dashboard Vercel
                const instrucoes = resultado.instrucoes || [];
                const mensagem = resultado.mensagem || 'Configuração temporária aplicada.';

                let mensagemCompleta = mensagem + '\n\n';
                if (instrucoes.length > 0) {
                    mensagemCompleta += '📋 Instruções:\n\n';
                    instrucoes.forEach(inst => {
                        mensagemCompleta += inst + '\n';
                    });
                }

                mensagemCompleta += '\n⚠️ As configurações serão temporárias até você configurar no dashboard da Vercel.';

                alert(mensagemCompleta);
            } else {
                alert('Configurações salvas com sucesso!');
            }

            // Recarregar página para atualizar todos os dados
            await carregarConexaoFocus();
        } else {
            const erroMsg = typeof resultado.erro === 'string' ? resultado.erro : 
                          (resultado.erro?.mensagem || resultado.erro?.message || JSON.stringify(resultado.erro) || 'Erro desconhecido');
            alert('Erro ao salvar configurações: ' + erroMsg);
        }
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        alert('Erro ao salvar configurações: ' + errorMsg);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * Reseta configurações do FocusNFe
 */
async function resetarFocusConfig() {
    if (estadoAtual.dados.focus) {
        const dados = estadoAtual.dados.focus;
        document.getElementById('focus-ambiente').value = dados.ambiente || 'homologacao';
        document.getElementById('token-homologacao').value = dados.token_homologacao || '';
        document.getElementById('token-producao').value = dados.token_producao || '';
    } else {
        // Recarregar do servidor
        await carregarConexaoFocus();
    }
}

/**
 * Testa conexão com FocusNFe
 */
async function testarConexaoFocus() {
    const resultadoDiv = document.getElementById('resultado-teste-focus');
    const btnTestar = document.getElementById('btn-testar-conexao');

    if (!resultadoDiv || !btnTestar) return;

    // Mostrar loading
    resultadoDiv.style.display = 'block';
    resultadoDiv.innerHTML = `
        <div style="padding: 12px; background-color: #f8f9fa; border-radius: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
                <span style="color: #666; font-size: 14px;">Testando conexão com FocusNFe...</span>
            </div>
        </div>
    `;

    btnTestar.disabled = true;
    btnTestar.textContent = 'Testando...';

    try {
        const resultado = await API.Config.testarConexao();

        let html = '';
        if (resultado.sucesso) {
            html = `
                <div style="padding: 16px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; color: #155724;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #155724;">✓ Conexão bem-sucedida!</h4>
                    <div style="font-size: 14px; line-height: 1.8;">
                        <div><strong>Status:</strong> ${resultado.mensagem || 'Conexão estabelecida'}</div>
                        <div><strong>Ambiente:</strong> ${resultado.ambiente ? resultado.ambiente.toUpperCase() : 'N/A'}</div>
                        ${resultado.status ? `<div><strong>Status HTTP:</strong> ${resultado.status}</div>` : ''}
                        ${resultado.token_preview ? `<div><strong>Token:</strong> ${resultado.token_preview}</div>` : ''}
                        ${resultado.detalhes ? `<div style="margin-top: 8px; font-size: 13px; color: #155724;">${resultado.detalhes}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            html = `
                <div style="padding: 16px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #721c24;">✗ Erro na conexão</h4>
                    <div style="font-size: 14px; line-height: 1.8;">
                        <div><strong>Erro:</strong> ${(() => {
                            const erro = resultado.erro || resultado.mensagem || 'Erro desconhecido';
                            if (typeof erro === 'string') return erro;
                            if (typeof erro === 'object') {
                                return erro.mensagem || erro.message || JSON.stringify(erro);
                            }
                            return String(erro);
                        })()}</div>
                        ${resultado.status ? `<div><strong>Status HTTP:</strong> ${resultado.status}</div>` : ''}
                        ${resultado.ambiente ? `<div><strong>Ambiente:</strong> ${resultado.ambiente.toUpperCase()}</div>` : ''}
                        ${resultado.detalhes ? `<div style="margin-top: 12px; font-size: 13px; color: #721c24;"><strong>Detalhes:</strong> ${resultado.detalhes}</div>` : ''}
                        <div style="margin-top: 12px; font-size: 13px;">
                            <strong>Possíveis causas:</strong>
                            <ul style="margin: 8px 0 0 20px; padding: 0;">
                                <li>Token inválido ou expirado</li>
                                <li>Token não tem permissão para acessar a API</li>
                                <li>Ambiente incorreto (homologação vs produção)</li>
                                <li>Problemas de rede ou firewall</li>
                                <li>Servidor FocusNFe temporariamente indisponível</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }

        resultadoDiv.innerHTML = html;

    } catch (error) {
        console.error('Erro ao testar conexão:', error);
        resultadoDiv.innerHTML = `
            <div style="padding: 16px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #721c24;">✗ Erro ao testar conexão</h4>
                <div style="font-size: 14px;">${error.message || 'Erro desconhecido ao testar conexão'}</div>
            </div>
        `;
    } finally {
        btnTestar.disabled = false;
        btnTestar.textContent = 'Testar Conexão';
    }
}

/**
 * Carrega seção de Requisições
 */
async function carregarRequisicoes() {
    const contentArea = document.getElementById('content-area');

    const html = `
        <div class="content-section">
            <h2 class="section-title">Pesquisa de Requisições</h2>
            ${window.Components ? window.Components.renderizarFormularioPesquisa('pesquisarRequisicoes', 'limparFiltrosRequisicoes') : '<div>Erro: Components não disponível</div>'}
        </div>
        <div class="content-section">
            <h2 class="section-title">Requisições</h2>
            <div id="tabela-requisicoes">
                ${window.Components ? window.Components.renderizarLoading() : '<div class="loading-spinner"></div><p>Carregando...</p>'}
            </div>
            <div id="paginacao-requisicoes"></div>
        </div>
    `;

    contentArea.innerHTML = html;

    // Carregar dados iniciais
    await buscarRequisicoes();
}

/**
 * Busca requisições com filtros
 */
async function buscarRequisicoes() {
    const tabelaArea = document.getElementById('tabela-requisicoes');
    const paginacaoArea = document.getElementById('paginacao-requisicoes');

    if (!tabelaArea) return;

    tabelaArea.innerHTML = window.Components ? window.Components.renderizarLoading() : '<div class="loading-spinner"></div><p>Carregando...</p>';

    const filtros = {
        limite: 50,
        offset: (estadoAtual.paginaAtual - 1) * 50,
        ...estadoAtual.filtros
    };

    const resultado = await API.NFSe.listar(filtros);

    if (resultado.sucesso) {
        estadoAtual.dados.requisicoes = Array.isArray(resultado.dados) ? resultado.dados : [];
        tabelaArea.innerHTML = window.Components ? window.Components.renderizarTabelaRequisicoes(estadoAtual.dados.requisicoes) : '<div>Erro: Components não disponível</div>';

        // Calcular paginação (assumindo 50 itens por página)
        const totalPaginas = Math.ceil(estadoAtual.dados.requisicoes.length / 50) || 1;
        paginacaoArea.innerHTML = window.Components ? window.Components.renderizarPaginacao(
            estadoAtual.paginaAtual,
            totalPaginas,
            'mudarPaginaRequisicoes'
        ) : '';
    } else {
        tabelaArea.innerHTML = `<div class="empty-state"><p>Erro ao carregar requisições: ${resultado.erro}</p></div>`;
    }
}

/**
 * Pesquisa requisições com filtros do formulário
 */
function pesquisarRequisicoes() {
    const form = document.getElementById('form-pesquisa');
    if (!form) return;

    const formData = new FormData(form);
    estadoAtual.filtros = {};

    // Coletar filtros
    const referencia = formData.get('referencia');
    if (referencia) estadoAtual.filtros.referencia = referencia;

    const numero = formData.get('numero');
    if (numero) estadoAtual.filtros.numero = numero;

    estadoAtual.paginaAtual = 1;
    buscarRequisicoes();
}

/**
 * Limpa filtros de requisições
 */
function limparFiltrosRequisicoes() {
    const form = document.getElementById('form-pesquisa');
    if (form) form.reset();

    estadoAtual.filtros = {};
    estadoAtual.paginaAtual = 1;
    buscarRequisicoes();
}

/**
 * Muda página de requisições
 */
function mudarPaginaRequisicoes(pagina) {
    if (pagina < 1) return;
    estadoAtual.paginaAtual = pagina;
    buscarRequisicoes();
}

/**
 * Agrupa pedidos por mês
 */
function agruparPedidosPorMes(pedidos) {
    const grupos = {};

    pedidos.forEach(pedido => {
        // Pedidos podem estar em formato WooCommerce (já convertidos) ou formato banco
        let dateCreated = null;
        let total = 0;

        // Tentar obter data de diferentes formas (usando parseDateSafe para formatos corrompidos)
        if (pedido.date_created) {
            dateCreated = parseDateSafe(pedido.date_created);
        } else if (pedido.created_at) {
            dateCreated = parseDateSafe(pedido.created_at);
        } else if (pedido.dados_pedido) {
            const dadosPedido = typeof pedido.dados_pedido === 'string'
                ? JSON.parse(pedido.dados_pedido)
                : pedido.dados_pedido;
            dateCreated = parseDateSafe(dadosPedido.date_created || dadosPedido.data_pedido || dadosPedido.data_emissao || dadosPedido.created_at);
        }

        // Se não conseguiu obter data válida, pular este pedido
        if (!dateCreated || isNaN(dateCreated.getTime())) {
            console.warn('Pedido sem data válida:', pedido);
            return;
        }

        const mesAno = `${dateCreated.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
        const chave = `${dateCreated.getFullYear()}-${String(dateCreated.getMonth() + 1).padStart(2, '0')}`;

        // Obter total
        if (pedido.total) {
            total = parseFloat(pedido.total) || 0;
        } else if (pedido.dados_pedido) {
            const dadosPedido = typeof pedido.dados_pedido === 'string'
                ? JSON.parse(pedido.dados_pedido)
                : pedido.dados_pedido;
            total = parseFloat(dadosPedido.total || dadosPedido.valor_total || dadosPedido.valor_servicos || 0);
        }

        if (!grupos[chave]) {
            grupos[chave] = {
                mesAno,
                pedidos: [],
                total: 0,
                quantidade: 0
            };
        }

        grupos[chave].pedidos.push(pedido);
        grupos[chave].quantidade++;
        grupos[chave].total += total;
    });

    return grupos;
}

/**
 * Atualiza a barra de status de conexão
 */
function atualizarStatusConexao(mensagem, tipo = 'info') {
    const statusBar = document.getElementById('status-woocommerce');
    if (!statusBar) return;

    const icones = {
        'info': '⏳',
        'success': '✓',
        'error': '✗',
        'warning': '⚠'
    };

    const cores = {
        'info': '#666',
        'success': '#28a745',
        'error': '#dc3545',
        'warning': '#ffc107'
    };

    statusBar.innerHTML = `
        <span style="color: ${cores[tipo]}; font-size: 12px;">
            ${icones[tipo]} ${mensagem}
        </span>
    `;
}

/**
 * Carrega seção de Pedidos WooCommerce - Mostra todos os pedidos com filtros de mês
 */
/**
 * Converte pedido do banco de dados para formato WooCommerce (para compatibilidade com a interface)
 */
function converterPedidoBancoParaWooCommerce(pedidoBanco) {
    // O backend pode retornar dados já extraídos de dados_pedido ou o formato original
    // Verificar se os dados já estão no formato WooCommerce (tem billing, line_items, etc)
    if (pedidoBanco.billing && pedidoBanco.line_items && pedidoBanco.date_created) {
        // Já está no formato WooCommerce, retornar como está
        return pedidoBanco;
    }

    // O backend pode retornar dados de duas formas:
    // 1. Com dados_pedido como objeto/string JSON (formato original do banco)
    // 2. Com dados já extraídos usando spread (formato do listarPedidosBanco)

    let dados = {};

    // Tentar obter dados_pedido primeiro
    if (pedidoBanco.dados_pedido) {
        dados = pedidoBanco.dados_pedido;
        if (typeof dados === 'string') {
            try {
                dados = JSON.parse(dados);
            } catch (e) {
                console.warn('Erro ao parsear dados_pedido:', e);
                dados = {};
            }
        }
    }

    // Se dados_pedido não existe ou está vazio, o backend extraiu os dados diretamente
    // Nesse caso, usar os campos diretos do pedidoBanco
    if (!dados || Object.keys(dados).length === 0 || (!dados.nome && !dados.servicos && !dados.valor_total && !dados.endereco)) {
        // O backend extraiu dados_pedido usando spread, então os campos estão diretamente no objeto
        // Usar pedidoBanco diretamente como dados
        dados = pedidoBanco;
    }

    // Obter pedido_id - pode estar em diferentes lugares
    const pedidoId = pedidoBanco.pedido_id || dados.pedido_id || pedidoBanco._id_banco || pedidoBanco.id || pedidoBanco.number;

    // Obter data de criação - tentar múltiplas fontes
    let dateCreatedRaw = dados.data_pedido || dados.data_emissao || dados.date_created || pedidoBanco.created_at || pedidoBanco.date_created;

    // Usar parseDateSafe para lidar com formatos corrompidos do Google Sheets
    let dateCreatedParsed = parseDateSafe(dateCreatedRaw);
    let dateCreated;
    if (dateCreatedParsed) {
        dateCreated = dateCreatedParsed.toISOString();
    } else {
        console.warn('Pedido sem data válida, usando data atual:', pedidoBanco.pedido_id);
        dateCreated = new Date().toISOString();
    }

    // Obter nome completo do cliente
    const nomeCompleto = dados.nome || '';
    const nomePartes = nomeCompleto.split(' ');
    const firstName = nomePartes[0] || '';
    const lastName = nomePartes.slice(1).join(' ') || '';

    // Calcular total se não existir
    let totalPedido = dados.valor_total || dados.valor_servicos || dados.total || 0;
    if (!totalPedido && dados.servicos && Array.isArray(dados.servicos)) {
        totalPedido = dados.servicos.reduce((sum, s) => sum + parseFloat(s.total || s.valor_unitario || 0), 0);
    }

    // Converter para formato WooCommerce
    const pedidoConvertido = {
        id: parseInt(pedidoId) || pedidoId || '-',
        number: pedidoId || '-',
        date_created: dateCreated,
        total: parseFloat(totalPedido) || 0, // Manter como número para cálculos
        status: pedidoBanco.status || dados.status_wc || pedidoBanco._status_emissao || 'pending',
        billing: {
            first_name: firstName,
            last_name: lastName,
            company: dados.razao_social || dados.nome || '',
            email: dados.email || '',
            phone: dados.telefone || '',
            address_1: dados.endereco?.rua || '',
            address_2: dados.endereco?.complemento || dados.endereco?.numero || '',
            city: dados.endereco?.cidade || '',
            state: dados.endereco?.estado || '',
            postcode: dados.endereco?.cep || '',
            country: dados.endereco?.pais || 'BR'
        },
        line_items: (dados.servicos || []).map(servico => ({
            id: servico.codigo || servico.numero_item,
            name: servico.nome || servico.discriminacao || 'Serviço',
            quantity: parseFloat(servico.quantidade) || 1,
            price: parseFloat(servico.valor_unitario) || 0,
            total: parseFloat(servico.total || servico.valor_unitario) || 0,
            subtotal: parseFloat(servico.subtotal || servico.total || servico.valor_unitario) || 0,
            categories: Array.isArray(servico.categorias) ? servico.categorias : (servico.categoria ? [servico.categoria] : []),
            category: servico.categorias && Array.isArray(servico.categorias) && servico.categorias.length > 0
                ? servico.categorias[0]
                : (servico.categoria || null)
        })),
        shipping_total: parseFloat(dados.frete) || 0,
        discount_total: parseFloat(dados.desconto_total) || 0,
        payment_method: dados.forma_pagamento || 'pix',
        customer_note: dados.observacoes || '',
        // Preservar dados_pedido original para referência
        dados_pedido: dados,
        // Preservar campos do backend
        _id_banco: pedidoBanco._id_banco || pedidoBanco.id,
        _status_emissao: pedidoBanco._status_emissao || pedidoBanco.status,
        _tem_nfse: pedidoBanco._tem_nfse,
        _tem_nfe: pedidoBanco._tem_nfe
    };

    return pedidoConvertido;
}

// Intervalos de polling (em ms)
let pollingInterval = null;
let pollingIntervalServico = null;
let pollingNotasInterval = null;
const POLLING_DELAY = 30000; // 30 segundos

/**
 * Verifica se o pedido contém itens de categorias configuradas como produto.
 * Usa window._categoriasProdutoCache (carregado do banco) ou fallback para "Livro Faíscas".
 */
function isPedidoDeProduto(pedido, categoriasProduto) {
    const catsRaw = (categoriasProduto !== undefined ? categoriasProduto : window._categoriasProdutoCache);

    let catsLower = [];

    // Se ainda nao carregou config (null/undefined), usa fallback antigo para nao quebrar fluxo.
    if (catsRaw === null || catsRaw === undefined) {
        catsLower = ['livro faiscas', 'livro faíscas'];
    } else if (Array.isArray(catsRaw) && catsRaw.length === 0) {
        // Se o usuario salvou lista vazia, nao ha categorias de produto.
        // Mantem Woo Produtos coerente com a configuracao do painel.
        return false;
    } else {
        catsLower = (Array.isArray(catsRaw) ? catsRaw : []).map(c =>
            String(c).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
    }

    const dadosPedido = typeof pedido.dados_pedido === 'string'
        ? JSON.parse(pedido.dados_pedido)
        : pedido.dados_pedido || pedido;

    const lineItems = dadosPedido.line_items || pedido.line_items || [];
    if (lineItems.length === 0) return false;

    for (const item of lineItems) {
        if (item.categories && Array.isArray(item.categories)) {
            for (const cat of item.categories) {
                const nome = (typeof cat === 'string' ? cat : cat.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (catsLower.some(c => nome.includes(c) || c.includes(nome))) return true;
            }
        }
        if (item.category) {
            const nome = (typeof item.category === 'string' ? item.category : item.category.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (catsLower.some(c => nome.includes(c) || c.includes(nome))) return true;
        }
        if (item.name) {
            const nome = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (catsLower.some(c => nome.includes(c))) return true;
        }
    }

    if (window.Components && typeof window.Components.extrairCategoriasPedido === 'function') {
        const categorias = window.Components.extrairCategoriasPedido(pedido);
        const match = categorias.some(cat => {
            const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return catsLower.some(c => catLower.includes(c) || c.includes(catLower));
        });
        if (match) return true;
    }

    return false;
}

async function carregarPedidos() {
    const contentArea = document.getElementById('content-area');
    const meses = gerarListaMeses();

    // Mostrar tela inicial
    contentArea.innerHTML = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Woo Produtos</h2>
                <div id="status-woocommerce" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                    <span style="color: #666; font-size: 12px;">⏳ Carregando...</span>
                </div>
            </div>
            <div style="text-align: center; padding: 40px;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                <p style="color: var(--color-gray-medium);">Carregando pedidos...</p>
            </div>
        </div>
    `;

    try {
        // Carregar categorias de produto antes de filtrar
        await carregarCategoriasProdutoCache();

        atualizarStatusConexao('Carregando do banco...', 'info');

        let todosPedidos = [];
        const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });

        if (resultadoBanco.sucesso && resultadoBanco.dados && resultadoBanco.dados.length > 0) {
            todosPedidos = resultadoBanco.dados;

            todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

            todosPedidos = todosPedidos.filter(pedido => isPedidoDeProduto(pedido));

            // Ordenar por data
            todosPedidos.sort((a, b) => {
                const dataA = new Date(a.date_created || 0);
                const dataB = new Date(b.date_created || 0);
                return dataB - dataA;
            });

            // Salvar no estado e renderizar IMEDIATAMENTE
            estadoAtual.dados.meses = meses;
            estadoAtual.dados.todosPedidos = todosPedidos;
            estadoAtual.filtroMes = null;
            estadoAtual.filtroStatus = null;
            estadoAtual.filtroCategoria = null;
            estadoAtual.agruparPorCategoria = false;

            renderizarTelaPedidos(todosPedidos, meses);
            atualizarStatusConexao(`✓ ${todosPedidos.length} pedidos de produto carregados`, 'success');

            // 2. ATUALIZAR EM BACKGROUND (em lotes pequenos, sem bloquear)
            sincronizarEmBackground();

        } else {
            // Banco vazio - fazer primeira importação
            atualizarStatusConexao('Importando do WooCommerce...', 'info');
            await importarPrimeiraVez(meses);
        }

        // Iniciar polling
        iniciarPollingPedidos();

    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        atualizarStatusConexao(`✗ Erro: ${error.message}`, 'error');
        contentArea.innerHTML = `
            <div class="content-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 class="section-title" style="margin: 0;">Woo Produtos</h2>
                    <div id="status-woocommerce" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #dc3545; font-size: 12px;">✗ Erro: ${error.message}</span>
                    </div>
                </div>
                <div class="empty-state">
                    <p>Erro ao carregar pedidos: ${error.message}</p>
                    <button class="btn btn-primary" onclick="carregarPedidos()" style="margin-top: 16px;">Tentar novamente</button>
                </div>
            </div>
        `;
    }
}

/**
 * Carrega seção de Pedidos Woo Serviço - Mostra apenas pedidos de serviço (excluindo Livro Faíscas)
 */
async function carregarPedidosServico(mostrarLoading = true) {
    const contentArea = document.getElementById('content-area');
    const meses = gerarListaMeses();

    // Mostrar tela inicial
    if (mostrarLoading) {
        contentArea.innerHTML = `
            <div class="content-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 class="section-title" style="margin: 0;">Woo Serviços</h2>
                    <div id="status-woocommerce-servico" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #666; font-size: 12px;">⏳ Carregando...</span>
                    </div>
                </div>
                <div style="text-align: center; padding: 40px;">
                    <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                    <p style="color: var(--color-gray-medium);">Carregando pedidos de serviço...</p>
                </div>
            </div>
        `;
    }

    try {
        await carregarCategoriasProdutoCache();

        if (mostrarLoading) atualizarStatusConexaoServico('Carregando do banco...', 'info');

        let todosPedidos = [];
        const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });

        if (resultadoBanco.sucesso && resultadoBanco.dados && resultadoBanco.dados.length > 0) {
            todosPedidos = resultadoBanco.dados;

            todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

            todosPedidos = todosPedidos.filter(pedido => !isPedidoDeProduto(pedido));

            // Ordenar por data
            todosPedidos.sort((a, b) => {
                const dataA = new Date(a.date_created || 0);
                const dataB = new Date(b.date_created || 0);
                return dataB - dataA;
            });

            // Salvar no estado e renderizar IMEDIATAMENTE
            estadoAtual.dados.meses = meses;
            estadoAtual.dados.todosPedidosServico = todosPedidos;
            estadoAtual.filtroMes = null;
            estadoAtual.filtroStatus = null;
            if (mostrarLoading) {
                estadoAtual.filtroCategoria = null;
                estadoAtual.agruparPorCategoria = false;
            }

            renderizarTelaPedidosServico(todosPedidos, meses, estadoAtual.filtroStatus, estadoAtual.filtroCategoria, estadoAtual.agruparPorCategoria);

            if (document.getElementById('status-woocommerce-servico')) {
                atualizarStatusConexaoServico(`✓ ${todosPedidos.length} pedidos de serviço carregados`, 'success');
            }

            // 2. ATUALIZAR EM BACKGROUND (em lotes pequenos, sem bloquear)
            sincronizarEmBackgroundServico();

        } else {
            // Banco vazio - fazer primeira importação
            if (mostrarLoading) atualizarStatusConexaoServico('Importando do WooCommerce...', 'info');
            await importarPrimeiraVezServico(meses);
        }

        // Iniciar polling
        iniciarPollingPedidosServico();

    } catch (error) {
        console.error('Erro ao carregar pedidos de serviço:', error);
        if (mostrarLoading) {
            atualizarStatusConexaoServico(`✗ Erro: ${error.message}`, 'error');
            contentArea.innerHTML = `
                <div class="content-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2 class="section-title" style="margin: 0;">Woo Serviços</h2>
                        <div id="status-woocommerce-servico" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                            <span style="color: #dc3545; font-size: 12px;">✗ Erro: ${error.message}</span>
                        </div>
                    </div>
                    <div class="empty-state">
                        <p>Erro ao carregar pedidos de serviço: ${error.message}</p>
                        <button class="btn btn-primary" onclick="carregarPedidosServico()" style="margin-top: 16px;">Tentar novamente</button>
                    </div>
                </div>
            `;
        } else {
            console.error('Erro silent:', error);
        }
    }
}

/**
 * Atualiza status da conexão WooCommerce para a aba de serviço
 */
function atualizarStatusConexaoServico(mensagem, tipo = 'info') {
    const statusEl = document.getElementById('status-woocommerce-servico');
    if (!statusEl) return;

    const cores = {
        success: '#28a745',
        error: '#dc3545',
        info: '#666',
        warning: '#ffc107'
    };

    statusEl.innerHTML = `<span style="color: ${cores[tipo] || cores.info}; font-size: 12px;">${mensagem}</span>`;
}

/**
 * Renderiza a tela de pedidos de serviço com accordion de meses
 * Baseado em renderizarTelaPedidos, mas com título "Pedidos Woo Serviço"
 */
function renderizarTelaPedidosServico(pedidos, meses, filtroStatus = null, filtroCategoria = null, agruparPorCategoria = false) {
    const contentArea = document.getElementById('content-area');

    // Verificar se Components está disponível
    if (!window.Components || typeof window.Components.renderizarTabelaPedidos !== 'function') {
        console.error('Components não está disponível. Aguardando carregamento...');
        setTimeout(() => renderizarTelaPedidosServico(pedidos, meses, filtroStatus, filtroCategoria, agruparPorCategoria), 100);
        return;
    }

    // Debug: verificar se pedidos está definido
    console.log('renderizarTelaPedidosServico chamado:', {
        totalPedidos: pedidos ? pedidos.length : 0,
        meses: meses ? meses.length : 0,
        filtroStatus,
        filtroCategoria,
        agruparPorCategoria
    });

    // Garantir que pedidos é um array
    if (!pedidos || !Array.isArray(pedidos)) {
        console.error('Pedidos não é um array válido:', pedidos);
        pedidos = [];
    }

    // Extrair categorias de serviço (excluindo as de produto)
    const catsProduto = (window._categoriasProdutoCache || []).map(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const todasCategorias = new Set();
    pedidos.forEach(pedido => {
        const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
        if (categorias.length > 0) {
            categorias.forEach(cat => {
                const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const isProduto = catsProduto.some(c => catLower.includes(c) || c.includes(catLower));
                if (!isProduto) {
                    todasCategorias.add(cat);
                }
            });
        } else {
            todasCategorias.add('Sem categoria');
        }
    });
    const categoriasOrdenadas = Array.from(todasCategorias).sort();

    // Aplicar filtros
    let pedidosFiltrados = [...pedidos];

    if (filtroStatus && filtroStatus !== 'todos') {
        pedidosFiltrados = pedidosFiltrados.filter(p => {
            const dadosPedido = typeof p.dados_pedido === 'string' ? JSON.parse(p.dados_pedido) : (p.dados_pedido || p);
            return (dadosPedido.status || 'pending') === filtroStatus;
        });
    }

    if (filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.length > 0) {
        pedidosFiltrados = pedidosFiltrados.filter(pedido => {
            const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
            if (categorias.length === 0) {
                return filtroCategoria.includes('sem-categoria');
            }
            // Verificar se alguma categoria do pedido está na lista de filtros
            return categorias.some(cat => {
                const categoriaNormalizada = cat.toLowerCase().replace(/\s+/g, '-');
                return filtroCategoria.includes(categoriaNormalizada);
            });
        });
    }

    // Agrupar pedidos por mês
    const pedidosPorMes = agruparPedidosPorMes(pedidosFiltrados);
    const mesesOrdenados = meses.sort((a, b) => b.value.localeCompare(a.value));

    // Opções de status
    const statusOptions = [
        { value: 'todos', label: 'Todos os status' },
        { value: 'pending', label: 'Pendente' },
        { value: 'processing', label: 'Processando' },
        { value: 'on-hold', label: 'Em espera' },
        { value: 'completed', label: 'Concluído' },
        { value: 'cancelled', label: 'Cancelado' },
        { value: 'refunded', label: 'Reembolsado' },
        { value: 'failed', label: 'Falhou' }
    ];

    const html = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Woo Serviços</h2>
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                    <button 
                        type="button" 
                        class="btn btn-primary" 
                        onclick="atualizarDadosWooCommerceServico()"
                        id="btn-atualizar-woocommerce-servico"
                        style="padding: 8px 16px; font-size: 14px;">
                        Recarregar do WooCommerce
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-secondary" 
                        onclick="sincronizarExcel()"
                        id="btn-sincronizar-excel"
                        style="padding: 8px 16px; font-size: 14px;">
                        🔄 Sincronizar (Geral)
                    </button>
                <div id="status-woocommerce-servico" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #28a745; font-size: 12px;">✓ ${pedidosFiltrados.length} pedidos ${filtroStatus || filtroCategoria ? 'filtrados' : 'carregados'}</span>
                    </div>
                </div>
            </div>
            
            <!-- Categorias de Serviço -->
            <div id="categorias-servico-container" style="padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #dee2e6; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 14px;">Categorias de Serviço (NFSe)</span>
                    <span id="cat-servico-info" style="font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #e2e3e5; color: #383d41;">carregando...</span>
                </div>
                <p style="font-size: 12px; color: #666; margin: 0 0 8px;">
                    Pedidos cujas categorias <strong>não</strong> são de produto aparecem aqui como serviço e geram NFSe.
                </p>
                <div id="cat-servico-list" style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span style="color: #888; font-size: 13px;">Carregando...</span>
                </div>
            </div>

            <!-- Importar do Google Sheets (collapsible) -->
            <div style="margin-bottom: 16px;">
                <button type="button" onclick="toggleConfigGSheets()" style="background: none; border: 1px solid #dee2e6; border-radius: 8px; padding: 10px 16px; cursor: pointer; width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #333;">
                    <span><strong>Importar do Google Sheets</strong> <span id="gsheets-config-status" style="font-size: 12px; margin-left: 8px; padding: 2px 8px; border-radius: 4px;">⏳</span></span>
                    <span id="gsheets-config-arrow">▶</span>
                </button>
                <div id="gsheets-config-panel" style="display: none; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px; padding: 20px; background: #fafafa; box-sizing: border-box;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; box-sizing: border-box;">
                        <div style="min-width: 0;">
                            <h4 style="margin: 0 0 12px 0; color: #333;">Credenciais</h4>
                            <div style="margin-bottom: 12px;">
                                <label style="font-weight: 600; font-size: 13px; color: #555; display: block; margin-bottom: 4px;">ID da Planilha</label>
                                <input type="text" id="gsheets-id" placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: monospace; box-sizing: border-box;">
                                <small style="color: #888; font-size: 11px;">Encontre na URL: docs.google.com/spreadsheets/d/<strong>{ID}</strong>/edit</small>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <label style="font-weight: 600; font-size: 13px; color: #555; display: block; margin-bottom: 4px;">JSON da Service Account</label>
                                <textarea id="gsheets-credentials" rows="6" placeholder='Cole aqui o conteúdo do arquivo .json da Service Account do Google Cloud...' style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; font-family: monospace; resize: vertical; box-sizing: border-box;"></textarea>
                                <small style="color: #888; font-size: 11px;">Baixado do Google Cloud Console > APIs > Credenciais > Service Account > Chaves</small>
                            </div>
                            <div style="margin-bottom: 8px;" id="gsheets-client-email-info"></div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button type="button" class="btn btn-primary" onclick="salvarConfigGSheets()" style="padding: 8px 16px; font-size: 13px;">Salvar</button>
                                <button type="button" class="btn btn-secondary" onclick="testarConfigGSheets()" style="padding: 8px 16px; font-size: 13px;">Testar Conexão</button>
                                <a id="link-abrir-planilha" href="https://docs.google.com/spreadsheets" target="_blank" class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px; text-decoration: none;">Abrir Planilha</a>
                            </div>
                            <div id="gsheets-feedback" style="margin-top: 8px; display: none; padding: 8px 12px; border-radius: 6px; font-size: 13px;"></div>
                        </div>
                        <div style="min-width: 0;">
                            <h4 style="margin: 0 0 12px 0; color: #333;">Modelo da Planilha</h4>
                            <p style="font-size: 12px; color: #666; margin-bottom: 8px;">Aba <strong>\"Pedidos\"</strong> com colunas:</p>
                            <div style="overflow-x: auto; border: 1px solid #ddd; border-radius: 6px; font-size: 11px;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead><tr style="background: #e8f5e9;">
                                        <th style="padding: 4px 8px; border: 1px solid #ddd;">A</th><th style="padding: 4px 8px; border: 1px solid #ddd;">B</th><th style="padding: 4px 8px; border: 1px solid #ddd;">C</th><th style="padding: 4px 8px; border: 1px solid #ddd;">D</th><th style="padding: 4px 8px; border: 1px solid #ddd;">E</th><th style="padding: 4px 8px; border: 1px solid #ddd;">F</th><th style="padding: 4px 8px; border: 1px solid #ddd;">G</th>
                                    </tr></thead>
                                    <tbody>
                                        <tr style="background: #f1f8e9; font-weight: 600;">
                                            <td style="padding: 4px 8px; border: 1px solid #ddd;">ID Pedido</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Data</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Cliente</td><td style="padding: 4px 8px; border: 1px solid #ddd;">CPF/CNPJ</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Email</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Serviço</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Valor</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p style="font-size: 11px; color: #888; margin-top: 6px;">+ colunas H-M: Status Woo, Status Nota, Nº Nota, Link PDF, Msg Erro, JSON Pedido</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Filtros -->
            <div style="background-color: var(--color-gray-light); padding: 16px; border-radius: 8px; margin-bottom: 24px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">Status:</label>
                    <select 
                        id="filtro-status-pedidos-servico"
                        onchange="aplicarFiltrosPedidosServico()"
                        style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-width: 180px;">
                        ${statusOptions.map(opt => `
                            <option value="${opt.value}" ${filtroStatus === opt.value ? 'selected' : ''}>
                                ${opt.label}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">
                        <input 
                            type="checkbox" 
                            id="agrupar-por-categoria-servico"
                            ${agruparPorCategoria ? 'checked' : ''}
                            onchange="aplicarFiltrosPedidosServico()"
                            style="margin-right: 6px;">
                        Agrupar por categoria
                    </label>
                </div>
                
                ${(filtroStatus || agruparPorCategoria) ? `
                    <button 
                        type="button"
                        class="btn btn-secondary"
                        onclick="limparFiltrosPedidosServico()"
                        style="padding: 6px 12px; font-size: 14px;">
                        Limpar Filtros
                    </button>
                ` : ''}
            </div>
            
            <!-- Accordion de Meses -->
            <div style="margin-bottom: 24px;">
                ${mesesOrdenados.map(mes => {
        const grupo = pedidosPorMes[mes.value] || { pedidos: [], total: 0, quantidade: 0 };
        const mesId = `mes-${mes.value.replace('-', '')}-servico`;
        return `
                        <div style="border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 12px; overflow: hidden;">
                    <button 
                        type="button" 
                                class="mes-accordion-header"
                                onclick="toggleMesServico('${mesId}')"
                                style="width: 100%; padding: 16px; background-color: var(--color-gray-light); border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; text-align: left; font-size: 16px; font-weight: 600; color: var(--color-gray-dark);">
                                <span>${mes.label}</span>
                                <span id="icon-${mesId}" style="font-size: 20px; transition: transform 0.3s;">▼</span>
                    </button>
                            <div id="${mesId}" class="mes-accordion-content" style="display: none; padding: 0;">
                                ${grupo.pedidos.length > 0 ? (window.Components && typeof window.Components.renderizarTabelaPedidos === 'function' ? window.Components.renderizarTabelaPedidos(grupo.pedidos, agruparPorCategoria) : '<div style="padding: 20px; text-align: center; color: #dc3545;">Erro: Components não disponível. Recarregue a página.</div>') : '<div style="padding: 20px; text-align: center; color: var(--color-gray-medium);">Nenhum pedido neste mês</div>'}
                                ${grupo.pedidos.length > 0 ? `
                                    <div style="padding: 16px; background-color: #f8f9fa; border-top: 1px solid var(--color-border);">
                                        <div style="display: flex; gap: 12px; justify-content: center; align-items: center; margin-bottom: 16px;">
                                            <button 
                                                type="button" 
                                                class="btn btn-primary"
                                                onclick="emitirNotasMesServico('${mes.value}')"
                                                style="padding: 12px 32px; font-size: 16px; font-weight: 600;">
                                                📄 Emitir Nota
                                            </button>
                                            <button 
                                                type="button"
                                                class="btn btn-secondary"
                                                onclick="emitirNFTeste('auto')"
                                                style="padding: 8px 16px; font-size: 12px; font-weight: 400; opacity: 0.7;">
                                                🧪 Emitir Teste
                                            </button>
                                        </div>
                                        <!-- Área de Logs -->
                                        <div id="logs-mes-${mes.value.replace('-', '')}-servico" style="margin-top: 16px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
                                            <div 
                                                id="logs-header-${mes.value.replace('-', '')}-servico"
                                                onclick="toggleLogsMesServico('${mes.value}')"
                                                style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8f9fa; cursor: pointer; border-bottom: 1px solid #ddd; user-select: none;"
                                                onmouseover="this.style.background='#e9ecef'"
                                                onmouseout="this.style.background='#f8f9fa'">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span id="logs-icon-${mes.value.replace('-', '')}-servico" style="font-size: 12px; transition: transform 0.2s;">▲</span>
                                                    <div style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">Log do Processo</div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onclick="event.stopPropagation(); carregarLogsMesServico('${mes.value}')"
                                                    style="padding: 4px 12px; font-size: 12px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;"
                                                    onmouseover="this.style.background='#e9ecef'"
                                                    onmouseout="this.style.background='white'">
                                                    Atualizar
                                                </button>
                                            </div>
                                            <div 
                                                id="conteudo-logs-mes-${mes.value.replace('-', '')}-servico" 
                                                style="display: block; background-color: #1e1e1e; color: #d4d4d4; padding: 12px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 300px; overflow-y: auto; min-height: 60px;">
                                                <div style="color: #888;">Carregando logs...</div>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
            
            <!-- Resumo -->
            <div style="background-color: var(--color-gray-light); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <div style="font-size: 14px; color: var(--color-gray-medium); margin-bottom: 4px;">Total de Pedidos</div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--color-gray-dark);">${pedidos.length}</div>
                    </div>
                    <div>
                        <div style="font-size: 14px; color: var(--color-gray-medium); margin-bottom: 4px;">Valor Total</div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--color-orange);">${window.Components ? window.Components.formatarValor(pedidos.reduce((sum, p) => sum + parseFloat(p.total || 0), 0)) : 'R$ 0,00'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;
    
    setTimeout(() => {
        if (typeof carregarCategoriasServicoInfo === 'function') carregarCategoriasServicoInfo();
        if (typeof carregarConfigGSheets === 'function') carregarConfigGSheets();
    }, 0);

    // Carregar logs automaticamente para todos os meses após renderizar
    setTimeout(() => {
        mesesOrdenados.forEach(mes => {
            const mesId = mes.value.replace('-', '');
            const logsContainer = document.getElementById(`conteudo-logs-mes-${mesId}-servico`);
            if (logsContainer) {
                // Garantir que está visível
                logsContainer.style.display = 'block';
                const icon = document.getElementById(`logs-icon-${mesId}-servico`);
                if (icon) {
                    icon.textContent = '▲';
                }
                // Carregar logs
                carregarLogsMesServico(mes.value);
            }
        });
    }, 500); // Pequeno delay para garantir que o DOM está pronto
}

/**
 * Toggle accordion para pedidos serviço
 */
function toggleAccordionServico(mesId) {
    const content = document.getElementById(mesId);
    const icon = document.getElementById(`icon-${mesId}`);

    if (content && icon) {
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        icon.textContent = isOpen ? '▶' : '▼';
    }
}

/**
 * Aplica filtros na aba de pedidos serviço
 */
function aplicarFiltrosPedidosServico() {
    const filtroStatus = document.getElementById('filtro-status-pedidos-servico')?.value || null;
    const filtroCategoriaEl = document.getElementById('filtro-categoria-pedidos-servico');
    const agruparPorCategoria = document.getElementById('agrupar-por-categoria-servico')?.checked || false;

    let filtroCategoria = null;
    if (filtroCategoriaEl) {
        const selecionadas = Array.from(filtroCategoriaEl.selectedOptions).map(opt => opt.value);
        if (selecionadas.length > 0 && !selecionadas.includes('todas')) {
            filtroCategoria = selecionadas;
        }
    }

    estadoAtual.filtroStatus = filtroStatus === 'todos' ? null : filtroStatus;
    estadoAtual.filtroCategoria = filtroCategoria;
    estadoAtual.agruparPorCategoria = agruparPorCategoria;

    renderizarTelaPedidosServico(
        estadoAtual.dados.todosPedidosServico || [],
        estadoAtual.dados.meses || [],
        estadoAtual.filtroStatus,
        estadoAtual.filtroCategoria,
        estadoAtual.agruparPorCategoria
    );
}

/**
 * Limpa filtros na aba de pedidos serviço
 */
function limparFiltrosPedidosServico() {
    estadoAtual.filtroStatus = null;
    estadoAtual.filtroCategoria = null;
    estadoAtual.agruparPorCategoria = false;

    renderizarTelaPedidosServico(
        estadoAtual.dados.todosPedidosServico || [],
        estadoAtual.dados.meses || [],
        null,
        null,
        false
    );
}

/**
 * Atualiza dados do WooCommerce para a aba de serviço
 */
async function atualizarDadosWooCommerceServico() {
    const statusBar = document.getElementById('status-woocommerce-servico');
    if (statusBar) {
        statusBar.innerHTML = '<span style="color: #666; font-size: 12px;">⏳ Recarregando pedidos do WooCommerce...</span>';
    }

    try {
        // Recarregar pedidos diretamente do WooCommerce (sem salvar no banco)
        await carregarPedidosServico();
    } catch (error) {
        console.error('Erro ao atualizar dados WooCommerce (serviço):', error);
        if (statusBar) {
            statusBar.innerHTML = `<span style="color: #dc3545; font-size: 12px;">✗ Erro: ${error.message}</span>`;
        }
    }
}

/**
 * Toggle dropdown de categorias para serviço
 */
function toggleDropdownCategoriasServico() {
    const dropdown = document.getElementById('dropdown-categorias-servico');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Toggle todas as categorias para serviço
 */
function toggleTodasCategoriasServico(checkbox) {
    const checkboxes = document.querySelectorAll('.checkbox-categoria-servico');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    atualizarFiltroCategoriasServico();
}

/**
 * Atualiza filtro de categorias para serviço
 */
function atualizarFiltroCategoriasServico() {
    const checkboxes = document.querySelectorAll('.checkbox-categoria-servico:checked');
    const categorias = Array.from(checkboxes).map(cb => cb.value);

    const textoEl = document.getElementById('texto-filtro-categoria-servico');
    if (textoEl) {
        textoEl.textContent = categorias.length > 0 ? `${categorias.length} categoria(s) selecionada(s)` : 'Todas as categorias';
    }

    const todasCheckbox = document.querySelector('.checkbox-categoria-todas-servico');
    if (todasCheckbox) {
        todasCheckbox.checked = categorias.length === 0;
    }

    aplicarFiltrosPedidosServico();
}

/**
 * Toggle mês no accordion para serviço
 */
function toggleMesServico(mesId) {
    const content = document.getElementById(mesId);
    const icon = document.getElementById(`icon-${mesId}`);

    if (!content || !icon) return;

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
    } else {
        content.style.display = 'none';
        icon.textContent = '▶';
    }
}

/**
 * Toggle logs do mês para serviço
 */
function toggleLogsMesServico(mes) {
    const mesId = mes.replace('-', '');
    const conteudo = document.getElementById(`conteudo-logs-mes-${mesId}-servico`);
    const icon = document.getElementById(`logs-icon-${mesId}-servico`);

    // Logs sempre ficam abertos na aba de serviço - apenas recarrega ao clicar
    if (conteudo && icon) {
        conteudo.style.display = 'block';
        icon.textContent = '▲';
        // Recarregar logs automaticamente ao clicar
        carregarLogsMesServico(mes);
    }
}

/**
 * Adiciona log ao container de logs do mês (serviço)
 */
function adicionarLogMesServico(mes, nivel, mensagem, dados = null) {
    const mesId = mes.replace('-', '');
    const logsContainer = document.getElementById(`conteudo-logs-mes-${mesId}-servico`);
    if (!logsContainer) return;

    // Garantir que está visível
    logsContainer.style.display = 'block';
    const icon = document.getElementById(`logs-icon-${mesId}-servico`);
    if (icon) {
        icon.textContent = '▲';
    }

    // Determinar cor baseado no nível
    let cor = '#d4d4d4'; // Cor padrão
    if (nivel === 'ERROR' || nivel === 'erro') {
        cor = '#f48771'; // Vermelho claro
    } else if (nivel === 'SUCCESS' || nivel === 'sucesso') {
        cor = '#4ec9b0'; // Verde claro
    } else if (nivel === 'WARN' || nivel === 'aviso') {
        cor = '#dcdcaa'; // Amarelo claro
    } else if (nivel === 'INFO' || nivel === 'info') {
        cor = '#569cd6'; // Azul claro
    }

    const data = new Date().toLocaleString('pt-BR');
    const nivelUpper = nivel.toUpperCase();

    // Formatar mensagem com dados adicionais
    let mensagemFormatada = mensagem;
    if (dados) {
        if (typeof dados === 'object') {
            const dadosStr = Object.keys(dados).map(key => `${key}: ${typeof dados[key] === 'object' ? JSON.stringify(dados[key]) : dados[key]}`).join(', ');
            mensagemFormatada += ` [${dadosStr}]`;
        } else {
            mensagemFormatada += ` [${dados}]`;
        }
    }

    const logDiv = document.createElement('div');
    logDiv.style.marginBottom = '6px';
    logDiv.style.padding = '4px 0';
    logDiv.style.borderBottom = '1px solid #333';

    logDiv.innerHTML = `
        <span style="color: #808080;">[${data}]</span>
        <span style="color: ${cor}; font-weight: 600; margin-left: 8px;">[${nivelUpper}]</span>
        <span style="color: #d4d4d4; margin-left: 8px;">${mensagemFormatada}</span>
    `;

    logsContainer.appendChild(logDiv);

    // Scroll para o final (logs mais recentes)
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Carrega logs do mês para serviço
 */
async function carregarLogsMesServico(mes) {
    try {
        const resultado = await API.Pedidos.listarLogs({ mes, limite: 50 });

        const logs = Array.isArray(resultado) ? resultado : (resultado.dados || []);

        // Limpar logs anteriores
        const mesId = mes.replace('-', '');
        const logsContainer = document.getElementById(`conteudo-logs-mes-${mesId}-servico`);
        if (!logsContainer) return;

        // Garantir que o container está visível ao carregar logs
        logsContainer.style.display = 'block';
        const icon = document.getElementById(`logs-icon-${mesId}-servico`);
        if (icon) {
            icon.textContent = '▲';
        }

        if (logs.length === 0) {
            logsContainer.innerHTML = '<div style="color: #888;">Nenhum log disponível ainda. Os logs aparecerão aqui após iniciar a emissão.</div>';
            return;
        }

        logsContainer.innerHTML = '';

        // Ordenar logs por data (mais antigo primeiro para melhor leitura)
        logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        logs.forEach(log => {
            let tipo = 'info';
            let mensagem = log.message || '';

            // Determinar tipo baseado no level e action
            if (log.level === 'ERROR' || log.level === 'error') {
                tipo = 'erro';
            } else if (log.action === 'emitir_nfse' || log.action === 'emitir_nfe' || log.service === 'focusNFe') {
                if (log.message && log.message.toLowerCase().includes('enviando')) {
                    tipo = 'enviado';
                } else if (log.message && (log.message.toLowerCase().includes('resposta') || log.message.toLowerCase().includes('recebido'))) {
                    tipo = 'recebido';
                } else if (log.message && (log.message.toLowerCase().includes('sucesso') || log.message.toLowerCase().includes('emitida') || log.message.toLowerCase().includes('autorizado'))) {
                    tipo = 'sucesso';
                }
            }

            // Extrair dados relevantes com mais detalhes
            let dados = null;
            if (log.data) {
                try {
                    const dataObj = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                    dados = dataObj;
                } catch (e) {
                    dados = { raw: log.data };
                }
            }

            // Formatar mensagem com informações adicionais
            let mensagemFormatada = mensagem;
            if (dados) {
                if (dados.pedido_id) {
                    mensagemFormatada += ` [Pedido: #${dados.pedido_id}]`;
                }
                if (dados.referencia) {
                    mensagemFormatada += ` [Ref: ${dados.referencia}]`;
                }
                if (dados.status) {
                    mensagemFormatada += ` [Status: ${dados.status}]`;
                }
                if (dados.erro) {
                    mensagemFormatada += ` [Erro: ${typeof dados.erro === 'string' ? dados.erro : JSON.stringify(dados.erro)}]`;
                }
            }

            // Determinar cor baseado no tipo
            let cor = '#d4d4d4'; // Cor padrão
            if (tipo === 'erro') {
                cor = '#f48771'; // Vermelho claro
            } else if (tipo === 'sucesso') {
                cor = '#4ec9b0'; // Verde claro
            } else if (tipo === 'enviado') {
                cor = '#569cd6'; // Azul claro
            } else if (tipo === 'recebido') {
                cor = '#ce9178'; // Laranja claro
            }

            // Criar elemento de log
            const logDiv = document.createElement('div');
            logDiv.style.marginBottom = '6px';
            logDiv.style.padding = '4px 0';
            logDiv.style.borderBottom = '1px solid #333';

            const data = new Date(log.created_at || Date.now()).toLocaleString('pt-BR');
            const level = (log.level || 'INFO').toUpperCase();
            const service = log.service || '';
            const action = log.action || '';

            logDiv.innerHTML = `
                <span style="color: #808080;">[${data}]</span>
                <span style="color: ${cor}; font-weight: 600; margin-left: 8px;">[${level}]</span>
                ${service ? `<span style="color: #569cd6; margin-left: 8px;">[${service}]</span>` : ''}
                ${action ? `<span style="color: #ce9178; margin-left: 8px;">[${action}]</span>` : ''}
                <span style="color: #d4d4d4; margin-left: 8px;">${mensagemFormatada}</span>
            `;

            logsContainer.appendChild(logDiv);
        });

        // Scroll para o final (logs mais recentes)
        logsContainer.scrollTop = logsContainer.scrollHeight;

    } catch (error) {
        console.error('Erro ao carregar logs do mês:', error);
        const mesId = mes.replace('-', '');
        const logsContainer = document.getElementById(`conteudo-logs-mes-${mesId}-servico`);
        if (logsContainer) {
            logsContainer.innerHTML = `<div style="color: #f48771;">Erro ao carregar logs: ${error.message}</div>`;
        }
    }
}

/**
 * Emite notas do mês para serviço (apenas NFSe)
 */
async function emitirNotasMesServico(mes) {
    console.log('Emitir Notas de Serviço para mês:', mes);

    // Buscar pedidos do mês que são de serviço
    const pedidosMes = estadoAtual.dados.todosPedidosServico?.filter(pedido => {
        const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
        const [ano, mesNum] = mes.split('-');
        return dataPedido.getFullYear() === parseInt(ano) &&
            (dataPedido.getMonth() + 1) === parseInt(mesNum);
    }) || [];

    if (pedidosMes.length === 0) {
        adicionarLogMesServico(mes, 'WARN', 'Nenhum pedido de serviço encontrado para este mês.');
        return;
    }

    const pedidoIds = pedidosMes.map(p => String(p.id || p.number));

    if (!confirm(`Deseja emitir ${pedidoIds.length} nota(s) de serviço (NFSe) para o mês ${mes}?`)) {
        return;
    }

    const mesId = `mes-${mes.replace('-', '')}-servico`;

    try {
        const resultado = await API.NFSe.emitirLote(pedidoIds, 'servico');

        // Garantir que o accordion do mês está expandido
        const mesContent = document.getElementById(mesId);
        if (mesContent && mesContent.style.display === 'none') {
            toggleMesServico(mesId);
        }

        // Garantir que os logs estão visíveis
        toggleLogsMesServico(mes);

        // --- INÍCIO TRATAMENTO ASSÍNCRONO ---
        if (resultado.processamento_async && resultado.job_id) {
            adicionarLogMesServico(mes, 'INFO', `⚡ Processamento em segundo plano iniciado (Job: ${resultado.job_id}). Acompanhando...`);

            const jobId = resultado.job_id;
            let pollingAtivo = true;
            let tentativas = 0;
            const maxTentativas = 60; // ~2 minutos (2s * 60)

            // Função de Polling
            const fazerPolling = async () => {
                if (!pollingAtivo || tentativas >= maxTentativas) {
                    if (tentativas >= maxTentativas) {
                        adicionarLogMesServico(mes, 'WARN', '⚠️ Tempo limite de acompanhamento excedido. O processo continua no servidor.');
                        await carregarPedidosServico(false); // Atualizar lista final
                    }
                    return;
                }

                tentativas++;

                try {
                    // Buscar logs específicos do Job
                    // Assumimos que API.Config.buscarLogs suporta filtro por job_id (conforme update anterior)
                    const resLogs = await API.Config.buscarLogs({
                        job_id: jobId,
                        limite: 10 // Pegar últimos 10
                    });

                    if (resLogs.sucesso && resLogs.dados) {
                        // Filtrar logs que indicam conclusão
                        const logs = resLogs.dados;

                        // Verificar se tem log de conclusão
                        const logConclusao = logs.find(l =>
                            (l.message && l.message.includes('Processamento concluído')) ||
                            (l.data && l.data.status_job === 'concluido')
                        );

                        if (logConclusao) {
                            pollingAtivo = false;
                            const dadosFinais = logConclusao.data || {};
                            const msgFinal = `✓ Concluído! Sucessos: ${dadosFinais.sucessos || 0}, Erros: ${dadosFinais.erros || 0}.`;

                            adicionarLogMesServico(mes, 'SUCCESS', msgFinal);

                            // Recarregar lista e restaurar UI
                            await carregarPedidosServico(false);
                            setTimeout(() => {
                                const mesContentRec = document.getElementById(mesId);
                                if (mesContentRec) mesContentRec.style.display = 'block';
                                toggleLogsMesServico(mes);
                                carregarLogsMesServico(mes); // Carregar histórico completo
                            }, 500);

                        } else {
                            // Se ainda não acabou, apenas atualiza logs recentes na tela (opcional)
                            // Para não floodar, podemos apenas mostrar "Processando... [X/Y]" se tiver essa info
                            const logProgresso = logs.find(l => l.data && l.data.progresso_atual);
                            if (logProgresso) {
                                // Opcional: Atualizar algum indicador visual
                                // adicionarLogMesServico(mes, 'INFO', `... Pedido ${logProgresso.data.progresso_atual}/${logProgresso.data.total}`);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Erro no polling:', err);
                }

                if (pollingAtivo) {
                    setTimeout(fazerPolling, 2000); // Tentar novamente em 2s
                }
            };

            // Iniciar polling
            fazerPolling();
            return; // Sai da função, o polling cuida do resto
        }
        // --- FIM TRATAMENTO ASSÍNCRONO ---

        // Fluxo síncrono legado (mantido para compatibilidade ou se backend reverter)
        if (resultado.sucesso) {
            adicionarLogMesServico(mes, 'SUCCESS', `✓ ${resultado.sucesso} nota(s) emitida(s) com sucesso!`, { pedidos: pedidoIds.length });

            // Recarregar pedidos silenciosamente (sem flash)
            await carregarPedidosServico(false);

            // Restaurar estado visual
            setTimeout(async () => {
                const mesContentRecarregado = document.getElementById(mesId);
                if (mesContentRecarregado) {
                    mesContentRecarregado.style.display = 'block';
                    const icon = document.getElementById(`icon-${mesId}`);
                    if (icon) icon.textContent = '▼';

                    const logsIcon = document.getElementById(`logs-icon-${mes.replace('-', '')}-servico`);
                    const logsContent = document.getElementById(`conteudo-logs-mes-${mes.replace('-', '')}-servico`);

                    if (logsContent) {
                        logsContent.style.display = 'block';
                        if (logsIcon) logsIcon.textContent = '▲';

                        await carregarLogsMesServico(mes);
                        adicionarLogMesServico(mes, 'SUCCESS', `✓ Sincronização concluída. Status atualizados.`);
                    }
                }
            }, 50);
        } else {
            const erroMsg = resultado.erro || 'Erro desconhecido';
            adicionarLogMesServico(mes, 'ERROR', `✗ Erro ao emitir notas: ${erroMsg}`, { pedidos: pedidoIds.length, erro: resultado.erro });
            await carregarLogsMesServico(mes);
        }
    } catch (error) {
        const mesContent = document.getElementById(mesId);
        if (mesContent && mesContent.style.display === 'none') {
            toggleMesServico(mesId);
        }

        toggleLogsMesServico(mes);

        adicionarLogMesServico(mes, 'ERROR', `✗ Erro ao emitir notas: ${error.message}`, {
            pedidos: pedidoIds.length,
            erro: error.message,
            stack: error.stack
        });

        await carregarLogsMesServico(mes);
    }
}

// Expor funções globalmente
window.aplicarFiltrosPedidosServico = aplicarFiltrosPedidosServico;
window.limparFiltrosPedidosServico = limparFiltrosPedidosServico;
window.atualizarDadosWooCommerceServico = atualizarDadosWooCommerceServico;
window.carregarPedidosServico = carregarPedidosServico;
window.toggleAccordionServico = toggleAccordionServico;
window.toggleDropdownCategoriasServico = toggleDropdownCategoriasServico;
window.toggleTodasCategoriasServico = toggleTodasCategoriasServico;
window.atualizarFiltroCategoriasServico = atualizarFiltroCategoriasServico;
window.toggleMesServico = toggleMesServico;
window.toggleLogsMesServico = toggleLogsMesServico;
window.carregarLogsMesServico = carregarLogsMesServico;
window.emitirNotasMesServico = emitirNotasMesServico;
window.adicionarLogMesServico = adicionarLogMesServico;

/**
 * Sincroniza pedidos de serviço do WooCommerce em background
 */
async function sincronizarEmBackgroundServico() {
    try {
        const resultado = await API.Pedidos.sincronizarDoWooCommerce(1, 50);

        if (resultado.sucesso && resultado.salvos > 0) {
            atualizarStatusConexaoServico(`🔄 ${resultado.salvos} novos pedidos encontrados`, 'info');

            const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });
            if (resultadoBanco.sucesso && resultadoBanco.dados) {
                let todosPedidos = resultadoBanco.dados;

                // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
                todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

                // Filtrar apenas pedidos de serviço (excluir categorias de produto)
                todosPedidos = todosPedidos.filter(pedido => {
                    return !isPedidoDeProduto(pedido);
                });

                todosPedidos.sort((a, b) => {
                    const dataA = new Date(a.date_created || 0);
                    const dataB = new Date(b.date_created || 0);
                    return dataB - dataA;
                });

                estadoAtual.dados.todosPedidosServico = todosPedidos;

                renderizarTelaPedidosServico(
                    todosPedidos,
                    estadoAtual.dados.meses,
                    estadoAtual.filtroStatus,
                    estadoAtual.filtroCategoria,
                    estadoAtual.agruparPorCategoria
                );
            }
        }
    } catch (error) {
        console.error('Erro na sincronização em background (serviço):', error);
    }
}

/**
 * Importa pedidos pela primeira vez (apenas serviços)
 */
async function importarPrimeiraVezServico(meses) {
    const resultado = await API.Pedidos.sincronizarTodosDoWooCommerce((progresso) => {
        atualizarStatusConexaoServico(`Importando página ${progresso.pagina}... (${progresso.salvos} pedidos)`, 'info');
    });

    if (resultado.sucesso) {
        const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });
        if (resultadoBanco.sucesso && resultadoBanco.dados) {
            let todosPedidos = resultadoBanco.dados;

            // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
            todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

            // Filtrar apenas pedidos de serviço (excluir categorias de produto)
            todosPedidos = todosPedidos.filter(pedido => {
                return !isPedidoDeProduto(pedido);
            });

            todosPedidos.sort((a, b) => {
                const dataA = new Date(a.date_created || 0);
                const dataB = new Date(b.date_created || 0);
                return dataB - dataA;
            });

            estadoAtual.dados.meses = meses;
            estadoAtual.dados.todosPedidosServico = todosPedidos;
            estadoAtual.filtroMes = null;
            estadoAtual.filtroStatus = null;
            estadoAtual.filtroCategoria = null;
            estadoAtual.agruparPorCategoria = false;

            renderizarTelaPedidosServico(todosPedidos, meses);
            atualizarStatusConexaoServico(`✓ ${todosPedidos.length} pedidos de serviço importados`, 'success');
        }
    } else {
        const erroMsg = typeof resultado.erro === 'string' ? resultado.erro : 
                      (resultado.erro?.mensagem || resultado.erro?.message || JSON.stringify(resultado.erro) || 'Erro ao importar pedidos');
        throw new Error(erroMsg);
    }
}

/**
 * Inicia polling para verificar novos pedidos de serviço
 */
function iniciarPollingPedidosServico() {
    // Parar polling anterior se existir
    if (pollingIntervalServico) {
        clearInterval(pollingIntervalServico);
    }

    console.log('🔄 Iniciando polling para novos pedidos de serviço (a cada 30s)');

    pollingIntervalServico = setInterval(async () => {
        try {
            // Verificar se ainda estamos na seção de pedidos serviço
            if (estadoAtual.secaoAtiva !== 'pedidos-servico') {
                clearInterval(pollingIntervalServico);
                pollingIntervalServico = null;
                return;
            }

            // Buscar pedidos atualizados do banco
            const resultado = await API.Pedidos.listarDoBanco({ limite: 1000 });

            if (resultado.sucesso && resultado.dados) {
                // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
                let todosPedidos = resultado.dados.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

                // Filtrar apenas pedidos de serviço (excluir categorias de produto)
                let pedidosServico = todosPedidos.filter(pedido => {
                    return !isPedidoDeProduto(pedido);
                });

                const novosTotal = pedidosServico.length;
                const atualTotal = estadoAtual.dados.todosPedidosServico?.length || 0;

                // Se tem novos pedidos, atualizar a lista
                if (novosTotal > atualTotal) {
                    console.log(`🔔 Novos pedidos de serviço detectados: ${novosTotal - atualTotal}`);

                    pedidosServico.sort((a, b) => {
                        const dataA = new Date(a.date_created || 0);
                        const dataB = new Date(b.date_created || 0);
                        return dataB - dataA;
                    });

                    estadoAtual.dados.todosPedidosServico = pedidosServico;

                    // Re-renderizar mantendo filtros
                    renderizarTelaPedidosServico(
                        pedidosServico,
                        estadoAtual.dados.meses,
                        estadoAtual.filtroStatus,
                        estadoAtual.filtroCategoria,
                        estadoAtual.agruparPorCategoria
                    );
                }
            }
        } catch (error) {
            console.error('Erro no polling de pedidos serviço:', error);
        }
    }, POLLING_DELAY);
}

/**
 * Sincroniza pedidos do WooCommerce em background (em lotes pequenos)
 * Não bloqueia a interface
 */
async function sincronizarEmBackground() {
    try {
        // Sincronizar apenas página 1 (pedidos mais recentes) para pegar novos
        const resultado = await API.Pedidos.sincronizarDoWooCommerce(1, 50);

        if (resultado.sucesso && resultado.salvos > 0) {
            // Tem pedidos novos - recarregar do banco e atualizar tela
            atualizarStatusConexao(`🔄 ${resultado.salvos} novos pedidos encontrados`, 'info');

            const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });
            if (resultadoBanco.sucesso && resultadoBanco.dados) {
                let todosPedidos = resultadoBanco.dados;

                // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
                todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

                // Filtrar apenas pedidos de produto
                todosPedidos = todosPedidos.filter(pedido => {
                    return isPedidoDeProduto(pedido);
                });

                todosPedidos.sort((a, b) => {
                    const dataA = new Date(a.date_created || 0);
                    const dataB = new Date(b.date_created || 0);
                    return dataB - dataA;
                });

                estadoAtual.dados.todosPedidos = todosPedidos;

                // Re-renderizar mantendo filtros
                renderizarTelaPedidos(
                    todosPedidos,
                    estadoAtual.dados.meses,
                    estadoAtual.filtroStatus,
                    estadoAtual.filtroCategoria,
                    estadoAtual.agruparPorCategoria
                );

                atualizarStatusConexao(`✓ ${todosPedidos.length} pedidos de produto (${resultado.salvos} novos)`, 'success');
            }
        } else {
            // Sem pedidos novos - apenas atualizar status
            atualizarStatusConexao(`✓ ${estadoAtual.dados.todosPedidos?.length || 0} pedidos (atualizado)`, 'success');
        }
    } catch (err) {
        console.warn('Erro na sincronização em background:', err);
        // Não mostrar erro para o usuário, dados do banco já estão carregados
    }
}

/**
 * Importa pedidos pela primeira vez (banco vazio)
 */
async function importarPrimeiraVez(meses) {
    const resultado = await API.Pedidos.sincronizarTodosDoWooCommerce((progresso) => {
        atualizarStatusConexao(`Importando página ${progresso.pagina}... (${progresso.salvos} pedidos)`, 'info');
    });

    if (resultado.sucesso) {
        const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });
        if (resultadoBanco.sucesso && resultadoBanco.dados) {
            let todosPedidos = resultadoBanco.dados;

            // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
            todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

            // Filtrar apenas pedidos de produto
            todosPedidos = todosPedidos.filter(pedido => {
                return isPedidoDeProduto(pedido);
            });

            todosPedidos.sort((a, b) => {
                const dataA = new Date(a.date_created || 0);
                const dataB = new Date(b.date_created || 0);
                return dataB - dataA;
            });

            estadoAtual.dados.meses = meses;
            estadoAtual.dados.todosPedidos = todosPedidos;
            estadoAtual.filtroMes = null;
            estadoAtual.filtroStatus = null;
            estadoAtual.filtroCategoria = null;
            estadoAtual.agruparPorCategoria = false;

            renderizarTelaPedidos(todosPedidos, meses);
            atualizarStatusConexao(`✓ ${todosPedidos.length} pedidos de produto importados`, 'success');
        }
    } else {
        const erroMsg = typeof resultado.erro === 'string' ? resultado.erro : 
                      (resultado.erro?.mensagem || resultado.erro?.message || JSON.stringify(resultado.erro) || 'Erro ao importar pedidos');
        throw new Error(erroMsg);
    }
}

/**
 * Busca todos os pedidos do WooCommerce (paginado)
 */
async function buscarTodosPedidosWooCommerce() {
    let todosPedidos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        atualizarStatusConexao(`Carregando do WooCommerce... (${todosPedidos.length} carregados)`, 'info');

        const resultado = await API.WooCommerce.buscarPedidos({
            per_page: perPage,
            page: page,
            orderby: 'date',
            order: 'desc'
        });

        let pedidos = [];
        if (Array.isArray(resultado)) {
            pedidos = resultado;
        } else if (resultado && Array.isArray(resultado.dados)) {
            pedidos = resultado.dados;
        } else if (resultado && Array.isArray(resultado.pedidos)) {
            pedidos = resultado.pedidos;
        } else {
            break;
        }

        if (!pedidos || pedidos.length === 0) break;

        todosPedidos = todosPedidos.concat(pedidos);

        if (pedidos.length < perPage) break;
        page++;
    }

    atualizarStatusConexao(`✓ ${todosPedidos.length} pedidos carregados do WooCommerce`, 'success');
    return todosPedidos;
}

/**
 * Inicia polling para verificar novos pedidos/notas
 */
function iniciarPollingPedidos() {
    // Parar polling anterior se existir
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    console.log('🔄 Iniciando polling para novos pedidos (a cada 30s)');

    pollingInterval = setInterval(async () => {
        try {
            // Verificar se ainda estamos na seção de pedidos
            if (estadoAtual.secaoAtiva !== 'pedidos-woocommerce') {
                clearInterval(pollingInterval);
                pollingInterval = null;
                return;
            }

            // Buscar pedidos atualizados do banco
            const resultado = await API.Pedidos.listarDoBanco({ limite: 1000 });

            if (resultado.sucesso && resultado.dados) {
                const novosTotal = resultado.dados.length;
                const atualTotal = estadoAtual.dados.todosPedidos?.length || 0;

                // Se tem novos pedidos, atualizar a lista
                if (novosTotal > atualTotal) {
                    console.log(`🔔 Novos pedidos detectados: ${novosTotal - atualTotal}`);

                    // Salvar seleção atual
                    const selecionadosAntes = obterPedidosSelecionados();

                    // Atualizar dados
                    resultado.dados.sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
                    estadoAtual.dados.todosPedidos = resultado.dados;

                    // Re-renderizar mantendo filtros
                    renderizarTelaPedidos(
                        resultado.dados,
                        estadoAtual.dados.meses,
                        estadoAtual.filtroStatus,
                        estadoAtual.filtroCategoria,
                        estadoAtual.agruparPorCategoria
                    );

                    // Restaurar seleção
                    setTimeout(() => {
                        selecionadosAntes.forEach(id => {
                            const checkbox = document.querySelector(`input.checkbox-pedido[data-pedido-id="${id}"]`);
                            if (checkbox) checkbox.checked = true;
                        });
                        atualizarSelecaoPedidos();
                    }, 100);

                    // Mostrar notificação
                    atualizarStatusConexao(`🔔 ${novosTotal - atualTotal} novo(s) pedido(s) adicionado(s)`, 'success');
                }
            }
        } catch (err) {
            console.warn('Erro no polling de pedidos:', err);
        }
    }, POLLING_DELAY);
}

/**
 * Para o polling de pedidos
 */
function pararPollingPedidos() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('⏹️ Polling de pedidos parado');
    }
}

/**
 * Inicia polling para atualizar notas enviadas automaticamente
 */
function iniciarPollingNotas() {
    // Parar polling anterior se existir
    if (pollingNotasInterval) {
        clearInterval(pollingNotasInterval);
    }

    console.log('🔄 Iniciando polling para notas enviadas (a cada 30s)');

    pollingNotasInterval = setInterval(async () => {
        try {
            if (estadoAtual.secaoAtiva !== 'notas-enviadas') {
                clearInterval(pollingNotasInterval);
                pollingNotasInterval = null;
                return;
            }
            await buscarNotasEnviadas();
        } catch (err) {
            console.warn('Erro no polling de notas:', err);
        }
    }, POLLING_DELAY);
}

/**
 * Para o polling de notas
 */
function pararPollingNotas() {
    if (pollingNotasInterval) {
        clearInterval(pollingNotasInterval);
        pollingNotasInterval = null;
        console.log('⏹️ Polling de notas parado');
    }
}

/**
 * Força atualização do WooCommerce (manual)
 */
async function forcarAtualizacaoWooCommerce() {
    atualizarStatusConexao('Sincronizando do WooCommerce...', 'info');

    try {
        // Sincronizar todos os pedidos do WooCommerce (paginado)
        const resultado = await API.Pedidos.sincronizarTodosDoWooCommerce((progresso) => {
            atualizarStatusConexao(`Sincronizando página ${progresso.pagina}... (${progresso.salvos} novos, ${progresso.atualizados} atualizados)`, 'info');
        });

        if (resultado.sucesso) {
            atualizarStatusConexao(`✓ ${resultado.paginas} páginas: ${resultado.salvos} novos, ${resultado.atualizados} atualizados`, 'success');

            // Recarregar do banco
            const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 1000 });
            if (resultadoBanco.sucesso && resultadoBanco.dados) {
                let todosPedidos = resultadoBanco.dados;

                // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
                todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

                // Filtrar apenas pedidos de produto
                todosPedidos = todosPedidos.filter(pedido => {
                    return isPedidoDeProduto(pedido);
                });

                todosPedidos.sort((a, b) => {
                    const dataA = new Date(a.date_created || 0);
                    const dataB = new Date(b.date_created || 0);
                    return dataB - dataA;
                });

                estadoAtual.dados.todosPedidos = todosPedidos;

                renderizarTelaPedidos(
                    todosPedidos,
                    estadoAtual.dados.meses,
                    estadoAtual.filtroStatus,
                    estadoAtual.filtroCategoria,
                    estadoAtual.agruparPorCategoria
                );
            }
        } else {
            atualizarStatusConexao(`✗ Erro: ${resultado.erro}`, 'error');
        }
    } catch (error) {
        atualizarStatusConexao(`✗ Erro: ${error.message}`, 'error');
    }
}

// Expor funções globalmente
window.forcarAtualizacaoWooCommerce = forcarAtualizacaoWooCommerce;
window.pararPollingPedidos = pararPollingPedidos;
window.iniciarPollingNotas = iniciarPollingNotas;
window.pararPollingNotas = pararPollingNotas;

/**
 * Renderiza a tela de pedidos com accordion de meses
 */
function renderizarTelaPedidos(pedidos, meses, filtroStatus = null, filtroCategoria = null, agruparPorCategoria = false) {
    const contentArea = document.getElementById('content-area');

    // Verificar se Components está disponível
    if (!window.Components || typeof window.Components.renderizarTabelaPedidos !== 'function') {
        console.error('Components não está disponível. Aguardando carregamento...');
        // Tentar novamente após um pequeno delay
        setTimeout(() => {
            if (window.Components && typeof window.Components.renderizarTabelaPedidos === 'function') {
                renderizarTelaPedidos(pedidos, meses, filtroStatus, filtroCategoria, agruparPorCategoria);
            } else {
                contentArea.innerHTML = `
                    <div class="content-section">
                        <div style="padding: 20px; text-align: center; color: #dc3545;">
                            <h3>Erro ao carregar componentes</h3>
                            <p>Por favor, recarregue a página.</p>
                        </div>
                    </div>
                `;
            }
        }, 100);
        return;
    }

    // Debug: verificar se pedidos está definido
    console.log('renderizarTelaPedidos chamado:', {
        totalPedidos: pedidos ? pedidos.length : 0,
        meses: meses ? meses.length : 0,
        filtroStatus,
        filtroCategoria,
        agruparPorCategoria
    });

    // Garantir que pedidos é um array
    if (!pedidos || !Array.isArray(pedidos)) {
        console.error('Pedidos não é um array válido:', pedidos);
        pedidos = [];
    }

    // Extrair todas as categorias únicas dos pedidos filtrados como produto
    const todasCategorias = new Set();
    pedidos.forEach(pedido => {
        const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
        categorias.forEach(cat => todasCategorias.add(cat));
    });
    const categoriasOrdenadas = Array.from(todasCategorias).sort();

    // Aplicar filtros
    let pedidosFiltrados = [...pedidos];

    if (filtroStatus && filtroStatus !== 'todos') {
        pedidosFiltrados = pedidosFiltrados.filter(p => (p.status || 'pending') === filtroStatus);
    }

    if (filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.length > 0) {
        pedidosFiltrados = pedidosFiltrados.filter(pedido => {
            const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
            if (categorias.length === 0) {
                return filtroCategoria.includes('sem-categoria');
            }
            // Verificar se alguma categoria do pedido está na lista de filtros
            return categorias.some(cat => {
                const categoriaNormalizada = cat.toLowerCase().replace(/\s+/g, '-');
                return filtroCategoria.includes(categoriaNormalizada);
            });
        });
    }

    // Agrupar pedidos por mês
    const pedidosPorMes = agruparPedidosPorMes(pedidosFiltrados);
    const mesesOrdenados = meses.sort((a, b) => b.value.localeCompare(a.value));

    // Opções de status
    const statusOptions = [
        { value: 'todos', label: 'Todos os status' },
        { value: 'pending', label: 'Pendente' },
        { value: 'processing', label: 'Processando' },
        { value: 'on-hold', label: 'Em espera' },
        { value: 'completed', label: 'Concluído' },
        { value: 'cancelled', label: 'Cancelado' },
        { value: 'refunded', label: 'Reembolsado' },
        { value: 'failed', label: 'Falhou' }
    ];

    const html = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Woo Produtos</h2>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button 
                        type="button" 
                        class="btn btn-primary" 
                        onclick="atualizarDadosWooCommerce()"
                        id="btn-atualizar-woocommerce"
                        style="padding: 8px 16px; font-size: 14px;">
                        Recarregar do WooCommerce
                    </button>
                <div id="status-woocommerce" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #28a745; font-size: 12px;">✓ ${pedidosFiltrados.length} pedidos ${filtroStatus || filtroCategoria ? 'filtrados' : 'carregados'}</span>
                    </div>
                </div>
            </div>

            <!-- Toggle Emissão Automática -->
            <div id="auto-emitir-container" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border: 2px solid #dee2e6; background: #f8f9fa;">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <label class="toggle-switch" style="position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0;">
                        <input type="checkbox" id="toggle-auto-emitir" onchange="toggleAutoEmitir(this.checked)" style="opacity: 0; width: 0; height: 0;">
                        <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 26px;"></span>
                    </label>
                    <div>
                        <span id="auto-emitir-label" style="font-weight: 600; font-size: 14px;">Emissão automática</span>
                        <span id="auto-emitir-status" style="font-size: 12px; margin-left: 8px; padding: 2px 8px; border-radius: 4px; font-weight: 600;">⏳ carregando...</span>
                    </div>
                </div>
                <span style="font-size: 12px; color: #666; max-width: 340px;">Quando ativado, notas são emitidas ao receber pedidos via webhook. Você ainda pode emitir manualmente.</span>
            </div>

            <!-- Categorias de Produto -->
            <div id="categorias-produto-container" style="padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #dee2e6; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 14px;">Categorias de Produto (NFe)</span>
                    <span id="cat-produto-status" style="font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #e2e3e5; color: #383d41;">carregando...</span>
                </div>
                <p style="font-size: 12px; color: #666; margin: 0 0 10px;">Selecione quais categorias do WooCommerce são de <strong>produto</strong>. Pedidos com essas categorias aparecem aqui e geram NFe.</p>
                <div id="cat-produto-checkboxes" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <span style="color: #888; font-size: 13px;">Carregando categorias do WooCommerce...</span>
                </div>
            </div>
            
            <!-- Filtros -->
            <div style="background-color: var(--color-gray-light); padding: 16px; border-radius: 8px; margin-bottom: 24px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">Status:</label>
                    <select 
                        id="filtro-status-pedidos"
                        onchange="aplicarFiltrosPedidos()"
                        style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-width: 180px;">
                        ${statusOptions.map(opt => `
                            <option value="${opt.value}" ${filtroStatus === opt.value ? 'selected' : ''}>
                                ${opt.label}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">
                        <input 
                            type="checkbox" 
                            id="agrupar-por-categoria"
                            ${agruparPorCategoria ? 'checked' : ''}
                            onchange="aplicarFiltrosPedidos()"
                            style="margin-right: 6px;">
                        Agrupar por categoria
                    </label>
                </div>
                
                ${(filtroStatus || agruparPorCategoria) ? `
                    <button 
                        type="button"
                        class="btn btn-secondary"
                        onclick="limparFiltrosPedidosTela()"
                        style="padding: 6px 12px; font-size: 14px;">
                        Limpar Filtros
                    </button>
                ` : ''}
            </div>
            
            <!-- Accordion de Meses -->
            <div style="margin-bottom: 24px;">
                ${mesesOrdenados.map(mes => {
        const grupo = pedidosPorMes[mes.value] || { pedidos: [], total: 0, quantidade: 0 };
        const mesId = `mes-${mes.value.replace('-', '')}`;
        return `
                        <div style="border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 12px; overflow: hidden;">
                    <button 
                        type="button" 
                                class="mes-accordion-header"
                                onclick="toggleMes('${mesId}')"
                                style="width: 100%; padding: 16px; background-color: var(--color-gray-light); border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; text-align: left; font-size: 16px; font-weight: 600; color: var(--color-gray-dark);">
                                <span>${mes.label}</span>
                                <span id="icon-${mesId}" style="font-size: 20px; transition: transform 0.3s;">▼</span>
                    </button>
                            <div id="${mesId}" class="mes-accordion-content" style="display: none; padding: 0;">
                                ${grupo.pedidos.length > 0 ? (window.Components && typeof window.Components.renderizarTabelaPedidos === 'function' ? window.Components.renderizarTabelaPedidos(grupo.pedidos, agruparPorCategoria) : '<div style="padding: 20px; text-align: center; color: #dc3545;">Erro: Components não disponível. Recarregue a página.</div>') : '<div style="padding: 20px; text-align: center; color: var(--color-gray-medium);">Nenhum pedido neste mês</div>'}
                                ${grupo.pedidos.length > 0 ? `
                                    <div style="padding: 16px; background-color: #f8f9fa; border-top: 1px solid var(--color-border);">
                                        <div style="display: flex; gap: 12px; justify-content: center; align-items: center; margin-bottom: 16px;">
                                            <button 
                                                type="button" 
                                                class="btn btn-primary"
                                                onclick="emitirNotasMes('${mes.value}')"
                                                style="padding: 12px 32px; font-size: 16px; font-weight: 600;">
                                                📄 Emitir Nota
                                            </button>
                                            <button 
                                                type="button"
                                                class="btn btn-secondary"
                                                onclick="emitirNFTeste('auto')"
                                                style="padding: 8px 16px; font-size: 12px; font-weight: 400; opacity: 0.7;">
                                                🧪 Emitir Teste
                                            </button>
                                        </div>
                                        <!-- Área de Logs -->
                                        <div id="logs-mes-${mes.value.replace('-', '')}" style="margin-top: 16px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
                                            <div 
                                                id="logs-header-${mes.value.replace('-', '')}"
                                                onclick="toggleLogsMes('${mes.value}')"
                                                style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8f9fa; cursor: pointer; border-bottom: 1px solid #ddd; user-select: none;"
                                                onmouseover="this.style.background='#e9ecef'"
                                                onmouseout="this.style.background='#f8f9fa'">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span id="logs-icon-${mes.value.replace('-', '')}" style="font-size: 12px; transition: transform 0.2s;">▼</span>
                                                    <div style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">Log do Processo</div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onclick="event.stopPropagation(); carregarLogsMes('${mes.value}')"
                                                    style="padding: 4px 12px; font-size: 12px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;"
                                                    onmouseover="this.style.background='#e9ecef'"
                                                    onmouseout="this.style.background='white'">
                                                    Atualizar
                                                </button>
                                            </div>
                                            <div 
                                                id="conteudo-logs-mes-${mes.value.replace('-', '')}" 
                                                style="display: none; background-color: #1e1e1e; color: #d4d4d4; padding: 12px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 300px; overflow-y: auto; min-height: 60px;">
                                                <div style="color: #888;">Carregando logs...</div>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
            
            <!-- Resumo -->
            <div style="background-color: var(--color-gray-light); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <div style="font-size: 14px; color: var(--color-gray-medium); margin-bottom: 4px;">Total de Pedidos</div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--color-gray-dark);">${pedidos.length}</div>
                    </div>
                    <div>
                        <div style="font-size: 14px; color: var(--color-gray-medium); margin-bottom: 4px;">Valor Total</div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--color-orange);">${window.Components ? window.Components.formatarValor(pedidos.reduce((sum, p) => sum + parseFloat(p.total || 0), 0)) : 'R$ 0,00'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;

    carregarEstadoAutoEmitir();
    carregarSeletorCategorias();
}

/**
 * Toggle expansão/colapso de mês no accordion
 */
function toggleMes(mesId) {
    const content = document.getElementById(mesId);
    const icon = document.getElementById(`icon-${mesId}`);

    if (!content || !icon) return;

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▲';
        icon.style.transform = 'rotate(0deg)';

        // Carregar logs do banco APENAS se não houver logs locais já na tela
        // Extrair o mês do mesId (formato: mes-202411)
        const mesMatch = mesId.match(/mes-(\d{6})/);
        if (mesMatch) {
            const mesNum = mesMatch[1];
            const mes = `${mesNum.substring(0, 4)}-${mesNum.substring(4)}`;
            const logsContainer = document.getElementById(`conteudo-logs-mes-${mesNum}`);
            // Só carregar do banco se o container estiver vazio ou só tiver a mensagem inicial
            const temApenasInicial = logsContainer && logsContainer.children.length <= 1 &&
                logsContainer.innerHTML.includes('Carregando logs') ||
                logsContainer.innerHTML.includes('Nenhum log');
            if (temApenasInicial) {
                carregarLogsMes(mes);
            }
        }
    } else {
        content.style.display = 'none';
        icon.textContent = '▼';
        icon.style.transform = 'rotate(0deg)';
    }
}

/**
 * Atualiza dados do WooCommerce (recarrega pedidos diretamente do WooCommerce)
 */
async function atualizarDadosWooCommerce() {
    const btnAtualizar = document.getElementById('btn-atualizar-woocommerce');
    const statusBar = document.getElementById('status-woocommerce');

    if (!btnAtualizar) return;

    // Desabilitar botão e mostrar loading
    btnAtualizar.disabled = true;
    btnAtualizar.textContent = 'Recarregando...';

    if (statusBar) {
        statusBar.innerHTML = '<span style="color: #666; font-size: 12px;">⏳ Recarregando pedidos do WooCommerce...</span>';
    }

    try {
        // Recarregar pedidos diretamente do WooCommerce (sem salvar no banco)
        await carregarPedidos();
    } catch (error) {
        console.error('Erro ao atualizar dados WooCommerce:', error);
        if (statusBar) {
            statusBar.innerHTML = `<span style="color: #dc3545; font-size: 12px;">✗ Erro: ${error.message}</span>`;
        }
        alert(`Erro ao sincronizar: ${error.message}`);
    } finally {
        btnAtualizar.disabled = false;
        btnAtualizar.textContent = 'Atualizar dados WooCommerce';
    }
}

/**
 * Filtra pedidos por mês (mantido para compatibilidade, mas não usado mais)
 */
function filtrarPorMes(mes) {
    // Esta função não é mais usada, mas mantida para compatibilidade
    // Os meses agora são expansíveis via accordion
}


/**
 * Função antiga - redireciona para filtrar por mês
 */
async function abrirFiltrosMes(mes) {
    filtrarPorMes(mes);
}

/**
 * Volta para mostrar todos os pedidos (remove filtro de mês)
 */
function voltarParaListaMeses() {
    filtrarPorMes(null);
}

/**
 * Gera lista dos últimos 12 meses
 */
function gerarListaMeses() {
    const meses = [];
    const hoje = new Date();

    for (let i = 0; i < 12; i++) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const mesNome = data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        meses.push({
            value: `${ano}-${mes}`,
            label: mesNome.charAt(0).toUpperCase() + mesNome.slice(1)
        });
    }

    return meses;
}


/**
 * Busca pedidos do WooCommerce com filtros aplicados
 */
async function buscarPedidosFiltrados() {
    const tabelaArea = document.getElementById('tabela-pedidos');
    const areaEmissao = document.getElementById('area-emissao-lote');

    if (!tabelaArea) return;

    const mes = estadoAtual.mesSelecionado;

    if (!mes) {
        alert('Por favor, selecione um mês primeiro.');
        return;
    }

    tabelaArea.style.display = 'block';
    tabelaArea.innerHTML = window.Components ? window.Components.renderizarLoading() : '<div class="loading-spinner"></div><p>Carregando...</p>';
    if (areaEmissao) areaEmissao.style.display = 'none';

    // Coletar filtros
    const statusSelect = document.getElementById('filtro-status-pedidos');
    const status = statusSelect ? (statusSelect.value || 'completed') : 'completed';

    // Coletar categorias selecionadas
    const checkboxes = document.querySelectorAll('.checkbox-categoria:checked');
    const categorias = Array.from(checkboxes).map(cb => parseInt(cb.value));

    const filtros = {
        mes: mes,
        status: status || undefined,
        categorias: categorias.length > 0 ? categorias : undefined,
        per_page: 100,
        page: 1,
        orderby: 'date',
        order: 'desc'
    };

    const resultado = await API.WooCommerce.buscarPedidos(filtros);

    if (resultado.sucesso) {
        estadoAtual.dados.pedidos = resultado.pedidos || [];
        estadoAtual.filtros = filtros;

        if (estadoAtual.dados.pedidos.length === 0) {
            tabelaArea.innerHTML = `<div class="empty-state"><p>Nenhum pedido encontrado com os filtros selecionados.</p></div>`;
            return;
        }

        // Mostrar tabela de pedidos
        tabelaArea.innerHTML = window.Components ? window.Components.renderizarTabelaPedidos(estadoAtual.dados.pedidos) : '<div>Erro: Components não disponível</div>';

        // Mostrar botão de emissão em lote
        if (areaEmissao) {
            areaEmissao.style.display = 'block';
        }
    } else {
        tabelaArea.innerHTML = `<div class="empty-state"><p>Erro ao carregar pedidos: ${resultado.erro}</p></div>`;
    }
}

/**
 * Limpa filtros e reseta a área
 */
function limparFiltrosPedidos() {
    const statusSelect = document.getElementById('filtro-status-pedidos');
    if (statusSelect) statusSelect.value = 'completed';

    const checkboxes = document.querySelectorAll('.checkbox-categoria');
    checkboxes.forEach(cb => cb.checked = false);

    document.getElementById('tabela-pedidos').style.display = 'none';
    document.getElementById('area-emissao-lote').style.display = 'none';
}

/**
 * Atualiza o status de um pedido
 */
async function atualizarStatusPedido(pedidoId, novoStatus) {
    try {
        // Atualizar no banco de dados via API
        const resultado = await API.Pedidos.atualizarStatus(pedidoId, novoStatus);

        if (resultado.sucesso || (resultado.dados && resultado.dados.sucesso)) {
            // Atualizar na interface imediatamente
            const pedido = estadoAtual.dados.todosPedidos.find(p => (p.id || p.number) == pedidoId);
            if (pedido) {
                pedido.status = novoStatus;
            }

            console.log(`Status do pedido ${pedidoId} atualizado para: ${novoStatus}`);

            // Mostrar feedback visual
            const select = document.querySelector(`select[data-pedido-id="${pedidoId}"]`);
            if (select) {
                select.style.backgroundColor = '#d4edda';
                setTimeout(() => {
                    select.style.backgroundColor = '';
                }, 1000);
            }
        } else {
            const erroMsg = typeof resultado.erro === 'string' ? resultado.erro : 
                          (resultado.erro?.mensagem || resultado.erro?.message || JSON.stringify(resultado.erro) || 'Erro ao atualizar status');
            throw new Error(erroMsg);
        }

    } catch (error) {
        console.error('Erro ao atualizar status do pedido:', error);
        alert('Erro ao atualizar status: ' + (error.message || error.erro || 'Erro desconhecido'));

        // Reverter o select para o valor anterior
        const select = document.querySelector(`select[data-pedido-id="${pedidoId}"]`);
        if (select) {
            const pedido = estadoAtual.dados.todosPedidos.find(p => (p.id || p.number) == pedidoId);
            if (pedido) {
                select.value = pedido.status || 'pending';
            }
        }
    }
}

/**
 * Extrai categorias dos produtos do pedido (duplicado de components.js para uso em app.js)
 */
function extrairCategoriasPedido(pedido) {
    if (!pedido.line_items || !Array.isArray(pedido.line_items)) {
        return [];
    }

    const categorias = new Set();
    pedido.line_items.forEach(item => {
        // Tentar obter categorias de diferentes formas
        if (item.categories && Array.isArray(item.categories)) {
            item.categories.forEach(cat => {
                if (cat.name) categorias.add(cat.name);
            });
        }
        if (item.category && typeof item.category === 'string') {
            categorias.add(item.category);
        }
        // Se não tiver categoria direta, usar o nome do produto como fallback
        if (categorias.size === 0 && item.name) {
            categorias.add(item.name);
        }
    });

    return Array.from(categorias);
}

/**
 * Aplica filtros de status e categoria
 */
function aplicarFiltrosPedidos() {
    if (!estadoAtual.dados.todosPedidos || !estadoAtual.dados.meses) {
        return;
    }

    const statusSelect = document.getElementById('filtro-status-pedidos');
    const agruparCheckbox = document.getElementById('agrupar-por-categoria');

    const filtroStatus = statusSelect ? statusSelect.value : null;
    const agruparPorCategoria = agruparCheckbox ? agruparCheckbox.checked : false;

    // Salvar no estado
    estadoAtual.filtroStatus = filtroStatus === 'todos' ? null : filtroStatus;
    // Woo Produtos usa o painel de "Categorias de Produto (NFe)" para definir produto x servico.
    // Por isso, aqui nao aplicamos filtro de categoria adicional na tabela.
    estadoAtual.filtroCategoria = null;
    estadoAtual.agruparPorCategoria = agruparPorCategoria;

    // Renderizar com filtros
    renderizarTelaPedidos(
        estadoAtual.dados.todosPedidos,
        estadoAtual.dados.meses,
        estadoAtual.filtroStatus,
        estadoAtual.filtroCategoria,
        estadoAtual.agruparPorCategoria
    );
}

/**
 * Obtém as categorias selecionadas dos checkboxes
 */
function obterCategoriasSelecionadas() {
    const checkboxes = document.querySelectorAll('.checkbox-categoria:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Atualiza o filtro de categorias quando um checkbox é alterado
 */
function atualizarFiltroCategorias() {
    // Woo Produtos: o filtro de categoria na tabela foi removido.
    // Mantido apenas para compatibilidade com HTML legado.
    return;
}

/**
 * Seleciona ou desseleciona todas as categorias
 */
function toggleTodasCategorias(checkbox) {
    // Woo Produtos: categoria na tabela removida.
    return;
}

/**
 * Abre/fecha o dropdown de categorias
 */
function toggleDropdownCategorias() {
    // Woo Produtos: dropdown de categoria removido.
    return;
}

/**
 * Limpa filtros e recarrega a tela
 */
function limparFiltrosPedidosTela() {
    estadoAtual.filtroStatus = null;
    estadoAtual.filtroCategoria = null;
    estadoAtual.agruparPorCategoria = false;

    renderizarTelaPedidos(
        estadoAtual.dados.todosPedidos,
        estadoAtual.dados.meses
    );
}

/**
 * Ver detalhes de um pedido
 */
async function verDetalhesPedido(pedidoId) {
    try {
        const resultado = await API.WooCommerce.buscarPedidoPorId(pedidoId);

        if (!resultado || !resultado.sucesso) {
            alert('Erro ao buscar detalhes: ' + (resultado?.erro || 'Erro desconhecido'));
            return;
        }

        const pedido = resultado.dados?.pedido || resultado.pedido || resultado;

        // Criar popup/modal com os detalhes
        mostrarPopupDetalhesPedido(pedido);

    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        alert('Erro ao buscar detalhes: ' + error.message);
    }
}

/**
 * Mostra popup com detalhes do pedido WooCommerce
 */
function mostrarPopupDetalhesPedido(pedido) {
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.id = 'popup-detalhes-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;

    // Criar modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 8px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    // Header do modal
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 20px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--color-gray-light);
    `;

    const titulo = document.createElement('h2');
    titulo.textContent = `Pedido #${pedido.id || pedido.number || 'N/A'}`;
    titulo.style.cssText = 'margin: 0; font-size: 20px; font-weight: 600; color: var(--color-gray-dark);';

    const btnFechar = document.createElement('button');
    btnFechar.textContent = '✕';
    btnFechar.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--color-gray-medium);
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    btnFechar.onclick = () => overlay.remove();

    header.appendChild(titulo);
    header.appendChild(btnFechar);

    // Body do modal
    const body = document.createElement('div');
    body.style.cssText = 'padding: 20px;';

    // Função auxiliar para formatar dados de forma mais legível
    const formatarDados = (obj, nivel = 0, chave = '') => {
        const indent = '  '.repeat(nivel);

        if (obj === null || obj === undefined) {
            return `<span style="color: #999;">null</span>`;
        }

        if (typeof obj === 'string') {
            const valor = obj.length > 100 ? obj.substring(0, 100) + '...' : obj;
            return `<span style="color: #28a745;">"${valor}"</span>`;
        }

        if (typeof obj === 'number') {
            return `<span style="color: #0066cc; font-weight: 600;">${obj}</span>`;
        }

        if (typeof obj === 'boolean') {
            return `<span style="color: #cc0066; font-weight: 600;">${obj}</span>`;
        }

        if (Array.isArray(obj)) {
            if (obj.length === 0) {
                return `<span style="color: #999;">[]</span>`;
            }
            return `<div style="margin-left: ${nivel * 20}px; border-left: 2px solid #e0e0e0; padding-left: 10px;">
                ${obj.map((item, idx) => `
                    <div style="margin-bottom: 6px;">
                        <span style="color: #666; font-weight: 600;">[${idx}]</span>: ${formatarDados(item, nivel + 1)}
                    </div>
                `).join('')}
            </div>`;
        }

        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) {
                return `<span style="color: #999;">{}</span>`;
            }
            return `<div style="margin-left: ${nivel * 20}px; border-left: 2px solid #e0e0e0; padding-left: 10px;">
                ${keys.map(key => {
                const valor = obj[key];
                const isComplex = (typeof valor === 'object' && valor !== null) || Array.isArray(valor);
                return `
                        <div style="margin-bottom: ${isComplex ? '12px' : '6px'};">
                            <span style="color: #0066cc; font-weight: 600;">${key}</span>: ${formatarDados(valor, nivel + 1, key)}
                        </div>
                    `;
            }).join('')}
            </div>`;
        }

        return String(obj);
    };

    // Criar conteúdo formatado
    const conteudo = document.createElement('div');
    conteudo.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.8;
        background-color: #f8f9fa;
        padding: 16px;
        border-radius: 4px;
        overflow-x: auto;
        max-height: 60vh;
        overflow-y: auto;
    `;
    conteudo.innerHTML = formatarDados(pedido);

    body.appendChild(conteudo);

    // Montar modal
    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);

    // Fechar ao clicar no overlay (fora do modal)
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };

    // Adicionar ao body
    document.body.appendChild(overlay);
}

/**
 * Adiciona log à área de logs do mês
 */
function adicionarLogMes(mes, tipo, mensagem, dados = null) {
    const mesId = mes.replace('-', '');
    const logsContainer = document.getElementById(`conteudo-logs-mes-${mesId}`);
    if (!logsContainer) return;

    // Expandir automaticamente quando adicionar log
    logsContainer.style.display = 'block';
    const icon = document.getElementById(`logs-icon-${mesId}`);
    if (icon) {
        icon.textContent = '▲';
    }

    const timestamp = new Date().toLocaleString('pt-BR');
    let cor = '#d4d4d4';
    let prefixo = '';

    switch (tipo) {
        case 'enviado':
            cor = '#4ec9b0';
            prefixo = '→ ENVIADO';
            break;
        case 'recebido':
            cor = '#569cd6';
            prefixo = '← RECEBIDO';
            break;
        case 'erro':
            cor = '#f48771';
            prefixo = '✗ ERRO';
            break;
        case 'info':
            cor = '#ce9178';
            prefixo = 'ℹ INFO';
            break;
        case 'sucesso':
            cor = '#6a9955';
            prefixo = '✓ SUCESSO';
            break;
        default:
            prefixo = '•';
    }

    const logEntry = document.createElement('div');
    logEntry.style.cssText = 'margin-bottom: 12px; line-height: 1.6; padding: 8px; border-radius: 4px; background: rgba(255,255,255,0.02);';

    // Formatar dados de forma mais legível
    let dadosHTML = '';
    if (dados) {
        if (typeof dados === 'string') {
            dadosHTML = `<div style="margin-left: 20px; margin-top: 6px; color: #888; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${dados}</div>`;
        } else if (typeof dados === 'object') {
            dadosHTML = '<div style="margin-left: 20px; margin-top: 6px; display: grid; gap: 4px;">';
            for (const [chave, valor] of Object.entries(dados)) {
                if (valor !== null && valor !== undefined && valor !== '') {
                    const valorStr = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
                    const valorCor = chave.includes('Erro') ? '#f48771' : (chave.includes('Sucesso') || chave.includes('autorizado') ? '#6a9955' : '#b5cea8');
                    dadosHTML += `
                        <div style="display: flex; gap: 8px; font-size: 12px;">
                            <span style="color: #9cdcfe; min-width: 120px;">${chave}:</span>
                            <span style="color: ${valorCor}; word-break: break-all;">${valorStr}</span>
                        </div>
                    `;
                }
            }
            dadosHTML += '</div>';
        }
    }

    logEntry.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
            <span style="color: #808080; font-size: 11px; white-space: nowrap;">[${timestamp}]</span>
            <span style="color: ${cor}; font-weight: 600; white-space: nowrap;">${prefixo}</span>
            <span style="color: #d4d4d4; flex: 1;">${mensagem}</span>
        </div>
        ${dadosHTML}
    `;

    // Se for o primeiro log, limpar mensagem inicial
    if (logsContainer.querySelector('div[style*="color: #888"]') && logsContainer.children.length === 1) {
        logsContainer.innerHTML = '';
    }

    logsContainer.appendChild(logEntry);

    // Scroll para o final
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Carrega logs do mês
 */
async function carregarLogsMes(mes) {
    try {
        const resultado = await API.Pedidos.listarLogs({ mes, limite: 50 });

        const logs = Array.isArray(resultado) ? resultado : (resultado.dados || []);

        // Limpar logs anteriores
        const mesId = mes.replace('-', '');
        const logsContainer = document.getElementById(`conteudo-logs-mes-${mesId}`);
        if (!logsContainer) return;

        // Garantir que o container está visível ao carregar logs
        logsContainer.style.display = 'block';
        const icon = document.getElementById(`logs-icon-${mesId}`);
        if (icon) {
            icon.textContent = '▲';
        }

        if (logs.length === 0) {
            logsContainer.innerHTML = '<div style="color: #888;">Nenhum log disponível ainda. Os logs aparecerão aqui após iniciar a emissão.</div>';
            return;
        }

        logsContainer.innerHTML = '';

        // Ordenar logs por data (mais antigo primeiro para melhor leitura)
        logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        logs.forEach(log => {
            let tipo = 'info';
            let mensagem = log.message || '';

            // Determinar tipo baseado no level e action
            if (log.level === 'ERROR' || log.level === 'error') {
                tipo = 'erro';
            } else if (log.action === 'emitir_nfse' || log.action === 'emitir_nfe' || log.service === 'focusNFe') {
                if (log.message && log.message.toLowerCase().includes('enviando')) {
                    tipo = 'enviado';
                } else if (log.message && (log.message.toLowerCase().includes('resposta') || log.message.toLowerCase().includes('recebido'))) {
                    tipo = 'recebido';
                } else if (log.message && (log.message.toLowerCase().includes('sucesso') || log.message.toLowerCase().includes('emitida') || log.message.toLowerCase().includes('autorizado'))) {
                    tipo = 'sucesso';
                }
            }

            // Extrair dados relevantes com mais detalhes
            let dados = null;
            if (log.data) {
                try {
                    const dataObj = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;

                    // Montar objeto com todos os dados úteis
                    const detalhes = {};

                    // Identificação
                    if (dataObj.pedido_id) detalhes['📦 Pedido'] = `#${dataObj.pedido_id}`;
                    if (dataObj.referencia) detalhes['🏷️ Referência'] = dataObj.referencia;
                    if (dataObj.tipo_nota) detalhes['📄 Tipo'] = dataObj.tipo_nota === 'produto' ? 'NFe (Produto)' : 'NFSe (Serviço)';

                    // Status
                    if (dataObj.status) detalhes['📊 Status'] = dataObj.status;
                    if (dataObj.status_sefaz) detalhes['🏛️ Status SEFAZ'] = dataObj.status_sefaz;
                    if (dataObj.mensagem_sefaz) detalhes['💬 Mensagem SEFAZ'] = dataObj.mensagem_sefaz;

                    // Chaves e URLs
                    if (dataObj.chave_nfe) detalhes['🔑 Chave NFe'] = dataObj.chave_nfe;
                    if (dataObj.chave_nfse) detalhes['🔑 Chave NFSe'] = dataObj.chave_nfse;
                    if (dataObj.caminho_xml_nota_fiscal || dataObj.caminho_xml) detalhes['📁 XML'] = dataObj.caminho_xml_nota_fiscal || dataObj.caminho_xml;
                    if (dataObj.caminho_danfe || dataObj.caminho_pdf) detalhes['📄 PDF'] = dataObj.caminho_danfe || dataObj.caminho_pdf;

                    // Valores
                    if (dataObj.valor_total) detalhes['💰 Valor'] = `R$ ${parseFloat(dataObj.valor_total).toFixed(2)}`;

                    // Cliente
                    if (dataObj.cliente) detalhes['👤 Cliente'] = dataObj.cliente;
                    if (dataObj.nome) detalhes['👤 Cliente'] = dataObj.nome;
                    if (dataObj.cpf || dataObj.cpf_destinatario) detalhes['🆔 CPF'] = dataObj.cpf || dataObj.cpf_destinatario;
                    if (dataObj.cnpj || dataObj.cnpj_destinatario) detalhes['🆔 CNPJ'] = dataObj.cnpj || dataObj.cnpj_destinatario;

                    // Erros
                    if (dataObj.erro) detalhes['❌ Erro'] = typeof dataObj.erro === 'object' ? JSON.stringify(dataObj.erro) : dataObj.erro;
                    if (dataObj.error) detalhes['❌ Erro'] = typeof dataObj.error === 'object' ? JSON.stringify(dataObj.error) : dataObj.error;
                    if (dataObj.codigo_erro) detalhes['🔢 Código Erro'] = dataObj.codigo_erro;

                    // Response da API
                    if (dataObj.response_data) {
                        if (dataObj.response_data.status) detalhes['📊 Status API'] = dataObj.response_data.status;
                        if (dataObj.response_data.mensagem_sefaz) detalhes['💬 SEFAZ'] = dataObj.response_data.mensagem_sefaz;
                        if (dataObj.response_data.chave_nfe) detalhes['🔑 Chave'] = dataObj.response_data.chave_nfe;
                    }

                    // Ambiente
                    if (dataObj.ambiente) detalhes['🌐 Ambiente'] = dataObj.ambiente === 'producao' ? '🔴 PRODUÇÃO' : '🟡 Homologação';

                    // Se tem detalhes, usar; senão mostrar dados brutos
                    if (Object.keys(detalhes).length > 0) {
                        dados = detalhes;
                    } else if (dataObj.payload || dataObj.response || dataObj.erro || dataObj.error) {
                        dados = dataObj;
                    }
                } catch (e) {
                    // Se não conseguir parsear, mostrar como string
                    dados = String(log.data).substring(0, 500);
                }
            }

            adicionarLogMes(mes, tipo, mensagem, dados);
        });

    } catch (error) {
        console.error('Erro ao carregar logs do mês:', error);
        const mesId = mes.replace('-', '');
        adicionarLogMes(mes, 'erro', `Erro ao carregar logs: ${error.message}`);
    }
}

/**
 * Emite NF Serviço para pedidos selecionados do mês
 */
/**
 * Emite notas para pedidos do mês - detecta automaticamente o tipo (produto ou serviço)
 */
async function emitirNotasMes(mes) {
    console.log('Emitir Notas para mês:', mes);

    // Garantir que o mês está expandido para ver os logs
    const mesId = `mes-${mes.replace('-', '')}`;
    const content = document.getElementById(mesId);
    if (content && content.style.display === 'none') {
        toggleMes(mesId);
    }

    // Adicionar log inicial
    adicionarLogMes(mes, 'info', '🚀 Iniciando emissão de notas...');

    try {
        // Obter pedidos selecionados ou todos do mês
        let pedidoIds = obterPedidosSelecionados();

        // Se não houver pedidos selecionados, usar todos do mês
        let pedidosMes = [];
        if (!pedidoIds || pedidoIds.length === 0) {
            pedidosMes = estadoAtual.dados.todosPedidos.filter(pedido => {
                const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
                const [ano, mesNum] = mes.split('-');
                return dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);
            });

            if (pedidosMes.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido encontrado para este mês.');
                return;
            }

            adicionarLogMes(mes, 'info', `Processando todos os ${pedidosMes.length} pedido(s) do mês.`);
        } else {
            // Filtrar pedidos selecionados que pertencem ao mês
            pedidosMes = estadoAtual.dados.todosPedidos.filter(pedido => {
                const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
                const [ano, mesNum] = mes.split('-');
                const pertenceAoMes = dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);
                const estaSelecionado = pedidoIds.includes(String(pedido.id || pedido.number));
                return pertenceAoMes && estaSelecionado;
            });

            if (pedidosMes.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido selecionado pertence a este mês.');
                return;
            }

            adicionarLogMes(mes, 'info', `${pedidosMes.length} pedido(s) selecionado(s) para processar.`);
        }

        // Separar pedidos por tipo (produto vs serviço)
        const pedidosProduto = [];
        const pedidosServico = [];

        for (const pedido of pedidosMes) {
            const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
            const temLivroFaiscas = categorias.some(cat => {
                const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return catLower.includes('livro') && catLower.includes('faiscas');
            });

            if (temLivroFaiscas) {
                pedidosProduto.push(pedido);
            } else {
                pedidosServico.push(pedido);
            }
        }

        adicionarLogMes(mes, 'info', `📊 Detectado: ${pedidosServico.length} serviço(s), ${pedidosProduto.length} produto(s)`);

        let totalSucesso = 0;
        let totalErros = 0;

        // Emitir NFSe (serviços)
        if (pedidosServico.length > 0) {
            const idsServico = pedidosServico.map(p => String(p.id || p.number));
            adicionarLogMes(mes, 'enviado', `📤 Emitindo ${idsServico.length} NFSe (serviço)...`);

            try {
                const resultado = await API.NFSe.emitirLote(idsServico, 'servico');
                processarResultadoEmissao(mes, resultado, 'NFSe', pedidosServico);
                totalSucesso += resultado.sucesso || 0;
                totalErros += resultado.erros || 0;
            } catch (err) {
                adicionarLogMes(mes, 'erro', `Erro ao emitir NFSe: ${err.message}`);
                totalErros += idsServico.length;
            }
        }

        // Emitir NFe (produtos)
        if (pedidosProduto.length > 0) {
            const idsProduto = pedidosProduto.map(p => String(p.id || p.number));
            adicionarLogMes(mes, 'enviado', `📤 Emitindo ${idsProduto.length} NFe (produto)...`);

            try {
                const resultado = await API.NFSe.emitirLote(idsProduto, 'produto');
                processarResultadoEmissao(mes, resultado, 'NFe', pedidosProduto);
                totalSucesso += resultado.sucesso || 0;
                totalErros += resultado.erros || 0;
            } catch (err) {
                adicionarLogMes(mes, 'erro', `Erro ao emitir NFe: ${err.message}`);
                totalErros += idsProduto.length;
            }
        }

        // Mensagem final
        const total = pedidosMes.length;
        if (totalSucesso === total) {
            adicionarLogMes(mes, 'sucesso', `✅ Emissão concluída: ${totalSucesso}/${total} nota(s) emitida(s) com sucesso!`);
        } else if (totalSucesso > 0) {
            adicionarLogMes(mes, 'info', `⚠️ Emissão parcial: ${totalSucesso}/${total} sucesso, ${totalErros} erro(s)`);
        } else {
            adicionarLogMes(mes, 'erro', `❌ Emissão falhou: ${totalErros} erro(s)`);
        }

        // Recarregar dados
        await carregarPedidos();

        // Garantir que o accordion do mês está expandido
        const mesId = `mes-${mes.replace('-', '')}`;
        const mesContent = document.getElementById(mesId);
        if (mesContent && mesContent.style.display === 'none') {
            toggleMes(mesId);
        }

        // Aguardar um pouco para garantir que os logs foram salvos no banco
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Carregar logs automaticamente após emissão
        // Expandir accordion de logs e carregar
        toggleLogsMes(mes);
        await carregarLogsMes(mes);

    } catch (error) {
        console.error('Erro ao emitir notas:', error);
        adicionarLogMes(mes, 'erro', `Erro: ${error.message}`);

        // Garantir que o accordion do mês está expandido
        const mesId = `mes-${mes.replace('-', '')}`;
        const mesContent = document.getElementById(mesId);
        if (mesContent && mesContent.style.display === 'none') {
            toggleMes(mesId);
        }

        // Aguardar um pouco antes de carregar logs
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mesmo em caso de erro, tentar carregar logs
        toggleLogsMes(mes);
        await carregarLogsMes(mes);
    }
}

/**
 * Processa resultado da emissão e adiciona logs individuais
 */
function processarResultadoEmissao(mes, resultado, tipoNota, pedidos) {
    if (resultado && resultado.resultados && Array.isArray(resultado.resultados)) {
        resultado.resultados.forEach((res) => {
            const pedidoCompleto = pedidos.find(p =>
                String(p.id) === String(res.pedido_id) || String(p.number) === String(res.pedido_id)
            );
            const cliente = pedidoCompleto?.billing?.first_name ?
                `${pedidoCompleto.billing.first_name} ${pedidoCompleto.billing.last_name || ''}`.trim() : 'N/A';
            const valor = pedidoCompleto?.total || 'N/A';

            if (res.sucesso) {
                adicionarLogMes(mes, 'sucesso', `✓ #${res.pedido_id}: ${tipoNota} emitida`, {
                    '👤 Cliente': cliente,
                    '💰 Valor': valor !== 'N/A' ? `R$ ${parseFloat(valor).toFixed(2)}` : valor,
                    '🏷️ Ref': res.referencia || 'N/A',
                    '📊 Status': res.status || 'processando'
                });
            } else {
                const erroDetalhe = typeof res.erro === 'object'
                    ? (res.erro.mensagem || res.erro.message || JSON.stringify(res.erro))
                    : (res.erro || 'Erro desconhecido');

                adicionarLogMes(mes, 'erro', `✗ #${res.pedido_id}: Falha`, {
                    '👤 Cliente': cliente,
                    '❌ Erro': erroDetalhe
                });
            }
        });
    }
}

// Manter funções antigas por compatibilidade
async function emitirNFServicoMes(mes) {
    console.log('Emitir NF Serviço para mês:', mes);

    // Garantir que o mês está expandido para ver os logs
    const mesId = `mes-${mes.replace('-', '')}`;
    const content = document.getElementById(mesId);
    if (content && content.style.display === 'none') {
        toggleMes(mesId);
    }

    // Adicionar log inicial
    adicionarLogMes(mes, 'info', 'Iniciando emissão de NF Serviço...');

    try {
        // Obter pedidos selecionados primeiro
        let pedidoIds = obterPedidosSelecionados();

        // Se não houver pedidos selecionados, usar todos do mês
        if (!pedidoIds || pedidoIds.length === 0) {
            const pedidosMes = estadoAtual.dados.todosPedidos.filter(pedido => {
                const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
                const [ano, mesNum] = mes.split('-');
                return dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);
            });

            if (pedidosMes.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido encontrado para este mês.');
                return;
            }

            pedidoIds = pedidosMes.map(p => String(p.id || p.number));
            adicionarLogMes(mes, 'info', `Nenhum pedido selecionado. Processando todos os ${pedidoIds.length} pedido(s) do mês.`);
        } else {
            // Filtrar apenas os pedidos selecionados que pertencem ao mês
            const pedidosMes = estadoAtual.dados.todosPedidos.filter(pedido => {
                const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
                const [ano, mesNum] = mes.split('-');
                const pertenceAoMes = dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);
                const estaSelecionado = pedidoIds.includes(String(pedido.id || pedido.number));
                return pertenceAoMes && estaSelecionado;
            });

            pedidoIds = pedidosMes.map(p => String(p.id || p.number));

            if (pedidoIds.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido selecionado pertence a este mês.');
                return;
            }

            adicionarLogMes(mes, 'info', `${pedidoIds.length} pedido(s) selecionado(s) para processar.`);
        }

        // Chamar API de emissão em lote
        adicionarLogMes(mes, 'enviado', `Enviando ${pedidoIds.length} pedido(s) para emissão...`, {
            total_pedidos: pedidoIds.length,
            pedido_ids: pedidoIds.slice(0, 5) // Mostrar apenas os primeiros 5 IDs
        });

        const resultado = await API.NFSe.emitirLote(pedidoIds, 'servico');

        // Verificar se temos resultados para processar (sucesso pode ser 0 mas ainda ter resultados)
        if (resultado && resultado.resultados && Array.isArray(resultado.resultados)) {
            adicionarLogMes(mes, 'recebido', `Resposta recebida: ${resultado.sucesso || 0} sucesso, ${resultado.erros || 0} erros`, {
                total: resultado.total,
                sucesso: resultado.sucesso,
                erros: resultado.erros
            });

            // Adicionar logs individuais dos resultados
            resultado.resultados.forEach((res, idx) => {
                // Buscar dados do pedido para mais detalhes
                const pedidoCompleto = estadoAtual.dados.todosPedidos?.find(p =>
                    String(p.id) === String(res.pedido_id) || String(p.number) === String(res.pedido_id)
                );
                const cliente = pedidoCompleto?.billing?.first_name ?
                    `${pedidoCompleto.billing.first_name} ${pedidoCompleto.billing.last_name || ''}`.trim() :
                    (pedidoCompleto?.customer_name || 'N/A');
                const valor = pedidoCompleto?.total || res.valor_total || 'N/A';

                if (res.sucesso) {
                    adicionarLogMes(mes, 'sucesso', `Pedido #${res.pedido_id}: NFSe emitida com sucesso`, {
                        '📦 Pedido': `#${res.pedido_id}`,
                        '👤 Cliente': cliente,
                        '💰 Valor': valor !== 'N/A' ? `R$ ${parseFloat(valor).toFixed(2)}` : valor,
                        '🏷️ Referência': res.referencia || 'N/A',
                        '📊 Status': res.status || 'autorizado',
                        '🔑 Chave': res.chave_nfse || res.numero || 'Aguardando...',
                        '📁 XML': res.caminho_xml ? '✓ Disponível' : 'Aguardando...',
                        '📄 PDF': res.caminho_pdf ? '✓ Disponível' : 'Aguardando...'
                    });
                } else {
                    // Extrair mensagem de erro (pode ser string ou objeto)
                    const erroDetalhe = typeof res.erro === 'object'
                        ? (res.erro.mensagem || res.erro.message || JSON.stringify(res.erro))
                        : (res.erro || res.mensagem || 'Erro desconhecido');
                    const codigoErro = typeof res.erro === 'object'
                        ? (res.erro.codigo || res.erro.code || res.codigo_erro || res.codigo || 'N/A')
                        : (res.codigo_erro || res.codigo || 'N/A');

                    adicionarLogMes(mes, 'erro', `Pedido #${res.pedido_id}: Falha na emissão`, {
                        '📦 Pedido': `#${res.pedido_id}`,
                        '👤 Cliente': cliente,
                        '💰 Valor': valor !== 'N/A' ? `R$ ${parseFloat(valor).toFixed(2)}` : valor,
                        '❌ Erro': erroDetalhe,
                        '🔢 Código': codigoErro
                    });
                }
            });

            // Determinar mensagem final baseado no resultado
            const temSucesso = resultado.sucesso > 0;
            const mensagemFinal = `${temSucesso ? '✓' : '✗'} Emissão concluída: ${resultado.sucesso || 0} de ${resultado.total || pedidoIds.length} pedido(s) processado(s) com sucesso.`;

            if (temSucesso) {
                adicionarLogMes(mes, 'sucesso', mensagemFinal);
            } else {
                adicionarLogMes(mes, 'erro', mensagemFinal);
            }
        } else {
            const erroMsg = resultado?.erro || resultado?.mensagem || 'Erro desconhecido';
            adicionarLogMes(mes, 'erro', `Erro ao emitir NFSe: ${erroMsg}`, {
                erro: erroMsg
            });
        }

        // Logs permanecem na tela até o usuário atualizar a página

    } catch (error) {
        console.error('Erro ao emitir NF Serviço:', error);
        adicionarLogMes(mes, 'erro', `Erro ao emitir NF Serviço: ${error.message}`, { error: error.message });
    }
}

/**
 * Emite NF Produto para pedidos selecionados do mês
 */
async function emitirNFProdutoMes(mes) {
    console.log('Emitir NF Produto para mês:', mes);

    // Garantir que o mês está expandido para ver os logs
    const mesId = `mes-${mes.replace('-', '')}`;
    const content = document.getElementById(mesId);
    if (content && content.style.display === 'none') {
        toggleMes(mesId);
    }

    // Garantir que o container de logs existe
    const mesIdLogs = mes.replace('-', '');
    const logsContainer = document.getElementById(`conteudo-logs-mes-${mesIdLogs}`);
    if (!logsContainer) {
        console.error('Container de logs não encontrado:', `conteudo-logs-mes-${mesIdLogs}`);
        alert('Erro: Container de logs não encontrado. Recarregue a página.');
        return;
    }

    // Adicionar log inicial
    adicionarLogMes(mes, 'info', 'Iniciando emissão de NF Produto...');

    try {
        // Verificar se há dados carregados
        if (!estadoAtual.dados || !estadoAtual.dados.todosPedidos) {
            adicionarLogMes(mes, 'erro', 'Erro: Dados dos pedidos não carregados. Clique em "Recarregar do WooCommerce" primeiro.');
            return;
        }

        // Obter pedidos selecionados primeiro
        let pedidoIds = obterPedidosSelecionados();

        // Se não houver pedidos selecionados, usar todos do mês que são produtos
        if (!pedidoIds || pedidoIds.length === 0) {
            const pedidosMes = estadoAtual.dados.todosPedidos.filter(pedido => {
                const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
                const [ano, mesNum] = mes.split('-');
                const pertenceAoMes = dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);
                return pertenceAoMes && isPedidoDeProduto(pedido);
            });

            if (pedidosMes.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido de PRODUTO encontrado para este mês.');
                return;
            }

            pedidoIds = pedidosMes.map(p => String(p.id || p.number));
            adicionarLogMes(mes, 'info', `Nenhum pedido selecionado. Processando ${pedidoIds.length} pedido(s) de PRODUTO do mês.`);
        } else {
            const pedidosMes = estadoAtual.dados.todosPedidos.filter(pedido => {
                const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
                const [ano, mesNum] = mes.split('-');
                const pertenceAoMes = dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);
                const estaSelecionado = pedidoIds.includes(String(pedido.id || pedido.number));
                return pertenceAoMes && estaSelecionado && isPedidoDeProduto(pedido);
            });

            pedidoIds = pedidosMes.map(p => String(p.id || p.number));

            if (pedidoIds.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido selecionado é de PRODUTO ou pertence a este mês.');
                return;
            }

            adicionarLogMes(mes, 'info', `${pedidoIds.length} pedido(s) de PRODUTO selecionado(s) para processar.`);
        }

        // Chamar API de emissão em lote (tipo produto)
        adicionarLogMes(mes, 'enviado', `Enviando ${pedidoIds.length} pedido(s) para emissão de NF Produto...`, {
            total_pedidos: pedidoIds.length,
            pedido_ids: pedidoIds.slice(0, 5),
            tipo: 'produto'
        });

        console.log('Chamando API.emitirLote com:', { pedidoIds, tipo: 'produto' });
        const resultado = await API.NFSe.emitirLote(pedidoIds, 'produto');
        console.log('Resultado da API:', resultado);

        // Verificar se temos resultados para processar (sucesso pode ser 0 mas ainda ter resultados)
        if (resultado && resultado.resultados && Array.isArray(resultado.resultados)) {
            adicionarLogMes(mes, 'recebido', `Resposta recebida: ${resultado.sucesso || 0} sucesso, ${resultado.erros || 0} erros`, {
                total: resultado.total,
                sucesso: resultado.sucesso,
                erros: resultado.erros
            });

            // Adicionar logs individuais dos resultados
            resultado.resultados.forEach((res, idx) => {
                // Buscar dados do pedido para mais detalhes
                const pedidoCompleto = estadoAtual.dados.todosPedidos?.find(p =>
                    String(p.id) === String(res.pedido_id) || String(p.number) === String(res.pedido_id)
                );
                const cliente = pedidoCompleto?.billing?.first_name ?
                    `${pedidoCompleto.billing.first_name} ${pedidoCompleto.billing.last_name || ''}`.trim() :
                    (pedidoCompleto?.customer_name || 'N/A');
                const valor = pedidoCompleto?.total || res.valor_total || 'N/A';

                if (res.sucesso) {
                    adicionarLogMes(mes, 'sucesso', `Pedido #${res.pedido_id}: NFe (Produto) emitida com sucesso`, {
                        '📦 Pedido': `#${res.pedido_id}`,
                        '👤 Cliente': cliente,
                        '💰 Valor': valor !== 'N/A' ? `R$ ${parseFloat(valor).toFixed(2)}` : valor,
                        '🏷️ Referência': res.referencia || 'N/A',
                        '📊 Status': res.status || 'autorizado',
                        '🔑 Chave NFe': res.chave_nfe || 'Aguardando...',
                        '📁 XML': res.caminho_xml_nota_fiscal ? '✓ Disponível' : 'Aguardando...',
                        '📄 DANFE': res.caminho_danfe ? '✓ Disponível' : 'Aguardando...'
                    });
                } else {
                    // Extrair mensagem de erro (pode ser string ou objeto)
                    const erroDetalhe = typeof res.erro === 'object'
                        ? (res.erro.mensagem || res.erro.message || JSON.stringify(res.erro))
                        : (res.erro || res.mensagem || 'Erro desconhecido');
                    const codigoErro = typeof res.erro === 'object'
                        ? (res.erro.codigo || res.erro.code || res.codigo_erro || res.codigo || 'N/A')
                        : (res.codigo_erro || res.codigo || 'N/A');

                    adicionarLogMes(mes, 'erro', `Pedido #${res.pedido_id}: Falha na emissão de NFe`, {
                        '📦 Pedido': `#${res.pedido_id}`,
                        '👤 Cliente': cliente,
                        '💰 Valor': valor !== 'N/A' ? `R$ ${parseFloat(valor).toFixed(2)}` : valor,
                        '❌ Erro': erroDetalhe,
                        '🔢 Código': codigoErro
                    });
                }
            });

            // Determinar mensagem final baseado no resultado
            const temSucesso = resultado.sucesso > 0;
            const mensagemFinal = `${temSucesso ? '✓' : '✗'} Emissão concluída: ${resultado.sucesso || 0} de ${resultado.total || pedidoIds.length} pedido(s) processado(s) com sucesso.`;

            if (temSucesso) {
                adicionarLogMes(mes, 'sucesso', mensagemFinal);
            } else {
                adicionarLogMes(mes, 'erro', mensagemFinal);
            }
        } else {
            const erroMsg = resultado?.erro || resultado?.mensagem || JSON.stringify(resultado) || 'Erro desconhecido';
            console.error('Erro na resposta da API:', resultado);
            adicionarLogMes(mes, 'erro', `Erro ao emitir NF Produto: ${erroMsg}`, {
                erro: erroMsg,
                resposta_completa: resultado
            });
        }

        // Logs permanecem na tela até o usuário atualizar a página

    } catch (error) {
        console.error('Erro ao emitir NF Produto:', error);
        adicionarLogMes(mes, 'erro', `Erro ao emitir NF Produto: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            tipo: error.name
        });
    }
}

/**
 * Emite NF de teste (serviço ou produto)
 */
/**
 * Mostra modal de progresso da emissão
 */
function mostrarProgressoEmissao(tipoNF, isTeste = false) {
    const modalId = 'modal-progresso-emissao';
    let modal = document.getElementById(modalId);

    let titulo;
    if (tipoNF === 'sincronizacao') {
        titulo = 'Sincronizando Notas da Focus NFe';
    } else {
        titulo = isTeste
            ? `Emitindo ${tipoNF === 'produto' ? 'NFe' : 'NFSe'} de Teste`
            : `Emitindo ${tipoNF === 'produto' ? 'NFe' : 'NFSe'} em Lote`;
    }

    const step1Text = tipoNF === 'sincronizacao' ? 'Buscando notas da Focus NFe...' : 'Preparando dados...';
    const step2Text = tipoNF === 'sincronizacao' ? 'Sincronizando com banco local...' : 'Enviando para Focus NFe...';
    const step3Text = tipoNF === 'sincronizacao' ? 'Finalizando sincronização...' : 'Processando resposta...';

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-progresso';
        modal.innerHTML = `
            <div class="modal-progresso-content">
                <h3>${titulo}</h3>
                <div class="progresso-steps">
                    <div class="step" id="step-1">
                        <div class="step-icon">1</div>
                        <div class="step-text">${step1Text}</div>
                    </div>
                    <div class="step" id="step-2">
                        <div class="step-icon">2</div>
                        <div class="step-text">${step2Text}</div>
                    </div>
                    <div class="step" id="step-3">
                        <div class="step-icon">3</div>
                        <div class="step-text">${step3Text}</div>
                    </div>
                </div>
                <div class="progresso-mensagem" id="progresso-mensagem"></div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        // Atualizar título e textos dos steps se modal já existe
        const h3 = modal.querySelector('h3');
        if (h3) h3.textContent = titulo;

        const step1 = modal.querySelector('#step-1 .step-text');
        if (step1) step1.textContent = step1Text;
        const step2 = modal.querySelector('#step-2 .step-text');
        if (step2) step2.textContent = step2Text;
        const step3 = modal.querySelector('#step-3 .step-text');
        if (step3) step3.textContent = step3Text;
    }

    // Resetar estados
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`step-${i}`);
        if (step) {
            step.classList.remove('active', 'completed', 'error');
        }
    }
    const mensagem = document.getElementById('progresso-mensagem');
    if (mensagem) {
        mensagem.textContent = '';
        mensagem.className = 'progresso-mensagem';
    }

    modal.style.display = 'flex';
    return modal;
}

/**
 * Atualiza o progresso da emissão
 */
function atualizarProgressoEmissao(passo, mensagem = '') {
    // Marcar passos anteriores como completos
    for (let i = 1; i < passo; i++) {
        const step = document.getElementById(`step-${i}`);
        if (step) {
            step.classList.remove('active');
            step.classList.add('completed');
        }
    }

    // Marcar passo atual como ativo
    const stepAtual = document.getElementById(`step-${passo}`);
    if (stepAtual) {
        stepAtual.classList.add('active');
    }

    // Atualizar mensagem
    const mensagemEl = document.getElementById('progresso-mensagem');
    if (mensagemEl && mensagem) {
        mensagemEl.textContent = mensagem;
    }
}

/**
 * Finaliza o progresso (sucesso ou erro)
 */
function finalizarProgressoEmissao(sucesso, mensagem) {
    // Marcar todos os passos como completos ou erro
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`step-${i}`);
        if (step) {
            step.classList.remove('active');
            if (sucesso) {
                step.classList.add('completed');
            } else if (i === 3) {
                step.classList.add('error');
            } else {
                step.classList.add('completed');
            }
        }
    }

    const mensagemEl = document.getElementById('progresso-mensagem');
    if (mensagemEl) {
        mensagemEl.textContent = mensagem;
        mensagemEl.className = 'progresso-mensagem ' + (sucesso ? 'sucesso' : 'erro');
    }

    // Adicionar botão de fechar se não existir
    const modal = document.getElementById('modal-progresso-emissao');
    if (modal) {
        const content = modal.querySelector('.modal-progresso-content');
        if (content && !content.querySelector('.btn-fechar-modal')) {
            const btnFechar = document.createElement('button');
            btnFechar.className = 'btn-fechar-modal';
            btnFechar.textContent = 'Fechar';
            btnFechar.style.cssText = 'margin-top: 20px; padding: 12px 24px; background-color: var(--color-orange); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; width: 100%;';
            btnFechar.onclick = () => {
                modal.style.display = 'none';
            };
            content.appendChild(btnFechar);
        }
    }

    // NÃO fecha automaticamente - usuário deve clicar no botão ou dar refresh
}

/**
 * Emite NF de teste com feedback visual no console
 */
async function emitirNFTeste(tipoNF) {
    // Se for 'auto', perguntar qual tipo
    if (tipoNF === 'auto') {
        const opcao = prompt('Qual tipo de nota de TESTE deseja emitir?\n\n1 = NFSe (Serviço)\n2 = NFe (Produto)\n\nDigite 1 ou 2:');
        if (opcao === '1') {
            tipoNF = 'servico';
        } else if (opcao === '2') {
            tipoNF = 'produto';
        } else {
            return;
        }
    }

    if (!confirm(`Deseja emitir uma ${tipoNF === 'produto' ? 'NFe (Produto)' : 'NFSe (Serviço)'} de TESTE com dados aleatórios?`)) {
        return;
    }

    console.log(`Iniciando emissão de ${tipoNF === 'produto' ? 'NFe' : 'NFSe'} de teste...`);

    try {
        // Fazer a requisição
        const resultado = await API.NFSe.emitirTeste(tipoNF);

        if (resultado.sucesso) {
            const msg = `✓ ${tipoNF === 'produto' ? 'NFe (Produto)' : 'NFSe (Serviço)'} enviada com sucesso!\n\nReferência: ${resultado.referencia}\nStatus: ${resultado.status}`;
            console.log(msg);
            alert(msg);
        } else {
            const limiteInfo = formatarErroLimite(resultado);
            const erroMsg = limiteInfo ? limiteInfo.mensagem : (resultado.mensagem || resultado.erro || 'Erro desconhecido');
            const msg = `✗ ${erroMsg}${limiteInfo && limiteInfo.upgrade_url ? '\n\nClique OK para abrir a página de upgrade.' : ''}`;
            console.error(msg);
            alert(msg);
            if (limiteInfo && limiteInfo.upgrade_url) {
                window.open(limiteInfo.upgrade_url, '_blank');
            }
        }
    } catch (error) {
        const msg = `✗ Erro ao emitir ${tipoNF === 'produto' ? 'NFe' : 'NFSe'}: ${error.message}`;
        console.error(msg);
        alert(msg);
    }
}

/**
 * Seleciona ou desseleciona todos os pedidos da tabela
 */
function selecionarTodosPedidos(checkbox, tabelaId) {
    const tabela = document.getElementById(tabelaId);
    if (!tabela) return;

    const checkboxes = tabela.querySelectorAll('.checkbox-pedido');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });

    atualizarSelecaoPedidos();
}

/**
 * Atualiza o estado do checkbox "Selecionar todos" baseado nos checkboxes individuais
 */
function atualizarSelecaoPedidos() {
    // Encontrar todas as tabelas de pedidos na página
    const tabelas = document.querySelectorAll('.table');

    tabelas.forEach(tabela => {
        const checkboxTodos = tabela.querySelector('.checkbox-selecionar-todos');
        if (!checkboxTodos) return;

        const checkboxes = tabela.querySelectorAll('.checkbox-pedido');
        const total = checkboxes.length;
        const selecionados = Array.from(checkboxes).filter(cb => cb.checked).length;

        // Atualizar estado do checkbox "Selecionar todos"
        if (total === 0) {
            checkboxTodos.checked = false;
            checkboxTodos.indeterminate = false;
        } else if (selecionados === total) {
            checkboxTodos.checked = true;
            checkboxTodos.indeterminate = false;
        } else if (selecionados > 0) {
            checkboxTodos.checked = false;
            checkboxTodos.indeterminate = true;
        } else {
            checkboxTodos.checked = false;
            checkboxTodos.indeterminate = false;
        }
    });
}

/**
 * Obtém os IDs dos pedidos selecionados
 */
function obterPedidosSelecionados() {
    const checkboxes = document.querySelectorAll('.checkbox-pedido:checked');
    return Array.from(checkboxes).map(cb => cb.getAttribute('data-pedido-id'));
}

/**
 * Emite NF (NFe ou NFSe) para um pedido individual
 * Detecta automaticamente o tipo baseado na categoria do pedido
 */
async function cancelarNFSePedido(pedidoId, referenciaOriginal = null) {
    // 1. Pedir justificativa (com valor padrão)
    const justificativaPadrao = "A ordem das notas foi gerada incorretamente, necessitamos cancelar para reemitir";
    const justificativa = prompt('Digite a justificativa para o cancelamento (mínimo 15 caracteres):', justificativaPadrao);

    if (!justificativa) return; // Cancelado pelo usuário

    if (justificativa.length < 15) {
        alert('A justificativa deve ter pelo menos 15 caracteres.');
        return;
    }

    // 2. Confirmar ação
    if (!confirm(`Tem certeza que deseja CANCELAR a nota do pedido #${pedidoId}? Esta ação não pode ser desfeita.`)) {
        return;
    }

    // 3. Mostrar loading
    const btn = document.querySelector(`button[onclick*="cancelarNFSePedido('${pedidoId}')"]`);
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Cancelando...';
    }

    try {
        console.log('Enviando solicitação de cancelamento:', { pedido_id: pedidoId, referencia: referenciaOriginal, justificativa });

        // 4. Chamar API
        const response = await fetch('/api/excel/cancelar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pedido_id: pedidoId,
                referencia: referenciaOriginal, // Enviar referência se conhecida
                justificativa
            })
        });

        const result = await response.json();

        if (result.sucesso) {
            if (result.aviso) {
                alert('⚠️ ' + (result.mensagem || 'Atenção: verifique o status na planilha.'));
            } else {
                alert('✅ ' + (result.mensagem || 'Solicitação de cancelamento enviada com sucesso!'));
            }
            // Recarregar tabela para atualizar status
            if (typeof carregarPedidosExcel === 'function') {
                carregarPedidosExcel();
            }
        } else {
            const erroMsg = typeof result.erro === 'string' ? result.erro : 
                          (result.erro?.mensagem || result.erro?.message || JSON.stringify(result.erro) || 'Erro desconhecido');
            throw new Error(erroMsg);
        }

    } catch (error) {
        console.error('Erro ao cancelar nota:', error);
        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        alert(`❌ Erro ao cancelar nota: ${errorMsg}`);
    } finally {
        // Restaurar botão
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

window.cancelarNFSePedido = cancelarNFSePedido;

async function emitirNFSePedido(pedidoId) {
    console.log('[DEBUG] emitirNFSePedido chamado para pedido:', pedidoId);

    try {
        // Buscar pedido completo do WooCommerce
        console.log('[DEBUG] Buscando pedido no WooCommerce...');
        const resultado = await API.WooCommerce.buscarPedidoPorId(pedidoId);

        if (!resultado.sucesso) {
            console.error('[DEBUG] Erro ao buscar pedido:', resultado.erro);
            // Tentar determinar o mês do pedido para adicionar log (se possível)
            try {
                const pedidoWC = await API.WooCommerce.buscarPedidoPorId(pedidoId);
                if (pedidoWC.sucesso && pedidoWC.pedido) {
                    const dataPedido = (parseDateSafe(pedidoWC.pedido.date_created || pedidoWC.pedido.created_at) || new Date());
                    const mes = `${dataPedido.getFullYear()}-${String(dataPedido.getMonth() + 1).padStart(2, '0')}`;
                    adicionarLogMesServico(mes, 'ERROR', `Erro ao buscar pedido #${pedidoId}: ${resultado.erro}`, { pedido_id: pedidoId });
                }
            } catch (e) {
                console.error('[DEBUG] Erro ao adicionar log de erro:', e);
            }
            return;
        }

        const pedido = resultado.pedido;
        console.log('[DEBUG] Pedido encontrado:', pedido.id, pedido.number);

        // Extrair categorias do pedido
        const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
        console.log('[DEBUG] Categorias do pedido:', categorias);

        const tipoNF = isPedidoDeProduto(pedido) ? 'produto' : 'servico';
        const tipoNFLabel = tipoNF === 'produto' ? 'NFe (Produto)' : 'NFSe (Serviço)';
        console.log('[DEBUG] Tipo de NF determinado:', tipoNF, tipoNFLabel);

        // Determinar o mês do pedido ANTES de emitir (para logs)
        const dataPedido = parseDateSafe(pedido.date_created || pedido.created_at) || new Date();
        const mes = `${dataPedido.getFullYear()}-${String(dataPedido.getMonth() + 1).padStart(2, '0')}`;
        console.log('[DEBUG] Mês do pedido:', mes);

        // Garantir que o accordion do mês está expandido e logs visíveis ANTES de emitir
        const sufixoMes = tipoNF === 'servico' ? '-servico' : '';
        const mesId = `mes-${mes.replace('-', '')}${sufixoMes}`;
        const mesContent = document.getElementById(mesId);
        if (mesContent && mesContent.style.display === 'none') {
            if (tipoNF === 'servico') {
                toggleMesServico(mesId);
            } else {
                toggleMes(mesId);
            }
        }

        // Garantir que os logs estão visíveis
        if (tipoNF === 'servico') {
            toggleLogsMesServico(mes);
            adicionarLogMesServico(mes, 'INFO', `Iniciando emissão de ${tipoNFLabel} para pedido #${pedidoId}...`, {
                pedido_id: pedidoId,
                tipo: tipoNF,
                categorias: categorias.length > 0 ? categorias.join(', ') : 'Sem categoria'
            });
        }

        console.log('[DEBUG] Iniciando emissão automaticamente (sem confirmação)...');

        // Mostrar feedback visual - buscar botão pelo pedidoId (tentar diferentes formatos de aspas)
        let btnOriginal = document.querySelector(`button[onclick*="emitirNFSePedido('${pedidoId}')"]`);
        if (!btnOriginal) {
            btnOriginal = document.querySelector(`button[onclick*='emitirNFSePedido("${pedidoId}")']`);
        }
        if (!btnOriginal) {
            btnOriginal = document.querySelector(`button[onclick*="emitirNFSePedido(${pedidoId})"]`);
        }

        if (btnOriginal) {
            btnOriginal.disabled = true;
            btnOriginal.textContent = 'Emitindo...';
        }

        if (tipoNF === 'servico') {
            adicionarLogMesServico(mes, 'INFO', `Enviando ${tipoNFLabel} para Focus NFe...`, { pedido_id: pedidoId });
        } else {
            // Se for produto, usar o log padrão (que funciona)
            toggleLogsMes(mes);
            adicionarLogMes(mes, 'INFO', `Iniciando emissão de ${tipoNFLabel} para pedido #${pedidoId}...`, {
                pedido_id: pedidoId,
                tipo: tipoNF,
                categorias: categorias.length > 0 ? categorias.join(', ') : 'Sem categoria'
            });
            adicionarLogMes(mes, 'INFO', `Enviando ${tipoNFLabel} para Focus NFe...`, { pedido_id: pedidoId });
        }



        // Emitir usando a API de lote (com apenas 1 pedido)
        const resultadoEmissao = await API.NFSe.emitirLote([pedidoId], tipoNF);
        console.log('[DEBUG] Resultado da emissão:', resultadoEmissao);

        if (btnOriginal) {
            btnOriginal.disabled = false;
            btnOriginal.textContent = 'Emitir NF';
        }

        if (resultadoEmissao.sucesso) {
            const resultadoPedido = resultadoEmissao.resultados && resultadoEmissao.resultados[0];
            if (resultadoPedido && resultadoPedido.sucesso) {
                adicionarLogMesServico(mes, 'SUCCESS', `✓ ${tipoNFLabel} emitida com sucesso!`, {
                    pedido_id: pedidoId,
                    referencia: resultadoPedido.referencia,
                    status: resultadoPedido.status || 'Processando',
                    tipo: tipoNF
                });

                // Recarregar dados para atualizar a tabela
                // Verificar qual aba está ativa e recarregar apropriadamente
                const secaoAtiva = estadoAtual.secaoAtiva || 'pedidos';
                if (secaoAtiva === 'pedidos-servico') {
                    await carregarPedidosServico();

                    // Aguardar um pouco para garantir que os logs foram salvos no banco
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Carregar logs automaticamente após emissão
                    await carregarLogsMesServico(mes);

                    // Também carregar logs do mês atual (pois a emissão gera logs com data atual)
                    const dataAtual = new Date();
                    const mesAtual = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                    if (mes !== mesAtual) {
                        console.log('[DEBUG] Atualizando também logs do mês atual:', mesAtual);
                        await carregarLogsMesServico(mesAtual);
                    }

                } else if (secaoAtiva === 'pedidos-produto' || secaoAtiva === 'pedidos') {
                    await carregarPedidos();
                    // Carregar logs automaticamente após emissão
                    const pedidoWC = await API.WooCommerce.buscarPedidoPorId(pedidoId);
                    if (pedidoWC.sucesso && pedidoWC.pedido) {
                        const dataPedido = (parseDateSafe(pedidoWC.pedido.date_created || pedidoWC.pedido.created_at) || new Date());
                        const mes = `${dataPedido.getFullYear()}-${String(dataPedido.getMonth() + 1).padStart(2, '0')}`;

                        // Garantir que o accordion do mês está expandido
                        const mesId = `mes-${mes.replace('-', '')}`;
                        const mesContent = document.getElementById(mesId);
                        if (mesContent && mesContent.style.display === 'none') {
                            toggleMes(mesId);
                        }

                        // Aguardar um pouco para garantir que os logs foram salvos no banco
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // Expandir accordion de logs e carregar
                        toggleLogsMes(mes);
                        await carregarLogsMes(mes);
                    }
                } else {
                    atualizarDadosWooCommerce();
                }
            } else {
                const erro = resultadoPedido?.erro || 'Erro desconhecido';
                console.error('[DEBUG] Erro na emissão (resultadoPedido):', erro);
                if (tipoNF === 'servico') {
                    adicionarLogMesServico(mes, 'ERROR', `✗ Erro ao emitir ${tipoNFLabel}: ${erro}`, {
                        pedido_id: pedidoId,
                        tipo: tipoNF,
                        erro: erro
                    });
                    await carregarLogsMesServico(mes);

                    // Também carregar logs do mês atual
                    const dataAtual = new Date();
                    const mesAtual = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                    if (mes !== mesAtual) {
                        await carregarLogsMesServico(mesAtual);
                    }

                }
            }
        } else {
            const limiteInfo = formatarErroLimite(resultadoEmissao);
            const erroMsg = limiteInfo ? (limiteInfo.mensagem + (limiteInfo.upgrade_url ? ' Faça upgrade em: ' + limiteInfo.upgrade_url : '')) : (resultadoEmissao.erro || 'Erro desconhecido');
            console.error('[DEBUG] Erro na emissão (resultadoEmissao):', erroMsg);
            if (tipoNF === 'servico') {
                adicionarLogMesServico(mes, 'ERROR', `✗ Erro ao emitir ${tipoNFLabel}: ${erroMsg}`, {
                    pedido_id: pedidoId,
                    tipo: tipoNF,
                    erro: erroMsg,
                    upgrade_url: limiteInfo ? limiteInfo.upgrade_url : undefined
                });
                await carregarLogsMesServico(mes);

                // Também carregar logs do mês atual
                const dataAtual = new Date();
                const mesAtual = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                if (mes !== mesAtual) {
                    await carregarLogsMesServico(mesAtual);
                }

            }
        }

    } catch (error) {
        console.error('[DEBUG] Erro ao emitir NF (catch):', error);
        console.error('[DEBUG] Stack trace:', error.stack);

        // Determinar o mês do pedido para adicionar log de erro
        try {
            const pedidoWC = await API.WooCommerce.buscarPedidoPorId(pedidoId);
            if (pedidoWC.sucesso && pedidoWC.pedido) {
                const dataPedido = (parseDateSafe(pedidoWC.pedido.date_created || pedidoWC.pedido.created_at) || new Date());
                const mes = `${dataPedido.getFullYear()}-${String(dataPedido.getMonth() + 1).padStart(2, '0')}`;

                const tipoNF = isPedidoDeProduto(pedidoWC.pedido) ? 'produto' : 'servico';

                // Garantir que os logs estão visíveis apenas para serviço
                if (tipoNF === 'servico') {
                    toggleLogsMesServico(mes);
                    adicionarLogMesServico(mes, 'ERROR', `Erro ao emitir NF: ${error.message}`, {
                        pedido_id: pedidoId,
                        erro: error.message,
                        stack: error.stack
                    });
                    await carregarLogsMesServico(mes);
                }
            }
        } catch (e) {
            // Se não conseguir determinar o mês, pelo menos logar no console
            console.error('[DEBUG] Erro ao adicionar log:', e);
        }

        // Restaurar botão em caso de erro
        const btnOriginal = document.querySelector(`button[onclick*="emitirNFSePedido(${pedidoId})"]`);
        if (btnOriginal) {
            btnOriginal.disabled = false;
            btnOriginal.textContent = 'Emitir NF';
        }
    }
}

/**
 * Emite NFSe em lote para todos os pedidos filtrados
 */
async function emitirLoteNFSe() {
    // Pegar pedidos filtrados
    const todosPedidos = estadoAtual.dados.todosPedidos || [];
    const mesFiltrado = estadoAtual.filtroMes;

    let pedidos = todosPedidos;
    if (mesFiltrado) {
        const [ano, mes] = mesFiltrado.split('-');
        pedidos = todosPedidos.filter(pedido => {
            const dataPedido = (parseDateSafe(pedido.date_created) || new Date(0));
            return dataPedido.getFullYear() === parseInt(ano) &&
                (dataPedido.getMonth() + 1) === parseInt(mes);
        });
    }

    const tipoNF = 'servico'; // Por enquanto sempre serviço

    if (pedidos.length === 0) {
        alert('Nenhum pedido selecionado para emissão.');
        return;
    }

    if (!confirm(`Deseja emitir NFSe para ${pedidos.length} pedido(s)?`)) {
        return;
    }

    // Extrair IDs dos pedidos
    const pedidoIds = pedidos.map(p => p.id || p.number);

    // Criar modal de progresso
    const modalHtml = window.Components ? window.Components.renderizarProgressoEmissao(pedidoIds.length, 0, 0, 0, []) : '<div>Erro: Components não disponível</div>';
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('modal-progresso');
    const resultados = [];
    let processados = 0;
    let sucesso = 0;
    let erros = 0;

    // Função para atualizar modal
    const atualizarModal = () => {
        const novoHtml = window.Components ? window.Components.renderizarProgressoEmissao(
            pedidoIds.length,
            processados,
            sucesso,
            erros,
            resultados
        ) : '<div>Erro: Components não disponível</div>';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = novoHtml;
        const novoModal = tempDiv.firstElementChild;
        modal.replaceWith(novoModal);
        return document.getElementById('modal-progresso');
    };

    // Processar cada pedido
    for (let i = 0; i < pedidoIds.length; i++) {
        const pedidoId = pedidoIds[i];

        try {
            const resultado = await API.NFSe.emitirLote([pedidoId], tipoNF);

            if (resultado.sucesso && resultado.resultados && resultado.resultados.length > 0) {
                const resultadoPedido = resultado.resultados[0];
                resultados.push(resultadoPedido);

                if (resultadoPedido.sucesso) {
                    sucesso++;
                } else {
                    erros++;
                }
            } else {
                resultados.push({
                    pedido_id: pedidoId,
                    sucesso: false,
                    erro: resultado.erro || 'Erro desconhecido'
                });
                erros++;
            }
        } catch (error) {
            resultados.push({
                pedido_id: pedidoId,
                sucesso: false,
                erro: error.message || 'Erro ao processar'
            });
            erros++;
        }

        processados++;
        modal = atualizarModal();

        // Pequeno delay para não sobrecarregar a API
        if (i < pedidoIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Atualizar modal final
    modal = atualizarModal();
}

/**
 * Fecha modal de progresso
 */
function fecharModalProgresso() {
    const modal = document.getElementById('modal-progresso');
    if (modal) {
        modal.remove();
    }

    // Recarregar pedidos para atualizar status
    buscarPedidosFiltrados();
}


/**
 * Carrega seção de Notas Enviadas
 */
async function carregarNotasEnviadas() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    if (!estadoAtual.filtrosNotas) estadoAtual.filtrosNotas = {};
    if (!estadoAtual.paginaNotas) estadoAtual.paginaNotas = 1;

    contentArea.innerHTML = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 class="section-title" style="margin: 0;">Notas Enviadas</h2>
                <button type="button" class="btn btn-primary" onclick="atualizarStatusNotas()" style="padding: 8px 16px; font-size: 14px;">
                    🔄 Atualizar Status
                </button>
            </div>

            <div style="background: var(--color-gray-light); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                <div>
                    <label style="font-size: 12px; font-weight: 600; color: #555; display: block; margin-bottom: 4px;">Data Início</label>
                    <input type="date" id="filtro-data-inicio" style="padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                </div>
                <div>
                    <label style="font-size: 12px; font-weight: 600; color: #555; display: block; margin-bottom: 4px;">Data Fim</label>
                    <input type="date" id="filtro-data-fim" style="padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                </div>
                <div>
                    <label style="font-size: 12px; font-weight: 600; color: #555; display: block; margin-bottom: 4px;">Status</label>
                    <select id="filtro-status" style="padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <option value="">Todos</option>
                        <option value="autorizado">Autorizado</option>
                        <option value="processando_autorizacao">Processando</option>
                        <option value="erro_autorizacao">Erro</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </div>
                <button type="button" class="btn btn-primary" onclick="filtrarNotasEnviadas()" style="padding: 6px 16px; font-size: 13px;">Filtrar</button>
                <button type="button" class="btn btn-secondary" onclick="limparFiltrosNotasEnviadas()" style="padding: 6px 16px; font-size: 13px;">Limpar</button>
            </div>

            <div id="tabela-notas-enviadas" style="min-height: 100px;">
                <div style="text-align: center; padding: 40px; color: #888;">Carregando...</div>
            </div>
            <div id="paginacao-notas-enviadas" style="margin-top: 12px;"></div>
        </div>
    `;

    await buscarNotasEnviadas();
}

async function buscarNotasEnviadas() {
    const area = document.getElementById('tabela-notas-enviadas');
    if (!area) return;

    area.innerHTML = '<div style="text-align: center; padding: 30px; color: #888;">Carregando notas...</div>';

    const limite = 50;
    const offset = (estadoAtual.paginaNotas - 1) * limite;

    const filtros = { limite, offset, ...estadoAtual.filtrosNotas };

    try {
        const res = await API.NFSe.listar(filtros);

        if (!res.sucesso) {
            area.innerHTML = `<div style="text-align: center; padding: 30px; color: #dc3545;">Erro: ${res.erro || 'Falha ao carregar'}</div>`;
            return;
        }

        const notas = res.dados || [];
        const total = res.total || 0;
        estadoAtual.dados.notasEnviadas = notas;

        if (notas.length === 0) {
            area.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #888;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📄</div>
                    <h3 style="margin: 0 0 8px; color: #555;">Nenhuma nota encontrada</h3>
                    <p style="margin: 0; font-size: 14px;">As notas emitidas aparecerão aqui.</p>
                </div>`;
            return;
        }

        const rows = notas.map(nota => {
            const data = nota.created_at ? new Date(nota.created_at).toLocaleDateString('pt-BR') : '-';
            const ref = nota.referencia || '-';
            const tipo = (nota.tipo_nota || 'nfse').toUpperCase();
            const tipoCor = tipo === 'NFE' ? '#1976d2' : '#2e7d32';

            let dc = nota.dados_completos;
            if (typeof dc === 'string') { try { dc = JSON.parse(dc); } catch(e) { dc = {}; } }
            dc = dc || {};

            let cliente = '-';
            if (tipo === 'NFE') {
                cliente = dc.destinatario?.nome_destinatario || dc.destinatario?.razao_social || '-';
            } else {
                cliente = dc.tomador?.razao_social || dc.tomador?.nome || '-';
            }

            let valor = 0;
            if (tipo === 'NFE') {
                valor = dc.valor_total || nota.valor_total || 0;
            } else {
                valor = dc.servico?.valor_servicos || dc.valor_total || nota.valor_total || 0;
            }
            valor = parseFloat(valor) || 0;
            const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const st = nota.status_focus || 'pendente';
            let stLabel, stCor, stBg;
            if (st === 'autorizado') { stLabel = 'Autorizado'; stCor = '#155724'; stBg = '#d4edda'; }
            else if (st.includes('processando')) { stLabel = 'Processando'; stCor = '#856404'; stBg = '#fff3cd'; }
            else if (st.includes('erro')) { stLabel = 'Erro'; stCor = '#721c24'; stBg = '#f8d7da'; }
            else if (st === 'cancelado') { stLabel = 'Cancelado'; stCor = '#383d41'; stBg = '#e2e3e5'; }
            else { stLabel = st; stCor = '#666'; stBg = '#f0f0f0'; }

            return `<tr>
                <td>${data}</td>
                <td><span style="background: ${tipoCor}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${tipo}</span></td>
                <td style="font-family: monospace; font-size: 13px;">${ref}</td>
                <td>${cliente}</td>
                <td style="font-weight: 600;">${valorFmt}</td>
                <td><span style="background: ${stBg}; color: ${stCor}; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">${stLabel}</span></td>
                <td><button class="btn btn-sm btn-secondary" onclick="verLogsNota('${ref}')" style="padding: 4px 10px; font-size: 12px;">Logs</button></td>
            </tr>`;
        }).join('');

        area.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="table">
                    <thead><tr>
                        <th>Data</th><th>Tipo</th><th>Referência</th><th>Cliente</th><th>Valor</th><th>Status</th><th></th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        // Paginacao simples
        const totalPag = Math.ceil(total / limite) || 1;
        const pagArea = document.getElementById('paginacao-notas-enviadas');
        if (pagArea && totalPag > 1) {
            let pagHtml = '<div style="display: flex; gap: 4px; justify-content: center;">';
            for (let i = 1; i <= totalPag; i++) {
                const ativo = i === estadoAtual.paginaNotas;
                pagHtml += `<button onclick="mudarPaginaNotasEnviadas(${i})" style="padding: 6px 12px; border: 1px solid ${ativo ? '#e65100' : '#ddd'}; background: ${ativo ? '#e65100' : '#fff'}; color: ${ativo ? '#fff' : '#333'}; border-radius: 4px; cursor: pointer; font-size: 13px;">${i}</button>`;
            }
            pagHtml += '</div>';
            pagArea.innerHTML = pagHtml;
        }

    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        area.innerHTML = `<div style="text-align: center; padding: 30px; color: #dc3545;">Erro: ${error.message}</div>`;
    }
}

/**
 * Sincroniza notas da Focus NFe
 */
/**
 * Atualiza status das notas pendentes (processando_autorizacao)
 */
async function atualizarStatusNotas() {
    console.log('Atualizando status das notas pendentes...');

    try {
        const resultado = await API.NFSe.atualizarStatus();

        if (resultado.sucesso) {
            let mensagem = `✓ Status atualizados!\n\n`;
            mensagem += `Total pendentes: ${resultado.total_pendentes}\n`;
            mensagem += `Atualizadas: ${resultado.atualizadas}\n`;

            if (resultado.detalhes && resultado.detalhes.length > 0) {
                mensagem += `\nDetalhes:\n`;
                resultado.detalhes.forEach(d => {
                    mensagem += `• ${d.ref}: ${d.status_novo}\n`;
                });
            }

            if (resultado.erros > 0) {
                mensagem += `\n⚠️ ${resultado.erros} erro(s)`;
            }

            alert(mensagem);

            // Recarregar lista de notas
            setTimeout(() => buscarNotasEnviadas(), 500);
        } else {
            const erroMsg = typeof resultado.erro === 'string' ? resultado.erro : 
                          (resultado.erro?.mensagem || resultado.erro?.message || JSON.stringify(resultado.erro));
            alert(`✗ Erro: ${erroMsg}`);
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        alert(`✗ Erro: ${errorMsg}`);
    }
}

// Expor globalmente
window.atualizarStatusNotas = atualizarStatusNotas;

async function sincronizarNotasFocus() {
    if (!confirm('Deseja sincronizar todas as notas da Focus NFe com o banco local?\n\nIsso irá buscar todas as notas (NFSe e NFe) da Focus NFe e atualizar/criar registros no banco local.')) {
        return;
    }

    console.log('Iniciando sincronização com Focus NFe...');

    try {
        const resultado = await API.NFSe.sincronizar();

        if (resultado.sucesso) {
            const resumo = resultado.resumo || {};
            const nfse = resumo.nfse || {};
            const nfe = resumo.nfe || {};

            let mensagem = '✓ Sincronização concluída!\n\n';
            mensagem += `NFSe: ${nfse.criadas || 0} criadas, ${nfse.atualizadas || 0} atualizadas\n`;
            mensagem += `NFe: ${nfe.criadas || 0} criadas, ${nfe.atualizadas || 0} atualizadas\n`;

            if (resumo.total_erros > 0) {
                mensagem += `\n⚠️ ${resumo.total_erros} erro(s) durante a sincronização`;
            }

            console.log(mensagem);
            alert(mensagem);

            // Recarregar a lista de notas após sincronização
            setTimeout(() => {
                buscarNotasEnviadas();
            }, 1000);
        } else {
            const erroMsg = resultado.erro || resultado.mensagem || 'Erro desconhecido';
            const msg = `✗ Erro ao sincronizar: ${erroMsg}`;
            console.error(msg);
            alert(msg);
        }
    } catch (error) {
        console.error('Erro ao sincronizar notas:', error);
        alert(`✗ Erro ao sincronizar: ${error.message}`);
    }
}

/**
 * Carrega seção de Buscar Notas
 */
async function carregarBuscarNotas() {
    try {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            console.error('content-area não encontrado');
            return;
        }

        // Verificar se Components está disponível
        if (!window.Components || !window.Components.renderizarFiltrosBuscarNotas) {
            console.error('Components não está disponível ou renderizarFiltrosBuscarNotas não existe');
            contentArea.innerHTML = '<div class="content-section"><p>Erro: Componentes não carregados</p></div>';
            return;
        }

        const html = `
            <div class="content-section">
                <h2 class="section-title">Excluir notas enviadas</h2>
                ${window.Components.renderizarFiltrosBuscarNotas()}
            </div>
        `;

        contentArea.innerHTML = html;

        // Inicializar estado
        if (!estadoAtual.filtrosBuscarNotas) {
            estadoAtual.filtrosBuscarNotas = {};
        }
    } catch (error) {
        console.error('Erro ao carregar buscar notas:', error);
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.innerHTML = `<div class="content-section"><p>Erro ao carregar: ${error.message}</p></div>`;
        }
    }
}

/**
 * Busca notas na Focus NFe e banco local
 */
async function buscarNotasFocus() {
    console.log('🔍 [FRONTEND] Buscar Notas - Iniciando busca...');

    const tabelaArea = document.getElementById('tabela-buscar-notas');

    if (!tabelaArea) {
        console.error('🔍 [FRONTEND] Buscar Notas - Área da tabela não encontrada');
        return;
    }

    tabelaArea.innerHTML = window.Components.renderizarLoading();

    const form = document.getElementById('form-filtros-buscar-notas');
    if (!form) {
        console.error('🔍 [FRONTEND] Buscar Notas - Formulário de filtros não encontrado');
        return;
    }

    const formData = new FormData(form);
    const apenasBancoLocal = formData.get('apenas_banco_local') === 'on';

    const filtros = {
        referencia: formData.get('referencia') || undefined,
        chave: formData.get('chave') || undefined,
        data_inicio: formData.get('data_inicio') || undefined,
        data_fim: formData.get('data_fim') || undefined,
        status: formData.get('status') || undefined,
        tipo_nota: formData.get('tipo_nota') || undefined,
        apenas_banco_local: apenasBancoLocal // Sempre enviar (true ou false)
    };

    // Remover campos vazios (exceto apenas_banco_local que é boolean)
    Object.keys(filtros).forEach(key => {
        if (key === 'apenas_banco_local') {
            // Manter apenas_banco_local sempre (true ou false)
            return;
        }
        if (!filtros[key]) delete filtros[key];
    });

    console.log('🔍 [FRONTEND] Buscar Notas - Filtros finais:', {
        ...filtros,
        apenas_banco_local: filtros.apenas_banco_local,
        buscar_na_focus: !filtros.apenas_banco_local
    });

    console.log('🔍 [FRONTEND] Buscar Notas - Filtros aplicados:', filtros);
    const inicioBusca = Date.now();

    try {
        const resultado = await API.NFSe.buscar(filtros);
        const tempoDecorrido = Date.now() - inicioBusca;

        if (resultado.sucesso) {
            const notas = resultado.dados || [];
            console.log('✅ [FRONTEND] Buscar Notas - Busca concluída com sucesso', {
                total_encontradas: notas.length,
                tempo_decorrido_ms: tempoDecorrido,
                filtros_aplicados: filtros,
                notas: notas.map(n => ({
                    referencia: n.referencia || n.ref,
                    tipo: n.tipo_nota,
                    origem: n.origem,
                    status: n.status || n.status_focus
                }))
            });

            tabelaArea.innerHTML = window.Components.renderizarTabelaBuscarNotas(notas);
        } else {
            console.error('❌ [FRONTEND] Buscar Notas - Erro na busca', {
                erro: resultado.erro,
                mensagem: resultado.mensagem,
                tempo_decorrido_ms: tempoDecorrido,
                filtros_aplicados: filtros
            });
            tabelaArea.innerHTML = `<div class="empty-state"><p>Erro ao buscar notas: ${resultado.erro || 'Erro desconhecido'}</p></div>`;
        }
    } catch (error) {
        const tempoDecorrido = Date.now() - inicioBusca;
        console.error('❌ [FRONTEND] Buscar Notas - Exceção ao buscar notas', {
            error: error.message,
            stack: error.stack,
            tempo_decorrido_ms: tempoDecorrido,
            filtros_aplicados: filtros
        });
        tabelaArea.innerHTML = `<div class="empty-state"><p>Erro ao buscar notas: ${error.message}</p></div>`;
    }
}

/**
 * Visualiza uma nota (abre DANFe/PDF ou página da NFSe)
 */
function visualizarNota(url, tipoNota, ambiente) {
    console.log('👁️ [FRONTEND] Visualizar Nota', {
        url,
        tipo_nota: tipoNota,
        ambiente
    });

    // Abrir em nova aba
    window.open(url, '_blank');
}

/**
 * Cancela uma nota por chave (quando não tem referência)
 */
async function cancelarNotaPorChave(chave, tipoNota, ambiente, justificativaPreenchida = null) {
    console.log('🚫 [FRONTEND] Cancelar Nota por Chave - Iniciando processo de cancelamento', {
        chave,
        tipoNota,
        ambiente,
        justificativaPreenchida: justificativaPreenchida ? 'sim' : 'não',
        timestamp: new Date().toISOString()
    });

    // Justificativa padrão de 30 caracteres
    const justificativaPadrao = justificativaPreenchida || 'Erro na ordem das notas, cance';

    // Criar modal para justificativa
    const modalId = 'modal-cancelar-nota-chave';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Cancelar Nota por Chave</h3>
                    <button class="modal-close" onclick="fecharModalCancelarChave()">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Chave:</strong> ${chave}</p>
                    <p><strong>Tipo:</strong> ${tipoNota === 'nfe' ? 'NFe (Produto)' : 'NFSe (Serviço)'}</p>
                    <p><strong>Ambiente:</strong> ${ambiente === 'producao' ? 'Produção' : 'Homologação'}</p>
                    <div class="form-group">
                        <label for="justificativa-cancelar-chave">Justificativa do Cancelamento *</label>
                        <textarea 
                            id="justificativa-cancelar-chave" 
                            class="form-input" 
                            rows="4" 
                            placeholder="Digite a justificativa para cancelar a nota (mínimo 15 caracteres, máximo 255)"
                            maxlength="255"
                        >${justificativaPadrao}</textarea>
                        <small class="form-help">Mínimo 15 caracteres, máximo 255 caracteres</small>
                        <div id="contador-justificativa-chave" class="form-help"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="fecharModalCancelarChave()">Cancelar</button>
                    <button class="btn btn-danger" onclick="confirmarCancelarNotaPorChave('${chave}', '${tipoNota}', '${ambiente || 'producao'}')">Confirmar Cancelamento</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        // Atualizar conteúdo do modal
        const pElements = modal.querySelectorAll('p');
        if (pElements.length >= 3) {
            pElements[0].innerHTML = `<strong>Chave:</strong> ${chave}`;
            pElements[1].innerHTML = `<strong>Tipo:</strong> ${tipoNota === 'nfe' ? 'NFe (Produto)' : 'NFSe (Serviço)'}`;
            pElements[2].innerHTML = `<strong>Ambiente:</strong> ${ambiente === 'producao' ? 'Produção' : 'Homologação'}`;
        }
        modal.querySelector('#justificativa-cancelar-chave').value = justificativaPadrao;
        const btnConfirmar = modal.querySelector('.btn-danger');
        if (btnConfirmar) {
            btnConfirmar.setAttribute('onclick', `confirmarCancelarNotaPorChave('${chave}', '${tipoNota}', '${ambiente || 'producao'}')`);
        }
    }

    // Atualizar contador de caracteres
    const textarea = modal.querySelector('#justificativa-cancelar-chave');
    const contador = modal.querySelector('#contador-justificativa-chave');

    const updateCounter = () => {
        const length = textarea.value.length;
        contador.textContent = `${length}/255 caracteres`;
        if (length < 15) {
            contador.style.color = '#dc3545';
        } else {
            contador.style.color = '#28a745';
        }
    };

    // Remover listeners anteriores e adicionar novo
    const newTextarea = textarea.cloneNode(true);
    textarea.parentNode.replaceChild(newTextarea, textarea);
    newTextarea.addEventListener('input', updateCounter);

    // Atualizar contador inicial
    const length = newTextarea.value.length;
    contador.textContent = `${length}/255 caracteres`;
    if (length < 15) {
        contador.style.color = '#dc3545';
    } else {
        contador.style.color = '#28a745';
    }

    // Mostrar modal
    modal.style.display = 'flex';
    newTextarea.focus();
}

/**
 * Fecha modal de cancelamento por chave
 */
function fecharModalCancelarChave() {
    const modal = document.getElementById('modal-cancelar-nota-chave');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Confirma cancelamento da nota por chave
 */
async function confirmarCancelarNotaPorChave(chave, tipoNota, ambiente = null) {
    console.log('🚫 [FRONTEND] Confirmando cancelamento por chave', {
        chave,
        tipo_nota: tipoNota,
        ambiente: ambiente || 'não especificado',
        timestamp: new Date().toISOString()
    });

    const modal = document.getElementById('modal-cancelar-nota-chave');
    if (!modal) {
        console.error('Modal não encontrado');
        return;
    }

    const justificativa = modal.querySelector('#justificativa-cancelar-chave').value.trim();

    if (!justificativa) {
        alert('Por favor, informe a justificativa do cancelamento.');
        return;
    }

    if (justificativa.length < 15) {
        alert('A justificativa deve ter no mínimo 15 caracteres.');
        return;
    }

    if (justificativa.length > 255) {
        alert('A justificativa deve ter no máximo 255 caracteres.');
        return;
    }

    // Desabilitar botões durante o processamento
    const btnConfirmar = modal.querySelector('.btn-danger');
    const btnCancelar = modal.querySelector('.btn-secondary');
    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;

    try {
        const resultado = await API.NFSe.cancelarPorChave(chave, justificativa, ambiente);

        if (resultado.sucesso) {
            alert('✅ Nota cancelada com sucesso!');
            fecharModalCancelarChave();

            // Recarregar a lista de notas
            await buscarNotasFocus();

            console.log('✅ [FRONTEND] Processo de cancelamento por chave concluído com sucesso');
        } else {
            const erroMsg = resultado.erro?.mensagem || resultado.erro || resultado.mensagem || 'Erro desconhecido';
            alert(`❌ Erro ao cancelar nota: ${erroMsg}`);
            console.error('❌ [FRONTEND] Erro ao cancelar nota por chave', {
                chave,
                tipo_nota: tipoNota,
                erro: resultado.erro,
                mensagem: resultado.mensagem
            });
        }
    } catch (error) {
        console.error('❌ [FRONTEND] Exceção ao cancelar nota por chave', {
            error: error.message,
            stack: error.stack
        });
        alert(`❌ Erro ao cancelar nota: ${error.message}`);
    } finally {
        // Reabilitar botões
        if (btnConfirmar) btnConfirmar.disabled = false;
        if (btnCancelar) btnCancelar.disabled = false;
    }
}

/**
 * Cancela uma nota (NFe ou NFSe)
 */
async function cancelarNota(referencia, tipoNota, ambiente) {
    console.log('🚫 [FRONTEND] Cancelar Nota - Iniciando processo de cancelamento', {
        referencia,
        tipoNota,
        timestamp: new Date().toISOString()
    });

    // Criar modal para justificativa
    const modalId = 'modal-cancelar-nota';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Cancelar Nota</h3>
                    <button class="modal-close" onclick="fecharModalCancelar()">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Referência:</strong> ${referencia}</p>
                    <p><strong>Tipo:</strong> ${tipoNota === 'nfe' ? 'NFe (Produto)' : 'NFSe (Serviço)'}</p>
                    <div class="form-group">
                        <label for="justificativa-cancelar">Justificativa do Cancelamento *</label>
                        <textarea 
                            id="justificativa-cancelar" 
                            class="form-input" 
                            rows="4" 
                            placeholder="Digite a justificativa para cancelar a nota (mínimo 15 caracteres, máximo 255)"
                            maxlength="255"
                        ></textarea>
                        <small class="form-help">Mínimo 15 caracteres, máximo 255 caracteres</small>
                        <div id="contador-justificativa" class="form-help"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="fecharModalCancelar()">Cancelar</button>
                    <button class="btn btn-danger" onclick="confirmarCancelarNota('${referencia}', '${tipoNota}', '${ambiente || 'homologacao'}')">Confirmar Cancelamento</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        // Atualizar conteúdo do modal
        const pElements = modal.querySelectorAll('p');
        if (pElements.length >= 2) {
            pElements[0].innerHTML = `<strong>Referência:</strong> ${referencia}`;
            pElements[1].innerHTML = `<strong>Tipo:</strong> ${tipoNota === 'nfe' ? 'NFe (Produto)' : 'NFSe (Serviço)'}`;
        }
        modal.querySelector('#justificativa-cancelar').value = '';
        const btnConfirmar = modal.querySelector('.btn-danger');
        if (btnConfirmar) {
            btnConfirmar.setAttribute('onclick', `confirmarCancelarNota('${referencia}', '${tipoNota}', '${ambiente || 'homologacao'}')`);
        }
    }

    // Atualizar contador de caracteres
    const textarea = modal.querySelector('#justificativa-cancelar');
    const contador = modal.querySelector('#contador-justificativa');

    const updateCounter = () => {
        const length = textarea.value.length;
        contador.textContent = `${length}/255 caracteres`;
        if (length < 15) {
            contador.style.color = '#dc3545';
        } else {
            contador.style.color = '#28a745';
        }
    };

    // Remover listeners anteriores e adicionar novo
    const newTextarea = textarea.cloneNode(true);
    textarea.parentNode.replaceChild(newTextarea, textarea);
    newTextarea.addEventListener('input', updateCounter);

    // Mostrar modal
    modal.style.display = 'flex';
    newTextarea.focus();
}

/**
 * Fecha modal de cancelamento
 */
function fecharModalCancelar() {
    const modal = document.getElementById('modal-cancelar-nota');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Confirma cancelamento da nota
 */
async function confirmarCancelarNota(referencia, tipoNota, ambiente = null) {
    console.log('🚫 [FRONTEND] Iniciando processo de cancelamento', {
        referencia,
        tipo_nota: tipoNota,
        ambiente: ambiente || 'não especificado',
        timestamp: new Date().toISOString()
    });

    const textarea = document.getElementById('justificativa-cancelar');
    const justificativa = textarea.value.trim();

    if (!justificativa) {
        console.warn('⚠️ [FRONTEND] Justificativa não fornecida');
        alert('Por favor, digite a justificativa do cancelamento.');
        textarea.focus();
        return;
    }

    if (justificativa.length < 15) {
        console.warn('⚠️ [FRONTEND] Justificativa muito curta', {
            referencia,
            tipo_nota: tipoNota,
            justificativa_length: justificativa.length
        });
        alert('A justificativa deve ter no mínimo 15 caracteres.');
        textarea.focus();
        return;
    }

    if (justificativa.length > 255) {
        console.warn('⚠️ [FRONTEND] Justificativa muito longa', {
            referencia,
            tipo_nota: tipoNota,
            justificativa_length: justificativa.length
        });
        alert('A justificativa deve ter no máximo 255 caracteres.');
        textarea.focus();
        return;
    }

    console.log('📝 [FRONTEND] Justificativa validada', {
        referencia,
        tipo_nota: tipoNota,
        justificativa_length: justificativa.length,
        justificativa_preview: justificativa.substring(0, 50) + (justificativa.length > 50 ? '...' : '')
    });

    if (!confirm(`Deseja realmente cancelar a nota ${referencia}?\n\nJustificativa: ${justificativa}`)) {
        console.log('❌ [FRONTEND] Usuário cancelou a confirmação');
        return;
    }

    // Desabilitar botão durante processamento
    const btnConfirmar = document.querySelector('#modal-cancelar-nota .btn-danger');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Cancelando...';
    }

    const inicioCancelamento = Date.now();
    console.log('📤 [FRONTEND] Enviando requisição de cancelamento para o backend', {
        referencia,
        tipo_nota: tipoNota,
        timestamp: new Date().toISOString()
    });

    try {
        const resultado = await API.NFSe.cancelar(referencia, tipoNota, justificativa, ambiente);
        const tempoDecorrido = Date.now() - inicioCancelamento;

        if (resultado.sucesso) {
            console.log('✅ [FRONTEND] Nota cancelada com sucesso', {
                referencia,
                tipo_nota: tipoNota,
                status_focus: resultado.status,
                status_sefaz: resultado.status_sefaz,
                mensagem_sefaz: resultado.mensagem_sefaz,
                caminho_xml_cancelamento: resultado.caminho_xml_cancelamento,
                tempo_decorrido_ms: tempoDecorrido,
                timestamp: new Date().toISOString(),
                detalhes_completos: resultado
            });

            alert(`✓ Nota ${referencia} cancelada com sucesso!`);
            fecharModalCancelar();

            console.log('🔄 [FRONTEND] Recarregando lista de notas após cancelamento...');
            // Recarregar busca
            await buscarNotasFocus();

            console.log('✅ [FRONTEND] Processo de cancelamento concluído com sucesso');
        } else {
            console.error('❌ [FRONTEND] Erro ao cancelar nota', {
                referencia,
                tipo_nota: tipoNota,
                erro: resultado.erro,
                mensagem: resultado.mensagem,
                status_code: resultado.status_code,
                tempo_decorrido_ms: tempoDecorrido,
                timestamp: new Date().toISOString(),
                resposta_completa: resultado
            });

            const erroMsg = typeof resultado.erro === 'string' ? resultado.erro : 
                          (resultado.erro?.mensagem || resultado.erro?.message || resultado.mensagem || JSON.stringify(resultado.erro) || 'Erro desconhecido');
            alert(`✗ Erro ao cancelar nota: ${erroMsg}`);
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.textContent = 'Confirmar Cancelamento';
            }
        }
    } catch (error) {
        const tempoDecorrido = Date.now() - inicioCancelamento;
        console.error('❌ [FRONTEND] Exceção ao cancelar nota', {
            referencia,
            tipo_nota: tipoNota,
            error: error.message,
            stack: error.stack,
            tempo_decorrido_ms: tempoDecorrido,
            timestamp: new Date().toISOString()
        });

        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        alert(`✗ Erro ao cancelar nota: ${errorMsg}`);
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Confirmar Cancelamento';
        }
    }
}

/**
 * Filtra notas enviadas
 */
function filtrarNotasEnviadas() {
    estadoAtual.filtrosNotas = {};

    const di = document.getElementById('filtro-data-inicio');
    const df = document.getElementById('filtro-data-fim');
    const st = document.getElementById('filtro-status');

    if (di && di.value) estadoAtual.filtrosNotas.data_inicio = di.value;
    if (df && df.value) estadoAtual.filtrosNotas.data_fim = df.value;
    if (st && st.value) estadoAtual.filtrosNotas.status_focus = st.value;

    estadoAtual.paginaNotas = 1;
    buscarNotasEnviadas();
}

function limparFiltrosNotasEnviadas() {
    estadoAtual.filtrosNotas = {};
    estadoAtual.paginaNotas = 1;

    const di = document.getElementById('filtro-data-inicio');
    const df = document.getElementById('filtro-data-fim');
    const st = document.getElementById('filtro-status');
    if (di) di.value = '';
    if (df) df.value = '';
    if (st) st.value = '';

    buscarNotasEnviadas();
}

/**
 * Muda página de notas enviadas
 */
function mudarPaginaNotasEnviadas(pagina) {
    estadoAtual.paginaNotas = pagina;
    buscarNotasEnviadas();
}

async function verLogsNota(referencia) {
    try {
        const resultado = await API.Pedidos.listarLogs({ referencia, limite: 100 });
        const logs = resultado.dados || (Array.isArray(resultado) ? resultado : []);
        logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        let bodyHtml = '';
        if (logs.length === 0) {
            bodyHtml = '<p style="color:#888;text-align:center;padding:30px;">Nenhum log encontrado para <strong>' + referencia + '</strong></p>';
        } else {
            bodyHtml = logs.map(log => {
                const data = new Date(log.created_at).toLocaleString('pt-BR');
                const level = (log.level || 'INFO').toUpperCase();
                const msg = log.message || '';
                const svc = log.service ? `[${log.service}]` : '';
                const act = log.action ? `[${log.action}]` : '';

                let cor = '#17a2b8';
                if (level === 'ERROR') cor = '#dc3545';
                else if (level === 'WARN') cor = '#e65100';

                let detalhes = '';
                if (log.data) {
                    try {
                        const d = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                        const keys = Object.keys(d).filter(k => !['service','action'].includes(k));
                        if (keys.length > 0) {
                            const obj = {};
                            keys.forEach(k => obj[k] = d[k]);
                            detalhes = '<pre style="background:#f5f5f5;padding:8px;border-radius:4px;font-size:11px;overflow-x:auto;margin:6px 0 0;max-height:150px;overflow-y:auto;">' + JSON.stringify(obj, null, 2) + '</pre>';
                        }
                    } catch(e) {}
                }

                return `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <div style="display:flex;gap:8px;align-items:center;font-size:12px;">
                        <span style="color:#999;">${data}</span>
                        <span style="color:${cor};font-weight:700;">${level}</span>
                        <span style="color:#888;">${svc} ${act}</span>
                    </div>
                    <div style="color:#333;font-size:13px;margin-top:2px;">${msg}</div>
                    ${detalhes}
                </div>`;
            }).join('');
        }

        overlay.innerHTML = `
            <div style="background:#fff;border-radius:8px;max-width:700px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 4px 20px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
                <div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:16px;">Logs: <span style="font-family:monospace;color:#e65100;">${referencia}</span></h3>
                    <span style="font-size:12px;color:#888;">${logs.length} registro(s)</span>
                </div>
                <div style="padding:12px 20px;overflow-y:auto;flex:1;">${bodyHtml}</div>
                <div style="padding:12px 20px;border-top:1px solid #eee;text-align:right;">
                    <button onclick="this.closest('[style*=fixed]').remove()" class="btn btn-secondary" style="padding:6px 16px;font-size:13px;">Fechar</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
    } catch (error) {
        alert('Erro ao carregar logs: ' + error.message);
    }
}

/**
 * Atualiza o status de todas as notas "Processando..." do mês
 */
async function atualizarStatusGeral(mesValue) {
    if (!confirm('Deseja atualizar o status de todas as notas pendentes deste mês? Isso será feito uma por uma.')) {
        return;
    }

    const tbody = document.getElementById(`lista-excel-${mesValue}`);
    if (!tbody) return;

    // Encontrar todos os botões de atualização dentro deste mês
    const botoes = Array.from(tbody.querySelectorAll('button[id^="btn-status-"]'));

    if (botoes.length === 0) {
        alert('Nenhuma nota pendente de atualização encontrada neste mês.');
        return;
    }

    const total = botoes.length;
    let atualizados = 0;

    mostrarFeedbackExcel('info', `Iniciando atualização de ${total} notas...`);

    for (const btn of botoes) {
        const id = btn.id.replace('btn-status-', '');

        // Verificar status atual (pode ter mudado)
        if (btn.disabled) continue;

        try {
            await verificarStatusNota(id);
            atualizados++;
            // Pequeno delay para visualização e não sobrecarregar
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.error(`Erro ao atualizar ${id}:`, e);
        }
    }

    mostrarFeedbackExcel('success', `Atualização concluída: ${atualizados} notas verificadas.`);
    await carregarPedidosExcel();
}

async function verificarStatusNota(pedidoId) {
    try {
        const res = await fetch(`/api/excel/status/${pedidoId}`);
        const data = await res.json();
        if (data.sucesso && window.pedidosExcelCache) {
            const cached = window.pedidosExcelCache.find(p => p.id == pedidoId);
            if (cached) {
                const statusMap = { 'autorizado': 'Autorizada', 'cancelado': 'Cancelada', 'erro_autorizacao': 'Erro' };
                cached.status_nota = statusMap[data.status] || 'Processando...';
                cached.numero_nota = data.numero || cached.numero_nota;
                cached.link_pdf = data.link_pdf || cached.link_pdf;
            }
        }
        return data;
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        return { sucesso: false, erro: error.message };
    }
}

async function verificarTodosProcessando() {
    if (!window.pedidosExcelCache) return;
    const processando = window.pedidosExcelCache.filter(p => {
        const s = (p.status_nota || '').replace(/^\[M\] /i, '').toLowerCase();
        return s === 'processando...' || s === 'processando';
    });
    if (processando.length === 0) return;

    mostrarFeedbackExcel('info', `Verificando ${processando.length} nota(s) em processamento...`);
    let atualizados = 0;
    for (const p of processando) {
        try {
            const r = await verificarStatusNota(p.id);
            if (r.sucesso && r.status !== 'processando_autorizacao') atualizados++;
            await new Promise(r => setTimeout(r, 300));
        } catch (e) { /* continuar */ }
    }
    if (atualizados > 0) {
        mostrarFeedbackExcel('success', `${atualizados} nota(s) atualizada(s)!`);
        await carregarPedidosExcel();
    } else {
        mostrarFeedbackExcel('info', 'Nenhuma mudança de status detectada.');
    }
}
window.verificarTodosProcessando = verificarTodosProcessando;

/**
 * Carrega seção de Municípios (placeholder)
 */
function carregarMunicipios() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="content-section">
            <h2 class="section-title">Municípios</h2>
            <div class="empty-state">
                <h3>Em desenvolvimento</h3>
                <p>Esta seção será implementada em breve.</p>
            </div>
        </div>
    `;
}

/**
 * Carrega seção de Webhooks (placeholder)
 */
function carregarWebhooks() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="content-section">
            <h2 class="section-title">Webhooks</h2>
            <div class="empty-state">
                <h3>Em desenvolvimento</h3>
                <p>Esta seção será implementada em breve.</p>
            </div>
        </div>
    `;
}

/**
 * Toggle para mostrar/ocultar logs do servidor
 */
let logsServidorVisivel = false;
let logsServidorExpandido = false;

function toggleLogsServidor() {
    let logsContainer = document.getElementById('logs-servidor-container');

    if (!logsContainer) {
        // Criar container de logs se não existir (inicialmente minimizado)
        logsContainer = document.createElement('div');
        logsContainer.id = 'logs-servidor-container';
        logsContainer.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 40px;
            background: #1e1e1e;
            border-top: 2px solid var(--color-orange);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            box-shadow: 0 -4px 6px rgba(0,0,0,0.3);
            transition: height 0.3s ease;
        `;

        // Header do container (sempre visível)
        const header = document.createElement('div');
        header.id = 'logs-servidor-header';
        header.style.cssText = `
            padding: 8px 16px;
            background: #2d2d2d;
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            min-height: 40px;
        `;
        header.onclick = () => {
            logsServidorExpandido = !logsServidorExpandido;
            atualizarEstadoLogsServidor();
        };

        const titulo = document.createElement('div');
        titulo.style.cssText = 'color: #d4d4d4; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px;';
        titulo.innerHTML = `
            <span id="logs-servidor-icon" style="transition: transform 0.3s;">▼</span>
            <span>Logs do Servidor</span>
        `;

        const botoes = document.createElement('div');
        botoes.style.cssText = 'display: flex; gap: 8px; align-items: center;';
        botoes.onclick = (e) => e.stopPropagation(); // Prevenir toggle ao clicar nos botões

        const btnAtualizar = document.createElement('button');
        btnAtualizar.textContent = 'Atualizar';
        btnAtualizar.style.cssText = `
            padding: 4px 12px;
            font-size: 12px;
            background: var(--color-orange);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        btnAtualizar.onclick = (e) => {
            e.stopPropagation();
            carregarLogsServidor();
        };

        const btnFechar = document.createElement('button');
        btnFechar.textContent = '✕';
        btnFechar.style.cssText = `
            padding: 4px 12px;
            font-size: 16px;
            background: #444;
            color: #d4d4d4;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        btnFechar.onclick = (e) => {
            e.stopPropagation();
            logsServidorVisivel = false;
            logsServidorExpandido = false;
            logsContainer.style.display = 'none';
            document.getElementById('btn-mostrar-logs').style.opacity = '1';
        };

        botoes.appendChild(btnAtualizar);
        botoes.appendChild(btnFechar);
        header.appendChild(titulo);
        header.appendChild(botoes);

        // Body do container (inicialmente oculto)
        const body = document.createElement('div');
        body.id = 'logs-servidor-conteudo';
        body.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #d4d4d4;
            line-height: 1.6;
            display: none;
        `;

        logsContainer.appendChild(header);
        logsContainer.appendChild(body);
        document.body.appendChild(logsContainer);

        logsServidorVisivel = true;
        logsServidorExpandido = false;
    } else {
        // Se já existe, apenas toggle visibilidade
        logsServidorVisivel = !logsServidorVisivel;
        if (!logsServidorVisivel) {
            logsServidorExpandido = false;
        }
    }

    atualizarEstadoLogsServidor();
}

/**
 * Atualiza o estado visual do painel de logs
 */
function atualizarEstadoLogsServidor() {
    const logsContainer = document.getElementById('logs-servidor-container');
    const conteudo = document.getElementById('logs-servidor-conteudo');
    const icon = document.getElementById('logs-servidor-icon');
    const btnMostrar = document.getElementById('btn-mostrar-logs');

    if (!logsContainer) return;

    if (logsServidorVisivel) {
        logsContainer.style.display = 'flex';
        if (btnMostrar) btnMostrar.style.opacity = '0.6';

        if (logsServidorExpandido) {
            logsContainer.style.height = '400px';
            if (conteudo) conteudo.style.display = 'block';
            if (icon) icon.textContent = '▲';
            if (!conteudo.innerHTML || conteudo.innerHTML.includes('Carregando')) {
                carregarLogsServidor();
            }
        } else {
            logsContainer.style.height = '40px';
            if (conteudo) conteudo.style.display = 'none';
            if (icon) icon.textContent = '▼';
        }
    } else {
        logsContainer.style.display = 'none';
        if (btnMostrar) btnMostrar.style.opacity = '1';
    }
}

/**
 * Carrega logs do servidor
 */
async function carregarLogsServidor() {
    const conteudo = document.getElementById('logs-servidor-conteudo');
    if (!conteudo) return;

    // Verificar se já existe mensagem de status, senão criar
    let loadingMsg = document.getElementById('logs-loading-msg');
    if (!loadingMsg) {
        loadingMsg = document.createElement('div');
        loadingMsg.id = 'logs-loading-msg';
        loadingMsg.style.cssText = 'color: #888; padding: 8px; border-bottom: 1px solid #333;';
        conteudo.innerHTML = '';
        conteudo.appendChild(loadingMsg);
    }
    loadingMsg.innerHTML = '<span style="color: #4ec9b0;">⏳</span> Carregando logs...';

    try {
        const resultado = await API.Config.buscarLogs({ limite: 200 });

        const logs = resultado.logs || resultado.dados?.logs || (Array.isArray(resultado) ? resultado : []);

        // Atualizar mensagem de status
        if (logs.length === 0) {
            loadingMsg.innerHTML = '<span style="color: #888;">✓</span> <span style="color: #888;">Nenhum log disponível.</span>';
            return;
        }

        // Ordenar por data (mais recente primeiro)
        logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        // Atualizar mensagem de status com sucesso
        loadingMsg.innerHTML = `<span style="color: #6a9955;">✓</span> <span style="color: #6a9955;">${logs.length} log(s) carregado(s) com sucesso</span>`;

        // Formatar logs
        const logsFormatados = logs.map(log => {
            const data = new Date(log.created_at || Date.now()).toLocaleString('pt-BR');
            const level = (log.level || 'INFO').toUpperCase();
            const service = log.service || '';
            const action = log.action || '';
            const message = log.message || '';

            let cor = '#d4d4d4';
            if (level === 'ERROR') cor = '#f48771';
            else if (level === 'WARN') cor = '#dcdcaa';
            else if (level === 'INFO') cor = '#4ec9b0';
            else if (level === 'DEBUG') cor = '#808080';

            return `
                <div style="margin-bottom: 6px; padding: 4px 0; border-bottom: 1px solid #333;">
                    <span style="color: #808080;">[${data}]</span>
                    <span style="color: ${cor}; font-weight: 600; margin-left: 8px;">[${level}]</span>
                    ${service ? `<span style="color: #569cd6; margin-left: 8px;">[${service}]</span>` : ''}
                    ${action ? `<span style="color: #ce9178; margin-left: 8px;">[${action}]</span>` : ''}
                    <span style="color: #d4d4d4; margin-left: 8px;">${message}</span>
                </div>
            `;
        }).join('');

        // Remover logs antigos (se existirem) mas manter a mensagem de status
        const existingLogsDiv = conteudo.querySelector('#logs-servidor-lista');
        if (existingLogsDiv) {
            existingLogsDiv.remove();
        }

        // Adicionar logs após a mensagem de status
        const logsDiv = document.createElement('div');
        logsDiv.id = 'logs-servidor-lista';
        logsDiv.innerHTML = logsFormatados;
        conteudo.appendChild(logsDiv);

        // Scroll para o topo (logs mais recentes)
        conteudo.scrollTop = 0;

    } catch (error) {
        console.error('Erro ao carregar logs:', error);
        loadingMsg.innerHTML = `<span style="color: #f48771;">✗</span> <span style="color: #f48771;">Erro ao carregar logs: ${error.message}</span>`;
    }
}

/**
 * verificarStatusNota já definida acima — esta referência é mantida para compatibilidade
 */

/**
 * Toggle para expandir/colapsar logs do mês
 */
function toggleLogsMes(mes) {
    const mesId = mes.replace('-', '');
    const conteudo = document.getElementById(`conteudo-logs-mes-${mesId}`);
    const icon = document.getElementById(`logs-icon-${mesId}`);

    if (!conteudo || !icon) return;

    const isExpanded = conteudo.style.display !== 'none';

    if (isExpanded) {
        conteudo.style.display = 'none';
        icon.textContent = '▼';
        icon.style.transform = 'rotate(0deg)';
    } else {
        conteudo.style.display = 'block';
        icon.textContent = '▲';
        icon.style.transform = 'rotate(180deg)';

        // Se não tiver logs carregados ainda, carregar
        if (conteudo.innerHTML.includes('Carregando logs...') || conteudo.innerHTML.trim() === '') {
            carregarLogsMes(mes);
        }
    }
}

// Exportar funções globalmente
/**
 * Carrega a seção de backups XML
 */
async function carregarBackups() {
    const contentArea = document.getElementById('content-area');

    // Mostrar loading
    contentArea.innerHTML = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Backups XML - Notas de Produto</h2>
            </div>
            <div style="text-align: center; padding: 40px;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                <p style="color: var(--color-gray-medium);">Carregando backups...</p>
            </div>
        </div>
    `;

    try {
        const resultado = await API.Backups.listar();
        const resultadoNotas = await API.Backups.listarNotasNFe();

        console.log('Resultado da API de backups:', resultado);
        console.log('Notas NFe encontradas:', resultadoNotas);

        if (resultado.sucesso) {
            // Aceitar array vazio como sucesso válido
            const backups = resultado.backups || [];
            const notasNFe = resultadoNotas.sucesso ? (resultadoNotas.notas || []) : [];
            const mesesBusca = resultadoNotas.sucesso ? (resultadoNotas.meses || []) : [];
            const notasPorMes = resultadoNotas.sucesso ? (resultadoNotas.notasPorMes || []) : [];
            // Passar informações adicionais junto com o array de notas
            const notasComInfo = {
                notas: notasNFe,
                meses: mesesBusca,
                notasPorMes: notasPorMes
            };
            const html = window.Components.renderBackups(backups, resultado.mensagem, notasComInfo);
            contentArea.innerHTML = html;
        } else {
            contentArea.innerHTML = `
                <div class="content-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2 class="section-title" style="margin: 0;">Backups XML - Notas de Produto</h2>
                    </div>
                    <div class="empty-state">
                        <p style="color: #dc3545;">Erro ao carregar backups</p>
                        <p style="color: var(--color-gray-medium); font-size: 14px; margin-top: 8px;">
                            ${resultado.erro || resultado.mensagem || 'Erro desconhecido'}
                        </p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao carregar backups:', error);
        contentArea.innerHTML = `
            <div class="content-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 class="section-title" style="margin: 0;">Backups XML - Notas de Produto</h2>
                </div>
                <div class="empty-state">
                    <p style="color: #dc3545;">Erro ao carregar backups</p>
                    <p style="color: var(--color-gray-medium); font-size: 14px; margin-top: 8px;">
                        ${error.message || 'Erro desconhecido'}
                    </p>
                </div>
            </div>
        `;
    }
}

window.carregarSecao = carregarSecao;
window.toggleLogsServidor = toggleLogsServidor;
window.carregarLogsServidor = carregarLogsServidor;
window.toggleLogsMes = toggleLogsMes;
window.salvarMeusDados = salvarMeusDados;
window.resetarMeusDados = resetarMeusDados;
window.toggleWooCommerceVisibility = toggleWooCommerceVisibility;
window.salvarWooCommerce = salvarWooCommerce;
window.resetarWooCommerce = resetarWooCommerce;
window.toggleTokenVisibility = toggleTokenVisibility;
window.salvarFocusConfig = salvarFocusConfig;
window.resetarFocusConfig = resetarFocusConfig;
window.testarConexaoFocus = testarConexaoFocus;
window.toggleMes = toggleMes;
window.atualizarDadosWooCommerce = atualizarDadosWooCommerce;
window.filtrarNotasEnviadas = filtrarNotasEnviadas;
window.limparFiltrosNotasEnviadas = limparFiltrosNotasEnviadas;
window.mudarPaginaNotasEnviadas = mudarPaginaNotasEnviadas;
window.verLogsNota = verLogsNota;
window.abrirFiltrosMes = abrirFiltrosMes;
window.voltarParaListaMeses = voltarParaListaMeses;
window.filtrarPorMes = filtrarPorMes;
window.buscarPedidosFiltrados = buscarPedidosFiltrados;
window.testarConexaoWooCommerce = testarConexaoWooCommerce;
window.limparFiltrosPedidos = limparFiltrosPedidos;
window.verDetalhesPedido = verDetalhesPedido;
window.emitirNotasMes = emitirNotasMes;
window.emitirNFServicoMes = emitirNFServicoMes;
window.emitirNFProdutoMes = emitirNFProdutoMes;
window.emitirNFSePedido = emitirNFSePedido;
window.emitirLoteNFSe = emitirLoteNFSe;
window.selecionarTodosPedidos = selecionarTodosPedidos;
window.atualizarSelecaoPedidos = atualizarSelecaoPedidos;
window.obterPedidosSelecionados = obterPedidosSelecionados;
window.toggleDropdownCategorias = toggleDropdownCategorias;
window.atualizarFiltroCategorias = atualizarFiltroCategorias;
window.toggleTodasCategorias = toggleTodasCategorias;
window.carregarLogsMes = carregarLogsMes;
window.fecharModalProgresso = fecharModalProgresso;
window.limparReferencia = limparReferencia;
window.toggleAutoEmitir = toggleAutoEmitir;
window.carregarEstadoAutoEmitir = carregarEstadoAutoEmitir;
window.salvarCategoriasProduto = salvarCategoriasProduto;
window.carregarSeletorCategorias = carregarSeletorCategorias;
window.carregarCategoriasServicoInfo = carregarCategoriasServicoInfo;

async function carregarEstadoAutoEmitir() {
    try {
        const res = await API.Config.getAutoEmitir();
        const ativo = res.auto_emitir === true;
        atualizarUIAutoEmitir(ativo);
    } catch (e) {
        atualizarUIAutoEmitir(false);
    }
}

async function toggleAutoEmitir(ativo) {
    const container = document.getElementById('auto-emitir-container');
    const statusEl = document.getElementById('auto-emitir-status');
    if (statusEl) {
        statusEl.textContent = '⏳ salvando...';
        statusEl.style.background = '#fff3cd';
        statusEl.style.color = '#856404';
    }

    const msgExtra = ativo
        ? 'Notas serão emitidas automaticamente ao receber pedidos via webhook. Deseja ativar?'
        : 'A emissão automática será desativada. Pedidos continuarão sendo salvos. Deseja desativar?';

    if (!confirm(msgExtra)) {
        const toggle = document.getElementById('toggle-auto-emitir');
        if (toggle) toggle.checked = !ativo;
        await carregarEstadoAutoEmitir();
        return;
    }

    try {
        await API.Config.setAutoEmitir(ativo);
        atualizarUIAutoEmitir(ativo);
    } catch (e) {
        alert('Erro ao salvar configuração: ' + e.message);
        const toggle = document.getElementById('toggle-auto-emitir');
        if (toggle) toggle.checked = !ativo;
        await carregarEstadoAutoEmitir();
    }
}

function atualizarUIAutoEmitir(ativo) {
    const toggle = document.getElementById('toggle-auto-emitir');
    const statusEl = document.getElementById('auto-emitir-status');
    const container = document.getElementById('auto-emitir-container');

    if (toggle) toggle.checked = ativo;

    if (statusEl) {
        if (ativo) {
            statusEl.textContent = 'ATIVADO';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';
        } else {
            statusEl.textContent = 'DESATIVADO';
            statusEl.style.background = '#f8d7da';
            statusEl.style.color = '#721c24';
        }
    }

    if (container) {
        container.style.borderColor = ativo ? '#28a745' : '#dc3545';
        container.style.background = ativo ? '#f0fff0' : '#fff5f5';
    }
}


// Cache global de categorias de produto para uso em filtragem
window._categoriasProdutoCache = null;

async function carregarCategoriasProdutoCache() {
    if (window._categoriasProdutoCache) return window._categoriasProdutoCache;
    try {
        const res = await API.Config.getCategoriasProduto();
        window._categoriasProdutoCache = (res.sucesso && res.categorias) ? res.categorias : [];
    } catch (e) {
        window._categoriasProdutoCache = [];
    }
    return window._categoriasProdutoCache;
}

async function carregarSeletorCategorias() {
    const container = document.getElementById('cat-produto-checkboxes');
    const statusEl = document.getElementById('cat-produto-status');
    if (!container) return;

    try {
        const [catRes, savedRes] = await Promise.all([
            API.Config.getCategoriasWoo(),
            API.Config.getCategoriasProduto()
        ]);

        const todasCats = (catRes.sucesso && catRes.categorias) ? catRes.categorias : [];
        const salvas = (savedRes.sucesso && savedRes.categorias) ? savedRes.categorias : [];
        window._categoriasProdutoCache = salvas;

        if (todasCats.length === 0) {
            container.innerHTML = '<span style="color:#888;font-size:13px;">Nenhuma categoria encontrada. Verifique a conexão WooCommerce.</span>';
            if (statusEl) { statusEl.textContent = 'sem categorias'; statusEl.style.background = '#fff3cd'; statusEl.style.color = '#856404'; }
            return;
        }

        container.innerHTML = todasCats.map(cat => {
            const checked = salvas.includes(cat.name) ? 'checked' : '';
            return `<label style="display:flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;${checked ? 'border-color:#28a745;background:#f0fff0;' : ''}">
                <input type="checkbox" class="cat-produto-check" value="${cat.name}" ${checked} onchange="salvarCategoriasProduto()" style="width:15px;height:15px;cursor:pointer;">
                ${cat.name} <span style="color:#aaa;font-size:11px;">(${cat.count})</span>
            </label>`;
        }).join('');

        if (statusEl) {
            if (salvas.length > 0) {
                statusEl.textContent = salvas.length + ' selecionada(s)';
                statusEl.style.background = '#d4edda';
                statusEl.style.color = '#155724';
            } else {
                statusEl.textContent = 'nenhuma selecionada';
                statusEl.style.background = '#f8d7da';
                statusEl.style.color = '#721c24';
            }
        }
    } catch (e) {
        container.innerHTML = '<span style="color:#dc3545;font-size:13px;">Erro ao carregar categorias: ' + e.message + '</span>';
    }
}

async function salvarCategoriasProduto() {
    const checks = document.querySelectorAll('.cat-produto-check:checked');
    const categorias = Array.from(checks).map(c => c.value);

    try {
        await API.Config.salvarCategoriasProduto(categorias);
        window._categoriasProdutoCache = categorias;

        const statusEl = document.getElementById('cat-produto-status');
        if (statusEl) {
            statusEl.textContent = categorias.length + ' selecionada(s) - salvo!';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';
        }

        // Re-style labels
        document.querySelectorAll('.cat-produto-check').forEach(cb => {
            const label = cb.closest('label');
            if (label) {
                label.style.borderColor = cb.checked ? '#28a745' : '#ddd';
                label.style.background = cb.checked ? '#f0fff0' : '#fff';
            }
        });

        // Atualizar a tabela agora que a classificacao produto/servico mudou.
        // Woo Produtos depende dessa configuracao.
        if (estadoAtual && estadoAtual.secaoAtiva === 'pedidos') {
            await carregarPedidos();
        }
    } catch (e) {
        alert('Erro ao salvar: ' + e.message);
    }
}

/**
 * Limpa o campo de referência
 */
function limparReferencia() {
    const referenciaInput = document.getElementById('referencia-cancelar');

    if (referenciaInput) {
        referenciaInput.value = '';
        referenciaInput.focus();
    }
}

/**
 * Cancela nota por referência diretamente
 */
async function cancelarPorReferencia() {
    const referenciaInput = document.getElementById('referencia-cancelar');

    if (!referenciaInput) {
        alert('Erro: Campo de referência não encontrado');
        return;
    }

    const referencia = referenciaInput.value.trim();

    if (!referencia) {
        alert('Por favor, informe a referência da nota (ex: PED-6454)');
        referenciaInput.focus();
        return;
    }

    // Abrir modal de cancelamento com a referência
    // Tentar detectar ambiente baseado na referência ou usar produção como padrão
    const ambiente = 'producao'; // Padrão produção, pode ser alterado se necessário
    await cancelarNota(referencia, 'nfe', ambiente);

    // Limpar campo após abrir modal
    referenciaInput.value = '';
}

/**
 * Handler para o card de cancelamento de NFSe específico
 */
async function cancelarNFSePorReferenciaInput() {
    const input = document.getElementById('ref-nfse-cancelar');
    if (!input) return; // Se o elemento não existir

    const referencia = input.value.trim();
    if (!referencia) {
        alert('Digite a referência da NFSe (ex: PED-1234)');
        return;
    }

    // Extrair ID do pedido da referência (assumindo PED-XXXX ou NFSE-XXXX)
    // Se for apenas número, usar como ID
    let pedidoId = referencia;

    // Remover prefixos comuns
    const prefixos = ['PED-', 'NFSE-', 'NFE-'];

    for (const prefixo of prefixos) {
        if (referencia.toUpperCase().startsWith(prefixo)) {
            pedidoId = referencia.substring(prefixo.length);
            break;
        }
    }

    if (!pedidoId) {
        alert('ID do pedido inválido.');
        return;
    }

    console.log('Iniciando cancelamento NFSe para Pedido ID:', pedidoId);
    // Passar a referência original também para garantir
    await cancelarNFSePedido(pedidoId, referencia);
}

window.cancelarNFSePorReferenciaInput = cancelarNFSePorReferenciaInput;
window.cancelarPorReferencia = cancelarPorReferencia;

/**
 * Carrega a seção de Pedidos Excel com layout de Accordion por Mês
 */
async function carregarPedidosExcel() {
    // Woo Serviços (pedidos de servico) deve usar a mesma logica organizada da aba de produtos:
    // - lista pedidos de servico do WooCommerce/DB
    // - emissoes chamam a API correta da Focus (NFSe para servico)
    // - Google Sheets fica como painel secundario de import/config
    return await carregarPedidosServico();
    const contentArea = document.getElementById('content-area');
    const meses = gerarListaMeses();

    contentArea.innerHTML = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Woo Serviços</h2>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <div id="status-servicos-excel" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #666; font-size: 12px;">Carregando...</span>
                    </div>
                </div>
            </div>

            <!-- Categorias de Serviço -->
            <div id="categorias-servico-container" style="padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #dee2e6; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 14px;">Categorias de Serviço (NFSe)</span>
                    <span id="cat-servico-info" style="font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #e2e3e5; color: #383d41;">carregando...</span>
                </div>
                <p style="font-size: 12px; color: #666; margin: 0 0 8px;">Pedidos cujas categorias <strong>não</strong> são de produto aparecem aqui como serviço e geram NFSe.</p>
                <div id="cat-servico-list" style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span style="color: #888; font-size: 13px;">Carregando...</span>
                </div>
            </div>

            <!-- Importar do Google Sheets (collapsible) -->
            <div style="margin-bottom: 16px;">
                <button type="button" onclick="toggleConfigGSheets()" style="background: none; border: 1px solid #dee2e6; border-radius: 8px; padding: 10px 16px; cursor: pointer; width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #333;">
                    <span><strong>Importar do Google Sheets</strong> <span id="gsheets-config-status" style="font-size: 12px; margin-left: 8px; padding: 2px 8px; border-radius: 4px;">⏳</span></span>
                    <span id="gsheets-config-arrow">▶</span>
                </button>
                <div id="gsheets-config-panel" style="display: none; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px; padding: 20px; background: #fafafa;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; box-sizing: border-box;">
                        <div style="min-width: 0;">
                            <h4 style="margin: 0 0 12px 0; color: #333;">Credenciais</h4>
                            <div style="margin-bottom: 12px;">
                                <label style="font-weight: 600; font-size: 13px; color: #555; display: block; margin-bottom: 4px;">ID da Planilha</label>
                                <input type="text" id="gsheets-id" placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: monospace; box-sizing: border-box;">
                                <small style="color: #888; font-size: 11px;">Encontre na URL: docs.google.com/spreadsheets/d/<strong>{ID}</strong>/edit</small>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <label style="font-weight: 600; font-size: 13px; color: #555; display: block; margin-bottom: 4px;">JSON da Service Account</label>
                                <textarea id="gsheets-credentials" rows="6" placeholder='Cole aqui o conteúdo do arquivo .json da Service Account do Google Cloud...' style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; font-family: monospace; resize: vertical; box-sizing: border-box;"></textarea>
                                <small style="color: #888; font-size: 11px;">Baixado do Google Cloud Console > APIs > Credenciais > Service Account > Chaves</small>
                            </div>
                            <div style="margin-bottom: 8px;" id="gsheets-client-email-info"></div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button type="button" class="btn btn-primary" onclick="salvarConfigGSheets()" style="padding: 8px 16px; font-size: 13px;">Salvar</button>
                                <button type="button" class="btn btn-secondary" onclick="testarConfigGSheets()" style="padding: 8px 16px; font-size: 13px;">Testar Conexão</button>
                                <button type="button" class="btn btn-secondary" onclick="sincronizarExcel()" id="btn-sincronizar-excel" style="padding: 8px 16px; font-size: 13px;">Sincronizar Planilha</button>
                                <a id="link-abrir-planilha" href="https://docs.google.com/spreadsheets" target="_blank" class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px; text-decoration: none;">Abrir Planilha</a>
                            </div>
                            <div id="gsheets-feedback" style="margin-top: 8px; display: none; padding: 8px 12px; border-radius: 6px; font-size: 13px;"></div>
                        </div>
                        <div style="min-width: 0;">
                            <h4 style="margin: 0 0 12px 0; color: #333;">Modelo da Planilha</h4>
                            <p style="font-size: 12px; color: #666; margin-bottom: 8px;">Aba <strong>"Pedidos"</strong> com colunas:</p>
                            <div style="overflow-x: auto; border: 1px solid #ddd; border-radius: 6px; font-size: 11px;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead><tr style="background: #e8f5e9;">
                                        <th style="padding: 4px 8px; border: 1px solid #ddd;">A</th><th style="padding: 4px 8px; border: 1px solid #ddd;">B</th><th style="padding: 4px 8px; border: 1px solid #ddd;">C</th><th style="padding: 4px 8px; border: 1px solid #ddd;">D</th><th style="padding: 4px 8px; border: 1px solid #ddd;">E</th><th style="padding: 4px 8px; border: 1px solid #ddd;">F</th><th style="padding: 4px 8px; border: 1px solid #ddd;">G</th>
                                    </tr></thead>
                                    <tbody>
                                        <tr style="background: #f1f8e9; font-weight: 600;">
                                            <td style="padding: 4px 8px; border: 1px solid #ddd;">ID Pedido</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Data</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Cliente</td><td style="padding: 4px 8px; border: 1px solid #ddd;">CPF/CNPJ</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Email</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Serviço</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Valor</td>
                                        </tr>
                                        <tr style="color: #999;">
                                            <td style="padding: 4px 8px; border: 1px solid #ddd;">6454</td><td style="padding: 4px 8px; border: 1px solid #ddd;">2026-03-15</td><td style="padding: 4px 8px; border: 1px solid #ddd;">João Silva</td><td style="padding: 4px 8px; border: 1px solid #ddd;">123.456.789-00</td><td style="padding: 4px 8px; border: 1px solid #ddd;">joao@email.com</td><td style="padding: 4px 8px; border: 1px solid #ddd;">Atendimento</td><td style="padding: 4px 8px; border: 1px solid #ddd;">150.00</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p style="font-size: 11px; color: #888; margin-top: 6px;">+ colunas H-M: Status Woo, Status Nota, N Nota, Link PDF, Msg Erro, JSON Pedido</p>
                            <div style="margin-top: 12px; padding: 10px; background: #fff3e0; border-radius: 6px; border: 1px solid #ffe0b2;">
                                <p style="font-size: 12px; color: #e65100; margin: 0 0 6px 0; font-weight: 600;">Como configurar</p>
                                <ol style="font-size: 11px; color: #666; margin: 0; padding-left: 16px; line-height: 1.7;">
                                    <li>No <a href="https://console.cloud.google.com" target="_blank" style="color: #1976d2;">Google Cloud Console</a>, crie um projeto</li>
                                    <li>Ative a <strong>Google Sheets API</strong></li>
                                    <li>Crie uma <strong>Service Account</strong> e baixe o JSON</li>
                                    <li>Compartilhe a planilha com o email da Service Account (Editor)</li>
                                    <li>Cole o ID da planilha e o JSON aqui</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="status-excel" style="margin-bottom: 16px; display: none; padding: 12px; border-radius: 8px;"></div>

            <div class="accordion" id="accordion-meses-excel">
                ${meses.map((mes, index) => {
        const [anoM, mesM] = mes.value.split('-');
        const mesNome = mes.label.split(' ')[0];

        return `
                    <div id="card-excel-${mes.value}" class="accordion-item">
                        <div class="accordion-header ${index === 0 ? 'active' : ''}" onclick="toggleMesExcel('${mes.value}')">
                            <h3>${mes.label}</h3>
                            <span class="badge" id="count-excel-${mes.value}">0 pedidos</span>
                            <span class="accordion-icon">▼</span>
                        </div>
                        <div class="accordion-content ${index === 0 ? 'active' : ''}" id="content-excel-${mes.value}">
                             <div style="padding: 10px 0; display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 4px;">
                                <button class="btn-sm" style="background-color: #fff; border: 1px solid #e0e0e0; color: #333; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="importarNubankMes('${mesNome}', '${anoM}')">Importar Nubank</button>
                                <button class="btn-sm" style="background-color: #fff; border: 1px solid #e0e0e0; color: #666; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="removerNubankMes('${mesNome}', '${anoM}')">Retirar</button>
                                <button class="btn-sm" style="background-color: #fff; border: 1px solid #e0e0e0; color: #333; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="ordenarPedidosPorDataLocal('${mes.value}')">Ordenar por Data</button>
                                <button class="btn-sm" style="background-color: #fff; border: 1px solid #e0e0e0; color: #e65100; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="atualizarStatusGeral('${mes.value}')">Atualizar Status</button>
                                <button id="btn-gerar-todas-${mes.value}" class="btn-sm" style="background-color: #e65100; border: 1px solid #e65100; color: #fff; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; padding: 4px 10px; font-weight: 600;"
                                    onclick="gerarTodasNotasMes('${mes.value}')">Gerar Todas Notas</button>
                                <button style="background-color: #1976d2; border: 1px solid #1976d2; color: #fff; display: flex; align-items: center; gap: 4px; cursor: pointer; border-radius: 4px; padding: 4px 10px; font-weight: 600; font-size: 12px;"
                                    onclick="verificarTodosProcessando()" title="Verificar notas em Processando...">Atualizar Status</button>
                             </div>
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Data</th>
                                            <th>Cliente</th>
                                            <th>Valor</th>
                                            <th>Status Woo</th>
                                            <th>Status Nota</th>
                                            <th>Links</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="lista-excel-${mes.value}">
                                        <tr><td colspan="8" style="text-align: center; padding: 20px;">Carregando...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        </div>
    `;

    carregarConfigGSheets();
    carregarCategoriasServicoInfo();

    try {
        const activeMonths = [];
        document.querySelectorAll('.accordion-content.active').forEach(el => {
            const id = el.id.replace('content-excel-', '');
            activeMonths.push(id);
        });

        const resultado = await API.Excel.listar();

        if (resultado.sucesso) {
            window.pedidosExcelCache = resultado.dados || [];
            distribuirPedidosExcelPorMes(window.pedidosExcelCache);

            activeMonths.forEach(mesId => {
                toggleMesExcel(mesId);
            });

            const statusEl = document.getElementById('status-servicos-excel');
            if (statusEl) statusEl.innerHTML = '<span style="color: #28a745; font-size: 12px;">' + (window.pedidosExcelCache.length) + ' pedidos carregados</span>';
        } else {
            document.querySelectorAll('[id^="lista-excel-"]').forEach(el => {
                el.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #888;">Nenhum dado do Google Sheets. Configure acima para importar.</td></tr>';
            });
            const statusEl = document.getElementById('status-servicos-excel');
            if (statusEl) statusEl.innerHTML = '<span style="color: #888; font-size: 12px;">Sem dados</span>';
        }
    } catch (error) {
        console.error(error);
        mostrarFeedbackExcel('error', 'Erro de conexão: ' + error.message);
    }
}

async function carregarCategoriasServicoInfo() {
    const container = document.getElementById('cat-servico-list');
    const infoEl = document.getElementById('cat-servico-info');
    if (!container) return;

    try {
        const [catRes, savedRes] = await Promise.all([
            API.Config.getCategoriasWoo(),
            API.Config.getCategoriasProduto()
        ]);

        const todasCats = (catRes.sucesso && catRes.categorias) ? catRes.categorias : [];
        const produtoCats = (savedRes.sucesso && savedRes.categorias) ? savedRes.categorias : [];

        const servicoCats = todasCats.filter(cat => !produtoCats.includes(cat.name));

        if (servicoCats.length === 0 && todasCats.length === 0) {
            container.innerHTML = '<span style="color:#888;font-size:13px;">Nenhuma categoria encontrada. Verifique a conexão WooCommerce.</span>';
            if (infoEl) { infoEl.textContent = 'sem categorias'; infoEl.style.background = '#fff3cd'; infoEl.style.color = '#856404'; }
            return;
        }

        if (servicoCats.length === 0) {
            container.innerHTML = '<span style="color:#888;font-size:13px;">Todas as categorias estão marcadas como produto. Configure na tela Woo Produtos.</span>';
            if (infoEl) { infoEl.textContent = 'nenhuma categoria de serviço'; infoEl.style.background = '#fff3cd'; infoEl.style.color = '#856404'; }
            return;
        }

        container.innerHTML = servicoCats.map(cat =>
            '<span style="display:inline-block;padding:4px 10px;border:1px solid #1976d2;border-radius:6px;background:#e3f2fd;font-size:13px;color:#1565c0;">' + cat.name + ' <span style="color:#90caf9;font-size:11px;">(' + cat.count + ')</span></span>'
        ).join('');

        if (infoEl) {
            infoEl.textContent = servicoCats.length + ' categoria(s) de serviço';
            infoEl.style.background = '#d4edda';
            infoEl.style.color = '#155724';
        }
    } catch (e) {
        container.innerHTML = '<span style="color:#dc3545;font-size:13px;">Erro ao carregar categorias</span>';
    }
}

function toggleMesExcel(mesId) {
    const content = document.getElementById(`content-excel-${mesId}`);
    const header = document.querySelector(`[onclick="toggleMesExcel('${mesId}')"]`); // Find the header triggering this

    if (content) {
        // Toggle active class on content
        content.classList.toggle('active');

        // Find icon within header if header exists
        if (header) {
            header.classList.toggle('active');
            const icon = header.querySelector('.accordion-icon');
            if (icon) {
                // The CSS likely handles rotation based on .active class on header or we can set text
                icon.textContent = content.classList.contains('active') ? '▼' : '▶';
                // If using CSS rotation on .accordion-header.active .accordion-icon, text change might not be needed or should be consistent.
                // Assuming the 'active' class on header drives CSS. Let's force update text for safety as per original code.
                icon.textContent = content.classList.contains('active') ? '▼' : '▶';
            }
        } else {
            // Fallback if header selection fails (legacy ID based?)
            const icon = document.getElementById(`icon-excel-${mesId}`); // This ID wasn't in template but good for safety
            if (icon) icon.textContent = content.classList.contains('active') ? '▼' : '▶';
        }
    }
}

function buildStatusSelect(pedidoId, statusNota, isManual) {
    const opts = ['Pendente', 'Processando...', 'Autorizada', 'Cancelada', 'Erro'];
    const cores = { 'Pendente': '#6c757d', 'Processando...': '#e65100', 'Autorizada': '#28a745', 'Cancelada': '#dc3545', 'Erro': '#dc3545' };
    const cor = cores[statusNota] || '#6c757d';
    const options = opts.map(o =>
        '<option value="' + o + '"' + (o === statusNota ? ' selected' : '') + '>' + o + '</option>'
    ).join('');

    return '<select ' +
        'onchange="alterarStatusManual(\'' + pedidoId + '\', this.value)" ' +
        'style="padding:3px 6px;font-size:12px;font-weight:700;color:#fff;background:' + cor + ';border:1px solid ' + cor + ';border-radius:4px;cursor:pointer;" ' +
        'title="Clique para alterar status">' +
        options +
        '</select>' +
        (isManual ? ' <span title="Manual" style="font-size:10px">✋</span>' : '');
}

function distribuirPedidosExcelPorMes(pedidos) {
    const meses = gerarListaMeses();

    // Primeiro, esconder todos os meses
    meses.forEach(mes => {
        const countEl = document.getElementById(`count-excel-${mes.value}`);
        const tbody = document.getElementById(`lista-excel-${mes.value}`);
        const monthCard = document.getElementById(`card-excel-${mes.value}`); // Assuming card ID exists or I can find it

        if (countEl) countEl.textContent = '0 pedidos';
        if (tbody) tbody.innerHTML = '';
        if (monthCard) monthCard.style.display = 'none'; // Hide by default
    });

    if (!pedidos || pedidos.length === 0) return;

    // Agrupar pedidos
    const pedidosPorMes = {};

    pedidos.forEach(p => {
        if (!p.data) return;

        const dataObj = parseDateSafe(p.data);
        if (!dataObj) return;

        const ano = dataObj.getFullYear();
        const mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
        const chave = `${ano}-${mes}`;
        if (!pedidosPorMes[chave]) pedidosPorMes[chave] = [];
        pedidosPorMes[chave].push(p);
    });

    // Renderizar
    Object.keys(pedidosPorMes).forEach(chave => {
        const accordId = chave;
        const tbody = document.getElementById(`lista-excel-${accordId}`);
        const countEl = document.getElementById(`count-excel-${accordId}`);
        const monthCard = document.getElementById(`card-excel-${accordId}`);

        if (tbody && countEl) {
            const lista = pedidosPorMes[chave];

            // Show card if it has items
            if (lista.length > 0 && monthCard) {
                monthCard.style.display = 'block'; // Show only if has items
            }

            // Ordenar por data crescente (menor data primeiro no mês)
            lista.sort((a, b) => {
                const dA = parseDateSafe(a.data);
                const dB = parseDateSafe(b.data);
                if (dA && dB) return dA.getTime() - dB.getTime();
                if (dA) return -1;
                if (dB) return 1;
                return 0;
            });

            countEl.textContent = `${lista.length} pedidos`;

            // Renderização Segura com try-catch por item para não quebrar tudo
            tbody.innerHTML = lista.map(p => {
                try {
                    // Parsear JSON para obter status real e categoria
                    let dadosPedido = {};
                    // Handle json_pedido being object or string
                    if (p.json_pedido && typeof p.json_pedido === 'object') {
                        dadosPedido = p.json_pedido;
                    } else if (typeof p.json_pedido === 'string') {
                        try {
                            dadosPedido = JSON.parse(p.json_pedido);
                        } catch (e) { }
                    }

                    // Status do Pedido (WooCommerce)
                    const statusWoo = p.status_woo || dadosPedido.status || 'pending';
                    const statusLabels = {
                        'pending': 'Pendente',
                        'processing': 'Processando',
                        'on-hold': 'Em espera',
                        'completed': 'Concluído',
                        'cancelled': 'Cancelado',
                        'refunded': 'Reembolsado',
                        'failed': 'Falhou'
                    };
                    const statusLabel = statusLabels[statusWoo] || statusWoo;

                    // Status da Nota (Excel) - suporta override manual com prefixo [M]
                    const statusNotaRaw = p.status_nota || 'Pendente';
                    const isManual = statusNotaRaw.startsWith('[M] ');
                    const statusNota = isManual ? statusNotaRaw.substring(4) : statusNotaRaw;

                    const safeId = String(p.id).replace(/'/g, "\\'");
                    const statusHtml = buildStatusSelect(safeId, statusNota, isManual);

                    // Categorias
                    let categorias = [];
                    if (dadosPedido.servicos) {
                        dadosPedido.servicos.forEach(s => {
                            if (s.categorias) categorias.push(...s.categorias);
                        });
                    }
                    const categoriaTexto = categorias.length > 0 ? [...new Set(categorias)].join(', ') : 'Serviço';

                    // Extrair CPF/CNPJ para validação
                    const cpfCnpj = (dadosPedido.cpf_cnpj || p.cpf_cnpj || '').replace(/\D/g, '');
                    const temDocumentoValido = cpfCnpj.length === 11 || cpfCnpj.length === 14;

                    // Verificar se é Nubank para estilo
                    const isNubank = (p.id && String(p.id).startsWith('NBK-')) ||
                        dadosPedido.origem === 'nubank' ||
                        (typeof p.json_pedido === 'string' && p.json_pedido.includes('"origem":"nubank"'));
                    const rowStyle = isNubank ? 'background-color: #f7f7f7; border-left: 3px solid #6c757d;' : ''; // Destacar mais

                    // Valor Seguro
                    let valorNum = parseFloat(p.valor);
                    if (isNaN(valorNum)) valorNum = 0;

                    return `
                        <tr style="${rowStyle}">
                            <td><strong>${isNubank ? '🏦 ' : ''}#${p.id}</strong></td>
                            <td>${formatarDataHuman(p.data)}</td>
                            <td>
                                ${p.cliente}<br>
                                <small style="color: #666;">${p.email || ''}</small>
                                ${(() => {
                                    // Detectar se é endereço internacional
                                    const endereco = dadosPedido.endereco || {};
                                    const pais = endereco.pais || '';
                                    const paisUpper = String(pais).toUpperCase().trim();
                                    const isInternacional = paisUpper !== 'BR' && 
                                                           paisUpper !== 'BRASIL' && 
                                                           paisUpper !== '' &&
                                                           paisUpper !== 'BRAZIL';
                                    const indicadorInternacional = isInternacional ? ' <span style="color: #856404; font-weight: normal;">(Internacional)</span>' : '';
                                    const pedidoIdEscapado = String(p.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                    return `<br><a href="#" onclick="if(typeof mostrarEnderecoCompleto === 'function') { mostrarEnderecoCompleto('${pedidoIdEscapado}', event); } else { alert('Função não disponível. Recarregue a página.'); } return false;" style="color: #000; text-decoration: underline; font-size: 11px; cursor: pointer;">Conferir endereço${indicadorInternacional}</a>`;
                                })()}
                            </td>
                            <td>${window.Components ? window.Components.formatarValor(valorNum) : `R$ ${valorNum.toFixed(2)}`}</td>
                            <td>${statusLabel}</td>
                            <td>${statusHtml}</td>
                            <td>
                             ${p.link_pdf ? `<a href="${p.link_pdf}" target="_blank" class="btn btn-sm btn-secondary" title="Ver PDF">📄 PDF</a>` : ''}
                             ${p.numero_nota ? `<small class="d-block mt-1">Nota: ${p.numero_nota}</small>` : ''}
                        </td>
                        <td>
                            ${statusNota !== 'Autorizada' ? `
                                ${temDocumentoValido ? `
                                    <button class="btn btn-primary" onclick="emitirNotaExcel('${p.id}')" style="padding: 4px 12px; font-size: 12px; white-space: nowrap;">
                                        Emitir NFSe
                                    </button>
                                ` : `
                                    <button class="btn btn-secondary" disabled style="padding: 4px 12px; font-size: 12px; white-space: nowrap; opacity: 0.6; cursor: not-allowed;" title="Documento (CPF/CNPJ) inválido ou ausente">
                                        ⚠️ Dados Inválidos
                                    </button>
                                    <div style="font-size: 10px; color: #dc3545; margin-top: 2px;">CPF/CNPJ ausente</div>
                                `}
                            ` : `
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span>✅</span>
                                    <button class="btn btn-sm" onclick="cancelarNotaExcel('${p.id}')" style="padding: 2px 8px; font-size: 11px; background: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;" title="Cancelar nota emitida">
                                        Cancelar Nota
                                    </button>
                                </div>
                            `}
                            ${(() => {
                                if (!p.mensagem_erro) return '';
                                let erroMsg = '';
                                if (typeof p.mensagem_erro === 'string') {
                                    erroMsg = escapeHtml(p.mensagem_erro);
                                } else if (typeof p.mensagem_erro === 'object') {
                                    // Tentar extrair mensagem do objeto
                                    if (p.mensagem_erro.mensagem) {
                                        erroMsg = escapeHtml(String(p.mensagem_erro.mensagem));
                                    } else if (p.mensagem_erro.erro) {
                                        erroMsg = escapeHtml(String(p.mensagem_erro.erro));
                                    } else if (p.mensagem_erro.message) {
                                        erroMsg = escapeHtml(String(p.mensagem_erro.message));
                                    } else {
                                        try {
                                            erroMsg = escapeHtml(JSON.stringify(p.mensagem_erro));
                                        } catch (e) {
                                            erroMsg = 'Erro ao processar mensagem';
                                        }
                                    }
                                } else {
                                    erroMsg = escapeHtml(String(p.mensagem_erro));
                                }
                                return erroMsg ? `<div style="font-size: 10px; color: red; max-width: 200px; margin-top: 4px;">${erroMsg}</div>` : '';
                            })()}
                        </td>
                    </tr>
                `;
                } catch (e) {
                    console.error('Erro ao renderizar item:', e);
                    return '';
                }
            }).join('');
        }
    });
}

function formatarDataHuman(dataIso) {
    if (!dataIso) return '-';
    const str = String(dataIso).trim();

    // Formato corrupto do Google Sheets: DDTxx:xx:xx/MM/YYYY → DD/MM/YYYY
    const matchCorrupt = str.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})/);
    if (matchCorrupt) return `${matchCorrupt[1]}/${matchCorrupt[2]}/${matchCorrupt[3]}`;

    // Formato ISO YYYY-MM-DD
    const parts = str.split('-');
    if (parts.length === 3) return `${parts[2].substring(0, 2)}/${parts[1]}/${parts[0]}`;

    // Formato BR DD/MM/YYYY (já está correto)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) return str.split(' ')[0];

    return dataIso;
}

// Atualiza a sincronização para buscar 30 dias por padrão ou perguntar
async function sincronizarExcel() {
    const btn = document.getElementById('btn-sincronizar-excel');

    // Forçar busca completa sem perguntar
    const dias = 'todos';

    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Sincronizando TUDO...';
    }

    try {
        const res = await API.Excel.sincronizar(dias);
        if (res.sucesso) {
            // Recarregar lista
            await carregarPedidosExcel();
            mostrarFeedbackExcel('success', `Sincronização concluída: ${res.resumo.inseridos} novos, ${res.resumo.atualizados} atualizados.`);
        } else {
            mostrarFeedbackExcel('error', `Erro na sincronização: ${res.erro}`);
        }
    } catch (err) {
        mostrarFeedbackExcel('error', `Erro ao chamar sincronização: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄 Sincronizar (Geral)';
        }
    }
}


/**
 * Importar Nubank por mês específico
 */
async function importarNubankMes(mesNome, ano) {
    if (!confirm(`Importar dados do Nubank para ${mesNome}/${ano}?`)) return;

    try {
        if (window.Toast) window.Toast.info(`Lendo aba "${mesNome}-${ano}-Nubank"...`);

        const res = await API.Excel.importarNubank(mesNome, ano);

        if (res.sucesso) {
            const resumo = res.resumo;
            const msg = `Sucesso! Lidos: ${resumo.lidos}, Importados: ${resumo.inseridos}`;
            if (window.Toast) window.Toast.success(msg);

            // Recarregar a lista
            await carregarPedidosExcel();
        } else {
            const erro = res.erro || 'Erro desconhecido';
            if (window.Toast) window.Toast.error(`Erro: ${erro}`);
        }
    } catch (err) {
        if (window.Toast) window.Toast.error(`Falha: ${err.message}`);
    }
}
window.importarNubankMes = importarNubankMes;

async function emitirNotaExcel(pedidoId) {
    if (!confirm(`Emitir NFSe para o pedido #${pedidoId}?`)) return;

    // Encontrar elementos da linha para feedback visual imediato
    const row = Array.from(document.querySelectorAll('td')).find(td => td.textContent.includes(`#${pedidoId}`))?.parentElement;
    let originalButtonHtml = '';

    if (row) {
        const btnCell = row.cells[7]; // Coluna Ações
        if (btnCell) {
            originalButtonHtml = btnCell.innerHTML;
            btnCell.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px;"></div>';
        }
    }

    try {
        mostrarFeedbackExcel('info', `Emitindo nota para pedido #${pedidoId}... aguarde.`);
        const res = await API.Excel.emitir(pedidoId);

        if (res.sucesso) {
            const statusFinal = res.status === 'autorizado' ? 'Autorizada' : 'Processando...';
            mostrarFeedbackExcel('success', `Nota #${pedidoId} enviada → ${statusFinal}`);

            // Atualizar cache e recarregar para manter dropdown e ações sincronizados
            if (window.pedidosExcelCache) {
                const pedidoCached = window.pedidosExcelCache.find(p => p.id == pedidoId);
                if (pedidoCached) {
                    pedidoCached.status_nota = statusFinal;
                    pedidoCached.link_pdf = res.link_pdf || pedidoCached.link_pdf;
                    pedidoCached.numero_nota = res.numero || pedidoCached.numero_nota;
                }
            }
            await carregarPedidosExcel();
        } else {
            const limiteInfo = formatarErroLimite(res);
            const msg = limiteInfo ? (limiteInfo.mensagem + (limiteInfo.upgrade_url ? ' Acesse a página de upgrade para continuar.' : '')) : res.erro;
            mostrarFeedbackExcel('error', `Erro ao emitir: ${msg}`);
            if (limiteInfo && limiteInfo.upgrade_url) {
                mostrarFeedbackExcel('info', 'Abra ' + limiteInfo.upgrade_url + ' para fazer upgrade.');
            }
            // Restaurar botão original em caso de erro
            if (row && originalButtonHtml) {
                row.cells[7].innerHTML = originalButtonHtml;
            }
            // Adicionar mensagem de erro na linha
            if (row) {
                const actionCell = row.cells[7];
                const existingError = actionCell.querySelector('.error-msg');
                if (!existingError) {
                    actionCell.innerHTML += `<div class="error-msg" style="font-size: 10px; color: red; max-width: 200px; margin-top: 4px;">${res.erro}</div>`;
                }
            }
        }
    } catch (err) {
        mostrarFeedbackExcel('error', `Falha na requisição: ${err.message}`);
        // Restaurar botão original
        if (row && originalButtonHtml) {
            row.cells[7].innerHTML = originalButtonHtml;
        }
    }
}

function mostrarFeedbackExcel(tipo, msg) {
    const div = document.getElementById('status-excel');
    if (!div) return;
    div.style.display = 'block';
    if (tipo === 'success') {
        div.style.backgroundColor = '#d4edda';
        div.style.color = '#155724';
        div.style.border = '1px solid #c3e6cb';
    } else if (tipo === 'error') {
        div.style.backgroundColor = '#f8d7da';
        div.style.color = '#721c24';
        div.style.border = '1px solid #f5c6cb';
    } else {
        div.style.backgroundColor = '#e2e3e5';
        div.style.color = '#383d41';
        div.style.border = '1px solid #d6d8db';
    }
    div.innerHTML = msg;
    if (tipo === 'success') {
        setTimeout(() => { div.style.display = 'none'; }, 5000);
    }
}

/**
 * Gerar todas as notas pendentes de um mês, em ordem de data, com delay entre cada.
 * Pula notas já autorizadas e continua de onde parou.
 */
async function gerarTodasNotasMes(mesValue) {
    const btn = document.getElementById(`btn-gerar-todas-${mesValue}`);
    if (btn && btn.dataset.running === 'true') {
        btn.dataset.running = 'false';
        btn.textContent = 'Cancelando...';
        btn.disabled = true;
        return;
    }

    const pedidosMes = (window.pedidosExcelCache || []).filter(p => {
        if (!p.data) return false;
        const dataObj = parseDateSafe(p.data);
        if (!dataObj) return false;
        const ano = dataObj.getFullYear();
        const mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
        return `${ano}-${mes}` === mesValue;
    });

    // Sort by date ascending (começo do mês → final)
    pedidosMes.sort((a, b) => {
        const dA = parseDateSafe(a.data) || new Date(0);
        const dB = parseDateSafe(b.data) || new Date(0);
        return dA - dB;
    });

    const pendentes = pedidosMes.filter(p => {
        const raw = (p.status_nota || '').replace(/^\[M\] /i, '').toLowerCase();
        return raw !== 'autorizada' && raw !== 'cancelada';
    }).filter(p => {
        let dados = {};
        if (p.json_pedido && typeof p.json_pedido === 'object') dados = p.json_pedido;
        else if (typeof p.json_pedido === 'string') { try { dados = JSON.parse(p.json_pedido); } catch(e){} }
        const cpf = (dados.cpf_cnpj || p.cpf_cnpj || '').replace(/\D/g, '');
        return cpf.length === 11 || cpf.length === 14;
    });

    if (pendentes.length === 0) {
        mostrarFeedbackExcel('info', `Nenhuma nota pendente com dados v\u00e1lidos para ${mesValue}.`);
        return;
    }

    if (!confirm(`Gerar ${pendentes.length} nota(s) pendente(s) de ${mesValue}?\nNotas j\u00e1 autorizadas ser\u00e3o ignoradas.\nO processo leva ~5s por nota.`)) return;

    if (btn) {
        btn.dataset.running = 'true';
        btn.style.backgroundColor = '#dc3545';
        btn.textContent = `0/${pendentes.length} - Clique p/ parar`;
    }

    let sucesso = 0, erros = 0;
    const DELAY_MS = 5000;

    for (let i = 0; i < pendentes.length; i++) {
        if (btn && btn.dataset.running !== 'true') break;

        const p = pendentes[i];
        if (btn) btn.textContent = `${i + 1}/${pendentes.length} - Emitindo #${p.id}...`;

        mostrarFeedbackExcel('info', `[${i + 1}/${pendentes.length}] Emitindo nota #${p.id} (${p.cliente || 'N/A'})...`);

        try {
            const res = await API.Excel.emitir(p.id);
            if (res.sucesso) {
                sucesso++;
                const row = Array.from(document.querySelectorAll('td')).find(td => td.textContent.includes(`#${p.id}`))?.parentElement;
                if (row) {
                    const sc = row.cells[5]; if (sc) sc.innerHTML = '<span class="badge badge-success">Autorizada</span>';
                    const ac = row.cells[7]; if (ac) ac.innerHTML = '\u2705';
                }
                if (window.pedidosExcelCache) {
                    const cached = window.pedidosExcelCache.find(c => c.id == p.id);
                    if (cached) cached.status_nota = 'Autorizada';
                }
            } else {
                erros++;
                const row = Array.from(document.querySelectorAll('td')).find(td => td.textContent.includes(`#${p.id}`))?.parentElement;
                if (row) {
                    const ac = row.cells[7];
                    if (ac) ac.innerHTML += `<div style="font-size:10px;color:red;margin-top:4px;">${res.erro || 'Erro'}</div>`;
                }
            }
        } catch (err) {
            erros++;
        }

        if (i < pendentes.length - 1 && btn && btn.dataset.running === 'true') {
            if (btn) btn.textContent = `${i + 1}/${pendentes.length} - Aguardando...`;
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    const stopped = btn && btn.dataset.running !== 'true';
    mostrarFeedbackExcel(erros === 0 ? 'success' : 'error',
        `${stopped ? 'Interrompido' : 'Conclu\u00eddo'}: ${sucesso} emitida(s), ${erros} erro(s) de ${pendentes.length} nota(s).`);

    if (btn) {
        btn.dataset.running = 'false';
        btn.disabled = false;
        btn.style.backgroundColor = '#e65100';
        btn.textContent = 'Gerar Todas Notas';
    }

    // Recarregar dados da planilha para atualizar status de todas as notas
    try { await carregarPedidosExcel(); } catch (e) { }

    // Aguardar 15s e verificar notas "Processando..." na Focus NFe
    if (sucesso > 0) {
        mostrarFeedbackExcel('info', 'Aguardando 15s para verificar status na Focus NFe...');
        setTimeout(async () => {
            await verificarTodosProcessando();
        }, 15000);
    }
}

async function cancelarNotaExcel(pedidoId) {
    const justificativaPadrao = "A ordem das notas foi gerada incorretamente, necessitamos cancelar para reemitir";
    const justificativa = prompt('Justificativa para cancelamento (mínimo 15 caracteres):', justificativaPadrao);

    if (!justificativa) return;
    if (justificativa.length < 15) {
        alert('A justificativa deve ter pelo menos 15 caracteres.');
        return;
    }
    if (!confirm(`Tem certeza que deseja CANCELAR a nota do pedido #${pedidoId}?`)) return;

    const btn = document.querySelector(`button[onclick*="cancelarNotaExcel('${pedidoId}')"]`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Cancelando...'; }

    try {
        mostrarFeedbackExcel('info', `Cancelando nota do pedido #${pedidoId}...`);

        const response = await fetch('/api/excel/cancelar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedido_id: pedidoId, justificativa })
        });
        const result = await response.json();

        if (result.sucesso) {
            if (result.aviso) {
                mostrarFeedbackExcel('error', result.mensagem || 'Cancelamento manual necessário.');
            } else {
                mostrarFeedbackExcel('success', result.mensagem || 'Cancelamento solicitado!');
            }
            await carregarPedidosExcel();
        } else {
            const erroMsg = typeof result.erro === 'string' ? result.erro : 
                          (result.erro?.mensagem || result.erro?.message || JSON.stringify(result.erro) || 'Erro desconhecido');
            throw new Error(erroMsg);
        }
    } catch (err) {
        const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
        mostrarFeedbackExcel('error', `Erro ao cancelar: ${errorMsg}`);
        if (btn) { btn.disabled = false; btn.textContent = 'Cancelar Nota'; }
    }
}

async function alterarStatusManual(pedidoId, novoStatus) {
    try {
        const response = await fetch('/api/excel/status-manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedido_id: pedidoId, status: novoStatus })
        });
        const result = await response.json();

        if (result.sucesso) {
            mostrarFeedbackExcel('success', `#${pedidoId} → ${novoStatus} ✋`);
            // Recarregar para atualizar status E coluna de ações
            await carregarPedidosExcel();
        } else {
            mostrarFeedbackExcel('error', `Erro: ${result.erro}`);
        }
    } catch (err) {
        mostrarFeedbackExcel('error', `Falha: ${err.message}`);
    }
}

window.carregarPedidosExcel = carregarPedidosExcel;
window.sincronizarExcel = sincronizarExcel;
window.emitirNotaExcel = emitirNotaExcel;
window.cancelarNotaExcel = cancelarNotaExcel;
window.alterarStatusManual = alterarStatusManual;
window.toggleMesExcel = toggleMesExcel;
window.gerarTodasNotasMes = gerarTodasNotasMes;
window.toggleConfigGSheets = toggleConfigGSheets;
window.salvarConfigGSheets = salvarConfigGSheets;
window.testarConfigGSheets = testarConfigGSheets;

function toggleConfigGSheets() {
    const panel = document.getElementById('gsheets-config-panel');
    const arrow = document.getElementById('gsheets-config-arrow');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    if (arrow) arrow.textContent = open ? '▶' : '▼';
    if (!open) carregarConfigGSheets();
}

async function carregarConfigGSheets() {
    try {
        const res = await API.Config.getGoogleSheets();
        if (res.sucesso && res.dados) {
            const idInput = document.getElementById('gsheets-id');
            if (idInput && res.dados.sheets_id) idInput.value = res.dados.sheets_id;

            const statusEl = document.getElementById('gsheets-config-status');
            if (statusEl) {
                if (res.dados.tem_credentials && res.dados.sheets_id) {
                    statusEl.textContent = '✓ Configurado';
                    statusEl.style.background = '#d4edda';
                    statusEl.style.color = '#155724';
                } else {
                    statusEl.textContent = '✗ Não configurado';
                    statusEl.style.background = '#f8d7da';
                    statusEl.style.color = '#721c24';
                }
            }

            const emailInfo = document.getElementById('gsheets-client-email-info');
            if (emailInfo && res.dados.client_email) {
                emailInfo.innerHTML = '<small style="color: #1976d2;">Service Account: <strong>' + res.dados.client_email + '</strong></small>';
            }

            // Update "Abrir Planilha" link
            const link = document.getElementById('link-abrir-planilha');
            if (link && res.dados.sheets_id) {
                link.href = 'https://docs.google.com/spreadsheets/d/' + res.dados.sheets_id + '/edit';
            }
        }
    } catch (e) {
        console.error('Erro ao carregar config GSheets:', e);
    }
}

async function salvarConfigGSheets() {
    const sheetsId = document.getElementById('gsheets-id')?.value?.trim();
    const credentials = document.getElementById('gsheets-credentials')?.value?.trim();
    const fb = document.getElementById('gsheets-feedback');

    if (!sheetsId) {
        if (fb) { fb.style.display = 'block'; fb.style.background = '#f8d7da'; fb.style.color = '#721c24'; fb.textContent = 'Informe o ID da planilha'; }
        return;
    }

    if (fb) { fb.style.display = 'block'; fb.style.background = '#fff3cd'; fb.style.color = '#856404'; fb.textContent = 'Salvando...'; }

    try {
        const body = { sheets_id: sheetsId };
        if (credentials) body.credentials_json = credentials;
        const res = await API.Config.salvarGoogleSheets(body.sheets_id, body.credentials_json);
        if (res.sucesso) {
            if (fb) { fb.style.background = '#d4edda'; fb.style.color = '#155724'; fb.textContent = 'Configuração salva com sucesso!'; }
            await carregarConfigGSheets();
            // Clear credentials textarea (security)
            const credEl = document.getElementById('gsheets-credentials');
            if (credEl) credEl.value = '';
        } else {
            if (fb) { fb.style.background = '#f8d7da'; fb.style.color = '#721c24'; fb.textContent = 'Erro: ' + (res.erro || 'Falha ao salvar'); }
        }
    } catch (e) {
        if (fb) { fb.style.background = '#f8d7da'; fb.style.color = '#721c24'; fb.textContent = 'Erro: ' + e.message; }
    }
}

async function testarConfigGSheets() {
    const fb = document.getElementById('gsheets-feedback');
    if (fb) { fb.style.display = 'block'; fb.style.background = '#fff3cd'; fb.style.color = '#856404'; fb.textContent = 'Testando conexão...'; }

    try {
        const res = await API.Config.testarGoogleSheets();
        if (res.sucesso) {
            if (fb) { fb.style.background = '#d4edda'; fb.style.color = '#155724'; fb.textContent = '✓ ' + (res.mensagem || 'Conexão OK!'); }
        } else {
            if (fb) { fb.style.background = '#f8d7da'; fb.style.color = '#721c24'; fb.textContent = '✗ ' + (res.erro || 'Falha na conexão'); }
        }
    } catch (e) {
        if (fb) { fb.style.background = '#f8d7da'; fb.style.color = '#721c24'; fb.textContent = '✗ Erro: ' + e.message; }
    }
}


/**
 * Sistema de Notificações Toast
 */
const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = 5000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        this.container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'info'); }
};

/**
 * Remove pedidos importados do Nubank de um mês específico
 */
async function removerNubankMes(mesNome, ano) {
    // Converter mês nome para número
    const mesesMap = {
        'Janeiro': '01', 'Fevereiro': '02', 'Março': '03', 'Abril': '04',
        'Maio': '05', 'Junho': '06', 'Julho': '07', 'Agosto': '08',
        'Setembro': '09', 'Outubro': '10', 'Novembro': '11', 'Dezembro': '12'
    };

    // Simplificação: o mesNome vem como "Novembro", etc.
    const mesNum = mesesMap[mesNome];

    if (!confirm(`Tem certeza que deseja REMOVER TODOS os pedidos importados do Nubank de ${mesNome}/${ano}?\n\nEssa ação não pode ser desfeita.`)) {
        return;
    }

    // Usar toast ou alert para feedback imediato
    if (window.Toast) window.Toast.info('Processando remoção...');

    try {
        const resultado = await API.Excel.removerNubank(mesNum, ano);

        if (resultado.sucesso) {
            if (window.Toast) window.Toast.success(resultado.mensagem);
            else alert(resultado.mensagem);

            // Recarregar lista para refletir mudanças
            await carregarPedidosExcel();
        } else {
            const erroMsg = typeof resultado.erro === 'string' ? resultado.erro : 
                          (resultado.erro?.mensagem || resultado.erro?.message || JSON.stringify(resultado.erro));
            if (window.Toast) window.Toast.error('Erro: ' + erroMsg);
            else alert('Erro: ' + erroMsg);
        }
    } catch (error) {
        console.error(error);
        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        if (window.Toast) window.Toast.error('Erro ao processar solicitação: ' + errorMsg);
        else alert('Erro ao processar solicitação: ' + errorMsg);
    }
}


window.Toast = Toast;


/**
 * Ordena os pedidos de um mês específico pela data (alterna entre crescente e decrescente)
 * @param {string} mesValue Valor do mês (ex: 2025-11)
 */
async function ordenarPedidosPorDataLocal(mesValue) {
    const tbody = document.getElementById(`lista-excel-${mesValue}`);
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0 || rows[0].innerText.includes('Nenhum pedido')) return;

    // Verificar ordem atual (armazenada no atributo data-order do tbody)
    // Se não existir ou for 'desc', começar com 'asc' (A-Z, mais antigo primeiro)
    // Se for 'asc', mudar para 'desc' (Z-A, mais recente primeiro)
    const ordemAtual = tbody.dataset.order || 'desc';
    const novaOrdem = ordemAtual === 'desc' ? 'asc' : 'desc';
    
    // Atualizar atributo para próxima vez
    tbody.dataset.order = novaOrdem;

    // Função auxiliar para parsear data (reutilizando lógica robusta)
    const getTimestamp = (dtStr) => {
        if (!dtStr) return 0;
        const str = dtStr.trim();
        let dia, mes, ano;

        // Formato DD/MM/YYYY
        const matchBR = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        // Formato Corrompido: 01T11:14:34/12/2025
        const matchCorrupt = str.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})/);
        // Formato ISO
        const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (matchBR) {
            [, dia, mes, ano] = matchBR;
        } else if (matchCorrupt) {
            [, dia, mes, ano] = matchCorrupt;
        } else if (matchISO) {
            [, ano, mes, dia] = matchISO;
        }

        if (dia && mes && ano) {
            return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)).getTime();
        }
        return 0;
    };

    rows.sort((a, b) => {
        // Obter data da celula (coluna 2, index 1)
        const dateA = a.children[1]?.innerText || '';
        const dateB = b.children[1]?.innerText || '';

        const tsA = getTimestamp(dateA);
        const tsB = getTimestamp(dateB);

        // Se ordem for 'asc' (A-Z), mais antigo primeiro: tsA - tsB
        // Se ordem for 'desc' (Z-A), mais recente primeiro: tsB - tsA
        return novaOrdem === 'asc' ? tsA - tsB : tsB - tsA;
    });

    // Reanexar ordenado
    rows.forEach(row => tbody.appendChild(row));

    // Atualizar texto do botão para indicar a ordem atual
    const botaoOrdenar = document.querySelector(`button[onclick*="ordenarPedidosPorDataLocal('${mesValue}')"]`);
    if (botaoOrdenar) {
        const textoAtual = botaoOrdenar.innerHTML;
        // Remover indicadores anteriores se existirem
        const textoLimpo = textoAtual.replace(/\s*\([A-Z↕↓↑]\)/g, '');
        const indicador = novaOrdem === 'asc' ? ' (A-Z ↑)' : ' (Z-A ↓)';
        botaoOrdenar.innerHTML = textoLimpo + indicador;
    }

    const mensagem = novaOrdem === 'asc' 
        ? 'Ordenado por data: mais antigo primeiro (A-Z ↑)' 
        : 'Ordenado por data: mais recente primeiro (Z-A ↓)';
    
    if (window.Toast) {
        window.Toast.success(mensagem);
    } else {
        alert(mensagem);
    }
}

/**
 * Mostra modal com endereço completo do pedido
 */
window.mostrarEnderecoCompleto = async function mostrarEnderecoCompleto(pedidoId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Buscar dados do pedido do cache ou fazer requisição
    let dadosPedido = null;
    
    try {
        // Tentar buscar do cache primeiro
        if (window.pedidosExcelCache) {
            // Se for um array simples
            if (Array.isArray(window.pedidosExcelCache)) {
                dadosPedido = window.pedidosExcelCache.find(p => String(p.id) === String(pedidoId));
            } else if (typeof window.pedidosExcelCache === 'object') {
                // Se for um objeto com meses, procurar em todos
                for (const mes in window.pedidosExcelCache) {
                    if (window.pedidosExcelCache[mes] && Array.isArray(window.pedidosExcelCache[mes])) {
                        const pedidoEncontrado = window.pedidosExcelCache[mes].find(p => String(p.id) === String(pedidoId));
                        if (pedidoEncontrado) {
                            dadosPedido = pedidoEncontrado;
                            break;
                        }
                    }
                }
            }
        }
        
        // Se ainda não encontrou, o pedido pode não estar carregado
        if (!dadosPedido) {
            throw new Error('Pedido não encontrado no cache. Por favor, recarregue a página para atualizar os dados.');
        }
        
        // Parsear json_pedido se existir
        if (dadosPedido && dadosPedido.json_pedido) {
            if (typeof dadosPedido.json_pedido === 'string') {
                try {
                    const parsed = JSON.parse(dadosPedido.json_pedido);
                    dadosPedido = { ...dadosPedido, ...parsed };
                } catch (e) {
                    console.warn('Erro ao parsear json_pedido (continuando mesmo assim):', e);
                }
            } else if (typeof dadosPedido.json_pedido === 'object') {
                dadosPedido = { ...dadosPedido, ...dadosPedido.json_pedido };
            }
        }
        
        // Garantir que dadosPedido tem estrutura esperada
        if (!dadosPedido) {
            throw new Error('Pedido não encontrado');
        }
        
        if (!dadosPedido.endereco) {
            dadosPedido.endereco = {};
        }
        
    } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        let errorMessage = 'Erro desconhecido';
        if (error && typeof error === 'object') {
            if (error.message) {
                errorMessage = error.message;
            } else if (error.error) {
                errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
            } else {
                try {
                    errorMessage = JSON.stringify(error);
                } catch (e) {
                    errorMessage = 'Erro ao processar mensagem de erro';
                }
            }
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        alert(`Erro ao buscar dados do pedido: ${errorMessage}`);
        return;
    }
    
    // Criar ou obter modal
    let modal = document.getElementById('modal-endereco-completo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-endereco-completo';
        modal.style.cssText = 'display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);';
        document.body.appendChild(modal);
    }
    
    // Detectar se é endereço internacional
    const endereco = dadosPedido.endereco || {};
    const pais = endereco.pais || '';
    const paisUpper = String(pais).toUpperCase().trim();
    const isInternacional = paisUpper !== 'BR' && 
                           paisUpper !== 'BRASIL' && 
                           paisUpper !== '' &&
                           paisUpper !== 'BRAZIL';
    
    // Preparar dados do endereço
    const rua = escapeHtml(endereco.rua || 'Não informado');
    const numero = escapeHtml(endereco.numero || 'S/N');
    const complemento = escapeHtml(endereco.complemento || '');
    const bairro = escapeHtml(endereco.bairro || 'Não informado');
    const cidade = escapeHtml(endereco.cidade || 'Não informado');
    const estado = escapeHtml(endereco.estado || 'Não informado');
    const cep = escapeHtml(endereco.cep || 'Não informado');
    const paisDisplay = escapeHtml(pais || 'BR');
    
    // Extrair NIF se for internacional
    const nif = isInternacional ? (dadosPedido.nif || dadosPedido.cpf_cnpj || '') : '';
    
    // Função auxiliar para validar se é CPF (11 dígitos)
    function validarCPF(numero) {
        if (!numero) return null;
        const limpo = numero.replace(/\D/g, '');
        if (limpo.length === 11) {
            // Validar dígitos verificadores do CPF
            let soma = 0;
            let resto;
            
            // Verificar se todos os dígitos são iguais
            if (/^(\d)\1{10}$/.test(limpo)) return null;
            
            // Validar primeiro dígito verificador
            for (let i = 1; i <= 9; i++) {
                soma += parseInt(limpo.substring(i - 1, i)) * (11 - i);
            }
            resto = (soma * 10) % 11;
            if (resto === 10 || resto === 11) resto = 0;
            if (resto !== parseInt(limpo.substring(9, 10))) return null;
            
            // Validar segundo dígito verificador
            soma = 0;
            for (let i = 1; i <= 10; i++) {
                soma += parseInt(limpo.substring(i - 1, i)) * (12 - i);
            }
            resto = (soma * 10) % 11;
            if (resto === 10 || resto === 11) resto = 0;
            if (resto !== parseInt(limpo.substring(10, 11))) return null;
            
            return {
                valido: true,
                documento: limpo,
                formatado: limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
            };
        }
        return null;
    }
    
    // Detectar se NIF é na verdade um CPF
    let documentoInfo = null;
    if (isInternacional && nif) {
        documentoInfo = validarCPF(nif);
    }
    
    // Formatar endereço para exibição
    let enderecoFormatado = '';
    if (isInternacional) {
        let documentoHTML = '';
        if (documentoInfo && documentoInfo.valido) {
            // CPF detectado
            documentoHTML = `<hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
                <p><strong>CPF:</strong> ${escapeHtml(documentoInfo.formatado)} 
                <span style="background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 8px;">✓ CPF detectado</span>
                <br><small style="color: #666;">(Brasileiro morando no exterior - CPF será usado na emissão)</small></p>`;
        } else if (nif) {
            // NIF estrangeiro
            documentoHTML = `<hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
                <p><strong>NIF:</strong> ${escapeHtml(nif)} <small style="color: #666;">(Número de Identificação Fiscal)</small></p>`;
        }
        
        enderecoFormatado = `
            <div style="background: #fff3cd; padding: 12px; border-radius: 4px; margin-bottom: 16px; border-left: 4px solid #ffc107;">
                <strong>🌍 Endereço Internacional</strong><br>
                <small style="color: #856404;">Campos que serão enviados para Focus NFe</small>
            </div>
            <div style="line-height: 1.8;">
                <p><strong>Logradouro:</strong> ${rua}</p>
                <p><strong>Número:</strong> ${numero}</p>
                ${complemento ? `<p><strong>Complemento:</strong> ${complemento}</p>` : ''}
                <p><strong>Bairro:</strong> ${bairro}</p>
                <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
                <p><strong>País (codigo_pais_ext):</strong> ${paisDisplay} <small style="color: #666;">(será convertido para código ISO)</small></p>
                <p><strong>Cidade (nome_cidade_ext):</strong> ${cidade}</p>
                <p><strong>Região (regiao_ext):</strong> ${estado !== 'Não informado' ? estado : cidade} <small style="color: #666;">(estado/província)</small></p>
                <p><strong>CEP (cep_ext):</strong> ${cep} <small style="color: #666;">(código postal internacional)</small></p>
                ${documentoHTML}
            </div>
        `;
    } else {
        // Para endereços brasileiros: campos padrão
        enderecoFormatado = `
            <div style="line-height: 1.8;">
                <p><strong>Rua:</strong> ${rua}</p>
                <p><strong>Número:</strong> ${numero}</p>
                ${complemento ? `<p><strong>Complemento:</strong> ${complemento}</p>` : ''}
                <p><strong>Bairro:</strong> ${bairro}</p>
                <p><strong>Cidade:</strong> ${cidade}</p>
                <p><strong>Estado:</strong> ${estado}</p>
                <p><strong>CEP:</strong> ${cep}</p>
                <p><strong>País:</strong> ${paisDisplay}</p>
            </div>
        `;
    }
    
    // Armazenar dados do pedido no modal para uso posterior
    modal.dataset.pedidoId = pedidoId;
    modal.dataset.dadosPedido = JSON.stringify(dadosPedido);
    modal.dataset.isInternacional = isInternacional;
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; margin: 50px auto; background: white; padding: 0; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">Endereço Completo - Pedido #${escapeHtml(String(pedidoId))}</h3>
                <button onclick="fecharModalEndereco()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <div id="endereco-view-mode">
                    <p style="margin-bottom: 16px; color: #666; font-size: 14px;">
                        Endereço que será usado na emissão da nota:
                    </p>
                    <div id="endereco-display">
                        ${enderecoFormatado}
                    </div>
                </div>
                <div id="endereco-edit-mode" style="display: none;">
                    ${criarFormularioEdicaoEndereco(dadosPedido, isInternacional)}
                </div>
            </div>
            <div class="modal-footer" style="padding: 16px 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div id="footer-view-mode">
                    <button class="btn btn-primary" onclick="editarEnderecoModal()" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Editar Endereço</button>
                </div>
                <div id="footer-edit-mode" style="display: none; gap: 8px;">
                    <button class="btn btn-secondary" onclick="cancelarEdicaoEndereco()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary" onclick="salvarEnderecoModal()" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Salvar</button>
                </div>
                <button class="btn btn-secondary" onclick="fecharModalEndereco()" id="btn-fechar-modal" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Fechar</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

/**
 * Fecha o modal de endereço
 */
window.fecharModalEndereco = function fecharModalEndereco() {
    const modal = document.getElementById('modal-endereco-completo');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Cria formulário de edição de endereço
 */
function criarFormularioEdicaoEndereco(dadosPedido, isInternacionalInicial) {
    const endereco = dadosPedido.endereco || {};
    const nif = dadosPedido.nif || dadosPedido.cpf_cnpj || '';
    
    return `
        <div style="max-height: 500px; overflow-y: auto;">
            <div style="margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500;">
                    <input type="checkbox" id="toggle-endereco-internacional" ${isInternacionalInicial ? 'checked' : ''} onchange="toggleTipoEndereco()" style="width: 18px; height: 18px; cursor: pointer;">
                    <span>Endereço Internacional</span>
                </label>
                <small style="color: #666; display: block; margin-top: 4px;">Marque se o endereço é fora do Brasil</small>
            </div>
            
            <div id="campos-endereco-brasileiro" style="display: ${isInternacionalInicial ? 'none' : 'block'};">
                <div style="display: grid; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Rua/Logradouro *</label>
                        <input type="text" id="edit-rua" value="${escapeHtml(endereco.rua || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Número *</label>
                            <input type="text" id="edit-numero" value="${escapeHtml(endereco.numero || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-weight: 500;">CEP *</label>
                            <input type="text" id="edit-cep" value="${escapeHtml(endereco.cep || '')}" placeholder="00000-000" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                        </div>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Complemento</label>
                        <input type="text" id="edit-complemento" value="${escapeHtml(endereco.complemento || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Bairro *</label>
                        <input type="text" id="edit-bairro" value="${escapeHtml(endereco.bairro || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Cidade *</label>
                            <input type="text" id="edit-cidade" value="${escapeHtml(endereco.cidade || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Estado (UF) *</label>
                            <input type="text" id="edit-estado" value="${escapeHtml(endereco.estado || '')}" placeholder="PE" maxlength="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-transform: uppercase;" required>
                        </div>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">CPF/CNPJ *</label>
                        <input type="text" id="edit-cpf-cnpj" value="${escapeHtml(dadosPedido.cpf_cnpj || '')}" placeholder="000.000.000-00 ou 00.000.000/0000-00" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                </div>
            </div>
            
            <div id="campos-endereco-internacional" style="display: ${isInternacionalInicial ? 'block' : 'none'};">
                <div style="background: #fff3cd; padding: 12px; border-radius: 4px; margin-bottom: 16px; border-left: 4px solid #ffc107;">
                    <strong>🌍 Endereço Internacional</strong><br>
                    <small style="color: #856404;">Preencha os campos conforme o endereço no exterior</small>
                </div>
                <div style="display: grid; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Logradouro *</label>
                        <input type="text" id="edit-int-rua" value="${escapeHtml(endereco.rua || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Número *</label>
                            <input type="text" id="edit-int-numero" value="${escapeHtml(endereco.numero || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-weight: 500;">CEP/Código Postal</label>
                            <input type="text" id="edit-int-cep" value="${escapeHtml(endereco.cep || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Complemento</label>
                        <input type="text" id="edit-int-complemento" value="${escapeHtml(endereco.complemento || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Bairro/Distrito</label>
                        <input type="text" id="edit-int-bairro" value="${escapeHtml(endereco.bairro || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Cidade *</label>
                        <input type="text" id="edit-int-cidade" value="${escapeHtml(endereco.cidade || '')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Região/Estado/Província *</label>
                        <input type="text" id="edit-int-estado" value="${escapeHtml(endereco.estado || '')}" placeholder="Ex: California, São Paulo, etc." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">País *</label>
                        <input type="text" id="edit-int-pais" value="${escapeHtml(endereco.pais || '')}" placeholder="Ex: Estados Unidos, Portugal, etc." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">NIF/CPF/CNPJ *</label>
                        <input type="text" id="edit-int-nif" value="${escapeHtml(nif)}" placeholder="Número de Identificação Fiscal ou CPF/CNPJ brasileiro" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                        <small style="color: #666; display: block; margin-top: 4px;">Para brasileiros no exterior, use o CPF. Para estrangeiros, use o NIF do país.</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Alterna para modo de edição
 */
window.editarEnderecoModal = function editarEnderecoModal() {
    const modal = document.getElementById('modal-endereco-completo');
    if (!modal) return;
    
    const viewMode = document.getElementById('endereco-view-mode');
    const editMode = document.getElementById('endereco-edit-mode');
    const footerView = document.getElementById('footer-view-mode');
    const footerEdit = document.getElementById('footer-edit-mode');
    const btnFechar = document.getElementById('btn-fechar-modal');
    
    if (viewMode && editMode && footerView && footerEdit) {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
        footerView.style.display = 'none';
        footerEdit.style.display = 'flex';
        if (btnFechar) btnFechar.style.display = 'none';
    }
}

/**
 * Cancela edição e volta para modo visualização
 */
window.cancelarEdicaoEndereco = function cancelarEdicaoEndereco() {
    const modal = document.getElementById('modal-endereco-completo');
    if (!modal) return;
    
    const viewMode = document.getElementById('endereco-view-mode');
    const editMode = document.getElementById('endereco-edit-mode');
    const footerView = document.getElementById('footer-view-mode');
    const footerEdit = document.getElementById('footer-edit-mode');
    const btnFechar = document.getElementById('btn-fechar-modal');
    
    if (viewMode && editMode && footerView && footerEdit) {
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        footerView.style.display = 'block';
        footerEdit.style.display = 'none';
        if (btnFechar) btnFechar.style.display = 'block';
    }
}

/**
 * Alterna entre campos de endereço brasileiro e internacional
 */
window.toggleTipoEndereco = function toggleTipoEndereco() {
    const checkbox = document.getElementById('toggle-endereco-internacional');
    const camposBR = document.getElementById('campos-endereco-brasileiro');
    const camposINT = document.getElementById('campos-endereco-internacional');
    
    if (checkbox && camposBR && camposINT) {
        if (checkbox.checked) {
            // Sincronizar valores dos campos brasileiros para internacionais
            const ruaBR = document.getElementById('edit-rua')?.value || '';
            const numeroBR = document.getElementById('edit-numero')?.value || '';
            const complementoBR = document.getElementById('edit-complemento')?.value || '';
            const bairroBR = document.getElementById('edit-bairro')?.value || '';
            const cidadeBR = document.getElementById('edit-cidade')?.value || '';
            const estadoBR = document.getElementById('edit-estado')?.value || '';
            const cepBR = document.getElementById('edit-cep')?.value || '';
            const cpfBR = document.getElementById('edit-cpf-cnpj')?.value || '';
            
            if (document.getElementById('edit-int-rua') && !document.getElementById('edit-int-rua').value) {
                document.getElementById('edit-int-rua').value = ruaBR;
            }
            if (document.getElementById('edit-int-numero') && !document.getElementById('edit-int-numero').value) {
                document.getElementById('edit-int-numero').value = numeroBR;
            }
            if (document.getElementById('edit-int-complemento') && !document.getElementById('edit-int-complemento').value) {
                document.getElementById('edit-int-complemento').value = complementoBR;
            }
            if (document.getElementById('edit-int-bairro') && !document.getElementById('edit-int-bairro').value) {
                document.getElementById('edit-int-bairro').value = bairroBR;
            }
            if (document.getElementById('edit-int-cidade') && !document.getElementById('edit-int-cidade').value) {
                document.getElementById('edit-int-cidade').value = cidadeBR;
            }
            if (document.getElementById('edit-int-estado') && !document.getElementById('edit-int-estado').value) {
                document.getElementById('edit-int-estado').value = estadoBR;
            }
            if (document.getElementById('edit-int-cep') && !document.getElementById('edit-int-cep').value) {
                document.getElementById('edit-int-cep').value = cepBR;
            }
            if (document.getElementById('edit-int-nif') && !document.getElementById('edit-int-nif').value) {
                document.getElementById('edit-int-nif').value = cpfBR;
            }
            
            camposBR.style.display = 'none';
            camposINT.style.display = 'block';
        } else {
            // Sincronizar valores dos campos internacionais para brasileiros
            const ruaINT = document.getElementById('edit-int-rua')?.value || '';
            const numeroINT = document.getElementById('edit-int-numero')?.value || '';
            const complementoINT = document.getElementById('edit-int-complemento')?.value || '';
            const bairroINT = document.getElementById('edit-int-bairro')?.value || '';
            const cidadeINT = document.getElementById('edit-int-cidade')?.value || '';
            const estadoINT = document.getElementById('edit-int-estado')?.value || '';
            const cepINT = document.getElementById('edit-int-cep')?.value || '';
            const nifINT = document.getElementById('edit-int-nif')?.value || '';
            
            if (document.getElementById('edit-rua') && !document.getElementById('edit-rua').value) {
                document.getElementById('edit-rua').value = ruaINT;
            }
            if (document.getElementById('edit-numero') && !document.getElementById('edit-numero').value) {
                document.getElementById('edit-numero').value = numeroINT;
            }
            if (document.getElementById('edit-complemento') && !document.getElementById('edit-complemento').value) {
                document.getElementById('edit-complemento').value = complementoINT;
            }
            if (document.getElementById('edit-bairro') && !document.getElementById('edit-bairro').value) {
                document.getElementById('edit-bairro').value = bairroINT;
            }
            if (document.getElementById('edit-cidade') && !document.getElementById('edit-cidade').value) {
                document.getElementById('edit-cidade').value = cidadeINT;
            }
            if (document.getElementById('edit-estado') && !document.getElementById('edit-estado').value) {
                document.getElementById('edit-estado').value = estadoINT.length === 2 ? estadoINT : '';
            }
            if (document.getElementById('edit-cep') && !document.getElementById('edit-cep').value) {
                document.getElementById('edit-cep').value = cepINT;
            }
            if (document.getElementById('edit-cpf-cnpj') && !document.getElementById('edit-cpf-cnpj').value) {
                document.getElementById('edit-cpf-cnpj').value = nifINT;
            }
            
            camposBR.style.display = 'block';
            camposINT.style.display = 'none';
        }
    }
}

/**
 * Salva endereço editado
 */
window.salvarEnderecoModal = async function salvarEnderecoModal() {
    const modal = document.getElementById('modal-endereco-completo');
    if (!modal) return;
    
    const pedidoId = modal.dataset.pedidoId;
    const isInternacional = document.getElementById('toggle-endereco-internacional')?.checked || false;
    
    try {
        let endereco = {};
        let cpf_cnpj = '';
        let nif = '';
        
        if (isInternacional) {
            // Campos internacionais
            const rua = document.getElementById('edit-int-rua')?.value?.trim();
            const numero = document.getElementById('edit-int-numero')?.value?.trim();
            const complemento = document.getElementById('edit-int-complemento')?.value?.trim();
            const bairro = document.getElementById('edit-int-bairro')?.value?.trim();
            const cidade = document.getElementById('edit-int-cidade')?.value?.trim();
            const estado = document.getElementById('edit-int-estado')?.value?.trim();
            const pais = document.getElementById('edit-int-pais')?.value?.trim();
            const cep = document.getElementById('edit-int-cep')?.value?.trim();
            nif = document.getElementById('edit-int-nif')?.value?.trim() || '';
            
            if (!rua || !numero || !cidade || !estado || !pais || !nif) {
                alert('Por favor, preencha todos os campos obrigatórios do endereço internacional.');
                return;
            }
            
            endereco = {
                rua,
                numero,
                complemento: complemento || '',
                bairro: bairro || '',
                cidade,
                estado,
                pais,
                cep: cep || ''
            };
            
            // Verificar se NIF é CPF brasileiro (11 dígitos)
            const nifLimpo = nif.replace(/\D/g, '');
            if (nifLimpo.length === 11) {
                cpf_cnpj = nifLimpo;
            } else {
                cpf_cnpj = nif;
            }
        } else {
            // Campos brasileiros
            const rua = document.getElementById('edit-rua')?.value?.trim();
            const numero = document.getElementById('edit-numero')?.value?.trim();
            const complemento = document.getElementById('edit-complemento')?.value?.trim();
            const bairro = document.getElementById('edit-bairro')?.value?.trim();
            const cidade = document.getElementById('edit-cidade')?.value?.trim();
            const estado = document.getElementById('edit-estado')?.value?.trim().toUpperCase();
            const cep = document.getElementById('edit-cep')?.value?.replace(/\D/g, '') || '';
            cpf_cnpj = document.getElementById('edit-cpf-cnpj')?.value?.replace(/\D/g, '') || '';
            
            if (!rua || !numero || !bairro || !cidade || !estado || !cep || !cpf_cnpj) {
                alert('Por favor, preencha todos os campos obrigatórios do endereço brasileiro.');
                return;
            }
            
            if (estado.length !== 2) {
                alert('O estado deve ter 2 caracteres (ex: PE, SP, RJ).');
                return;
            }
            
            endereco = {
                rua,
                numero,
                complemento: complemento || '',
                bairro,
                cidade,
                estado,
                cep,
                pais: 'Brasil'
            };
        }
        
        // Tentar primeiro como pedido do Excel, depois como pedido do WooCommerce
        let response = null;
        let resultado = null;
        let erroOcorrido = null;
        
        // Verificar se é pedido do Excel (geralmente são números simples ou começam com NBK-)
        const isExcelPedido = /^\d+$/.test(pedidoId) || pedidoId.startsWith('NBK-');
        
        console.log('Salvando endereço:', { pedidoId, isExcelPedido, isInternacional, endereco });
        
        if (isExcelPedido) {
            // Tentar rota do Excel primeiro
            try {
                console.log('Tentando salvar via rota Excel...');
                response = await fetch(`/api/excel/pedidos/${pedidoId}/endereco`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        endereco,
                        cpf_cnpj,
                        ...(isInternacional && nif ? { nif } : {})
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Erro HTTP ao salvar via Excel:', response.status, errorText);
                    erroOcorrido = `Erro ${response.status}: ${errorText}`;
                } else {
                    resultado = await response.json();
                    console.log('Resposta da rota Excel:', resultado);
                }
            } catch (e) {
                // Se falhar, tentar rota de pedidos
                console.warn('Erro ao salvar via rota Excel, tentando rota pedidos:', e);
                erroOcorrido = e.message;
            }
        }
        
        // Se não tentou Excel ou falhou, tentar rota de pedidos
        if (!response || !resultado || !resultado.sucesso) {
            try {
                console.log('Tentando salvar via rota pedidos...');
                response = await fetch(`/api/pedidos/${pedidoId}/endereco`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        endereco,
                        cpf_cnpj,
                        ...(isInternacional && nif ? { nif } : {})
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Erro HTTP ao salvar via pedidos:', response.status, errorText);
                    erroOcorrido = `Erro ${response.status}: ${errorText}`;
                    resultado = { sucesso: false, erro: errorText };
                } else {
                    resultado = await response.json();
                    console.log('Resposta da rota pedidos:', resultado);
                }
            } catch (e) {
                console.error('Erro ao salvar via rota pedidos:', e);
                erroOcorrido = e.message;
                resultado = { sucesso: false, erro: e.message };
            }
        }
        
        if (resultado && resultado.sucesso) {
            // Atualizar cache se existir
            if (window.pedidosExcelCache) {
                if (Array.isArray(window.pedidosExcelCache)) {
                    const pedidoIndex = window.pedidosExcelCache.findIndex(p => String(p.id) === String(pedidoId));
                    if (pedidoIndex >= 0) {
                        window.pedidosExcelCache[pedidoIndex] = {
                            ...window.pedidosExcelCache[pedidoIndex],
                            endereco,
                            cpf_cnpj,
                            ...(isInternacional && nif ? { nif } : {})
                        };
                    }
                } else if (typeof window.pedidosExcelCache === 'object') {
                    for (const mes in window.pedidosExcelCache) {
                        if (window.pedidosExcelCache[mes] && Array.isArray(window.pedidosExcelCache[mes])) {
                            const pedidoIndex = window.pedidosExcelCache[mes].findIndex(p => String(p.id) === String(pedidoId));
                            if (pedidoIndex >= 0) {
                                window.pedidosExcelCache[mes][pedidoIndex] = {
                                    ...window.pedidosExcelCache[mes][pedidoIndex],
                                    endereco,
                                    cpf_cnpj,
                                    ...(isInternacional && nif ? { nif } : {})
                                };
                                break;
                            }
                        }
                    }
                }
            }
            
            if (window.Toast) {
                window.Toast.success('Endereço atualizado com sucesso!');
            } else {
                alert('✅ Endereço atualizado com sucesso!');
            }
            
            // Atualizar dados do pedido no modal
            const dadosPedidoAtualizado = {
                ...JSON.parse(modal.dataset.dadosPedido || '{}'),
                endereco,
                cpf_cnpj,
                ...(isInternacional && nif ? { nif } : {})
            };
            modal.dataset.dadosPedido = JSON.stringify(dadosPedidoAtualizado);
            modal.dataset.isInternacional = isInternacional;
            
            // Recarregar modal com novos dados
            await mostrarEnderecoCompleto(pedidoId);
        } else {
            const erroMsg = resultado?.erro ? 
                          (typeof resultado.erro === 'string' ? resultado.erro : 
                           (resultado.erro?.mensagem || resultado.erro?.message || JSON.stringify(resultado.erro))) :
                          (erroOcorrido || 'Erro desconhecido ao salvar endereço');
            console.error('Erro ao salvar endereço:', { resultado, erroOcorrido, erroMsg });
            alert(`Erro ao salvar endereço: ${erroMsg}`);
        }
    } catch (error) {
        console.error('Erro ao salvar endereço:', error);
        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        alert(`Erro ao salvar endereço: ${errorMsg}`);
    }
}

// Função auxiliar para escapar HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fechar modal ao clicar fora
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modal-endereco-completo');
    if (modal && e.target === modal) {
        fecharModalEndereco();
    }
});

