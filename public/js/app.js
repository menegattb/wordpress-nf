// Main App - Lógica principal e navegação

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
    // Verificar autenticação primeiro - LOGIN DESABILITADO
    // const autenticado = await verificarAutenticacao();
    // if (!autenticado) {
    //     return; // Redirecionamento já foi feito
    // }

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
        cnpj: '51581345000117',
        inscricao_municipal: '032.392-6',
        razao_social: 'Lungta Psicoterapia Ltda',
        codigo_municipio: '2607208',
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
        url: 'https://meditandojunto.com',
        api_url: 'https://meditandojunto.com/wp-json/wc/v3',
        consumer_key: 'ck_65ddd6aac5d176eef45ab47c031410b95e57f163',
        consumer_secret: 'cs_7f4c98b0ef10421de9774ee3410981a8f9308839'
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
        token_homologacao: '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA',
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
            alert('Erro ao salvar configurações: ' + (resultado.erro || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        alert('Erro ao salvar configurações: ' + error.message);
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
                        <div><strong>Erro:</strong> ${resultado.erro || resultado.mensagem || 'Erro desconhecido'}</div>
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

        // Tentar obter data de diferentes formas
        if (pedido.date_created) {
            dateCreated = new Date(pedido.date_created);
        } else if (pedido.created_at) {
            dateCreated = new Date(pedido.created_at);
        } else if (pedido.dados_pedido) {
            const dadosPedido = typeof pedido.dados_pedido === 'string'
                ? JSON.parse(pedido.dados_pedido)
                : pedido.dados_pedido;
            dateCreated = new Date(dadosPedido.date_created || dadosPedido.data_pedido || dadosPedido.data_emissao || dadosPedido.created_at);
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
    let dateCreated = dados.data_pedido || dados.data_emissao || dados.date_created || pedidoBanco.created_at || pedidoBanco.date_created;

    // Se não encontrou data válida, usar data atual como fallback
    if (!dateCreated || (new Date(dateCreated)).toString() === 'Invalid Date') {
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
 * Verifica se o pedido contém produtos "Livro Faíscas"
 */
function pedidoContemLivroFaiscas(pedido) {
    const categoriasLivro = ['livro faíscas', 'livro faiscas', 'livros faíscas', 'livros faiscas'];

    // Extrair dados do pedido (pode estar em dados_pedido)
    const dadosPedido = typeof pedido.dados_pedido === 'string'
        ? JSON.parse(pedido.dados_pedido)
        : pedido.dados_pedido || pedido;

    if (!dadosPedido.line_items && !pedido.line_items) {
        return false;
    }

    const lineItems = dadosPedido.line_items || pedido.line_items || [];

    for (const item of lineItems) {
        // Verificar categorias do item
        if (item.categories && Array.isArray(item.categories)) {
            for (const cat of item.categories) {
                const nomeCategoria = (typeof cat === 'string' ? cat : cat.name || '').toLowerCase();
                if (categoriasLivro.some(c => nomeCategoria.includes(c))) {
                    return true;
                }
            }
        }
        // Verificar categoria direta
        if (item.category) {
            const nomeCategoria = (typeof item.category === 'string' ? item.category : item.category.name || '').toLowerCase();
            if (categoriasLivro.some(c => nomeCategoria.includes(c))) {
                return true;
            }
        }
        // Verificar nome do produto como fallback
        if (item.name) {
            const nomeProduto = item.name.toLowerCase();
            if (categoriasLivro.some(c => nomeProduto.includes(c))) {
                return true;
            }
        }
    }

    // Verificar também usando extrairCategoriasPedido do Components
    if (window.Components && typeof window.Components.extrairCategoriasPedido === 'function') {
        const categorias = window.Components.extrairCategoriasPedido(pedido);
        const temLivroFaiscas = categorias.some(cat => {
            const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return (catLower.includes('livro') && catLower.includes('faiscas')) ||
                catLower === 'livro faiscas' ||
                catLower.includes('livro faiscas');
        });
        if (temLivroFaiscas) {
            return true;
        }
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
                <h2 class="section-title" style="margin: 0;">Pedidos Woo Produtos</h2>
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
        // 1. CARREGAR DO BANCO LOCAL (instantâneo)
        atualizarStatusConexao('Carregando do banco...', 'info');

        let todosPedidos = [];
        const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });

        if (resultadoBanco.sucesso && resultadoBanco.dados && resultadoBanco.dados.length > 0) {
            todosPedidos = resultadoBanco.dados;

            // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
            todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

            // Filtrar apenas pedidos com "Livro Faíscas" (produtos)
            todosPedidos = todosPedidos.filter(pedido => {
                return pedidoContemLivroFaiscas(pedido);
            });

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
                    <h2 class="section-title" style="margin: 0;">Pedidos Woo Produtos</h2>
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
                    <h2 class="section-title" style="margin: 0;">Pedidos Woo Serviço</h2>
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
        // 1. CARREGAR DO BANCO LOCAL (instantâneo)
        if (mostrarLoading) atualizarStatusConexaoServico('Carregando do banco...', 'info');

        let todosPedidos = [];
        const resultadoBanco = await API.Pedidos.listarDoBanco({ limite: 2000 });

        if (resultadoBanco.sucesso && resultadoBanco.dados && resultadoBanco.dados.length > 0) {
            todosPedidos = resultadoBanco.dados;

            // Converter pedidos do banco para formato WooCommerce ANTES de filtrar
            // Isso garante que pedidoContemLivroFaiscas tenha acesso aos dados convertidos
            todosPedidos = todosPedidos.map(pedido => converterPedidoBancoParaWooCommerce(pedido));

            // Filtrar apenas pedidos de serviço (excluir Livro Faíscas) DEPOIS da conversão
            todosPedidos = todosPedidos.filter(pedido => {
                return !pedidoContemLivroFaiscas(pedido);
            });

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
                        <h2 class="section-title" style="margin: 0;">Pedidos Woo Serviço</h2>
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

    // Extrair todas as categorias únicas de TODOS os pedidos (para o filtro mostrar todas as opções)
    // EXCLUIR "Livro Faíscas" das categorias disponíveis
    const todasCategorias = new Set();
    pedidos.forEach(pedido => {
        const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
        if (categorias.length > 0) {
            categorias.forEach(cat => {
                // Excluir categorias relacionadas a "Livro Faíscas"
                const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const isLivroFaiscas = (catLower.includes('livro') && catLower.includes('faiscas')) ||
                    catLower === 'livro faiscas' ||
                    catLower.includes('livro faiscas');
                if (!isLivroFaiscas) {
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
                <h2 class="section-title" style="margin: 0;">Pedidos Woo Serviço</h2>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button 
                        type="button" 
                        class="btn btn-primary" 
                        onclick="atualizarDadosWooCommerceServico()"
                        id="btn-atualizar-woocommerce-servico"
                        style="padding: 8px 16px; font-size: 14px;">
                        Recarregar do WooCommerce
                    </button>
                <div id="status-woocommerce-servico" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #28a745; font-size: 12px;">✓ ${pedidosFiltrados.length} pedidos ${filtroStatus || filtroCategoria ? 'filtrados' : 'carregados'}</span>
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
                
                <div style="display: flex; align-items: center; gap: 8px; position: relative;">
                    <label style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">Categoria:</label>
                    <div style="position: relative;">
                        <button 
                            type="button"
                            id="btn-filtro-categoria-servico"
                            onclick="toggleDropdownCategoriasServico()"
                            style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-width: 200px; background: white; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                            <span id="texto-filtro-categoria-servico">${filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.length > 0 ? `${filtroCategoria.length} categoria(s) selecionada(s)` : 'Todas as categorias'}</span>
                            <span style="margin-left: 8px;">▼</span>
                        </button>
                        <div 
                            id="dropdown-categorias-servico"
                            style="display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; max-height: 300px; overflow-y: auto; min-width: 250px; padding: 8px;">
                            <div style="padding: 8px; border-bottom: 1px solid #eee;">
                                <label style="display: flex; align-items: center; cursor: pointer; font-weight: 600;">
                                    <input 
                                        type="checkbox" 
                                        class="checkbox-categoria-todas-servico"
                                        onchange="toggleTodasCategoriasServico(this)"
                                        style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;"
                                        ${!filtroCategoria || filtroCategoria.length === 0 ? 'checked' : ''}>
                                    <span>Todas as categorias</span>
                                </label>
                            </div>
                            ${categoriasOrdenadas.map(cat => {
        const catId = cat.toLowerCase().replace(/\s+/g, '-');
        const isSelected = filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.includes(catId);
        return `
                                    <div style="padding: 8px; border-bottom: 1px solid #f0f0f0;">
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input 
                                                type="checkbox" 
                                                class="checkbox-categoria-servico"
                                                value="${catId}"
                                                data-categoria="${cat}"
                                                onchange="atualizarFiltroCategoriasServico()"
                                                style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;"
                                                ${isSelected ? 'checked' : ''}>
                                            <span>${cat}</span>
                                        </label>
                                    </div>
                                `;
    }).join('')}
                            <div style="padding: 8px; border-top: 1px solid #eee;">
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input 
                                        type="checkbox" 
                                        class="checkbox-categoria-servico"
                                        value="sem-categoria"
                                        data-categoria="Sem categoria"
                                        onchange="atualizarFiltroCategoriasServico()"
                                        style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;"
                                        ${filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.includes('sem-categoria') ? 'checked' : ''}>
                                    <span>Sem categoria</span>
                                </label>
                            </div>
                        </div>
                    </div>
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
                
                ${(filtroStatus || (filtroCategoria && filtroCategoria.length > 0) || agruparPorCategoria) ? `
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
        const dataPedido = new Date(pedido.date_created);
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

                // Filtrar apenas pedidos de serviço (excluir Livro Faíscas) DEPOIS da conversão
                todosPedidos = todosPedidos.filter(pedido => {
                    return !pedidoContemLivroFaiscas(pedido);
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

            // Filtrar apenas pedidos de serviço (excluir Livro Faíscas) DEPOIS da conversão
            todosPedidos = todosPedidos.filter(pedido => {
                return !pedidoContemLivroFaiscas(pedido);
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
        throw new Error(resultado.erro || 'Erro ao importar pedidos');
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

                // Filtrar apenas pedidos de serviço (excluir Livro Faíscas) DEPOIS da conversão
                let pedidosServico = todosPedidos.filter(pedido => {
                    return !pedidoContemLivroFaiscas(pedido);
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

                // Filtrar apenas pedidos com "Livro Faíscas" (produtos)
                todosPedidos = todosPedidos.filter(pedido => {
                    return pedidoContemLivroFaiscas(pedido);
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

            // Filtrar apenas pedidos com "Livro Faíscas" (produtos)
            todosPedidos = todosPedidos.filter(pedido => {
                return pedidoContemLivroFaiscas(pedido);
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
        throw new Error(resultado.erro || 'Erro ao importar pedidos');
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
            // Verificar se ainda estamos na seção de notas enviadas
            if (estadoAtual.secaoAtiva !== 'notas-enviadas') {
                clearInterval(pollingNotasInterval);
                pollingNotasInterval = null;
                return;
            }

            // Buscar notas atualizadas do banco (sem alterar página atual)
            const limite = 50;
            const offset = (estadoAtual.paginaNotas - 1) * limite;
            const filtros = {
                limite: limite,
                offset: offset,
                ...estadoAtual.filtrosNotas
            };

            const resultado = await API.NFSe.listar(filtros);

            if (resultado.sucesso) {
                const notas = resultado.dados || [];
                const total = resultado.total || 0;
                const notasAnteriores = estadoAtual.dados.notasEnviadas || [];

                // Verificar se há novas notas (comparar por referência)
                const referenciasAnteriores = new Set(notasAnteriores.map(n => n.referencia));
                const novasNotas = notas.filter(n => !referenciasAnteriores.has(n.referencia));

                if (novasNotas.length > 0) {
                    console.log(`🔔 ${novasNotas.length} nova(s) nota(s) detectada(s)`);

                    // Atualizar dados
                    estadoAtual.dados.notasEnviadas = notas;
                    const tabelaArea = document.getElementById('tabela-notas-enviadas');
                    if (tabelaArea) {
                        tabelaArea.innerHTML = await window.Components.renderizarTabelaNotasEnviadas(notas);
                    }

                    // Atualizar paginação se necessário
                    const totalPaginas = Math.ceil(total / limite) || 1;
                    const paginacaoArea = document.getElementById('paginacao-notas-enviadas');
                    if (paginacaoArea) {
                        paginacaoArea.innerHTML = window.Components.renderizarPaginacao(
                            estadoAtual.paginaNotas,
                            totalPaginas,
                            'mudarPaginaNotasEnviadas'
                        );
                    }
                }
            }
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

                // Filtrar apenas pedidos com "Livro Faíscas" (produtos)
                todosPedidos = todosPedidos.filter(pedido => {
                    return pedidoContemLivroFaiscas(pedido);
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

    // Extrair todas as categorias únicas de TODOS os pedidos (para o filtro mostrar todas as opções)
    // Para produtos, mostrar apenas categorias relacionadas a "Livro Faíscas"
    const todasCategorias = new Set();
    pedidos.forEach(pedido => {
        const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
        if (categorias.length > 0) {
            categorias.forEach(cat => {
                // Incluir apenas categorias relacionadas a "Livro Faíscas"
                const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const isLivroFaiscas = (catLower.includes('livro') && catLower.includes('faiscas')) ||
                    catLower === 'livro faiscas' ||
                    catLower.includes('livro faiscas');
                if (isLivroFaiscas) {
                    todasCategorias.add(cat);
                }
            });
        }
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
                <h2 class="section-title" style="margin: 0;">Pedidos Woo Produtos</h2>
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
                
                <div style="display: flex; align-items: center; gap: 8px; position: relative;">
                    <label style="font-weight: 600; font-size: 14px; color: var(--color-gray-dark);">Categoria:</label>
                    <div style="position: relative;">
                        <button 
                            type="button"
                            id="btn-filtro-categoria"
                            onclick="toggleDropdownCategorias()"
                            style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-width: 200px; background: white; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                            <span id="texto-filtro-categoria">${filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.length > 0 ? `${filtroCategoria.length} categoria(s) selecionada(s)` : 'Todas as categorias'}</span>
                            <span style="margin-left: 8px;">▼</span>
                        </button>
                        <div 
                            id="dropdown-categorias"
                            style="display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; max-height: 300px; overflow-y: auto; min-width: 250px; padding: 8px;">
                            <div style="padding: 8px; border-bottom: 1px solid #eee;">
                                <label style="display: flex; align-items: center; cursor: pointer; font-weight: 600;">
                                    <input 
                                        type="checkbox" 
                                        class="checkbox-categoria-todas"
                                        onchange="toggleTodasCategorias(this)"
                                        style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;"
                                        ${!filtroCategoria || filtroCategoria.length === 0 ? 'checked' : ''}>
                                    <span>Todas as categorias</span>
                                </label>
                            </div>
                            ${categoriasOrdenadas.map(cat => {
        const catId = cat.toLowerCase().replace(/\s+/g, '-');
        const isSelected = filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.includes(catId);
        return `
                                    <div style="padding: 8px; border-bottom: 1px solid #f0f0f0;">
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input 
                                                type="checkbox" 
                                                class="checkbox-categoria"
                                                value="${catId}"
                                                data-categoria="${cat}"
                                                onchange="atualizarFiltroCategorias()"
                                                style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;"
                                                ${isSelected ? 'checked' : ''}>
                                            <span>${cat}</span>
                                        </label>
                                    </div>
                                `;
    }).join('')}
                            <div style="padding: 8px; border-top: 1px solid #eee;">
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input 
                                        type="checkbox" 
                                        class="checkbox-categoria"
                                        value="sem-categoria"
                                        data-categoria="Sem categoria"
                                        onchange="atualizarFiltroCategorias()"
                                        style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;"
                                        ${filtroCategoria && Array.isArray(filtroCategoria) && filtroCategoria.includes('sem-categoria') ? 'checked' : ''}>
                                    <span>Sem categoria</span>
                                </label>
                            </div>
                        </div>
                    </div>
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
                
                ${(filtroStatus || (filtroCategoria && filtroCategoria.length > 0) || agruparPorCategoria) ? `
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
            throw new Error(resultado.erro || 'Erro ao atualizar status');
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

    // Obter categorias selecionadas
    const categoriasSelecionadas = obterCategoriasSelecionadas();

    // Salvar no estado
    estadoAtual.filtroStatus = filtroStatus === 'todos' ? null : filtroStatus;
    estadoAtual.filtroCategoria = categoriasSelecionadas.length > 0 ? categoriasSelecionadas : null;
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
    const categoriasSelecionadas = obterCategoriasSelecionadas();
    const checkboxTodas = document.querySelector('.checkbox-categoria-todas');

    // Se nenhuma categoria está selecionada, marcar "Todas"
    if (categoriasSelecionadas.length === 0) {
        if (checkboxTodas) checkboxTodas.checked = true;
    } else {
        if (checkboxTodas) checkboxTodas.checked = false;
    }

    // Atualizar texto do botão
    const textoFiltro = document.getElementById('texto-filtro-categoria');
    if (textoFiltro) {
        textoFiltro.textContent = categoriasSelecionadas.length > 0
            ? `${categoriasSelecionadas.length} categoria(s) selecionada(s)`
            : 'Todas as categorias';
    }

    // Aplicar filtros
    aplicarFiltrosPedidos();
}

/**
 * Seleciona ou desseleciona todas as categorias
 */
function toggleTodasCategorias(checkbox) {
    const checkboxes = document.querySelectorAll('.checkbox-categoria');

    if (checkbox.checked) {
        // Se "Todas" foi marcada, desmarcar todas as categorias específicas
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
    }
    // Se "Todas" foi desmarcada, não fazer nada (manter seleções atuais)

    // Atualizar texto do botão
    const textoFiltro = document.getElementById('texto-filtro-categoria');
    if (textoFiltro) {
        if (checkbox.checked) {
            textoFiltro.textContent = 'Todas as categorias';
        } else {
            const categoriasSelecionadas = obterCategoriasSelecionadas();
            textoFiltro.textContent = categoriasSelecionadas.length > 0
                ? `${categoriasSelecionadas.length} categoria(s) selecionada(s)`
                : 'Todas as categorias';
        }
    }

    // Aplicar filtros
    aplicarFiltrosPedidos();
}

/**
 * Abre/fecha o dropdown de categorias
 */
function toggleDropdownCategorias() {
    const dropdown = document.getElementById('dropdown-categorias');
    if (dropdown) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';

        // Fechar ao clicar fora
        if (!isVisible) {
            setTimeout(() => {
                document.addEventListener('click', function fecharDropdown(e) {
                    if (!dropdown.contains(e.target) && e.target.id !== 'btn-filtro-categoria') {
                        dropdown.style.display = 'none';
                        document.removeEventListener('click', fecharDropdown);
                    }
                });
            }, 100);
        }
    }
}

/**
 * Limpa filtros e recarrega a tela
 */
function limparFiltrosPedidosTela() {
    estadoAtual.filtroStatus = null;
    estadoAtual.filtroCategoria = null;
    estadoAtual.agruparPorCategoria = false;

    // Desmarcar todos os checkboxes de categoria
    const checkboxes = document.querySelectorAll('.checkbox-categoria');
    checkboxes.forEach(cb => cb.checked = false);

    // Marcar "Todas as categorias"
    const checkboxTodas = document.querySelector('.checkbox-categoria-todas');
    if (checkboxTodas) checkboxTodas.checked = true;

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

    // Footer do modal
    const footer = document.createElement('div');
    footer.style.cssText = `
        padding: 16px 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        justify-content: flex-end;
        background-color: var(--color-gray-light);
    `;

    const btnFecharFooter = document.createElement('button');
    btnFecharFooter.textContent = 'Fechar';
    btnFecharFooter.className = 'btn btn-secondary';
    btnFecharFooter.style.cssText = 'padding: 8px 16px;';
    btnFecharFooter.onclick = () => overlay.remove();

    footer.appendChild(btnFecharFooter);

    // Montar modal
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
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
                const dataPedido = new Date(pedido.date_created);
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
                const dataPedido = new Date(pedido.date_created);
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
                const dataPedido = new Date(pedido.date_created);
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
                const dataPedido = new Date(pedido.date_created);
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
                const dataPedido = new Date(pedido.date_created);
                const [ano, mesNum] = mes.split('-');
                const pertenceAoMes = dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);

                // Filtrar apenas pedidos com categoria "Livro Faíscas" (produtos)
                const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
                const temLivroFaiscas = categorias.some(cat => {
                    const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return (catLower.includes('livro') && catLower.includes('faiscas')) ||
                        catLower === 'livro faiscas' ||
                        catLower.includes('livro faiscas');
                });

                return pertenceAoMes && temLivroFaiscas;
            });

            if (pedidosMes.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido de PRODUTO (Livro Faíscas) encontrado para este mês.');
                return;
            }

            pedidoIds = pedidosMes.map(p => String(p.id || p.number));
            adicionarLogMes(mes, 'info', `Nenhum pedido selecionado. Processando ${pedidoIds.length} pedido(s) de PRODUTO do mês.`);
        } else {
            // Filtrar apenas os pedidos selecionados que pertencem ao mês E são produtos
            const pedidosMes = estadoAtual.dados.todosPedidos.filter(pedido => {
                const dataPedido = new Date(pedido.date_created);
                const [ano, mesNum] = mes.split('-');
                const pertenceAoMes = dataPedido.getFullYear() === parseInt(ano) &&
                    (dataPedido.getMonth() + 1) === parseInt(mesNum);
                const estaSelecionado = pedidoIds.includes(String(pedido.id || pedido.number));

                // Verificar se é produto
                const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedido) : [];
                const temLivroFaiscas = categorias.some(cat => {
                    const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return (catLower.includes('livro') && catLower.includes('faiscas')) ||
                        catLower === 'livro faiscas' ||
                        catLower.includes('livro faiscas');
                });

                return pertenceAoMes && estaSelecionado && temLivroFaiscas;
            });

            pedidoIds = pedidosMes.map(p => String(p.id || p.number));

            if (pedidoIds.length === 0) {
                adicionarLogMes(mes, 'erro', 'Nenhum pedido selecionado é de PRODUTO (Livro Faíscas) ou pertence a este mês.');
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
        const opcao = prompt('Qual tipo de nota de TESTE deseja emitir?\n\n1 = NFSe (Serviço)\n2 = NFe (Produto - Livro Faíscas)\n\nDigite 1 ou 2:');
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
            const erroMsg = resultado.mensagem || resultado.erro || 'Erro desconhecido';
            const msg = `✗ Erro: ${erroMsg}`;
            console.error(msg);
            alert(msg);
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
            throw new Error(result.erro || 'Erro desconhecido');
        }

    } catch (error) {
        console.error('Erro ao cancelar nota:', error);
        alert(`❌ Erro ao cancelar nota: ${error.message}`);
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
                    const dataPedido = new Date(pedidoWC.pedido.date_created || pedidoWC.pedido.created_at);
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

        // Verificar se tem categoria "Livro Faíscas" (produto)
        // Busca flexível: "livro" + "faíscas" ou "faiscas" (com ou sem acento)
        const temLivroFaiscas = categorias.some(cat => {
            const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
            return (catLower.includes('livro') && catLower.includes('faiscas')) ||
                catLower === 'livro faiscas' ||
                catLower.includes('livro faiscas');
        });

        // Determinar tipo de NF
        const tipoNF = temLivroFaiscas ? 'produto' : 'servico';
        const tipoNFLabel = tipoNF === 'produto' ? 'NFe (Produto)' : 'NFSe (Serviço)';
        console.log('[DEBUG] Tipo de NF determinado:', tipoNF, tipoNFLabel);

        // Determinar o mês do pedido ANTES de emitir (para logs)
        const dataPedido = new Date(pedido.date_created || pedido.created_at);
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
                        const dataPedido = new Date(pedidoWC.pedido.date_created || pedidoWC.pedido.created_at);
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
            const erroMsg = resultadoEmissao.erro || 'Erro desconhecido';
            console.error('[DEBUG] Erro na emissão (resultadoEmissao):', erroMsg);
            if (tipoNF === 'servico') {
                adicionarLogMesServico(mes, 'ERROR', `✗ Erro ao emitir ${tipoNFLabel}: ${erroMsg}`, {
                    pedido_id: pedidoId,
                    tipo: tipoNF,
                    erro: erroMsg
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
                const dataPedido = new Date(pedidoWC.pedido.date_created || pedidoWC.pedido.created_at);
                const mes = `${dataPedido.getFullYear()}-${String(dataPedido.getMonth() + 1).padStart(2, '0')}`;

                // Determinar tipo de NF baseado nas categorias
                const categorias = window.Components ? window.Components.extrairCategoriasPedido(pedidoWC.pedido) : [];
                const temLivroFaiscas = categorias.some(cat => {
                    const catLower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return (catLower.includes('livro') && catLower.includes('faiscas')) ||
                        catLower === 'livro faiscas' ||
                        catLower.includes('livro faiscas');
                });
                const tipoNF = temLivroFaiscas ? 'produto' : 'servico';

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
            const dataPedido = new Date(pedido.date_created);
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
    try {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            console.error('content-area não encontrado');
            return;
        }

        // Verificar se Components está disponível
        if (!window.Components || !window.Components.renderizarFiltrosNotasEnviadas) {
            console.error('Components não está disponível ou renderizarFiltrosNotasEnviadas não existe');
            contentArea.innerHTML = '<div class="content-section"><p>Erro: Componentes não carregados</p></div>';
            return;
        }

        const html = `
            <div class="content-section">
                <h2 class="section-title">Notas Enviadas</h2>
                ${window.Components.renderizarFiltrosNotasEnviadas()}
            </div>
            <div class="content-section">
                <div id="tabela-notas-enviadas">
                    ${window.Components.renderizarLoading()}
                </div>
                <div id="paginacao-notas-enviadas"></div>
            </div>

        `;

        contentArea.innerHTML = html;

        // Inicializar estado
        if (!estadoAtual.filtrosNotas) {
            estadoAtual.filtrosNotas = {};
        }
        if (!estadoAtual.paginaNotas) {
            estadoAtual.paginaNotas = 1;
        }

        // Carregar dados iniciais
        await buscarNotasEnviadas();

        // Iniciar polling para atualizar notas automaticamente
        iniciarPollingNotas();
    } catch (error) {
        console.error('Erro ao carregar notas enviadas:', error);
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="content-section">
                    <h2 class="section-title">Notas Enviadas</h2>
                    <div class="alert alert-danger">
                        <h3>Erro ao carregar notas</h3>
                        <p>${error.message}</p>
                        <button onclick="carregarNotasEnviadas()" class="btn btn-primary" style="margin-top: 10px;">Tentar Novamente</button>
                    </div>
                </div>
            `;
        }
    }
}


/**
 * Busca notas enviadas com filtros
 */
async function buscarNotasEnviadas() {
    const tabelaArea = document.getElementById('tabela-notas-enviadas');
    const paginacaoArea = document.getElementById('paginacao-notas-enviadas');

    if (!tabelaArea) return;

    tabelaArea.innerHTML = window.Components.renderizarLoading();

    const limite = 50;
    const offset = (estadoAtual.paginaNotas - 1) * limite;

    const filtros = {
        limite: limite,
        offset: offset,
        ...estadoAtual.filtrosNotas
    };

    try {
        const resultado = await API.NFSe.listar(filtros);

        if (resultado.sucesso) {
            const notas = resultado.dados || [];
            const total = resultado.total || 0;

            estadoAtual.dados.notasEnviadas = notas;
            tabelaArea.innerHTML = await window.Components.renderizarTabelaNotasEnviadas(notas);


            // Calcular paginação
            const totalPaginas = Math.ceil(total / limite) || 1;
            paginacaoArea.innerHTML = window.Components.renderizarPaginacao(
                estadoAtual.paginaNotas,
                totalPaginas,
                'mudarPaginaNotasEnviadas'
            );
        } else {
            tabelaArea.innerHTML = `<div class="empty-state"><p>Erro ao carregar notas: ${resultado.erro || 'Erro desconhecido'}</p></div>`;
        }
    } catch (error) {
        console.error('Erro ao buscar notas enviadas:', error);
        tabelaArea.innerHTML = `<div class="empty-state"><p>Erro ao carregar notas: ${error.message}</p></div>`;
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
            alert(`✗ Erro: ${resultado.erro}`);
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert(`✗ Erro: ${error.message}`);
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

            alert(`✗ Erro ao cancelar nota: ${resultado.erro || resultado.mensagem || 'Erro desconhecido'}`);
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

        alert(`✗ Erro ao cancelar nota: ${error.message}`);
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
    const form = document.getElementById('form-filtros-notas');
    if (!form) return;

    const formData = new FormData(form);
    estadoAtual.filtrosNotas = {};

    for (const [key, value] of formData.entries()) {
        if (value && value.trim() !== '') {
            estadoAtual.filtrosNotas[key] = value.trim();
        }
    }

    estadoAtual.paginaNotas = 1;
    buscarNotasEnviadas();
}

/**
 * Limpa filtros de notas enviadas
 */
function limparFiltrosNotasEnviadas() {
    estadoAtual.filtrosNotas = {};
    estadoAtual.paginaNotas = 1;

    const form = document.getElementById('form-filtros-notas');
    if (form) {
        form.reset();
    }

    buscarNotasEnviadas();
}

/**
 * Muda página de notas enviadas
 */
function mudarPaginaNotasEnviadas(pagina) {
    estadoAtual.paginaNotas = pagina;
    buscarNotasEnviadas();
}

/**
 * Ver logs de uma nota específica
 */
async function verLogsNota(referencia) {
    try {
        const resultado = await API.Pedidos.listarLogs({ referencia, limite: 100 });

        const logs = Array.isArray(resultado) ? resultado : (resultado.dados || []);

        // Ordenar logs por data (mais antigo primeiro)
        logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Criar modal similar ao de detalhes do pedido
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        const titulo = document.createElement('h3');
        titulo.textContent = `Logs da Nota: ${referencia}`;
        titulo.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600;';

        const btnFechar = document.createElement('button');
        btnFechar.textContent = '✕';
        btnFechar.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
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

        // Body
        const body = document.createElement('div');
        body.style.cssText = `
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        `;

        if (logs.length === 0) {
            body.innerHTML = '<p style="color: #888; text-align: center;">Nenhum log encontrado para esta nota.</p>';
        } else {
            const logsHtml = logs.map(log => {
                const data = new Date(log.created_at).toLocaleString('pt-BR');
                const level = (log.level || 'INFO').toUpperCase();
                const message = log.message || '';
                const service = log.service || '';
                const action = log.action || '';

                let cor = '#666';
                if (level === 'ERROR') cor = '#dc3545';
                else if (level === 'WARN') cor = '#ffc107';
                else if (level === 'INFO') cor = '#17a2b8';

                let dadosHtml = '';
                if (log.data) {
                    try {
                        const dados = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                        dadosHtml = `<pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin-top: 8px;">${JSON.stringify(dados, null, 2)}</pre>`;
                    } catch (e) {
                        dadosHtml = `<div style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; margin-top: 8px;">${log.data}</div>`;
                    }
                }

                return `
                    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee;">
                        <div style="display: flex; gap: 12px; margin-bottom: 4px;">
                            <span style="color: #888; font-size: 12px;">[${data}]</span>
                            <span style="color: ${cor}; font-weight: 600; font-size: 12px;">[${level}]</span>
                            ${service ? `<span style="color: #17a2b8; font-size: 12px;">[${service}]</span>` : ''}
                            ${action ? `<span style="color: #6c757d; font-size: 12px;">[${action}]</span>` : ''}
                        </div>
                        <div style="color: #333; margin-top: 4px;">${message}</div>
                        ${dadosHtml}
                    </div>
                `;
            }).join('');

            body.innerHTML = logsHtml;
        }

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 20px;
            border-top: 1px solid #dee2e6;
            display: flex;
            justify-content: flex-end;
        `;

        const btnFecharFooter = document.createElement('button');
        btnFecharFooter.textContent = 'Fechar';
        btnFecharFooter.className = 'btn btn-secondary';
        btnFecharFooter.onclick = () => overlay.remove();

        footer.appendChild(btnFecharFooter);

        // Montar modal
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        // Fechar ao clicar fora
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };

        document.body.appendChild(overlay);

    } catch (error) {
        console.error('Erro ao carregar logs da nota:', error);
        alert(`Erro ao carregar logs: ${error.message}`);
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
}

async function verificarStatusNota(pedidoId) {
    const btnId = `btn-status-${pedidoId}`;
    const btn = document.getElementById(btnId);
    const originalContent = btn ? btn.innerHTML : '';

    if (btn) {
        btn.innerHTML = '↻';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`/api/excel/status/${pedidoId}`);
        const data = await res.json();

        if (data.sucesso) {
            mostrarFeedbackExcel('success', `Status atualizado: ${data.status}`);

            // Encontrar elementos da linha
            const row = Array.from(document.querySelectorAll('td')).find(td => td.textContent.includes(`#${pedidoId}`))?.parentElement;

            if (row) {
                const statusNotaCell = row.cells[5]; // Coluna Status Nota
                const linkPdfCell = row.cells[6]; // Coluna Links

                if (data.status === 'autorizado') {
                    statusNotaCell.innerHTML = '<span class="badge badge-success">Autorizada</span>';
                    linkPdfCell.innerHTML = `<a href="${data.link_pdf}" target="_blank" class="btn btn-sm btn-secondary" title="Ver PDF">📄 PDF</a>`;
                } else if (data.status === 'erro_autorizacao') {
                    statusNotaCell.innerHTML = '<span class="badge badge-error">Erro</span>';
                } else if (data.status === 'cancelado') {
                    statusNotaCell.innerHTML = '<span class="badge badge-error">Cancelada</span>';
                } else {
                    statusNotaCell.innerHTML = `<span class="badge badge-warning">${data.status}</span> <button id="btn-status-${pedidoId}" onclick="verificarStatusNota('${pedidoId}')" class="btn-icon-sm" title="Atualizar Status">↻</button>`;
                }
            }
        } else {
            mostrarFeedbackExcel('error', `Erro ao verificar: ${data.erro}`);
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        mostrarFeedbackExcel('error', 'Erro de conexão ao verificar status');
    } finally {
        if (btn && btn.innerHTML === '↻') { // Se ainda estiver lá e não foi substituído
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
}

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
 * Verifica o status de uma nota na Focus NFe e atualiza a interface
 */
async function verificarStatusNota(pedidoId) {
    const btnId = `btn-status-${pedidoId}`;
    const btn = document.getElementById(btnId);
    const originalContent = btn ? btn.innerHTML : '';

    if (btn) {
        btn.innerHTML = '↻';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`/api/excel/status/${pedidoId}`);
        const data = await res.json();

        if (data.sucesso) {
            mostrarFeedbackExcel('success', `Status atualizado: ${data.status}`);

            // Encontrar elementos da linha
            const row = Array.from(document.querySelectorAll('td')).find(td => td.textContent.includes(`#${pedidoId}`))?.parentElement;

            if (row) {
                const statusNotaCell = row.cells[5]; // Coluna Status Nota
                const linkPdfCell = row.cells[6]; // Coluna Links

                if (data.status === 'autorizado') {
                    statusNotaCell.innerHTML = '<span class="badge badge-success">Autorizada</span>';
                    linkPdfCell.innerHTML = `<a href="${data.link_pdf}" target="_blank" class="btn btn-sm btn-secondary" title="Ver PDF">📄 PDF</a>`;
                } else if (data.status === 'erro_autorizacao') {
                    statusNotaCell.innerHTML = '<span class="badge badge-error">Erro</span>';
                } else if (data.status === 'cancelado') {
                    statusNotaCell.innerHTML = '<span class="badge badge-error">Cancelada</span>';
                } else {
                    statusNotaCell.innerHTML = `<span class="badge badge-warning">${data.status}</span> <button id="btn-status-${pedidoId}" onclick="verificarStatusNota('${pedidoId}')" class="btn-icon-sm" title="Atualizar Status">↻</button>`;
                }
            }
        } else {
            mostrarFeedbackExcel('error', `Erro ao verificar: ${data.erro}`);
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        mostrarFeedbackExcel('error', 'Erro de conexão ao verificar status');
    } finally {
        if (btn && btn.innerHTML === '↻') { // Se ainda estiver lá e não foi substituído
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
}

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
    const contentArea = document.getElementById('content-area');
    const meses = gerarListaMeses(); // Reutiliza função global do app.js

    contentArea.innerHTML = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Pedidos Woo Excel (Google Sheets)</h2>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <a href="https://docs.google.com/spreadsheets" target="_blank" class="btn btn-secondary" style="padding: 8px 16px; font-size: 14px; text-decoration: none;">
                        Abrir Planilha ↗
                    </a>
                    <button 
                        type="button" 
                        class="btn btn-primary" 
                        onclick="sincronizarExcel()"
                        id="btn-sincronizar-excel"
                        style="padding: 8px 16px; font-size: 14px;">
                        🔄 Sincronizar (Geral)
                    </button>
                </div>
            </div>
            
            <div id="status-excel" style="margin-bottom: 16px; display: none; padding: 12px; border-radius: 8px;"></div>

            <div class="accordion" id="accordion-meses-excel">
                ${meses.map((mes, index) => {
        const [anoM, mesM] = mes.value.split('-'); // 2025-11
        // Usar label do mês para interface (Novembro, Dezembro...)
        const mesNome = mes.label.split(' ')[0];

        return `
                    <div id="card-excel-${mes.value}" class="accordion-item">
                        <div class="accordion-header ${index === 0 ? 'active' : ''}" onclick="toggleMesExcel('${mes.value}')">
                            <h3>${mes.label}</h3>
                            <span class="badge" id="count-excel-${mes.value}">0 pedidos</span>
                            <span class="accordion-icon">▼</span>
                        </div>
                        <div class="accordion-content ${index === 0 ? 'active' : ''}" id="content-excel-${mes.value}">
                             <div style="padding: 10px 0; display: flex; justify-content: flex-end;">
                                <button 
                                    class="btn-sm" 
                                    style="background-color: #fff; border: 1px solid #e0e0e0; color: #333; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="importarNubankMes('${mesNome}', '${anoM}')">
                                    <span style="font-size: 14px;">🏦</span> Importar Nubank
                                </button>
                                <button 
                                    class="btn-sm" 
                                    style="background-color: #fff; border: 1px solid #e0e0e0; color: #666; display: flex; align-items: center; gap: 6px; margin-left: 8px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="removerNubankMes('${mesNome}', '${anoM}')">
                                    <span style="font-size: 14px;">🗑️</span> Retirar
                                </button>
                                <button 
                                    class="btn-sm" 
                                    style="background-color: #fff; border: 1px solid #e0e0e0; color: #333; display: flex; align-items: center; gap: 6px; margin-left: 8px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="ordenarPedidosPorDataLocal('${mes.value}')">
                                    <span style="font-size: 14px;">📅</span> Ordenar por Data
                                </button>
                                <button 
                                    class="btn-sm" 
                                    style="background-color: #fff; border: 1px solid #e0e0e0; color: #e65100; display: flex; align-items: center; gap: 6px; margin-left: 8px; cursor: pointer; border-radius: 4px; padding: 4px 10px;"
                                    onclick="atualizarStatusGeral('${mes.value}')">
                                    <span style="font-size: 14px;">↻</span> Atualizar Status (Geral)
                                </button>
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

    try {
        // Capturar meses abertos atualmente para preservar estado
        const activeMonths = [];
        document.querySelectorAll('.accordion-content.active').forEach(el => {
            const id = el.id.replace('content-excel-', '');
            activeMonths.push(id);
        });

        // Buscar todos os pedidos da planilha
        const resultado = await API.Excel.listar();

        if (resultado.sucesso) {
            window.pedidosExcelCache = resultado.dados || [];
            distribuirPedidosExcelPorMes(window.pedidosExcelCache);

            // Restaurar meses abertos
            activeMonths.forEach(mesId => {
                toggleMesExcel(mesId);
            });
            // Se nenhum estava aberto, abre o primeiro por padrão (comportamento original)
            if (activeMonths.length === 0 && window.pedidosExcelCache.length > 0) {
                // A função original já abre o primeiro no template string, então ok.
            }
        } else {
            document.querySelectorAll('[id^="lista-excel-"]').forEach(el => {
                el.innerHTML = `
                    <tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">
                        Erro ao carregar: ${resultado.erro}. <br>
                        Verifique se configurou as credenciais do Google Sheets.
                    </td></tr>`;
            });
        }
    } catch (error) {
        console.error(error);
        mostrarFeedbackExcel('error', `Erro de conexão: ${error.message}`);
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
        let dataStr = p.data;
        if (!dataStr) return;

        let ano, mes;
        let dataObj;

        // Limpar string de data
        dataStr = String(dataStr).trim();

        // 1. Tentar detectar formato BR explícito DD/MM/YYYY
        // Isso evita que 01/11 seja lido como Jan 11 (US) em vez de Nov 01 (BR)
        const matchBR = dataStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

        if (matchBR) {
            // dia = matchBR[1], mes = matchBR[2], ano = matchBR[3]
            const dia = parseInt(matchBR[1]);
            const mesNum = parseInt(matchBR[2]);
            const anoNum = parseInt(matchBR[3]);

            dataObj = new Date(anoNum, mesNum - 1, dia); // Note: Month is 0-indexed in Date
        }
        else {
            // 2. Tentar ISO YYYY-MM-DD
            const matchISO = dataStr.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (matchISO) {
                dataObj = new Date(matchISO[0]);
            } else {
                // 3. Fallback para new Date() padrão (pode ser perigoso para datas ambíguas)
                dataObj = new Date(dataStr);
            }
        }

        if (dataObj && !isNaN(dataObj.getTime())) {
            ano = dataObj.getFullYear();
            mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
        }

        if (ano && mes) {
            const chave = `${ano}-${mes}`;
            if (!pedidosPorMes[chave]) pedidosPorMes[chave] = [];
            pedidosPorMes[chave].push(p);
        }
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

            // Ordenar por ID desc (Tratamento seguro para strings vs numeros)
            lista.sort((a, b) => {
                const idA = a.id;
                const idB = b.id;
                // Se ambos numericos
                if (!isNaN(idA) && !isNaN(idB)) return Number(idB) - Number(idA);
                // String comparison
                return String(idB).localeCompare(String(idA));
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

                    // Status da Nota (Excel)
                    const statusNota = p.status_nota || 'Pendente';
                    let statusHtml = '';

                    if (statusNota === 'Autorizada') {
                        statusHtml = '<span class="badge badge-success">Autorizada</span>';
                    } else if (statusNota === 'Erro') {
                        statusHtml = '<span class="badge badge-danger">Erro</span>';
                    } else if (statusNota === 'Processando...') {
                        statusHtml = `<div style="display:flex;align-items:center;gap:5px;"><span class="badge badge-warning">Processando...</span> <button id="btn-status-${p.id}" onclick="verificarStatusNota('${p.id}')" class="btn-icon-sm" title="Atualizar Status" style="background:none;border:none;cursor:pointer;font-size:16px;color:#f90;padding:0;line-height:1;">↻</button></div>`;
                    } else if (statusNota === 'Cancelada') {
                        statusHtml = '<span class="badge badge-error" style="background-color: #dc3545; color: white;">Cancelada</span>';
                    } else {
                        statusHtml = `<span class="badge badge-secondary">${statusNota}</span>`;
                    }

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
                            ` : '✅'}
                            ${p.mensagem_erro ? `<div style="font-size: 10px; color: red; max-width: 200px; margin-top: 4px;">${p.mensagem_erro}</div>` : ''}
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
    // Espera YYYY-MM-DD
    const parts = dataIso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
            mostrarFeedbackExcel('success', `Nota enviada, aguardando confirmação!`);

            // Atualizar UI Localmente sem recarregar tudo
            if (row) {
                // Atualizar Status Nota (Coluna 6, índice 5)
                const statusCell = row.cells[5];
                if (statusCell) {
                    if (res.status === 'autorizado') {
                        statusCell.innerHTML = '<span class="badge badge-success">Autorizada</span>';
                    } else {
                        statusCell.innerHTML = '<span class="badge badge-warning">Processando...</span>';
                    }
                }

                // Atualizar Links (Coluna 7, índice 6)
                const linksCell = row.cells[6];
                if (linksCell && res.link_pdf) {
                    linksCell.innerHTML = `
                        <a href="${res.link_pdf}" target="_blank" class="btn btn-sm btn-secondary" title="Ver PDF">📄 PDF</a>
                        ${res.numero ? `<small class="d-block mt-1">Nota: ${res.numero}</small>` : ''}
                    `;
                }

                // Atualizar Ações (Coluna 8, índice 7) - Remover botão emitir
                const actionCell = row.cells[7];
                if (actionCell) {
                    actionCell.innerHTML = '✅';
                }

                // Atualizar cache global se existir
                if (window.pedidosExcelCache) {
                    const pedidoCached = window.pedidosExcelCache.find(p => p.id == pedidoId);
                    if (pedidoCached) {
                        pedidoCached.status_nota = 'Autorizada';
                        pedidoCached.link_pdf = res.link_pdf;
                        pedidoCached.numero_nota = res.numero;
                    }
                }
            } else {
                // Fallback se não achou a linha (raro)
                await carregarPedidosExcel();
            }

        } else {
            mostrarFeedbackExcel('error', `Erro ao emitir: ${res.erro}`);
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

window.carregarPedidosExcel = carregarPedidosExcel;
window.sincronizarExcel = sincronizarExcel;
window.emitirNotaExcel = emitirNotaExcel;
window.toggleMesExcel = toggleMesExcel;


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
            if (window.Toast) window.Toast.error('Erro: ' + resultado.erro);
            else alert('Erro: ' + resultado.erro);
        }
    } catch (error) {
        console.error(error);
        if (window.Toast) window.Toast.error('Erro ao processar solicitação: ' + error.message);
        else alert('Erro ao processar solicitação: ' + error.message);
    }
}


window.Toast = Toast;


/**
 * Ordena os pedidos de um mês específico pela data (decrescente) no front-end
 * @param {string} mesValue Valor do mês (ex: 2025-11)
 */
async function ordenarPedidosPorDataLocal(mesValue) {
    const tbody = document.getElementById(`lista-excel-${mesValue}`);
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0 || rows[0].innerText.includes('Nenhum pedido')) return;

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

        return tsB - tsA; // Decrescente
    });

    // Reanexar ordenado
    rows.forEach(row => tbody.appendChild(row));

    if (window.Toast) window.Toast.success('Ordenado por data!');
}

