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
        let dia, mes, ano, hora, min, seg;

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
