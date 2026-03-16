#!/usr/bin/env node

require('dotenv').config();
const inquirer = require('inquirer');
const chalk = require('chalk');
const { table } = require('table');
const logger = require('./src/services/logger');
const { listarPedidos, listarNFSe, buscarPedidoPorId, buscarPedidoPorPedidoId } = require('./src/config/database');
const { emitirNFSe, consultarNFSe } = require('./src/services/focusNFSe');
const { buscarPedidos: buscarPedidosWooCommerce, buscarPedidoPorId: buscarPedidoWooCommercePorId } = require('./src/services/woocommerce');
const { mapearWooCommerceParaPedido } = require('./src/utils/mapeador');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// Estado global da CLI
let ambienteAtual = process.env.FOCUS_NFE_AMBIENTE || 'homologacao';
let tipoNota = 'nfse'; // 'nfse' ou 'nfe'

/**
 * Salva ambiente no .env
 */
function salvarAmbiente(ambiente) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Atualizar ou adicionar FOCUS_NFE_AMBIENTE
  if (envContent.includes('FOCUS_NFE_AMBIENTE=')) {
    envContent = envContent.replace(
      /FOCUS_NFE_AMBIENTE=.*/,
      `FOCUS_NFE_AMBIENTE=${ambiente}`
    );
  } else {
    envContent += `\nFOCUS_NFE_AMBIENTE=${ambiente}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  process.env.FOCUS_NFE_AMBIENTE = ambiente;
  ambienteAtual = ambiente;
}

/**
 * Menu principal
 */
async function menuPrincipal() {
  console.clear();
  console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║   WordPress NF - Gestão de Notas Fiscais       ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.gray(`Ambiente: ${chalk.yellow(ambienteAtual.toUpperCase())}`));
  console.log(chalk.gray(`Tipo de nota: ${chalk.yellow(tipoNota.toUpperCase())}\n`));
  
  const { acao } = await inquirer.prompt([
    {
      type: 'list',
      name: 'acao',
      message: 'O que deseja fazer?',
      choices: [
        { name: '1. Configurar Ambiente (Homologação/Produção)', value: 'ambiente' },
        { name: '2. Rastrear Nota de Serviço ou Produto', value: 'tipo' },
        { name: '3. Pedidos WooCommerce', value: 'mostrar' },
        { name: '4. Enviar para Focus NFe', value: 'enviar' },
        { name: '5. Verificar Status', value: 'status' },
        { name: '6. Testar Conexão (Dados Reais + Endereço Falso)', value: 'testar' },
        { name: '7. Sair', value: 'sair' }
      ]
    }
  ]);
  
  return acao;
}

/**
 * Salva token no .env
 */
function salvarToken(ambiente, token) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  const varName = ambiente === 'producao' 
    ? 'FOCUS_NFE_TOKEN_PRODUCAO' 
    : 'FOCUS_NFE_TOKEN_HOMOLOGACAO';
  
  // Atualizar ou adicionar token
  if (envContent.includes(`${varName}=`)) {
    envContent = envContent.replace(
      new RegExp(`${varName}=.*`),
      `${varName}=${token}`
    );
  } else {
    envContent += `\n${varName}=${token}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  
  // Atualizar process.env
  process.env[varName] = token;
  
  logger.info(`Token ${ambiente} atualizado`, {
    service: 'cli',
    action: 'salvar_token',
    ambiente
  });
}

/**
 * Configurar ambiente - Mostra token e permite alterar
 */
async function configurarAmbiente() {
  console.clear();
  console.log(chalk.blue.bold('\n═══════════ Configuração de Ambiente ═══════════\n'));
  
  // Obter token atual
  const ambiente = process.env.FOCUS_NFE_AMBIENTE || ambienteAtual || 'homologacao';
  const tokenAtual = ambiente === 'producao'
    ? (process.env.FOCUS_NFE_TOKEN_PRODUCAO || config.focusNFe.token || '')
    : (process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '');
  
  // Mostrar configuração atual
  console.log(chalk.gray(`Ambiente atual: ${chalk.yellow(ambiente.toUpperCase())}`));
  console.log(chalk.gray(`Token atual: ${chalk.yellow(tokenAtual ? tokenAtual.substring(0, 10) + '...' : 'NÃO CONFIGURADO')}\n`));
  
  const { acao } = await inquirer.prompt([
    {
      type: 'list',
      name: 'acao',
      message: 'O que deseja fazer?',
      choices: [
        { name: 'Alterar ambiente (Homologação/Produção)', value: 'ambiente' },
        { name: 'Alterar token', value: 'token' },
        { name: 'Voltar', value: 'voltar' }
      ]
    }
  ]);
  
  if (acao === 'ambiente') {
    const { novoAmbiente } = await inquirer.prompt([
      {
        type: 'list',
        name: 'novoAmbiente',
        message: 'Modo homologação ou produção?',
        choices: [
          { name: 'Homologação (Testes)', value: 'homologacao' },
          { name: 'Produção (Real)', value: 'producao' }
        ],
        default: ambiente === 'producao' ? 'producao' : 'homologacao'
      }
    ]);
    
    salvarAmbiente(novoAmbiente);
    console.log(chalk.green(`\n✓ Ambiente configurado: ${novoAmbiente.toUpperCase()}\n`));
    await aguardarEnter();
    
  } else if (acao === 'token') {
    const { novoToken } = await inquirer.prompt([
      {
        type: 'input',
        name: 'novoToken',
        message: `Digite o novo token para ${ambiente.toUpperCase()}:`,
        default: tokenAtual,
        validate: input => input.trim() !== '' || 'Token é obrigatório'
      }
    ]);
    
    salvarToken(ambiente, novoToken.trim());
    console.log(chalk.green(`\n✓ Token atualizado!\n`));
    await aguardarEnter();
  }
}

