/**
 * Parseia uma string de endereço (ex.: coluna da planilha) no formato
 * esperado pelo mapeador: { rua, numero, bairro, cidade, estado, cep }.
 * Compatível com dados como:
 * - "Rua X, 50, ap 302, Graças, Recife - PE"
 * - "Rua Y, 54, Santa Rosa, Niterói - RJ, CEP 24240-660"
 * - "RUA BEQUIMÃO, 54 - ENCRUZILHADA - RECIFE/PE - Cep: 52030-110"
 */
function parseEndereco(texto) {
    const empty = { rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' };
    if (texto == null || String(texto).trim() === '') return empty;

    let s = String(texto).trim();
    let cep = '';
    let estado = '';
    let cidade = '';

    // 1. CEP: 12345-678 ou 12345678 ou "CEP 12345-678" / "Cep: 52030-110"
    const cepMatch = s.match(/(?:CEP|Cep)\s*:?\s*(\d{5}-?\d{3})/i) || s.match(/(\d{5}-?\d{3})\s*$/);
    if (cepMatch) {
        cep = cepMatch[1].replace(/\D/g, '').substring(0, 8);
        s = s.replace(cepMatch[0], '').replace(/\s*,\s*$/, '').trim();
    }

    // 2. UF: " - PE" ou "/PE" (duas letras no final)
    const ufMatch = s.match(/\s*[-\/]\s*([A-Z]{2})\s*$/i);
    if (ufMatch) {
        estado = ufMatch[1].toUpperCase();
        s = s.replace(ufMatch[0], '').trim();
    }

    // 3. Cidade e UF: último segmento " - X" pode ser "Recife" (UF já extraída) ou "RECIFE/PE"
    const partsByDash = s.split(/\s+-\s+/);
    if (partsByDash.length >= 1) {
        const lastPart = partsByDash[partsByDash.length - 1].trim();
        if (lastPart.includes('/')) {
            const [c, u] = lastPart.split('/').map(x => x.trim());
            if (u && u.length === 2 && /^[A-Z]{2}$/i.test(u)) {
                estado = estado || u.toUpperCase();
                cidade = c || '';
                s = partsByDash.slice(0, -1).join(' - ').trim();
            }
        } else if (lastPart.length > 0 && !lastPart.includes(',') && !/^\d+$/.test(lastPart) && lastPart.length < 50) {
            cidade = lastPart;
            s = partsByDash.slice(0, -1).join(' - ').trim();
        }
    }
    // 3b. Se não achou cidade pelo " - ": pode ser último campo após vírgulas (ex.: "..., Graças, Recife" após remover " - PE")
    if (!cidade && s.includes(',')) {
        const porVirgula = s.split(',').map(p => p.trim()).filter(Boolean);
        const ultimo = porVirgula[porVirgula.length - 1];
        if (ultimo && !/^\d+$/.test(ultimo) && ultimo.length < 50) {
            cidade = ultimo;
            s = porVirgula.slice(0, -1).join(', ').trim();
        }
    }

    // 4. Restante: logradouro, número, bairro (vírgulas ou " - ")
    const partes = s.split(',').map(p => p.trim()).filter(Boolean);
    let rua = '';
    let numero = '';
    let bairro = '';

    if (partes.length === 0) {
        const byDash = s.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
        if (byDash.length >= 1) rua = byDash[0];
        if (byDash.length >= 2) bairro = byDash.slice(1).join(' - ');
    } else {
        rua = partes[0];
        // Segundo segmento: número (50, 54) ou "54 - ENCRUZILHADA"
        if (partes.length >= 2) {
            const second = partes[1];
            const numMatch = second.match(/^(\d{1,5})/);
            if (numMatch) {
                numero = numMatch[1];
                const afterNum = second.replace(numMatch[0], '').replace(/^\s*-\s*/, '').trim();
                if (afterNum) bairro = afterNum;
            } else {
                bairro = second;
            }
        }
        // Várias partes: rua, numero, complemento(s), bairro — bairro costuma ser o último
        if (partes.length >= 3 && !bairro) bairro = partes[partes.length - 1];
        if (partes.length >= 4 && bairro === partes[2]) bairro = partes[partes.length - 1];
    }

    return {
        rua: rua || '',
        numero: numero || '',
        bairro: bairro || '',
        cidade: cidade || '',
        estado: estado || '',
        cep: cep || ''
    };
}

module.exports = { parseEndereco };
