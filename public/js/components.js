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
 * Renderiza filtros para Buscar Notas
 */
function renderizarFiltrosBuscarNotas() {
    return `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">🗑️ Cancelar Nota por Referência</h3>
            <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
                Digite a referência da nota que deseja cancelar:
            </p>
            
            <div style="margin-bottom: 16px;">
                <label for="referencia-cancelar" style="display: block; margin-bottom: 6px; font-weight: 600; color: #333;">
                    Referência da Nota
                </label>
                <input 
                    type="text" 
                    id="referencia-cancelar" 
                    name="referencia"
                    class="form-input" 
                    placeholder="Ex: PED-6454"
                    style="width: 100%; font-size: 16px; padding: 12px;"
                />
                <small style="display: block; margin-top: 6px; color: #666; font-size: 13px;">
                    Digite a referência da nota (ex: PED-6454) e clique em "Cancelar Nota"
                </small>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 8px; align-items: center;">
                <button 
                    type="button" 
                    onclick="cancelarPorReferencia()" 
                    class="btn btn-danger"
                    style="margin: 0; padding: 12px 24px; font-size: 16px;"
                    id="btn-cancelar-referencia"
                >
                    🗑️ Cancelar Nota
                </button>
                <button 
                    type="button" 
                    onclick="limparReferencia()" 
                    class="btn btn-secondary"
                    style="margin: 0; padding: 12px 24px; font-size: 16px;"
                >
                    Limpar
                </button>
            </div>
        </div>
    `;
}

/**
 * Limpa filtros de buscar notas
 */
function limparFiltrosBuscarNotas() {
    const form = document.getElementById('form-filtros-buscar-notas');
    if (form) {
        form.reset();
    }
}

/**
 * Renderiza tabela de buscar notas (com botão de cancelar)
 */