/**
 * Selecionar tipo de nota
 */
async function selecionarTipoNota() {
  console.clear();
  console.log(chalk.blue.bold('\n═══════════ Tipo de Nota ═══════════\n'));
  
  const { tipo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tipo',
      message: 'Gostaria de rastrear nota de serviço ou produto?',
      choices: [
        { name: 'Nota de Serviço (NFSe)', value: 'nfse' },
        { name: 'Nota de Produto (NFe)', value: 'nfe' }
      ],
      default: tipoNota
    }
  ]);
  
  tipoNota = tipo;
  
  logger.info(`Tipo de nota selecionado: ${tipo.toUpperCase()}`, {
    service: 'cli',
    action: 'selecionar_tipo'
  });
  
  console.log(chalk.green(`\n✓ Tipo selecionado: ${tipo.toUpperCase()}\n`));
  await aguardarEnter();
}

/**
 * Agrupa notas por mês
 */
function agruparNotasPorMes(notas) {
  const grupos = {};
  
  notas.forEach(nota => {
    const data = new Date(nota.created_at);
    const mesAno = `${data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    
    if (!grupos[chave]) {
      grupos[chave] = {
        mesAno,
        notas: [],
        total: 0,
        autorizadas: 0,
        processando: 0,
        erros: 0
      };
    }
    
    grupos[chave].notas.push(nota);
    
    if (nota.status_focus === 'autorizado') {
      grupos[chave].autorizadas++;
    } else if (nota.status_focus === 'processando_autorizacao') {
      grupos[chave].processando++;
    } else if (nota.status_focus === 'erro_autorizacao') {
      grupos[chave].erros++;
    }
  });
  
  return grupos;
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
    grupos[chave].total += parseFloat(pedido.total || pedido.dados_pedido?.valor_total || 0);
  });
  
  return grupos;
}

/**
 * Mostrar notas / Rastrear pedidos do WooCommerce - Organizado por Mês
 */
async function mostrarNotas() {
  console.clear();
  console.log(chalk.blue.bold(`\n═══════════ Rastrear ${tipoNota.toUpperCase()} ═══════════\n`));
  
  try {
    // Perguntar de onde buscar
    const { origem } = await inquirer.prompt([
      {
        type: 'list',
        name: 'origem',
        message: 'De onde deseja buscar?',
        choices: [
          { name: 'WooCommerce (Buscar pedidos online)', value: 'woocommerce' },
          { name: 'Banco Local (Pedidos já processados)', value: 'local' }
        ]
      }
    ]);
    
    if (origem === 'woocommerce') {
      // Buscar pedidos do WooCommerce
      console.log(chalk.yellow('\n⏳ Buscando pedidos do WooCommerce...\n'));
      
      const { statusWC } = await inquirer.prompt([
        {
          type: 'list',
          name: 'statusWC',
          message: 'Filtrar pedidos por status?',
          choices: [
            { name: 'Todos os status', value: null },
            { name: 'Concluídos (completed)', value: 'completed' },
            { name: 'Processando (processing)', value: 'processing' },
            { name: 'Pendentes (pending)', value: 'pending' },
            { name: 'Em espera (on-hold)', value: 'on-hold' }
          ]
        }
      ]);
      
      logger.info('Buscando pedidos do WooCommerce via CLI', {
        service: 'cli',
        action: 'rastrear_woocommerce',
        status: statusWC
      });
      
      const resultado = await buscarPedidosWooCommerce({
        status: statusWC,
        per_page: 100, // Aumentar para pegar mais pedidos
        page: 1,
        orderby: 'date',
        order: 'desc'
      });
      
      if (!resultado.sucesso) {
        console.log(chalk.red(`\n✗ Erro ao buscar pedidos: ${resultado.erro}\n`));
        await aguardarEnter();
        return;
      }
      
      const pedidosWC = resultado.pedidos || [];
      
      if (pedidosWC.length === 0) {
        console.log(chalk.yellow('\nNenhum pedido encontrado no WooCommerce.\n'));
        await aguardarEnter();
        return;
      }
      
      // Agrupar por mês
      const grupos = agruparPedidosPorMes(pedidosWC);
      const mesesOrdenados = Object.keys(grupos).sort().reverse();
      
      console.log(chalk.green(`\n✓ Encontrados ${pedidosWC.length} pedido(s) em ${mesesOrdenados.length} mês(es)\n`));
      
      // Mostrar resumo por mês
      const dadosResumo = [
        ['Mês', 'Quantidade', 'Total']
      ];
      
      mesesOrdenados.forEach(chave => {
        const grupo = grupos[chave];
        dadosResumo.push([
          grupo.mesAno,
          grupo.quantidade.toString(),
          `R$ ${grupo.total.toFixed(2)}`
        ]);
      });
      
      console.log(chalk.cyan('📊 Resumo por Mês:\n'));
      console.log(table(dadosResumo));
      
      // Selecionar mês para ver detalhes
      const { mesSelecionado } = await inquirer.prompt([
        {
          type: 'list',
          name: 'mesSelecionado',
          message: 'Selecione um mês para ver detalhes:',
          choices: [
            ...mesesOrdenados.map(chave => ({
              name: `${grupos[chave].mesAno} (${grupos[chave].quantidade} pedidos)`,
              value: chave
            })),
            { name: 'Voltar', value: 'voltar' }
          ]
        }
      ]);
      
      if (mesSelecionado === 'voltar') {
        return;
      }
      
      // Mostrar pedidos do mês selecionado
      const pedidosMes = grupos[mesSelecionado].pedidos;
      const dadosTabela = [
        ['ID', 'Data', 'Cliente', 'Total', 'Status', 'NFSe']
      ];
      
      for (const pedidoWC of pedidosMes) {
        const cliente = pedidoWC.billing 
          ? `${pedidoWC.billing.first_name || ''} ${pedidoWC.billing.last_name || ''}`.trim() || pedidoWC.billing.company || 'N/A'
          : 'N/A';
        
        const data = new Date(pedidoWC.date_created).toLocaleDateString('pt-BR');
        const total = `R$ ${parseFloat(pedidoWC.total || 0).toFixed(2)}`;
        
        // Verificar se já tem NFSe no banco local
        const pedidoIdWC = pedidoWC.id?.toString() || pedidoWC.number?.toString();
        const pedidoLocal = await buscarPedidoPorPedidoId(pedidoIdWC);
        const temNFSe = pedidoLocal ? '✓' : '-';
        
        dadosTabela.push([
          pedidoWC.id?.toString() || pedidoWC.number?.toString(),
          data,
          cliente.substring(0, 30),
          total,
          pedidoWC.status || 'N/A',
          temNFSe
        ]);
      }
      
      console.log(chalk.cyan(`\n📋 Pedidos de ${grupos[mesSelecionado].mesAno}:\n`));
      console.log(table(dadosTabela));
      
      // Opções de ação
      const { acao } = await inquirer.prompt([
        {
          type: 'list',
          name: 'acao',
          message: 'O que deseja fazer?',
          choices: [
            { name: 'Ver detalhes de um pedido', value: 'detalhes' },
            { name: 'Emitir NFSe para um pedido', value: 'emitir' },
            { name: 'Voltar ao menu', value: 'voltar' }
          ]
        }
      ]);
      
      if (acao === 'detalhes') {
        const { id } = await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'Digite o ID do pedido:',
            validate: input => input.trim() !== '' || 'ID é obrigatório'
          }
        ]);
        
        const pedido = pedidosMes.find(p => 
          (p.id?.toString() === id) || (p.number?.toString() === id)
        );
        
        if (pedido) {
          console.log(chalk.blue('\n═══════════ Detalhes do Pedido ═══════════\n'));
          console.log(JSON.stringify(pedido, null, 2));
        } else {
          console.log(chalk.red('\nPedido não encontrado.\n'));
        }
        await aguardarEnter();
        
      } else if (acao === 'emitir') {
        const choices = pedidosMes.map(p => ({
          name: `Pedido #${p.id || p.number} - ${p.billing?.first_name || 'N/A'} - R$ ${parseFloat(p.total || 0).toFixed(2)}`,
          value: p.id?.toString() || p.number?.toString()
        }));
        
        const { pedidoId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'pedidoId',
            message: 'Selecione o pedido para emitir NFSe:',
            choices
          }
        ]);
        
        const pedidoSelecionado = pedidosMes.find(p => 
          (p.id?.toString() === pedidoId) || (p.number?.toString() === pedidoId)
        );
        
        if (pedidoSelecionado) {
          await processarPedidoWooCommerce(pedidoSelecionado);
        }
      }
      
    } else {
      // Buscar do banco local
      const { status } = await inquirer.prompt([
        {
          type: 'list',
          name: 'status',
          message: 'Filtrar por status?',
          choices: [
            { name: 'Todas', value: null },
            { name: 'Pendentes', value: 'pendente' },
            { name: 'Processando', value: 'processando' },
            { name: 'Emitidas', value: 'emitida' },
            { name: 'Erro', value: 'erro' }
          ]
        }
      ]);
      
      logger.info('Listando notas do banco local', {
        service: 'cli',
        action: 'mostrar_notas',
        tipo: tipoNota,
        status
      });
      
      if (tipoNota === 'nfse') {
        const notas = await listarNFSe({
          limite: 200, // Aumentar para pegar mais notas
          offset: 0,
          status_focus: status === 'processando' ? 'processando_autorizacao' : 
                        status === 'emitida' ? 'autorizado' :
                        status === 'erro' ? 'erro_autorizacao' : undefined
        });
        
        if (notas.length === 0) {
          console.log(chalk.yellow('\nNenhuma nota encontrada no banco local.\n'));
          await aguardarEnter();
          return;
        }
        
        // Agrupar por mês
        const grupos = agruparNotasPorMes(notas);
        const mesesOrdenados = Object.keys(grupos).sort().reverse();
        
        console.log(chalk.green(`\n✓ Encontradas ${notas.length} nota(s) em ${mesesOrdenados.length} mês(es)\n`));
        
        // Mostrar resumo por mês
        const dadosResumo = [
          ['Mês', 'Total', 'Autorizadas', 'Processando', 'Erros']
        ];
        
        mesesOrdenados.forEach(chave => {
          const grupo = grupos[chave];
          dadosResumo.push([
            grupo.mesAno,
            grupo.notas.length.toString(),
            grupo.autorizadas.toString(),
            grupo.processando.toString(),
            grupo.erros.toString()
          ]);
        });
        
        console.log(chalk.cyan('📊 Resumo por Mês:\n'));
        console.log(table(dadosResumo));
        
        // Selecionar mês para ver detalhes
        const { mesSelecionado } = await inquirer.prompt([
          {
            type: 'list',
            name: 'mesSelecionado',
            message: 'Selecione um mês para ver detalhes:',
            choices: [
              ...mesesOrdenados.map(chave => ({
                name: `${grupos[chave].mesAno} (${grupos[chave].notas.length} notas)`,
                value: chave
              })),
              { name: 'Voltar', value: 'voltar' }
            ]
          }
        ]);
        
        if (mesSelecionado === 'voltar') {
          return;
        }
        
        // Mostrar notas do mês selecionado
        const notasMes = grupos[mesSelecionado].notas;
        const dadosTabela = [
          ['ID', 'Referência', 'Pedido', 'Status', 'Chave NFSe', 'Data']
        ];
        
        notasMes.forEach(nota => {
          const chave = nota.chave_nfse 
            ? nota.chave_nfse.substring(0, 20) + '...'
            : '-';
          const data = new Date(nota.created_at).toLocaleString('pt-BR');
          const statusColor = nota.status_focus === 'autorizado' ? '✓' :
                             nota.status_focus === 'processando_autorizacao' ? '⏳' :
                             nota.status_focus === 'erro_autorizacao' ? '✗' : '?';
          
          dadosTabela.push([
            nota.id.toString(),
            nota.referencia,
            nota.pedido_externo || '-',
            `${statusColor} ${nota.status_focus || '-'}`,
            chave,
            data
          ]);
        });
        
        console.log(chalk.cyan(`\n📋 Notas de ${grupos[mesSelecionado].mesAno}:\n`));
        console.log(table(dadosTabela));
        
        const { verDetalhes } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'verDetalhes',
            message: 'Deseja ver detalhes de alguma nota?',
            default: false
          }
        ]);
        
        if (verDetalhes) {
          const { id } = await inquirer.prompt([
            {
              type: 'input',
              name: 'id',
              message: 'Digite o ID da nota:',
              validate: input => !isNaN(input) || 'ID deve ser um número'
            }
          ]);
          
          const nota = notasMes.find(n => n.id === parseInt(id));
          if (nota) {
            console.log(chalk.blue('\n═══════════ Detalhes da Nota ═══════════\n'));
            console.log(JSON.stringify(nota, null, 2));
          } else {
            console.log(chalk.red('\nNota não encontrada.\n'));
          }
          await aguardarEnter();
        }
      } else {
        const pedidos = await listarPedidos({
          limite: 50,
          offset: 0,
          status
        });
        
        if (pedidos.length === 0) {
          console.log(chalk.yellow('\nNenhum pedido encontrado.\n'));
          await aguardarEnter();
          return;
        }
        
        console.log(chalk.yellow('\nNFe ainda não implementado. Use NFSe.\n'));
        await aguardarEnter();
      }
    }
    
  } catch (error) {
    logger.error('Erro ao rastrear notas', {
      service: 'cli',
      action: 'mostrar_notas',
      error: error.message
    });
    
    console.log(chalk.red(`\nErro: ${error.message}\n`));
    await aguardarEnter();
  }
}

