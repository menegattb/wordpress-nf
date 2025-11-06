// Main App - Lógica principal e navegação

let estadoAtual = {
    secaoAtiva: 'meus-dados',
    paginaAtual: 1,
    filtros: {},
    subsecao: null, // Para subseções dentro de conexao-focus
    dados: {
        requisicoes: [],
        pedidos: [],
        meusDados: null
    }
};

/**
 * Inicialização da aplicação
 */
document.addEventListener('DOMContentLoaded', () => {
    inicializarNavegacao();
    carregarSecao('meus-dados');
});

/**
 * Inicializa navegação da sidebar
 */
function inicializarNavegacao() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const secao = item.dataset.section;
            if (secao) {
                carregarSecao(secao);
            }
        });
    });
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
    // Resetar subseção se mudar de seção
    if (estadoAtual.secaoAtiva !== secao && estadoAtual.secaoAtiva === 'conexao-focus') {
        estadoAtual.subsecao = null;
    }
    // Se entrar em conexao-focus, resetar subseção
    if (secao === 'conexao-focus' && estadoAtual.secaoAtiva !== 'conexao-focus') {
        estadoAtual.subsecao = null;
    }
    
    estadoAtual.secaoAtiva = secao;
    atualizarSidebarAtivo(secao);
    
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = Components.renderizarLoading();

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
        case 'requisicoes':
            await carregarRequisicoes();
            break;
        case 'pedidos':
            await carregarPedidos();
            break;
        case 'municipios':
            carregarMunicipios();
            break;
        case 'webhooks':
            carregarWebhooks();
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
    contentArea.innerHTML = Components.renderizarLoading();
    
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
    contentArea.innerHTML = Components.renderizarLoading();
    
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
 * Carrega seção de Conexão FocusNFe
 */
async function carregarConexaoFocus() {
    const contentArea = document.getElementById('content-area');
    
    // Se não tem subseção definida, mostrar menu de subseções
    if (!estadoAtual.subsecao) {
        const html = `
            <div class="content-section">
                <h2 class="section-title">Conexão FocusNFe</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 24px;">
                    <button class="subsecao-card" onclick="carregarSubsecao('tokens')">
                        <svg width="48" height="48" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 12px;">
                            <path d="M10 2L3 6v8l7 4 7-4V6l-7-4z" stroke="var(--color-orange)" stroke-width="1.5" fill="none"/>
                            <circle cx="10" cy="10" r="2" stroke="var(--color-orange)" stroke-width="1.5" fill="none"/>
                        </svg>
                        <h3>Tokens</h3>
                        <p>Gerenciar tokens de homologação e produção</p>
                    </button>
                    <button class="subsecao-card" onclick="carregarSubsecao('ambiente')">
                        <svg width="48" height="48" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 12px;">
                            <rect x="3" y="3" width="14" height="14" rx="2" stroke="var(--color-orange)" stroke-width="1.5" fill="none"/>
                            <path d="M3 8h14M8 3v14" stroke="var(--color-orange)" stroke-width="1.5"/>
                        </svg>
                        <h3>Ambiente</h3>
                        <p>Configurar ambiente (Homologação/Produção)</p>
                    </button>
                </div>
            </div>
        `;
        contentArea.innerHTML = html;
    } else {
        // Carregar subseção específica
        switch (estadoAtual.subsecao) {
            case 'tokens':
                carregarTokens();
                break;
            case 'ambiente':
                carregarAmbiente();
                break;
        }
    }
}

/**
 * Carrega subseção específica
 */
async function carregarSubsecao(subsecao) {
    estadoAtual.subsecao = subsecao;
    await carregarConexaoFocus();
}

/**
 * Volta para menu de subseções
 */
async function voltarConexaoFocus() {
    estadoAtual.subsecao = null;
    await carregarConexaoFocus();
}

/**
 * Carrega subseção de Tokens
 */