function renderizarTabelaBuscarNotas(notas) {
    if (!notas || notas.length === 0) {
        return `
            <div class="empty-state">
                <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M32 20v12M32 40h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>Nenhuma nota encontrada</h3>
                <p>Não há notas que correspondam aos filtros informados.</p>
            </div>
        `;
    }

    const rows = notas.map(nota => {
        const dataEmissao = formatarData(nota.created_at || nota.data_emissao);
        const referencia = nota.referencia || nota.ref || '-';
        const pedidoId = nota.pedido_externo || nota.pedido_id || '-';
        const tipoNota = nota.tipo_nota || (nota.chave_nfe ? 'nfe' : 'nfse');
        const tipoBadge = tipoNota === 'nfe' 
            ? '<span class="badge badge-info">NFe</span>' 
            : '<span class="badge badge-success">NFSe</span>';
        
        // Badge de origem
        const origem = nota.origem || 'banco_local';
        const origemBadge = origem === 'focus_nfe' 
            ? '<span class="badge badge-primary" title="Nota encontrada na Focus NFe">Focus NFe</span>'
            : '<span class="badge badge-secondary" title="Nota do banco local">Banco Local</span>';
        
        // Extrair cliente baseado no tipo de nota
        let cliente = '-';
        if (tipoNota === 'nfe') {
            cliente = nota.dados_completos?.destinatario?.nome_destinatario || 
                     nota.dados_completos?.destinatario?.razao_social || 
                     nota.nome_destinatario ||
                     '-';
        } else {
            cliente = nota.dados_completos?.tomador?.razao_social || 
                     nota.dados_completos?.tomador?.nome || 
                     nota.razao_social ||
                     '-';
        }
        
        // Extrair valor baseado no tipo de nota
        let valor = 0;
        if (tipoNota === 'nfe') {
            valor = nota.dados_completos?.valor_total || nota.valor_total || 0;
        } else {
            valor = nota.dados_completos?.servico?.valor_servicos || 
                   nota.dados_completos?.valor_total || 
                   nota.valor_servicos ||
                   nota.valor_total ||
                   0;
        }
        
        const ambiente = nota.ambiente || 'homologacao';
        const ambienteBadge = ambiente === 'producao' 
            ? '<span class="badge badge-success">Produção</span>' 
            : '<span class="badge badge-warning">Homologação</span>';
        const status = formatarStatus(nota.status || nota.status_focus);
        
        // Verificar se pode cancelar (não cancelada e autorizada)
        const statusLower = (nota.status || nota.status_focus || '').toLowerCase();
        const podeCancelar = !statusLower.includes('cancelado') && 
                            (statusLower.includes('autorizado') || statusLower === 'autorizado');
        
        // URLs para visualizar
        const baseUrl = ambiente === 'producao' 
            ? 'https://api.focusnfe.com.br'
            : 'https://homologacao.focusnfe.com.br';
        
        let urlVisualizar = null;
        if (tipoNota === 'nfe') {
            // Para NFe, usar caminho_danfe ou caminho_xml_nota_fiscal
            const caminhoDanfe = nota.caminho_danfe || nota.dados_completos?.caminho_danfe;
            const caminhoXml = nota.caminho_xml_nota_fiscal || nota.dados_completos?.caminho_xml_nota_fiscal;
            urlVisualizar = caminhoDanfe || caminhoXml;
        } else if (tipoNota === 'nfse') {
            // Para NFSe, usar url ou caminho_xml
            urlVisualizar = nota.url || nota.dados_completos?.url || 
                          nota.caminho_xml || nota.dados_completos?.caminho_xml_nota_fiscal ||
                          nota.dados_completos?.caminho_xml_nota_fsical;
        }
        
        const urlCompleta = urlVisualizar 
            ? (urlVisualizar.startsWith('http') ? urlVisualizar : `${baseUrl}${urlVisualizar}`)
            : null;
        
        const botaoVisualizar = urlCompleta
            ? `<button 
                   onclick="visualizarNota('${urlCompleta}', '${tipoNota}', '${ambiente}')" 
                   class="btn btn-sm btn-primary"
                   title="Visualizar ${tipoNota === 'nfe' ? 'DANFe' : 'NFSe'}"
                   style="margin-right: 4px;"
               >
                   👁️ Visualizar
               </button>`
            : `<button 
                   disabled
                   class="btn btn-sm btn-secondary"
                   title="URL de visualização não disponível"
                   style="margin-right: 4px;"
               >
                   👁️ Visualizar
               </button>`;
        
        // Obter chave da nota para cancelamento alternativo
        const chaveNota = nota.chave_nfe || nota.chave_nfse || nota.chave || 
                         (nota.dados_completos && (nota.dados_completos.chave_nfe || nota.dados_completos.chave_nfse));
        
        // Se não tem referência mas tem chave, usar cancelamento por chave
        const temReferencia = referencia && referencia !== '-';
        const usarCancelamentoPorChave = !temReferencia && chaveNota;
        
        const botaoCancelar = podeCancelar
            ? `<button 
                   onclick="${usarCancelamentoPorChave ? `cancelarNotaPorChave('${chaveNota}', '${tipoNota}', '${ambiente}')` : `cancelarNota('${referencia}', '${tipoNota}', '${ambiente}')`}" 
                   class="btn btn-sm btn-danger"
                   title="Cancelar esta nota"
               >
                   🗑️ Cancelar
               </button>`
            : `<button 
                   disabled
                   class="btn btn-sm btn-secondary"
                   title="Nota não pode ser cancelada (já cancelada ou não autorizada)"
               >
                   🗑️ Cancelar
               </button>`;

        return `
            <tr>
                <td>${dataEmissao}</td>
                <td>${tipoBadge}</td>
                <td>${origemBadge}</td>
                <td>${referencia}</td>
                <td>${pedidoId}</td>
                <td>${cliente}</td>
                <td>${formatarValor(valor)}</td>
                <td>${ambienteBadge}</td>
                <td>${status}</td>
                <td style="white-space: nowrap;">
                    ${botaoVisualizar}
                    ${botaoCancelar}
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Origem</th>
                        <th>Referência</th>
                        <th>Pedido ID</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Ambiente</th>
                        <th>Status</th>
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
 * Renderiza filtros para Notas Enviadas
 */
function renderizarFiltrosNotasEnviadas() {
    return `
        <form id="form-filtros-notas" class="filters-form" onsubmit="event.preventDefault(); filtrarNotasEnviadas();">
            <div class="filters-grid">
                <div class="filter-group">
                    <label for="filtro-data-inicio">Data Início</label>
                    <input 
                        type="date" 
                        id="filtro-data-inicio" 
                        name="data_inicio"
                        class="form-input"
                    />
                </div>
                
                <div class="filter-group">
                    <label for="filtro-data-fim">Data Fim</label>
                    <input 
                        type="date" 
                        id="filtro-data-fim" 
                        name="data_fim"
                        class="form-input"
                    />
                </div>
                
                <div class="filter-group">
                    <label for="filtro-status">Status</label>
                    <select id="filtro-status" name="status_focus" class="form-select">
                        <option value="">Todos</option>
                        <option value="autorizado">Autorizado</option>
                        <option value="processando_autorizacao">Processando</option>
                        <option value="erro_autorizacao">Erro</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="filtro-ambiente">Ambiente</label>
                    <select id="filtro-ambiente" name="ambiente" class="form-select">
                        <option value="">Todos</option>
                        <option value="homologacao">Homologação</option>
                        <option value="producao">Produção</option>
                    </select>
                </div>
            </div>
            
            <div class="filters-actions">
                <button type="button" class="btn btn-primary" onclick="atualizarStatusNotas()" title="Atualizar status das notas pendentes">
                    🔄 Atualizar Status
                </button>
                <button type="submit" class="btn btn-primary">Filtrar</button>
                <button type="button" onclick="limparFiltrosNotasEnviadas()" class="btn btn-secondary">Limpar Filtros</button>
            </div>
        </form>
    `;
}

/**
 * Renderiza tabela de requisições (alias para renderizarTabelaNotasEnviadas)
 */
function renderizarTabelaRequisicoes(requisicoes) {
    // Usar a mesma função de notas enviadas, já que são a mesma coisa
    return renderizarTabelaNotasEnviadas(requisicoes);
}

/**
 * Renderiza tabela de notas enviadas (NFSe e NFe)
 */
function renderizarTabelaNotasEnviadas(notas) {
    if (!notas || notas.length === 0) {
        return `
            <div class="empty-state">
                <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="12" width="48" height="40" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M8 20h48M20 28h24M20 36h24M20 44h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>Nenhuma nota encontrada</h3>
                <p>Não há notas para exibir no momento.</p>
            </div>
        `;
    }

    const rows = notas.map(nota => {
        const dataEmissao = formatarData(nota.created_at);
        const referencia = nota.referencia || '-';
        const pedidoId = nota.pedido_externo || nota.pedido_id || '-';
        const tipoNota = nota.tipo_nota || 'nfse';
        const tipoLabel = tipoNota === 'nfe' ? 'NFe' : 'NFSe';
        const tipoBadge = tipoNota === 'nfe' 
            ? '<span class="badge badge-info">NFe</span>' 
            : '<span class="badge badge-success">NFSe</span>';
        
        // Parsear dados_completos se for string JSON
        let dadosCompletos = nota.dados_completos;
        const tipoOriginal = typeof dadosCompletos;
        
        if (typeof dadosCompletos === 'string') {
            try {
                dadosCompletos = JSON.parse(dadosCompletos);
            } catch (e) {
                console.warn('Erro ao parsear dados_completos:', e);
                dadosCompletos = {};
            }
        }
        
        // Log para debug (apenas primeira nota)
        if (notas.indexOf(nota) === 0) {
            console.log('Debug Frontend - Nota:', referencia);
            console.log('Debug Frontend - Tipo dados_completos original:', tipoOriginal);
            console.log('Debug Frontend - Tipo após parse:', typeof dadosCompletos);
            console.log('Debug Frontend - dados_completos existe?', !!dadosCompletos);
            if (dadosCompletos && typeof dadosCompletos === 'object') {
                console.log('Debug Frontend - Chaves disponíveis:', Object.keys(dadosCompletos).slice(0, 10));
                if (tipoNota === 'nfse') {
                    console.log('Debug Frontend - Tem tomador?', !!dadosCompletos.tomador);
                    console.log('Debug Frontend - Tem servico?', !!dadosCompletos.servico);
                    if (dadosCompletos.tomador) {
                        console.log('Debug Frontend - Tomador keys:', Object.keys(dadosCompletos.tomador));
                    }
                    if (dadosCompletos.servico) {
                        console.log('Debug Frontend - Servico keys:', Object.keys(dadosCompletos.servico));
                        console.log('Debug Frontend - valor_servicos:', dadosCompletos.servico.valor_servicos);
                    }
                } else {
                    console.log('Debug Frontend - Tem destinatario?', !!dadosCompletos.destinatario);
                    console.log('Debug Frontend - valor_total:', dadosCompletos.valor_total);
                }
            }
        }
        
        // Extrair cliente baseado no tipo de nota
        let cliente = '-';
        if (tipoNota === 'nfe') {
            // NFe: dados_completos.destinatario.nome_destinatario
            cliente = dadosCompletos?.destinatario?.nome_destinatario || 
                     dadosCompletos?.destinatario?.razao_social || 
                     nota.nome_destinatario ||
                     nota.razao_social ||
                     '-';
        } else {
            // NFSe: dados_completos.tomador.razao_social ou nome
            cliente = dadosCompletos?.tomador?.razao_social || 
                     dadosCompletos?.tomador?.nome || 
                     nota.razao_social ||
                     nota.nome ||
                     '-';
        }
        
        // Extrair valor baseado no tipo de nota
        let valor = 0;
        if (tipoNota === 'nfe') {
            // NFe: dados_completos.valor_total
            valor = dadosCompletos?.valor_total || 
                   nota.valor_total || 
                   0;
        } else {
            // NFSe: dados_completos.servico.valor_servicos ou valor_total
            valor = dadosCompletos?.servico?.valor_servicos || 
                   dadosCompletos?.valor_total || 
                   nota.valor_servicos ||
                   nota.valor_total ||
                   0;
        }
        
        // Garantir que valor seja numérico
        valor = parseFloat(valor) || 0;
        
        const ambiente = nota.ambiente || 'homologacao';
        const ambienteLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
        const ambienteBadge = ambiente === 'producao' 
            ? '<span class="badge badge-success">Produção</span>' 
            : '<span class="badge badge-warning">Homologação</span>';
        const status = formatarStatus(nota.status_focus);

        return `
            <tr>
                <td>${dataEmissao}</td>
                <td>${tipoBadge}</td>
                <td>${referencia}</td>
                <td>${pedidoId}</td>
                <td>${cliente}</td>
                <td>${formatarValor(valor)}</td>
                <td>${ambienteBadge}</td>
                <td>${status}</td>
                <td>
                    <button 
                        onclick="verLogsNota('${referencia}')" 
                        class="btn btn-sm btn-secondary"
                        title="Ver logs desta nota"
                    >
                        Ver Logs
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Referência</th>
                        <th>Pedido ID</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Ambiente</th>
                        <th>Status</th>
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
 * Extrai categorias dos produtos do pedido
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
                if (typeof cat === 'string') {
                    categorias.add(cat);
                } else if (cat && cat.name) {
                    categorias.add(cat.name);
                }
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
 * Renderiza tabela de pedidos WooCommerce
 */
function renderizarTabelaPedidos(pedidos, agruparPorCategoria = false) {
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
    
    // Mapear status para labels
    const statusLabels = {
        'pending': 'Pendente',
        'processing': 'Processando',
        'on-hold': 'Em espera',
        'completed': 'Concluído',
        'cancelled': 'Cancelado',
        'refunded': 'Reembolsado',
        'failed': 'Falhou'
    };
    
    let rows = '';
    
    if (agruparPorCategoria) {
        // Agrupar pedidos por categoria
        const pedidosPorCategoria = {};
        
        pedidos.forEach(pedido => {
            const categorias = extrairCategoriasPedido(pedido);
            const categoriaPrincipal = categorias.length > 0 ? categorias[0] : 'Sem categoria';
            
            if (!pedidosPorCategoria[categoriaPrincipal]) {
                pedidosPorCategoria[categoriaPrincipal] = [];
            }
            pedidosPorCategoria[categoriaPrincipal].push(pedido);
        });
        
        // Renderizar por categoria
        Object.keys(pedidosPorCategoria).sort().forEach(categoria => {
            const pedidosCategoria = pedidosPorCategoria[categoria];
            const categoriaId = categoria.toLowerCase().replace(/\s+/g, '-');
            
            rows += `
                <tr style="background-color: var(--color-gray-light);">
                    <td colspan="7" style="padding: 12px; font-weight: 600; font-size: 16px;">
                        ${categoria} (${pedidosCategoria.length} pedido${pedidosCategoria.length !== 1 ? 's' : ''})
                    </td>
                </tr>
            `;
            
            pedidosCategoria.forEach(pedido => {
                const id = pedido.id || pedido.number || '-';
                const data = formatarData(pedido.date_created || pedido.created_at);
                const cliente = pedido.billing 
                    ? `${pedido.billing.first_name || ''} ${pedido.billing.last_name || ''}`.trim() || pedido.billing.company || 'N/A'
                    : 'N/A';
                const total = formatarValor(parseFloat(pedido.total || 0));
                const statusAtual = pedido.status || 'pending';
                const statusLabel = statusLabels[statusAtual] || statusAtual;
                
                rows += `
                    <tr>
                        <td>
                            <input 
                                type="checkbox" 
                                class="checkbox-pedido" 
                                data-pedido-id="${id}"
                                onchange="atualizarSelecaoPedidos()"
                                style="width: 18px; height: 18px; cursor: pointer;">
                        </td>
                        <td>#${id}</td>
                        <td>${data}</td>
                        <td>${cliente}</td>
                        <td>${total}</td>
                        <td>${statusLabel}</td>
                        <td>${categoria}</td>
                    </tr>
                `;
            });
        });
    } else {
        // Renderizar normalmente
        pedidos.forEach((pedido, index) => {
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
            const statusAtual = pedido.status || 'pending';
            const statusLabel = statusLabels[statusAtual] || statusAtual;
            
            // Extrair categorias
            const categorias = extrairCategoriasPedido(pedido);
            const categoriaTexto = categorias.length > 0 ? categorias.join(', ') : 'Sem categoria';

            rows += `
                <tr>
                    <td>
                        <input 
                            type="checkbox" 
                            class="checkbox-pedido" 
                            data-pedido-id="${id}"
                            onchange="atualizarSelecaoPedidos()"
                            style="width: 18px; height: 18px; cursor: pointer;">
                    </td>
                    <td>#${id}</td>
                    <td>${data}</td>
                    <td>${cliente}</td>
                    <td>${total}</td>
                    <td>${statusLabel}</td>
                    <td>${categoriaTexto}</td>
                </tr>
            `;
        });
    }

    console.log('Tabela renderizada com', rows.split('</tr>').length - 1, 'linhas');
    
    // Gerar ID único para esta tabela (baseado no timestamp)
    const tabelaId = 'tabela-pedidos-' + Date.now();
    
    return `
        <div class="table-container">
            <table class="table" id="${tabelaId}">
                <thead>
                    <tr>
                        <th style="width: 50px;">
                            <input 
                                type="checkbox" 
                                class="checkbox-selecionar-todos"
                                onchange="selecionarTodosPedidos(this, '${tabelaId}')"
                                style="width: 18px; height: 18px; cursor: pointer;"
                                title="Selecionar todos">
                        </th>
                        <th>ID</th>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Categoria</th>
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

/**
 * Renderiza tabela de backups de XMLs
 */
function renderBackups(backups, mensagem = null, notasNFe = []) {
    // Função auxiliar para obter URL completa do XML
    function obterUrlXml(caminhoXml, ambiente) {
        if (!caminhoXml) return '#';
        if (caminhoXml.startsWith('http')) return caminhoXml;
        const baseUrl = ambiente === 'producao' 
            ? 'https://api.focusnfe.com.br'
            : 'https://homologacao.focusnfe.com.br';
        return `${baseUrl}${caminhoXml}`;
    }
    
    let htmlBackups = '';
    
    if (!backups || backups.length === 0) {
        const mensagemExibicao = mensagem || 'Nenhum backup disponível no momento.';
        htmlBackups = `
            <div class="content-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 class="section-title" style="margin: 0;">Backups XML - Notas de Produto</h2>
                </div>
                <div class="empty-state">
                    <p style="color: var(--color-gray-medium);">${mensagemExibicao}</p>
                    <p style="color: var(--color-gray-medium); font-size: 14px; margin-top: 8px;">
                        Os backups são gerados mensalmente (dia 1) e semanalmente (sábados) pela Focus NFe.
                    </p>
                    <p style="color: var(--color-gray-medium); font-size: 12px; margin-top: 8px;">
                        <strong>Importante:</strong> Os backups só estarão disponíveis após a emissão de notas fiscais de produto (NFe) e após o primeiro backup ser gerado pela Focus NFe.
                    </p>
                </div>
            </div>
        `;
    } else {

        let rows = '';
        backups.forEach(backup => {
            rows += `
                <tr>
                    <td style="font-weight: 600;">${backup.mesFormatado}</td>
                    <td>
                        <span class="badge badge-info">${backup.tipo}</span>
                    </td>
                    <td>
                        ${backup.xmls ? `
                            <a 
                                href="${backup.xmls}" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                class="btn btn-sm btn-primary"
                                style="text-decoration: none; display: inline-block;"
                                download
                            >
                                📥 Baixar XMLs
                            </a>
                        ` : '<span style="color: var(--color-gray-medium);">-</span>'}
                    </td>
                    <td>
                        ${backup.danfes ? `
                            <a 
                                href="${backup.danfes}" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                class="btn btn-sm btn-secondary"
                                style="text-decoration: none; display: inline-block;"
                                download
                            >
                                📥 Baixar DANFEs
                            </a>
                        ` : '<span style="color: var(--color-gray-medium);">-</span>'}
                    </td>
                </tr>
            `;
        });

        htmlBackups = `
            <div class="content-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 class="section-title" style="margin: 0;">Backups XML - Notas de Produto</h2>
                    <div style="padding: 4px 12px; background-color: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                        <span style="color: #28a745; font-size: 12px;">✓ ${backups.length} backup(s) disponível(is)</span>
                    </div>
                </div>
                
                <div style="background-color: var(--color-gray-light); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <p style="margin: 0; color: var(--color-gray-dark); font-size: 14px;">
                        <strong>Informações:</strong> Os backups são gerados automaticamente pela Focus NFe. 
                        Backups mensais são gerados no dia 1 de cada mês. 
                        Backups semanais são gerados todo sábado com as notas emitidas até então.
                    </p>
                </div>

                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Mês</th>
                                <th>Tipo</th>
                                <th>Arquivo XML</th>
                                <th>Arquivo DANFE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Seção de notas individuais
    let notasHtml = '';
    // notasNFe pode ser um array ou um objeto com {notas: [], meses: []}
    const notasArray = Array.isArray(notasNFe) ? notasNFe : (notasNFe?.notas || []);
    const mesesBusca = notasNFe?.meses || [];
    
    if (notasArray && notasArray.length > 0) {
        // Determinar título baseado nos meses buscados
        let tituloSecao = 'Notas Individuais';
        if (mesesBusca && mesesBusca.length > 0) {
            tituloSecao = `Notas Individuais (${mesesBusca.join(' e ')})`;
        } else {
            const dataAtual = new Date();
            const mesAtual = String(dataAtual.getMonth() + 1).padStart(2, '0');
            const anoAtual = dataAtual.getFullYear();
            tituloSecao = `Notas Individuais (${mesAtual}/${anoAtual})`;
        }
        
        let notasRows = '';
        notasArray.forEach(nota => {
            const dataNota = new Date(nota.created_at);
            const urlXml = obterUrlXml(nota.caminho_xml, nota.ambiente);
            notasRows += `
                <tr>
                    <td style="font-family: monospace; font-size: 12px;">${nota.chave_nfe || '-'}</td>
                    <td>${nota.referencia}</td>
                    <td>${dataNota.toLocaleDateString('pt-BR')}</td>
                    <td>
                        <a 
                            href="${urlXml}" 
                            target="_blank"
                            class="btn btn-sm btn-primary"
                            style="text-decoration: none; display: inline-block;"
                            download
                        >
                            📥 Baixar XML
                        </a>
                    </td>
                </tr>
            `;
        });
        
        notasHtml = `
            <div class="content-section" style="margin-top: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0;">${tituloSecao}</h3>
                    <div style="padding: 4px 12px; background-color: #e7f3ff; border-radius: 4px; border: 1px solid #b3d9ff;">
                        <span style="color: #0066cc; font-size: 12px;">📄 ${notasArray.length} nota(s) autorizada(s)</span>
                    </div>
                </div>
                
                <div style="background-color: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #ffc107;">
                    <p style="margin: 0; color: #856404; font-size: 13px;">
                        <strong>💡 Dica:</strong> Você pode baixar os XMLs individuais abaixo ou baixar todos de uma vez em um arquivo ZIP.
                    </p>
                </div>
                
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Chave NFe</th>
                                <th>Referência</th>
                                <th>Data</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${notasRows}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 16px;">
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
                        <a 
                            href="/api/backups/baixar-todos-xmls" 
                            class="btn btn-success"
                            style="text-decoration: none; display: inline-block;"
                            download
                        >
                            📦 Baixar Todos os XMLs em ZIP
                        </a>
                        <span style="color: var(--color-gray-medium); font-size: 13px;">
                            (${notasArray.length} arquivo(s))
                        </span>
                    </div>
                    
                    ${notasNFe?.notasPorMes && notasNFe.notasPorMes.length > 1 ? `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                            <p style="margin: 0 0 12px 0; color: var(--color-gray-dark); font-weight: 600; font-size: 14px;">
                                📅 Baixar por mês:
                            </p>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${notasNFe.notasPorMes.map(mesInfo => `
                                    <a 
                                        href="/api/backups/baixar-todos-xmls?mes=${mesInfo.mes}&ano=${mesInfo.ano}" 
                                        class="btn btn-sm btn-outline-primary"
                                        style="text-decoration: none; display: inline-block;"
                                        download
                                    >
                                        📥 ${mesInfo.mesFormatado} (${mesInfo.total} arquivo${mesInfo.total !== 1 ? 's' : ''})
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } else if (backups && backups.length === 0) {
        // Se não há backups E não há notas individuais, mostrar mensagem alternativa
        notasHtml = `
            <div class="content-section" style="margin-top: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0;">Notas Individuais do Mês Atual</h3>
                </div>
                <div class="empty-state">
                    <p style="color: var(--color-gray-medium);">Nenhuma nota autorizada encontrada para o mês atual.</p>
                </div>
            </div>
        `;
    }
    
    return htmlBackups + notasHtml;
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
    renderizarFormularioPesquisa,
    renderizarFiltrosNotasEnviadas,
    renderizarTabelaNotasEnviadas,
    renderizarFiltrosBuscarNotas,
    renderizarTabelaBuscarNotas,
    extrairCategoriasPedido,
    renderBackups
};

// Debug: confirmar que Components foi carregado
console.log('Components carregado:', Object.keys(window.Components));