/**
 * Processa um pedido do WooCommerce para emitir NFSe
 */
async function processarPedidoWooCommerce(pedidoWC) {
  try {
    console.log(chalk.yellow('\n⏳ Processando pedido do WooCommerce...\n'));
    
    // Mapear pedido WooCommerce para formato interno
    const dadosPedido = mapearWooCommerceParaPedido(pedidoWC);
    
    // Verificar se já existe no banco local
    const pedidoExistente = await buscarPedidoPorPedidoId(dadosPedido.pedido_id);
    if (pedidoExistente) {
      console.log(chalk.yellow(`\n⚠ Pedido ${dadosPedido.pedido_id} já existe no banco local.`));
      console.log(chalk.gray(`Status: ${pedidoExistente.status}\n`));
      
      const { continuar } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continuar',
          message: 'Deseja processar novamente?',
          default: false
        }
      ]);
      
      if (!continuar) {
        return;
      }
      
      dadosPedido.pedido_id_db = pedidoExistente.id;
    } else {
      // Salvar pedido no banco local
      const { salvarPedido } = require('./src/config/database');
      const pedidoSalvo = await salvarPedido({
        pedido_id: dadosPedido.pedido_id,
        origem: 'woocommerce',
        dados_pedido: dadosPedido,
        status: 'pendente'
      });
      
      dadosPedido.pedido_id_db = pedidoSalvo.id;
    }
    
    // Mostrar preview
    console.log(chalk.blue('\n═══════════ Preview do Pedido ═══════════\n'));
    console.log(chalk.gray(`Pedido: ${dadosPedido.pedido_id}`));
    console.log(chalk.gray(`Cliente: ${dadosPedido.nome}`));
    console.log(chalk.gray(`CPF/CNPJ: ${dadosPedido.cpf_cnpj || 'N/A'}`));
    console.log(chalk.gray(`Total: R$ ${dadosPedido.valor_total.toFixed(2)}`));
    console.log(chalk.gray(`Serviços: ${dadosPedido.servicos?.length || 0}`));
    
    const { confirmar } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmar',
        message: 'Deseja emitir NFSe para este pedido?',
        default: true
      }
    ]);
    
    if (!confirmar) {
      console.log(chalk.yellow('\nEmissão cancelada.\n'));
      await aguardarEnter();
      return;
    }
    
    // Emitir NFSe
    console.log(chalk.yellow('\n⏳ Enviando para Focus NFe...\n'));
    
    logger.info('Emitindo NFSe para pedido WooCommerce via CLI', {
      service: 'cli',
      action: 'emitir_woocommerce',
      pedido_id: dadosPedido.pedido_id
    });
    
    const resultado = await emitirNFSe(dadosPedido, config.emitente, config.fiscal);
    
    if (resultado.sucesso) {
      console.log(chalk.green('\n✓ NFSe enviada com sucesso!'));
      console.log(chalk.gray(`\nReferência: ${resultado.referencia}`));
      console.log(chalk.gray(`Status: ${resultado.status}`));
      
      if (resultado.status === 'processando_autorizacao') {
        console.log(chalk.yellow('\n⏳ Status: verificando...'));
      } else if (resultado.status === 'autorizado') {
        console.log(chalk.green(`\n✓ NFSe autorizada!`));
        if (resultado.chave_nfse) {
          console.log(chalk.gray(`Chave: ${resultado.chave_nfse}`));
        }
      }
      
      logger.info('NFSe emitida com sucesso via CLI', {
        service: 'cli',
        action: 'emitir_woocommerce',
        pedido_id: dadosPedido.pedido_id,
        referencia: resultado.referencia,
        status: resultado.status
      });
    } else {
      console.log(chalk.red('\n✗ Erro ao emitir NFSe:'));
      console.log(chalk.red(JSON.stringify(resultado.erro, null, 2)));
      
      logger.error('Erro ao emitir NFSe via CLI', {
        service: 'cli',
        action: 'emitir_woocommerce',
        pedido_id: dadosPedido.pedido_id,
        erro: resultado.erro
      });
    }
    
    await aguardarEnter();
    
  } catch (error) {
    logger.error('Erro ao processar pedido WooCommerce', {
      service: 'cli',
      action: 'processar_pedido_woocommerce',
      error: error.message
    });
    
    console.log(chalk.red(`\nErro: ${error.message}\n`));
    await aguardarEnter();
  }
}