async function carregarTokens() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = Components.renderizarLoading();
    
    // Buscar informações do servidor
    const resultado = await API.Config.getFocus();
    const dadosFocus = resultado.sucesso ? resultado.dados : {
        ambiente: 'homologacao',
        token_homologacao: '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA',
        token_producao: ''
    };
    
    const tokenHomologacao = dadosFocus.token_homologacao || '';
    const tokenProducao = dadosFocus.token_producao || '';
    
    const html = `
        <div class="content-section">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <button class="btn btn-secondary" onclick="voltarConexaoFocus()" style="padding: 8px 16px;">← Voltar</button>
                <h2 class="section-title" style="margin: 0;">Tokens</h2>
            </div>
            <div style="max-width: 800px;">
                <div class="form-group" style="margin-bottom: 32px;">
                    <label class="form-label">Token de Homologação</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="password" class="form-input" id="token-homologacao" value="${tokenHomologacao}" placeholder="Token de homologação" style="flex: 1;">
                        <button type="button" class="btn btn-secondary" onclick="toggleTokenVisibility('homologacao')" id="btn-toggle-homologacao">Mostrar</button>
                    </div>
                    <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                        Token atual: <span id="token-preview-homologacao">${tokenHomologacao ? tokenHomologacao.substring(0, 10) + '...' : 'Não configurado'}</span>
                    </small>
                </div>
                <div class="form-group" style="margin-bottom: 32px;">
                    <label class="form-label">Token de Produção</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="password" class="form-input" id="token-producao" value="${tokenProducao}" placeholder="Token de produção" style="flex: 1;">
                        <button type="button" class="btn btn-secondary" onclick="toggleTokenVisibility('producao')" id="btn-toggle-producao">Mostrar</button>
                    </div>
                    <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                        Token atual: <span id="token-preview-producao">${tokenProducao ? tokenProducao.substring(0, 10) + '...' : 'Não configurado'}</span>
                    </small>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="resetarTokens()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="salvarTokens()">Salvar Tokens</button>
                </div>
            </div>
        </div>
    `;
    
    contentArea.innerHTML = html;
}

/**
 * Carrega subseção de Ambiente
 */
async function carregarAmbiente() {
    const contentArea = document.getElementById('content-area');
    
    // Buscar ambiente atual
    const resultado = await API.Config.getHealth();
    const ambienteAtual = resultado.sucesso ? (resultado.dados.ambiente || 'homologacao') : 'homologacao';
    
    const html = `
        <div class="content-section">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <button class="btn btn-secondary" onclick="voltarConexaoFocus()" style="padding: 8px 16px;">← Voltar</button>
                <h2 class="section-title" style="margin: 0;">Ambiente</h2>
            </div>
            <div style="max-width: 600px;">
                <div class="form-group" style="margin-bottom: 24px;">
                    <label class="form-label">Ambiente Atual</label>
                    <select class="form-select" id="config-ambiente">
                        <option value="homologacao" ${ambienteAtual === 'homologacao' ? 'selected' : ''}>Homologação (Testes)</option>
                        <option value="producao" ${ambienteAtual === 'producao' ? 'selected' : ''}>Produção (Real)</option>
                    </select>
                    <small style="color: var(--color-gray-medium); margin-top: 4px; display: block;">
                        Ambiente atual: <strong>${ambienteAtual.toUpperCase()}</strong>
                    </small>
                </div>
                <div style="background-color: var(--color-gray-light); padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                    <h4 style="margin-bottom: 8px; font-size: 14px; font-weight: 600;">Informações:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: var(--color-gray-medium); font-size: 13px;">
                        <li><strong>Homologação:</strong> Ambiente de testes, notas não têm valor fiscal</li>
                        <li><strong>Produção:</strong> Ambiente real, notas têm valor fiscal</li>
                    </ul>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="resetarAmbiente()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="salvarAmbiente()">Salvar Ambiente</button>
                </div>
            </div>
        </div>
    `;
    
    contentArea.innerHTML = html;
}

/**
 * Toggle visibilidade do token
 */
function toggleTokenVisibility(tipo) {
    const input = document.getElementById(`token-${tipo}`);
    const btn = document.getElementById(`btn-toggle-${tipo}`);
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Ocultar';
    } else {
        input.type = 'password';
        btn.textContent = 'Mostrar';
    }
}

/**
 * Salva tokens
 */
