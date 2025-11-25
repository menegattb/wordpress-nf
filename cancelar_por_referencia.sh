#!/bin/bash

# Script para cancelar nota fiscal por referência
# Uso: ./cancelar_por_referencia.sh <referencia> <justificativa> [ambiente]

REFERENCIA="${1}"
JUSTIFICATIVA="${2}"
AMBIENTE="${3:-producao}"  # Padrão: produção

if [ -z "$REFERENCIA" ] || [ -z "$JUSTIFICATIVA" ]; then
    echo "❌ Erro: Parâmetros obrigatórios não fornecidos"
    echo ""
    echo "Uso: $0 <referencia> <justificativa> [ambiente]"
    echo ""
    echo "Exemplo:"
    echo "  $0 PED-123 \"Nota emitida por engano\" producao"
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
echo "   Referência: $REFERENCIA"
echo "   Ambiente: $AMBIENTE"
echo "   Justificativa: $JUSTIFICATIVA"
echo ""

# Fazer requisição para a API
curl -X DELETE "http://localhost:3000/api/nfse/cancelar/$REFERENCIA" \
  -H "Content-Type: application/json" \
  -d "{
    \"tipo_nota\": \"nfe\",
    \"justificativa\": \"$JUSTIFICATIVA\",
    \"ambiente\": \"$AMBIENTE\"
  }" \
  -w "\n\nStatus HTTP: %{http_code}\n"

echo ""

