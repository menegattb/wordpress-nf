<?php
if (!defined('ABSPATH')) exit;
$api = new NF_Notas_Api_Client();
$config = $api->get('api/config/emitente');
$dados = isset($config['dados']) ? $config['dados'] : (isset($config['sucesso']) && $config['sucesso'] ? array() : array());
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('Configuração Emitente', 'nf-notas'); ?></h1>

    <?php if (isset($config['erro'])): ?>
    <div class="notice notice-error"><p><?php echo esc_html($config['erro']); ?></p></div>
    <?php endif; ?>

    <div class="content-section">
        <p><?php esc_html_e('Os dados do emitente são configurados na API. Esta página exibe os valores atuais.', 'nf-notas'); ?></p>
        <table class="table">
            <tbody>
                <tr><th><?php esc_html_e('CNPJ', 'nf-notas'); ?></th><td><?php echo esc_html($dados['cnpj'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('Razão Social', 'nf-notas'); ?></th><td><?php echo esc_html($dados['razao_social'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('Inscrição Municipal', 'nf-notas'); ?></th><td><?php echo esc_html($dados['inscricao_municipal'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('Código Município', 'nf-notas'); ?></th><td><?php echo esc_html($dados['codigo_municipio'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('Email', 'nf-notas'); ?></th><td><?php echo esc_html($dados['email'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('Telefone', 'nf-notas'); ?></th><td><?php echo esc_html($dados['telefone'] ?? '-'); ?></td></tr>
            </tbody>
        </table>
        <p><em><?php esc_html_e('Para alterar, use a interface da API ou adicione formulário de edição aqui.', 'nf-notas'); ?></em></p>
    </div>
</div>