async function salvarTokens() {
    const tokenHomologacao = document.getElementById('token-homologacao').value;
    const tokenProducao = document.getElementById('token-producao').value;
    
    if (!tokenHomologacao && !tokenProducao) {
        alert('Preencha pelo menos um token');
        return;
    }
    
    // Por enquanto, apenas mostra mensagem (implementar API depois)
    alert('Funcionalidade de salvar tokens será implementada via API.\n\nTokens:\nHomologação: ' + (tokenHomologacao ? tokenHomologacao.substring(0, 10) + '...' : 'Não alterado') + '\nProdução: ' + (tokenProducao ? tokenProducao.substring(0, 10) + '...' : 'Não alterado'));
}

/**
 * Reseta tokens
 */
async function resetarTokens() {
    const resultado = await API.Config.getFocus();
    const dadosFocus = resultado.sucesso ? resultado.dados : {
        token_homologacao: '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA',
        token_producao: ''
    };
    
    document.getElementById('token-homologacao').value = dadosFocus.token_homologacao || '';
    document.getElementById('token-producao').value = dadosFocus.token_producao || '';
}

/**
 * Salva ambiente
 */
async function salvarAmbiente() {
    const ambiente = document.getElementById('config-ambiente').value;
    
    // Por enquanto, apenas mostra mensagem (implementar API depois)
    alert('Funcionalidade de salvar ambiente será implementada via API.\n\nAmbiente selecionado: ' + ambiente.toUpperCase());
}

/**
 * Reseta ambiente
 */
async function resetarAmbiente() {
    const resultado = await API.Config.getHealth();
    const ambienteAtual = resultado.sucesso ? (resultado.dados.ambiente || 'homologacao') : 'homologacao';
    document.getElementById('config-ambiente').value = ambienteAtual;
}

/**
 * Carrega seção de Requisições
 */
