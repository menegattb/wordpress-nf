# Como Configurar Autenticação na Vercel

## Problema

Se você está recebendo o erro "Configuração de autenticação não encontrada", significa que as variáveis de ambiente não estão configuradas na Vercel.

## Solução

### 1. Gerar o Hash da Senha

Localmente, execute:

```bash
npm run generate-password-hash
```

Ou diretamente:

```bash
node scripts/generate-password-hash.js
```

Digite a senha: `#Notasmeditandojunto108`

Você receberá um hash como:
```
$2b$10$UphQr84P.b01IhN40FL7s.6BjITKoT8EfYGHOnZyAMy2IPxiZU53W
```

### 2. Configurar na Vercel

1. Acesse o [Painel da Vercel](https://vercel.com/dashboard)
2. Vá para seu projeto
3. Clique em **Settings** → **Environment Variables**
4. Adicione as seguintes variáveis:

#### Variáveis Obrigatórias:

**ADMIN_USERNAME**
```
admin
```

**ADMIN_PASSWORD_HASH**
```
$2b$10$UphQr84P.b01IhN40FL7s.6BjITKoT8EfYGHOnZyAMy2IPxiZU53W
```
*(Use o hash gerado pelo script acima)*

**SESSION_SECRET**
```
sua-chave-secreta-aleatoria-forte-aqui
```
*(Gere uma chave aleatória forte - pode usar: `openssl rand -base64 32`)*

### 3. Aplicar Mudanças

Após adicionar as variáveis:
1. Selecione os ambientes onde aplicar (Production, Preview, Development)
2. Clique em **Save**
3. Faça um novo deploy ou aguarde o próximo deploy automático

### 4. Verificar

Após o deploy, acesse sua aplicação e tente fazer login:
- Usuário: `admin`
- Senha: `#Notasmeditandojunto108`

## Variáveis de Ambiente Necessárias

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$UphQr84P.b01IhN40FL7s.6BjITKoT8EfYGHOnZyAMy2IPxiZU53W
SESSION_SECRET=sua-chave-secreta-aleatoria-forte
```

## Gerar SESSION_SECRET Seguro

No terminal:

```bash
openssl rand -base64 32
```

Ou use um gerador online de chaves aleatórias.

## Troubleshooting

### Erro: "Configuração de autenticação não encontrada"
- Verifique se `ADMIN_PASSWORD_HASH` está configurado na Vercel
- Verifique se fez deploy após adicionar as variáveis
- Verifique se selecionou o ambiente correto (Production)

### Erro: "Configuração de autenticação inválida"
- Verifique se o hash está completo (deve começar com `$2b$10$`)
- Gere um novo hash e atualize na Vercel

### Login não funciona
- Verifique se o usuário está correto: `admin`
- Verifique se a senha está correta: `#Notasmeditandojunto108`
- Verifique os logs da Vercel para mais detalhes

## Importante

- ⚠️ **NUNCA** commite o hash da senha no Git
- ⚠️ Use uma `SESSION_SECRET` diferente para cada ambiente
- ⚠️ Rotacione as credenciais periodicamente
- ✅ Mantenha o `.env` local atualizado para desenvolvimento

