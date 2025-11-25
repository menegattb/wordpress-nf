#!/bin/bash

# Script para cancelar nota fiscal por chave
# Uso: ./cancelar_nota_por_chave.sh <chave_nfe> <justificativa> [ambiente]

CHAVE_NFE="${1}"
JUSTIFICATIVA="${2}"
AMBIENTE="${3:-producao}"  # Padrão: produção

if [ -z "$CHAVE_NFE" ] || [ -z "$JUSTIFICATIVA" ]; then
    echo "❌ Erro: Parâmetros obrigatórios não fornecidos"
    echo ""
    echo "Uso: $0 <chave_nfe> <justificativa> [ambiente]"
    echo ""
    echo "Exemplo:"
    echo "  $0 26251151581345000117550010000000011106473566 \"Nota emitida por engano\" producao"
    echo ""
    exit 1
fi

# Validar tamanho da justificativa
if [ ${#JUSTIFICATIVA} -lt 15 ]; then
    echo "❌ Erro: Justificativa deve ter no mínimo 15 caracteres"
    exit 1
fi

if [ ${#JUSTIFICATIVA} -gt 255 ]; then
    echo "❌ Erro: Justificativa deve ter no máximo 255 caracteres"
    exit 1
fi

echo "🚫 Cancelando nota fiscal..."
echo "   Chave: $CHAVE_NFE"
echo "   Ambiente: $AMBIENTE"
echo "   Justificativa: $JUSTIFICATIVA"
echo ""

# Fazer requisição para a API
curl -X DELETE "http://localhost:3000/api/nfse/cancelar-por-chave/$CHAVE_NFE" \
  -H "Content-Type: application/json" \
  -d "{
    \"justificativa\": \"$JUSTIFICATIVA\",
    \"ambiente\": \"$AMBIENTE\"
  }" \
  -w "\n\nStatus HTTP: %{http_code}\n"

echo ""

