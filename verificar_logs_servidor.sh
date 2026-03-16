#!/bin/bash

# Script para verificar os logs do servidor e entender o que está acontecendo

echo "📋 Verificando logs do servidor..."
echo ""

# Verificar se há um processo Node.js rodando
if pgrep -f "node.*server" > /dev/null; then
    echo "✅ Servidor Node.js está rodando"
    echo ""
    echo "Para ver os logs em tempo real, execute:"
    echo "  tail -f logs/app.log"
    echo "  ou"
    echo "  pm2 logs"
    echo ""
else
    echo "⚠️  Servidor Node.js não está rodando"
    echo ""
fi

# Verificar arquivos de log
if [ -f "logs/app.log" ]; then
    echo "📄 Últimas 50 linhas do log:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -50 logs/app.log | grep -E "(CANCELAR|BUSCAR|FOCUS|NFe|erro|error|Error)" || tail -50 logs/app.log
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "⚠️  Arquivo de log não encontrado em logs/app.log"
    echo ""
    echo "Os logs podem estar sendo exibidos no console do servidor."
    echo "Verifique a janela/terminal onde o servidor está rodando."
fi

echo ""
echo "💡 Dica: Procure por mensagens que contenham:"
echo "   - 'CANCELAR POR CHAVE'"
echo "   - 'Resultado da busca no ambiente'"
echo "   - 'total_notas'"
echo "   - 'erro' ou 'error'"

