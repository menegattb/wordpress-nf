// Components Module - Funções para renderizar componentes reutilizáveis

/**
 * Formata data para exibição
 */
function formatarData(dataString) {
    if (!dataString) return '-';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formata valor monetário
 */
function formatarValor(valor) {
    if (!valor && valor !== 0) return '-';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

/**
 * Formata status com badge
 */
function formatarStatus(status) {
    if (!status) return '<span class="status-badge">-</span>';
    
    const statusLower = status.toLowerCase();
    let classe = 'status-badge';
    
    if (statusLower.includes('autorizado') || statusLower === 'autorizado') {
        classe += ' status-autorizado';
        return `<span class="${classe}">✓ Autorizado</span>`;
    } else if (statusLower.includes('processando') || statusLower === 'processando_autorizacao') {
        classe += ' status-processando';
        return `<span class="${classe}">⏳ Processando</span>`;
    } else if (statusLower.includes('erro') || statusLower === 'erro_autorizacao') {
        classe += ' status-erro';
        return `<span class="${classe}">✗ Erro</span>`;
    }
    
    return `<span class="status-badge">${status}</span>`;
}

/**
 * Renderiza tabela de requisições (NFSe)
 */
function renderizarTabelaRequisicoes(requisicoes) {
    if (!requisicoes || requisicoes.length === 0) {
        return `
            <div class="empty-state">
                <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="12" width="48" height="40" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M8 20h48M20 28h24M20 36h24M20 44h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>Nenhuma requisição encontrada</h3>
                <p>Não há requisições para exibir no momento.</p>
            </div>
        `;
    }

    const rows = requisicoes.map(req => {
        const emitente = req.dados_completos?.prestador?.razao_social || 
                        req.dados_completos?.prestador?.nome || 
                        '-';
        const dataEmissao = formatarData(req.created_at);
        const numero = req.chave_nfse ? req.chave_nfse.substring(0, 20) + '...' : '-';
        const destinatario = req.dados_completos?.tomador?.razao_social || 
                           req.dados_completos?.tomador?.nome || 
                           '-';
        const valor = req.dados_completos?.servico?.valor_servicos || 
                     req.dados_completos?.valor_total || 
                     0;
        const referencia = req.referencia || '-';
        const status = formatarStatus(req.status_focus);

        return `
            <tr>
                <td>${emitente}</td>
                <td>${dataEmissao}</td>
                <td>${numero}</td>
                <td>${destinatario}</td>
                <td>${formatarValor(valor)}</td>
                <td>${referencia}</td>
                <td>${status}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Emitente</th>
                        <th>Data Emissão</th>
                        <th>Número</th>
                        <th>Destinatário</th>
                        <th>Valor</th>
                        <th>Referência</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Renderiza tabela de pedidos WooCommerce
 */
function renderizarTabelaPedidos(pedidos) {
    console.log('renderizarTabelaPedidos chamado com:', pedidos ? pedidos.length : 0, 'pedidos');
    
    if (!pedidos || pedidos.length === 0) {
        console.log('Nenhum pedido para renderizar');
        return `
            <div class="empty-state">
                <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="12" width="48" height="40" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M8 20h48M20 28h24M20 36h24M20 44h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>Nenhum pedido encontrado</h3>
                <p>Não há pedidos para exibir no momento.</p>
            </div>
        `;
    }

    console.log('Renderizando', pedidos.length, 'pedidos na tabela');
    const rows = pedidos.map((pedido, index) => {
        if (index === 0) {
            console.log('Primeiro pedido:', {
                id: pedido.id,
                date_created: pedido.date_created,
                billing: pedido.billing,
                total: pedido.total
            });
        }
        const id = pedido.id || pedido.number || '-';
        const data = formatarData(pedido.date_created || pedido.created_at);
        const cliente = pedido.billing 
            ? `${pedido.billing.first_name || ''} ${pedido.billing.last_name || ''}`.trim() || pedido.billing.company || 'N/A'
            : 'N/A';
        const total = formatarValor(parseFloat(pedido.total || 0));
        const status = pedido.status || '-';
        const temNFSe = pedido.tem_nfse ? '✓' : '-';

        return `
            <tr>
                <td>#${id}</td>
                <td>${data}</td>
                <td>${cliente}</td>
                <td>${total}</td>
                <td>${status}</td>
                <td>${temNFSe}</td>
                <td>
                    <button class="btn btn-secondary" onclick="verDetalhesPedido(${id})">Ver Detalhes</button>
                    ${!pedido.tem_nfse ? `<button class="btn btn-primary" onclick="emitirNFSePedido(${id})">Emitir NFSe</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    console.log('Tabela renderizada com', rows.split('</tr>').length - 1, 'linhas');
    
    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>NFSe</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Renderiza paginação
 */
function renderizarPaginacao(paginaAtual, totalPaginas, onPageChange) {
    if (totalPaginas <= 1) return '';

    const paginas = [];
    const maxPaginas = 5;
    let inicio = Math.max(1, paginaAtual - Math.floor(maxPaginas / 2));
    let fim = Math.min(totalPaginas, inicio + maxPaginas - 1);
    
    if (fim - inicio < maxPaginas - 1) {
        inicio = Math.max(1, fim - maxPaginas + 1);
    }

    for (let i = inicio; i <= fim; i++) {
        paginas.push(i);
    }

    return `
        <div class="pagination">
            <button class="pagination-btn" 
                    onclick="${onPageChange}(${paginaAtual - 1})" 
                    ${paginaAtual === 1 ? 'disabled' : ''}>
                ←
            </button>
            ${paginas.map(pag => `
                <button class="pagination-page ${pag === paginaAtual ? 'active' : ''}" 
                        onclick="${onPageChange}(${pag})">
                    ${pag}
                </button>
            `).join('')}
            <button class="pagination-btn" 
                    onclick="${onPageChange}(${paginaAtual + 1})" 
                    ${paginaAtual === totalPaginas ? 'disabled' : ''}>
                →
            </button>
        </div>
    `;
}

/**
 * Renderiza tabela de resumo por mês
 */
function renderizarTabelaResumoMeses(dados) {
    if (!dados || dados.length <= 1) return '';
    
    const rows = dados.slice(1).map(row => `
        <tr>
            <td>${row[0]}</td>
            <td style="text-align: center;">${row[1]}</td>
            <td style="text-align: right;">${row[2]}</td>
        </tr>
    `).join('');
    
    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Mês</th>
                        <th style="text-align: center;">Quantidade</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Renderiza modal de progresso de emissão em lote
 */
function renderizarProgressoEmissao(total, processados, sucesso, erros, resultados) {
    const percentual = total > 0 ? Math.round((processados / total) * 100) : 0;
    
    const resultadosHtml = resultados.map((r, index) => {
        if (r.sucesso) {
            return `
                <div style="padding: 12px; background-color: #d4edda; border-left: 4px solid #28a745; margin-bottom: 8px; border-radius: 4px;">
                    <strong>Pedido #${r.pedido_id}</strong> - Sucesso
                    ${r.referencia ? `<br><small>Referência: ${r.referencia}</small>` : ''}
                    ${r.nfse_numero ? `<br><small>NFSe: ${r.nfse_numero}</small>` : ''}
                </div>
            `;
        } else {
            return `
                <div style="padding: 12px; background-color: #f8d7da; border-left: 4px solid #dc3545; margin-bottom: 8px; border-radius: 4px;">
                    <strong>Pedido #${r.pedido_id}</strong> - Erro
                    <br><small>${r.erro || 'Erro desconhecido'}</small>
                </div>
            `;
        }
    }).join('');
    
    return `
        <div id="modal-progresso" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="background-color: white; border-radius: 8px; padding: 24px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;">
                <h2 style="margin-top: 0; margin-bottom: 20px; color: var(--color-gray-dark);">Emissão em Lote</h2>
                
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Progresso: ${processados} de ${total}</span>
                        <span>${percentual}%</span>
                    </div>
                    <div style="width: 100%; height: 24px; background-color: var(--color-gray-light); border-radius: 12px; overflow: hidden;">
                        <div style="width: ${percentual}%; height: 100%; background-color: var(--color-orange); transition: width 0.3s ease;"></div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; padding: 12px; background-color: var(--color-gray-light); border-radius: 4px;">
                    <div style="display: flex; gap: 20px;">
                        <div>
                            <strong style="color: #28a745;">${sucesso}</strong> sucesso
                        </div>
                        <div>
                            <strong style="color: #dc3545;">${erros}</strong> erros
                        </div>
                    </div>
                </div>
                
                <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Resultados:</h3>
                    ${resultadosHtml || '<p style="color: var(--color-gray-medium);">Aguardando processamento...</p>'}
                </div>
                
                ${processados >= total ? `
                    <button class="btn btn-primary" onclick="fecharModalProgresso()" style="width: 100%;">Fechar</button>
                ` : `
                    <button class="btn btn-secondary" onclick="fecharModalProgresso()" style="width: 100%;">Cancelar</button>
                `}
            </div>
        </div>
    `;
}

/**
 * Renderiza loading spinner
 */
function renderizarLoading() {
    return `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Carregando...</p>
        </div>
    `;
}

/**
 * Renderiza formulário de pesquisa de requisições
 */
function renderizarFormularioPesquisa(onSubmit, onClear) {
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 7);

    const formatarDataInput = (data) => {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };

    return `
        <form class="search-form" id="form-pesquisa" onsubmit="event.preventDefault(); ${onSubmit}()">
            <div class="form-group">
                <label class="form-label">Empresa</label>
                <select class="form-select" name="empresa" id="filtro-empresa">
                    <option value="">Todas</option>
                    <option value="lungta">Lungta Psicoterapia</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Referência</label>
                <input type="text" class="form-input" name="referencia" id="filtro-referencia" placeholder="Digite a referência">
            </div>
            <div class="form-group">
                <label class="form-label">Número</label>
                <input type="text" class="form-input" name="numero" id="filtro-numero" placeholder="Digite o número">
            </div>
            <div class="form-group">
                <label class="form-label">Número RPS</label>
                <input type="text" class="form-input" name="rps" id="filtro-rps" placeholder="Digite o RPS">
            </div>
            <div class="form-group">
                <label class="form-label">Período</label>
                <select class="form-select" name="periodo" id="filtro-periodo">
                    <option value="custom">Personalizado</option>
                    <option value="hoje">Hoje</option>
                    <option value="7dias">Últimos 7 dias</option>
                    <option value="30dias">Últimos 30 dias</option>
                    <option value="mes">Este mês</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Início</label>
                <input type="date" class="form-input" name="inicio" id="filtro-inicio" value="${formatarDataInput(seteDiasAtras)}">
            </div>
            <div class="form-group">
                <label class="form-label">Fim</label>
                <input type="date" class="form-input" name="fim" id="filtro-fim" value="${formatarDataInput(hoje)}">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="${onClear}()">LIMPAR FILTROS</button>
                <button type="submit" class="btn btn-primary">PESQUISAR</button>
            </div>
        </form>
    `;
}

// Exportar funções globalmente
window.Components = {
    formatarData,
    formatarValor,
    formatarStatus,
    renderizarTabelaRequisicoes,
    renderizarTabelaPedidos,
    renderizarTabelaResumoMeses,
    renderizarProgressoEmissao,
    renderizarPaginacao,
    renderizarLoading,
    renderizarFormularioPesquisa
};

