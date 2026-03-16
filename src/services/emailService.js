/**
 * Serviço de envio de email (Resend)
 * Configure RESEND_API_KEY e EMAIL_FROM no .env
 */

const logger = require('./logger');

let resend = null;

function getResend() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return null;
    }
    const { Resend } = require('resend');
    resend = new Resend(apiKey);
  }
  return resend;
}

/**
 * Envia email com token de acesso ao novo assinante
 */
async function enviarToken(email, token, nome, siteUrl) {
  const client = getResend();
  if (!client) {
    logger.warn('RESEND_API_KEY não configurado - email não enviado');
    return false;
  }

  const from = process.env.EMAIL_FROM || 'NF Notas <onboarding@resend.dev>';
  const appUrl = process.env.APP_URL || 'https://app.example.com';

  const html = `
    <h1>Bem-vindo ao NF Notas!</h1>
    <p>Olá${nome ? ` ${nome}` : ''},</p>
    <p>Sua assinatura foi confirmada. Use o token abaixo para configurar o plugin no seu WordPress:</p>
    <p><strong style="font-family: monospace; font-size: 14px; word-break: break-all;">${token}</strong></p>
    <p><strong>Instruções:</strong></p>
    <ol>
      <li>Instale o plugin NF Notas no seu WordPress</li>
      <li>Acesse NF Notas > Token API</li>
      <li>Cole o token acima e salve</li>
      <li>Configure o Focus NFe em NF Notas > Config Focus</li>
    </ol>
    <p><a href="${appUrl}">Acessar painel</a></p>
    <p>Guarde este token em local seguro. Ele não será exibido novamente.</p>
  `;

  try {
    const { data, error } = await client.emails.send({
      from,
      to: [email],
      subject: 'Seu token de acesso - NF Notas',
      html
    });

    if (error) {
      logger.error('Erro ao enviar email', { error: error.message, email });
      return false;
    }

    logger.info('Email com token enviado', { email, id: data?.id });
    return true;
  } catch (err) {
    logger.error('Erro ao enviar email', { error: err.message, email });
    return false;
  }
}

module.exports = {
  enviarToken
};