/**
 * Enviar para Focus NFe
 */
async function enviarParaFocus() {
  console.clear();
  console.log(chalk.blue.bold('\n═══════════ Enviar para Focus NFe ═══════════\n'));
  
  try {
    // Buscar pedidos pendentes
    const pedidos = await listarPedidos({
      limite: 50,
      offset: 0,
      status: 'pendente'
    });
    
    if (pedidos.length === 0) {
      console.log(chalk.yellow('\nNenhum pedido pendente encontrado.\n'));
      await aguardarEnter();
      return;
    }
    
    // Selecionar pedido
    const choices = pedidos.map(p => ({
      name: `Pedido ${p.pedido_id} - ${p.dados_pedido?.nome || 'N/A'} - R$ ${p.dados_pedido?.valor_total || 0}`,
      value: p.id
    }));
    
    const { pedidoId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'pedidoId',
        message: 'Selecione o pedido para enviar:',
        choices
      }
    ]);
    
    const pedido = await buscarPedidoPorId(pedidoId);
    
    // Mostrar preview
    console.log(chalk.blue('\n═══════════ Preview dos Dados ═══════════\n'));
    console.log(JSON.stringify(pedido.dados_pedido, null, 2));
    
    const { confirmar } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmar',
        message: 'Deseja enviar este pedido para Focus NFe?',
        default: true
      }
    ]);
    
    if (!confirmar) {
      console.log(chalk.yellow('\nEnvio cancelado.\n'));
      await aguardarEnter();
      return;
    }
    
    // Enviar
    console.log(chalk.yellow('\n⏳ Enviando...'));
    
    logger.info('Enviando pedido para Focus NFe via CLI', {
      service: 'cli',
      action: 'enviar_focus',
      pedido_id: pedido.pedido_id
    });
    
    const dadosPedido = {
      ...pedido.dados_pedido,
      pedido_id_db: pedido.id
    };
    
    const resultado = await emitirNFSe(dadosPedido, config.emitente);
    
    if (resultado.sucesso) {
      console.log(chalk.green('\n✓ Enviado com sucesso!'));
      console.log(chalk.gray(`\nReferência: ${resultado.referencia}`));
      console.log(chalk.gray(`Status: ${resultado.status}`));
      
      if (resultado.status === 'processando_autorizacao') {
        console.log(chalk.yellow('\n⏳ Status: verificando...'));
      }
      
      logger.info('Pedido enviado com sucesso via CLI', {
        service: 'cli',
        action: 'enviar_focus',
        pedido_id: pedido.pedido_id,
        referencia: resultado.referencia,
        status: resultado.status
      });
    } else {
      console.log(chalk.red('\n✗ Erro ao enviar:'));
      console.log(chalk.red(JSON.stringify(resultado.erro, null, 2)));
      
      logger.error('Erro ao enviar pedido via CLI', {
        service: 'cli',
        action: 'enviar_focus',
        pedido_id: pedido.pedido_id,
        erro: resultado.erro
      });
    }
    
    await aguardarEnter();
    
  } catch (error) {
    logger.error('Erro ao enviar para Focus NFe', {
      service: 'cli',
      action: 'enviar_focus',
      error: error.message
    });
    
    console.log(chalk.red(`\nErro: ${error.message}\n`));
    await aguardarEnter();
  }
}

