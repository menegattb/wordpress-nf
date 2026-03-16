#!/usr/bin/env node

/**
 * Script para gerar hash de senha
 * Uso: node scripts/generate-password-hash.js [senha]
 */

const { hashPassword } = require('../src/utils/password');
const readline = require('readline');

async function gerarHash(senha) {
  if (!senha) {
    // Se não forneceu senha como argumento, pedir via stdin
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('Digite a senha para gerar o hash: ', async (senhaInput) => {
        rl.close();
        const hash = await hashPassword(senhaInput);
        resolve({ senha: senhaInput, hash });
      });
    });
  }
  
  const hash = await hashPassword(senha);
  return { senha, hash };
}

async function main() {
  const senha = process.argv[2];
  
  try {
    const { senha: senhaUsada, hash } = await gerarHash(senha);
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('Hash gerado com sucesso!');
    console.log('═══════════════════════════════════════════════\n');
    console.log('Adicione ao seu arquivo .env:');
    console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
    console.log('Ou use diretamente:');
    console.log(`export ADMIN_PASSWORD_HASH="${hash}"\n`);
    console.log('═══════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Erro ao gerar hash:', error.message);
    process.exit(1);
  }
}

main();