async function carregarRequisicoes() {
    const contentArea = document.getElementById('content-area');
    
    const html = `
        <div class="content-section">
            <h2 class="section-title">Pesquisa de Requisições</h2>
            ${Components.renderizarFormularioPesquisa('pesquisarRequisicoes', 'limparFiltrosRequisicoes')}
        </div>
        <div class="content-section">
            <h2 class="section-title">Requisições</h2>
            <div id="tabela-requisicoes">
                ${Components.renderizarLoading()}
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
    
    tabelaArea.innerHTML = Components.renderizarLoading();
    
    const filtros = {
        limite: 50,
        offset: (estadoAtual.paginaAtual - 1) * 50,
        ...estadoAtual.filtros
    };
    
    const resultado = await API.NFSe.listar(filtros);
    
    if (resultado.sucesso) {
        estadoAtual.dados.requisicoes = Array.isArray(resultado.dados) ? resultado.dados : [];
        tabelaArea.innerHTML = Components.renderizarTabelaRequisicoes(estadoAtual.dados.requisicoes);
        
        // Calcular paginação (assumindo 50 itens por página)
        const totalPaginas = Math.ceil(estadoAtual.dados.requisicoes.length / 50) || 1;
        paginacaoArea.innerHTML = Components.renderizarPaginacao(
            estadoAtual.paginaAtual,
            totalPaginas,
            'mudarPaginaRequisicoes'
        );
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
        const data = new Date(pedido.date_created || pedido.created_at);
        const mesAno = `${data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
        const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        
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
        grupos[chave].total += parseFloat(pedido.total || 0);
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
async function carregarPedidos() {
    const contentArea = document.getElementById('content-area');
    
    // Mostrar tela inicial com barra de status
    contentArea.innerHTML = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Pedidos WooCommerce</h2>
                <div id="status-woocommerce" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                    <span style="color: #666; font-size: 12px;">⏳ Iniciando conexão...</span>
                </div>
            </div>
            <div style="text-align: center; padding: 40px;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                <p style="color: var(--color-gray-medium);">Carregando pedidos...</p>
            </div>
        </div>
    `;
    
    try {
        atualizarStatusConexao('Testando conexão com WooCommerce...', 'info');
        
        // Primeiro, testar a conexão
        const testeConexao = await API.WooCommerce.testarConexao();
        console.log('Teste de conexão:', testeConexao);
        
        if (!testeConexao.sucesso) {
            atualizarStatusConexao(`✗ Erro na conexão: ${testeConexao.erro || 'Erro desconhecido'}`, 'error');
            throw new Error(testeConexao.erro || 'Erro ao conectar com WooCommerce');
        }
        
        atualizarStatusConexao(`✓ Conexão OK - Total de pedidos: ${testeConexao.total_pedidos || 'N/A'}`, 'success');
        
        // Gerar lista de meses (últimos 12 meses)
        const meses = gerarListaMeses();
        atualizarStatusConexao('Lista de meses gerada', 'info');
        
        // Buscar TODOS os pedidos (sem filtro de status)
        atualizarStatusConexao('Buscando todos os pedidos (sem filtro de status)...', 'info');
        console.log('Buscando todos os pedidos (sem filtro de status)...');
        
        let resultado = await API.WooCommerce.buscarPedidos({
            per_page: 100,
            page: 1,
            orderby: 'date',
            order: 'desc'
        });
        
        console.log('Resultado da busca:', resultado);
        console.log('Tipo do resultado:', typeof resultado);
        console.log('Chaves do resultado:', Object.keys(resultado || {}));
        
        let todosPedidos = [];
        // Verificar se resultado tem pedidos diretamente ou dentro de dados
        const pedidos = resultado.pedidos || (resultado.dados && resultado.dados.pedidos) || [];
        const sucesso = resultado.sucesso || (resultado.dados && resultado.dados.sucesso) || false;
        
        if (sucesso && pedidos && pedidos.length > 0) {
            todosPedidos = pedidos;
            console.log(`Encontrados ${todosPedidos.length} pedidos na primeira página`);
            atualizarStatusConexao(`Página 1: ${todosPedidos.length} pedidos encontrados`, 'success');
            
            // Se houver mais páginas, buscar todas
            const totalPages = parseInt(resultado.total_pages || (resultado.dados && resultado.dados.total_pages)) || 1;
            console.log(`Total de páginas: ${totalPages} (tipo: ${typeof totalPages})`);
            
            if (totalPages > 1) {
                atualizarStatusConexao(`Buscando ${totalPages - 1} página(s) adicional(is)...`, 'info');
                for (let page = 2; page <= totalPages; page++) {
                    atualizarStatusConexao(`Buscando página ${page} de ${totalPages}...`, 'info');
                    console.log(`Buscando página ${page}...`);
                    const pagina = await API.WooCommerce.buscarPedidos({
                        per_page: 100,
                        page: page,
                        orderby: 'date',
                        order: 'desc'
                    });
                    
                    const paginaPedidos = pagina.pedidos || (pagina.dados && pagina.dados.pedidos) || [];
                    const paginaSucesso = pagina.sucesso || (pagina.dados && pagina.dados.sucesso) || false;
                    
                    if (paginaSucesso && paginaPedidos && paginaPedidos.length > 0) {
                        todosPedidos = todosPedidos.concat(paginaPedidos);
                        console.log(`Página ${page}: ${paginaPedidos.length} pedidos`);
                        atualizarStatusConexao(`Página ${page}: ${paginaPedidos.length} pedidos`, 'success');
                    }
                }
            }
            
            atualizarStatusConexao(`✓ ${todosPedidos.length} pedidos carregados com sucesso`, 'success');
        } else {
            const erro = resultado.erro || (resultado.dados && resultado.dados.erro) || 'Não foi possível carregar pedidos';
            atualizarStatusConexao(`✗ Erro: ${erro}`, 'error');
            console.error('Erro ao buscar pedidos:', erro);
            console.error('Resultado completo:', resultado);
        }
        
        // Salvar no estado
        estadoAtual.dados.meses = meses;
        estadoAtual.dados.todosPedidos = todosPedidos;
        estadoAtual.filtroMes = null; // Sem filtro inicialmente
        
        // Debug: verificar dados antes de renderizar
        console.log('Dados antes de renderizar:', {
            totalPedidos: todosPedidos.length,
            meses: meses.length,
            primeiroPedido: todosPedidos[0] ? {
                id: todosPedidos[0].id,
                date_created: todosPedidos[0].date_created,
                total: todosPedidos[0].total
            } : null
        });
        
        // Renderizar tela
        renderizarTelaPedidos(todosPedidos, meses, null);
        
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        atualizarStatusConexao(`✗ Erro: ${error.message}`, 'error');
        contentArea.innerHTML = `
            <div class="content-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 class="section-title" style="margin: 0;">Pedidos WooCommerce</h2>
                    <div id="status-woocommerce" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #dc3545; font-size: 12px;">✗ Erro: ${error.message}</span>
                    </div>
                </div>
                <div class="empty-state">
                    <p>Erro ao carregar pedidos: ${error.message}</p>
                </div>
            </div>
        `;
    }
}

/**
 * Renderiza a tela de pedidos com filtros
 */
function renderizarTelaPedidos(pedidos, meses, mesFiltrado) {
    const contentArea = document.getElementById('content-area');
    
    // Debug: verificar se pedidos está definido
    console.log('renderizarTelaPedidos chamado:', {
        totalPedidos: pedidos ? pedidos.length : 0,
        mesFiltrado: mesFiltrado,
        meses: meses ? meses.length : 0
    });
    
    // Garantir que pedidos é um array
    if (!pedidos || !Array.isArray(pedidos)) {
        console.error('Pedidos não é um array válido:', pedidos);
        pedidos = [];
    }
    
    // Filtrar pedidos por mês se houver filtro
    let pedidosFiltrados = pedidos;
    if (mesFiltrado) {
        const [ano, mes] = mesFiltrado.split('-');
        pedidosFiltrados = pedidos.filter(pedido => {
            const dataPedido = new Date(pedido.date_created);
            return dataPedido.getFullYear() === parseInt(ano) && 
                   (dataPedido.getMonth() + 1) === parseInt(mes);
        });
    }
    
    console.log('Pedidos filtrados:', pedidosFiltrados.length);
    
    // Calcular totais
    const totalPedidos = pedidosFiltrados.length;
    const valorTotal = pedidosFiltrados.reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
    
    const html = `
        <div class="content-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 class="section-title" style="margin: 0;">Pedidos WooCommerce</h2>
                <div id="status-woocommerce" style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                    <span style="color: #28a745; font-size: 12px;">✓ ${pedidos.length} pedidos carregados</span>
                </div>
            </div>
            
            <!-- Filtros de Mês -->
            <div style="margin-bottom: 24px;">
                <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                    <button 
                        type="button" 
                        class="btn ${mesFiltrado === null ? 'btn-primary' : 'btn-secondary'}" 
                        onclick="filtrarPorMes(null)"
                        style="padding: 8px 16px; font-size: 14px;">
                        Todos
                    </button>
                    ${meses.map(mes => `
                        <button 
                            type="button" 
                            class="btn ${mesFiltrado === mes.value ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="filtrarPorMes('${mes.value}')"
                            style="padding: 8px 16px; font-size: 14px;">
                            ${mes.label}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <!-- Resumo -->
            <div style="background-color: var(--color-gray-light); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <div style="font-size: 14px; color: var(--color-gray-medium); margin-bottom: 4px;">Total de Pedidos</div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--color-gray-dark);">${totalPedidos}</div>
                    </div>
                    <div>
                        <div style="font-size: 14px; color: var(--color-gray-medium); margin-bottom: 4px;">Valor Total</div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--color-orange);">${Components.formatarValor(valorTotal)}</div>
                    </div>
                </div>
            </div>
            
            <!-- Tabela de Pedidos -->
            <div id="tabela-pedidos">
                ${totalPedidos > 0 ? (() => {
                    console.log('Renderizando tabela com', pedidosFiltrados.length, 'pedidos');
                    return Components.renderizarTabelaPedidos(pedidosFiltrados);
                })() : '<div class="empty-state"><p>Nenhum pedido encontrado.</p><p style="font-size: 12px; color: #999;">Total de pedidos carregados: ' + pedidos.length + '</p></div>'}
            </div>
            
            <!-- Área de Emissão -->
            ${totalPedidos > 0 ? `
                <div id="area-emissao-lote" style="margin-top: 24px;">
                    <button type="button" class="btn btn-primary" onclick="emitirLoteNFSe()" style="width: 100%; padding: 12px; font-size: 16px;">
                        Emitir Todas as Notas ${mesFiltrado ? 'do Mês Selecionado' : ''} (${totalPedidos} pedidos)
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    contentArea.innerHTML = html;
}

/**
 * Filtra pedidos por mês
 */
function filtrarPorMes(mes) {
    const todosPedidos = estadoAtual.dados.todosPedidos || [];
    const meses = estadoAtual.dados.meses || gerarListaMeses();
    
    estadoAtual.filtroMes = mes;
    
    renderizarTelaPedidos(todosPedidos, meses, mes);
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
    tabelaArea.innerHTML = Components.renderizarLoading();
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
        tabelaArea.innerHTML = Components.renderizarTabelaPedidos(estadoAtual.dados.pedidos);
        
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
 * Ver detalhes de um pedido
 */
async function verDetalhesPedido(pedidoId) {
    const resultado = await API.WooCommerce.buscarPedidoPorId(pedidoId);
    
    if (resultado.sucesso) {
        alert('Detalhes do pedido:\n\n' + JSON.stringify(resultado.dados.pedido, null, 2));
    } else {
        alert('Erro ao buscar detalhes: ' + resultado.erro);
    }
}

/**
 * Emite NFSe para um pedido
 */
async function emitirNFSePedido(pedidoId) {
    if (!confirm('Deseja emitir NFSe para este pedido?')) return;
    
    const resultado = await API.WooCommerce.buscarPedidoPorId(pedidoId);
    
    if (!resultado.sucesso) {
        alert('Erro ao buscar pedido: ' + resultado.erro);
        return;
    }
    
    // Aqui você precisaria mapear os dados do pedido WooCommerce para o formato esperado
    // Por enquanto, apenas mostra uma mensagem
    alert('Funcionalidade de emissão será implementada. Pedido ID: ' + pedidoId);
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
    const modalHtml = Components.renderizarProgressoEmissao(pedidoIds.length, 0, 0, 0, []);
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('modal-progresso');
    const resultados = [];
    let processados = 0;
    let sucesso = 0;
    let erros = 0;
    
    // Função para atualizar modal
    const atualizarModal = () => {
        const novoHtml = Components.renderizarProgressoEmissao(
            pedidoIds.length,
            processados,
            sucesso,
            erros,
            resultados
        );
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

// Exportar funções globalmente
window.carregarSecao = carregarSecao;
window.carregarSubsecao = carregarSubsecao;
window.voltarConexaoFocus = voltarConexaoFocus;
window.salvarMeusDados = salvarMeusDados;
window.resetarMeusDados = resetarMeusDados;
window.toggleWooCommerceVisibility = toggleWooCommerceVisibility;
window.salvarWooCommerce = salvarWooCommerce;
window.resetarWooCommerce = resetarWooCommerce;
window.toggleTokenVisibility = toggleTokenVisibility;
window.salvarTokens = salvarTokens;
window.resetarTokens = resetarTokens;
window.salvarAmbiente = salvarAmbiente;
window.resetarAmbiente = resetarAmbiente;
window.pesquisarRequisicoes = pesquisarRequisicoes;
window.limparFiltrosRequisicoes = limparFiltrosRequisicoes;
window.mudarPaginaRequisicoes = mudarPaginaRequisicoes;
window.abrirFiltrosMes = abrirFiltrosMes;
window.voltarParaListaMeses = voltarParaListaMeses;
window.filtrarPorMes = filtrarPorMes;
window.buscarPedidosFiltrados = buscarPedidosFiltrados;
window.testarConexaoWooCommerce = testarConexaoWooCommerce;
window.limparFiltrosPedidos = limparFiltrosPedidos;
window.verDetalhesPedido = verDetalhesPedido;
window.emitirNFSePedido = emitirNFSePedido;
window.emitirLoteNFSe = emitirLoteNFSe;
window.fecharModalProgresso = fecharModalProgresso;