/**
 * Verificar status
 */
async function verificarStatus() {
  console.clear();
  console.log(chalk.blue.bold('\n═══════════ Verificar Status ═══════════\n'));
  
  try {
    // Buscar notas em processamento
    const notas = await listarNFSe({
      limite: 50,
      offset: 0,
      status_focus: 'processando_autorizacao'
    });
    
    if (notas.length === 0) {
      console.log(chalk.yellow('\nNenhuma nota em processamento.\n'));
      await aguardarEnter();
      return;
    }
    
    console.log(chalk.yellow(`\nEncontradas ${notas.length} nota(s) em processamento.\n`));
    
    for (const nota of notas) {
      console.log(chalk.gray(`\n⏳ Consultando: ${nota.referencia}...`));
      
      logger.info('Verificando status via CLI', {
        service: 'cli',
        action: 'verificar_status',
        referencia: nota.referencia
      });
      
      const resultado = await consultarNFSe(nota.referencia);
      
      if (resultado.sucesso) {
        const statusColor = resultado.status === 'autorizado' ? chalk.green('✓ AUTORIZADO') :
                           resultado.status === 'processando_autorizacao' ? chalk.yellow('⏳ PROCESSANDO') :
                           resultado.status === 'erro_autorizacao' ? chalk.red('✗ ERRO') :
                           chalk.gray(resultado.status);
        
        console.log(chalk.gray(`   Status: ${statusColor}`));
        
        if (resultado.chave_nfse) {
          console.log(chalk.gray(`   Chave: ${resultado.chave_nfse.substring(0, 20)}...`));
        }
        
        if (resultado.mensagem_sefaz) {
          console.log(chalk.gray(`   Mensagem: ${resultado.mensagem_sefaz}`));
        }
      } else {
        console.log(chalk.red(`   ✗ Erro: ${resultado.mensagem || resultado.erro}`));
      }
    }
    
    console.log(chalk.green('\n\n✓ Verificação concluída!\n'));
    await aguardarEnter();
    
  } catch (error) {
    logger.error('Erro ao verificar status', {
      service: 'cli',
      action: 'verificar_status',
      error: error.message
    });
    
    console.log(chalk.red(`\nErro: ${error.message}\n`));
    await aguardarEnter();
  }
}

