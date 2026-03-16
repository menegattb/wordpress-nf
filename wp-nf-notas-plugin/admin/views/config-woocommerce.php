<?php
if (!defined('ABSPATH')) exit;
$api = new NF_Notas_Api_Client();
$config = $api->get('api/config/woocommerce');
$dados = isset($config['dados']) ? $config['dados'] : (isset($config['sucesso']) && $config['sucesso'] ? array() : array());
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('Configuração WooCommerce', 'nf-notas'); ?></h1>

    <?php if (isset($config['erro'])): ?>
    <div class="notice notice-error"><p><?php echo esc_html($config['erro']); ?></p></div>
    <?php endif; ?>

    <div class="content-section">
        <p><?php esc_html_e('As credenciais do WooCommerce são configuradas na API (por tenant). Esta página exibe o status atual.', 'nf-notas'); ?></p>
        <table class="table">
            <tbody>
                <tr><th><?php esc_html_e('URL', 'nf-notas'); ?></th><td><?php echo esc_html($dados['url'] ?? $dados['api_url'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('API URL', 'nf-notas'); ?></th><td><?php echo esc_html($dados['api_url'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('Consumer Key', 'nf-notas'); ?></th><td><?php echo esc_html($dados['consumer_key_preview'] ?? '-'); ?></td></tr>
                <tr><th><?php esc_html_e('Consumer Secret', 'nf-notas'); ?></th><td><?php echo esc_html($dados['consumer_secret_preview'] ?? '-'); ?></td></tr>
            </tbody>
        </table>
        <p><em><?php esc_html_e('Para alterar, use a interface da API ou adicione formulário de edição aqui.', 'nf-notas'); ?></em></p>
    </div>
</div>