/**
 * Testar Conexão com dados reais de CPF/nome mas endereço falso
 */
async function testarConexao() {
  console.clear();
  console.log(chalk.blue.bold('\n═══════════ Testar Conexão Focus NFe ═══════════\n'));
  console.log(chalk.yellow(`Este teste usa dados reais de CPF/nome com endereço falso para debugar erros.\n`));
  console.log(chalk.gray(`Tipo de nota: ${chalk.yellow(tipoNota.toUpperCase())}\n`));
  
  try {
    // Importar serviço correto baseado no tipo
    const { emitirNFe } = require('./src/services/focusNFe');
    const { emitirNFSe } = require('./src/services/focusNFSe');
    
    // Dados de teste reais (padrão)
    const dadosTeste = {
      pedido_id: `TEST-${Date.now()}`,
      data_pedido: new Date().toISOString(),
      data_emissao: new Date().toISOString().split('T')[0],
      
      // Dados reais do cliente
      nome: 'Bruno Henrique',
      razao_social: 'Bruno Henrique',
      cpf_cnpj: '09762992911',
      email: 'teste@exemplo.com',
      telefone: '11999999999',
      
      // Endereço (CEP válido)
      endereco: {
        rua: 'rua caminho do meio, 2600',
        numero: '2600',
        complemento: 'Apto 45',
        bairro: 'cocao',
        cidade: 'viamão',
        estado: 'RS',
        cep: '94515000',
        pais: 'Brasil'
      },
      
      // Serviços/Produtos de teste
      servicos: tipoNota === 'nfe' ? [
        {
          nome: 'Produto de Teste',
          codigo: 'PROD001',
          quantidade: 1,
          valor_unitario: 100.00,
          total: 100.00,
          meta_data: [
            { key: 'ncm', value: '49019900' },
            { key: 'cfop', value: '5102' }
          ]
        }
      ] : [
        {
          nome: 'Serviço de Teste',
          codigo: 'TEST001',
          quantidade: 1,
          valor_unitario: 100.00,
          total: 100.00,
          ncm: null,
          cfop: null,
          cst: null,
          item_lista_servico: '70101',
          codigo_tributario_municipio: '101',
          discriminacao: 'Serviço de Teste para Debug'
        }
      ],
      
      valor_total: 100.00,
      valor_servicos: tipoNota === 'servico' ? 100.00 : undefined,
      frete: 0,
      valor_desconto: 0,
      metodo_pagamento: 'teste'
    };
    
    // Perguntar se quer usar dados customizados
    const { usarCustom } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'usarCustom',
        message: 'Deseja usar dados customizados? (CPF, nome, etc)',
        default: false
      }
    ]);
    
    if (usarCustom) {
      const custom = await inquirer.prompt([
        {
          type: 'input',
          name: 'nome',
          message: 'Nome do cliente:',
          default: dadosTeste.nome
        },
        {
          type: 'input',
          name: 'cpf',
          message: 'CPF (apenas números):',
          default: dadosTeste.cpf_cnpj,
          validate: input => {
            const cpf = input.replace(/\D/g, '');
            return cpf.length === 11 || 'CPF deve ter 11 dígitos';
          }
        },
        {
          type: 'input',
          name: 'cep',
          message: 'CEP (apenas números):',
          default: dadosTeste.endereco.cep,
          validate: input => {
            const cep = input.replace(/\D/g, '');
            return cep.length === 8 || 'CEP deve ter 8 dígitos';
          }
        },
        {
          type: 'input',
          name: 'rua',
          message: 'Rua:',
          default: dadosTeste.endereco.rua
        },
        {
          type: 'input',
          name: 'numero',
          message: 'Número:',
          default: dadosTeste.endereco.numero
        },
        {
          type: 'input',
          name: 'bairro',
          message: 'Bairro:',
          default: dadosTeste.endereco.bairro
        },
        {
          type: 'input',
          name: 'cidade',
          message: 'Cidade:',
          default: dadosTeste.endereco.cidade
        },
        {
          type: 'input',
          name: 'estado',
          message: 'Estado (UF):',
          default: dadosTeste.endereco.estado,
          validate: input => input.length === 2 || 'UF deve ter 2 letras'
        },
        {
          type: 'input',
          name: 'valor',
          message: 'Valor do serviço:',
          default: '250.00',
          validate: input => !isNaN(parseFloat(input)) || 'Valor deve ser um número'
        }
      ]);
      
      dadosTeste.nome = custom.nome;
      dadosTeste.razao_social = custom.nome;
      dadosTeste.cpf_cnpj = custom.cpf.replace(/\D/g, '');
      dadosTeste.endereco.cep = custom.cep.replace(/\D/g, '');
      dadosTeste.endereco.rua = custom.rua;
      dadosTeste.endereco.numero = custom.numero;
      dadosTeste.endereco.bairro = custom.bairro;
      dadosTeste.endereco.cidade = custom.cidade;
      dadosTeste.endereco.estado = custom.estado.toUpperCase();
      dadosTeste.servicos[0].valor_unitario = parseFloat(custom.valor);
      dadosTeste.servicos[0].valor_total = parseFloat(custom.valor);
      dadosTeste.valor_total = parseFloat(custom.valor);
    } else {
      // Usar dados padrão (já configurados acima)
    }
    
    // Mostrar preview completo
    console.log(chalk.blue('\n═══════════ Preview dos Dados de Teste ═══════════\n'));
    console.log(chalk.gray(JSON.stringify(dadosTeste, null, 2)));
    
    // Mostrar configuração atual
    console.log(chalk.blue('\n═══════════ Configuração Atual ═══════════\n'));
    console.log(chalk.gray(`Ambiente: ${chalk.yellow(ambienteAtual)}`));
    console.log(chalk.gray(`Tipo de Nota: ${chalk.yellow(tipoNota.toUpperCase())}`));
    console.log(chalk.gray(`CNPJ Emitente: ${chalk.yellow(config.emitente.cnpj)}`));
    console.log(chalk.gray(`Razão Social: ${chalk.yellow(config.emitente.razao_social)}`));
    
    if (tipoNota === 'nfse') {
      console.log(chalk.gray(`IM: ${chalk.yellow(config.emitente.inscricao_municipal || 'N/A')}`));
    console.log(chalk.gray(`Município: ${chalk.yellow(config.emitente.codigo_municipio)}`));
    console.log(chalk.gray(`Item Lista Serviço: ${chalk.yellow(config.fiscal.item_lista_servico)}`));
    console.log(chalk.gray(`Código Tributário: ${chalk.yellow(config.fiscal.codigo_tributario_municipio)}`));
    console.log(chalk.gray(`Alíquota: ${chalk.yellow(config.fiscal.aliquota)}%`));
    } else {
      console.log(chalk.gray(`Inscrição Estadual: ${chalk.yellow(config.emitente.inscricao_estadual || 'N/A')}`));
      console.log(chalk.gray(`CFOP Padrão: ${chalk.yellow(config.fiscal.cfop_padrao)}`));
      console.log(chalk.gray(`NCM Padrão: ${chalk.yellow(config.fiscal.ncm_padrao)}`));
    }
    
    const { confirmar } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmar',
        message: `\nDeseja enviar ${tipoNota.toUpperCase()} para Focus NFe? (todos os logs serão exibidos)`,
        default: true
      }
    ]);
    
    if (!confirmar) {
      console.log(chalk.yellow('\nTeste cancelado.\n'));
      await aguardarEnter();
      return;
    }
    
    // Enviar com logs detalhados
    console.log(chalk.yellow(`\n═══════════ Enviando ${tipoNota.toUpperCase()} para Focus NFe ═══════════\n`));
    console.log(chalk.gray('Aguarde... Logs detalhados serão exibidos abaixo.\n'));
    
    logger.info('Iniciando teste de conexão', {
      service: 'cli',
      action: 'testar_conexao',
      tipo_nota: tipoNota,
      pedido_id: dadosTeste.pedido_id,
      dados: dadosTeste
    });
    
    // Mostrar dados que serão enviados
    console.log(chalk.cyan(`\n📤 Dados que serão enviados (${tipoNota.toUpperCase()}):\n`));
    
    // Chamar função correta baseada no tipo
    let resultado;
    if (tipoNota === 'nfe') {
      resultado = await emitirNFe(dadosTeste, config.emitente, config.fiscal);
    } else {
      resultado = await emitirNFSe(dadosTeste, config.emitente, config.fiscal);
    }
    
    // Mostrar resultado completo
    console.log(chalk.blue('\n═══════════ Resultado da Requisição ═══════════\n'));
    
    if (resultado.sucesso) {
      console.log(chalk.green('✓ Requisição enviada com sucesso!\n'));
      console.log(chalk.gray(`Referência: ${chalk.yellow(resultado.referencia)}`));
      console.log(chalk.gray(`Status: ${chalk.yellow(resultado.status)}`));
      
      if (tipoNota === 'nfe') {
        if (resultado.chave_nfe) {
          console.log(chalk.gray(`Chave NFe: ${chalk.yellow(resultado.chave_nfe)}`));
        }
        if (resultado.caminho_xml_nota_fiscal) {
          console.log(chalk.gray(`XML: ${chalk.yellow(resultado.caminho_xml_nota_fiscal)}`));
        }
        if (resultado.caminho_danfe) {
          console.log(chalk.gray(`DANFe: ${chalk.yellow(resultado.caminho_danfe)}`));
        }
      } else {
      if (resultado.chave_nfse) {
        console.log(chalk.gray(`Chave NFSe: ${chalk.yellow(resultado.chave_nfse)}`));
      }
      if (resultado.caminho_xml) {
        console.log(chalk.gray(`XML: ${chalk.yellow(resultado.caminho_xml)}`));
      }
      if (resultado.caminho_pdf) {
        console.log(chalk.gray(`PDF: ${chalk.yellow(resultado.caminho_pdf)}`));
        }
      }
      
      if (resultado.dados) {
        console.log(chalk.cyan('\n📋 Resposta Completa da API:\n'));
        console.log(JSON.stringify(resultado.dados, null, 2));
      }
      
    } else {
      console.log(chalk.red('✗ Erro na requisição!\n'));
      
      if (resultado.erro) {
        console.log(chalk.red('Erro retornado:'));
        console.log(chalk.red(JSON.stringify(resultado.erro, null, 2)));
      }
      
      if (resultado.mensagem_sefaz) {
        console.log(chalk.yellow('\nMensagem SEFAZ:'));
        console.log(chalk.yellow(resultado.mensagem_sefaz));
      }
      
      if (resultado.codigo_erro) {
        console.log(chalk.yellow(`\nCódigo do Erro: ${resultado.codigo_erro}`));
      }
      
      if (resultado.dados_completos) {
        console.log(chalk.cyan('\n📋 Resposta Completa da API (para debug):\n'));
        console.log(JSON.stringify(resultado.dados_completos, null, 2));
      }
    }
    
    console.log(chalk.blue('\n═══════════ Fim do Teste ═══════════\n'));
    
    logger.info('Teste de conexão concluído', {
      service: 'cli',
      action: 'testar_conexao',
      tipo_nota: tipoNota,
      pedido_id: dadosTeste.pedido_id,
      sucesso: resultado.sucesso,
      status: resultado.status,
      erro: resultado.erro
    });
    
    await aguardarEnter();
    
  } catch (error) {
    logger.error('Erro ao testar conexão', {
      service: 'cli',
      action: 'testar_conexao',
      tipo_nota: tipoNota,
      error: error.message,
      stack: error.stack
    });
    
    console.log(chalk.red(`\n✗ Erro inesperado: ${error.message}\n`));
    console.log(chalk.red(`Stack trace:\n${error.stack}\n`));
    await aguardarEnter();
  }
}

/**
 * Aguardar Enter
 */
async function aguardarEnter() {
  return new Promise(resolve => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(chalk.gray('\nPressione Enter para continuar...'), () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Loop principal
 */
async function main() {
  try {
    while (true) {
      const acao = await menuPrincipal();
      
      switch (acao) {
        case 'ambiente':
          await configurarAmbiente();
          break;
        case 'tipo':
          await selecionarTipoNota();
          break;
        case 'mostrar':
          await mostrarNotas();
          break;
        case 'enviar':
          await enviarParaFocus();
          break;
        case 'status':
          await verificarStatus();
          break;
        case 'testar':
          await testarConexao();
          break;
        case 'sair':
          console.log(chalk.blue('\nAté logo!\n'));
          process.exit(0);
      }
    }
  } catch (error) {
    if (error.isTtyError) {
      console.log(chalk.red('\nErro: Esta aplicação precisa ser executada em um terminal.\n'));
    } else {
      console.log(chalk.red(`\nErro: ${error.message}\n`));
      logger.error('Erro na CLI', {
        service: 'cli',
        error: error.message,
        stack: error.stack
      });
    }
    process.exit(1);
  }
}

// Executar
main();

