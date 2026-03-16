<?php
if (!defined('ABSPATH')) exit;
$settings = NF_Notas_Settings::get_instance();
$token_service = NF_Notas_Token::get_instance();

$message = '';
$message_type = '';
$new_token = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['nf_notas_save_config'])) {
        check_admin_referer('nf_notas_config_token');
        $api_url = esc_url_raw(trim(sanitize_text_field($_POST['api_url'] ?? '')));
        $token = sanitize_text_field($_POST['api_token'] ?? '');
        if ($api_url !== '') {
            $settings->set_api_url($api_url);
        }
        if ($token !== '') {
            $settings->set_api_token($token);
        }
        $message = __('Configurações salvas.', 'nf-notas');
        $message_type = 'success';
    } elseif (isset($_POST['nf_notas_registrar'])) {
        check_admin_referer('nf_notas_config_token');
        $admin_secret = sanitize_text_field($_POST['admin_secret'] ?? '');
        $nome = sanitize_text_field($_POST['nome'] ?? '');
        $site_url = esc_url_raw(sanitize_text_field($_POST['site_url'] ?? get_site_url()));
        $api_url = $settings->get_api_url();
        if (empty($api_url)) {
            $settings->set_api_url(esc_url_raw(sanitize_text_field($_POST['api_url'] ?? '')));
            $api_url = $settings->get_api_url();
        }
        if (empty($admin_secret)) {
            $message = __('ADMIN_SECRET é obrigatório para registro.', 'nf-notas');
            $message_type = 'error';
        } else {
            $result = $token_service->registrar_tenant($admin_secret, $nome, $site_url);
            if ($result['sucesso']) {
                $new_token = $result['token'];
                $message = __('Tenant registrado! Guarde o token abaixo - ele não será exibido novamente.', 'nf-notas');
                $message_type = 'success';
            } else {
                $message = $result['erro'] ?? __('Erro ao registrar.', 'nf-notas');
                $message_type = 'error';
            }
        }
    } elseif (isset($_POST['nf_notas_renovar'])) {
        check_admin_referer('nf_notas_config_token');
        $token_atual = $settings->get_api_token();
        if (empty($token_atual)) {
            $message = __('Token atual não configurado.', 'nf-notas');
            $message_type = 'error';
        } else {
            $result = $token_service->renovar_token($token_atual);
            if ($result['sucesso']) {
                $new_token = $result['token'];
                $message = __('Token renovado! Guarde o novo token abaixo.', 'nf-notas');
                $message_type = 'success';
            } else {
                $message = $result['erro'] ?? __('Erro ao renovar.', 'nf-notas');
                $message_type = 'error';
            }
        }
    }
}

$api_url = $settings->get_api_url();
$api_token = $settings->get_api_token();
$webhook_url = rest_url('nf-notas/v1/webhook/woocommerce');
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('Token API', 'nf-notas'); ?></h1>

    <?php if ($message): ?>
    <div class="notice notice-<?php echo $message_type === 'error' ? 'error' : 'success'; ?>">
        <p><?php echo esc_html($message); ?></p>
        <?php if ($new_token): ?>
        <p><strong><?php esc_html_e('Novo token:', 'nf-notas'); ?></strong> <code style="word-break: break-all;"><?php echo esc_html($new_token); ?></code></p>
        <p><em><?php esc_html_e('Copie e guarde em local seguro. Este token não será exibido novamente.', 'nf-notas'); ?></em></p>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <div class="content-section">
        <h2 class="section-title"><?php esc_html_e('Configuração', 'nf-notas'); ?></h2>
        <form method="post">
            <?php wp_nonce_field('nf_notas_config_token'); ?>
            <input type="hidden" name="nf_notas_save_config" value="1" />
            <div class="form-group">
                <label for="api_url"><?php esc_html_e('URL da API', 'nf-notas'); ?></label>
                <input type="url" name="api_url" id="api_url" class="form-input" value="<?php echo esc_attr($api_url); ?>" placeholder="https://api.seudominio.com" />
            </div>
            <div class="form-group">
                <label for="api_token"><?php esc_html_e('Token', 'nf-notas'); ?></label>
                <input type="password" name="api_token" id="api_token" class="form-input" value="<?php echo esc_attr($api_token); ?>" placeholder="<?php echo $api_token ? '••••••••' : ''; ?>" />
                <span class="form-help"><?php esc_html_e('Deixe em branco para manter o atual.', 'nf-notas'); ?></span>
            </div>
            <p><button type="submit" class="btn btn-primary"><?php esc_html_e('Salvar', 'nf-notas'); ?></button></p>
        </form>
    </div>

    <div class="content-section">
        <h2 class="section-title"><?php esc_html_e('Registrar ou Renovar Token', 'nf-notas'); ?></h2>
        <p><?php esc_html_e('Primeira vez: use "Registrar" com ADMIN_SECRET. Já tem token: use "Renovar" para gerar novo (o anterior será invalidado).', 'nf-notas'); ?></p>

        <form method="post" style="margin-bottom: 24px;">
            <?php wp_nonce_field('nf_notas_config_token'); ?>
            <input type="hidden" name="nf_notas_registrar" value="1" />
            <div class="form-group">
                <label for="admin_secret"><?php esc_html_e('ADMIN_SECRET (apenas para registro)', 'nf-notas'); ?></label>
                <input type="password" name="admin_secret" id="admin_secret" class="form-input" />
            </div>
            <div class="form-group">
                <label for="nome"><?php esc_html_e('Nome do tenant', 'nf-notas'); ?></label>
                <input type="text" name="nome" id="nome" class="form-input" value="<?php echo esc_attr(get_bloginfo('name')); ?>" />
            </div>
            <div class="form-group">
                <label for="site_url"><?php esc_html_e('URL do site', 'nf-notas'); ?></label>
                <input type="url" name="site_url" id="site_url" class="form-input" value="<?php echo esc_attr(get_site_url()); ?>" />
            </div>
            <p><button type="submit" class="btn btn-primary"><?php esc_html_e('Registrar tenant', 'nf-notas'); ?></button></p>
        </form>

        <form method="post">
            <?php wp_nonce_field('nf_notas_config_token'); ?>
            <input type="hidden" name="nf_notas_renovar" value="1" />
            <p><button type="submit" class="btn btn-secondary"><?php esc_html_e('Renovar token', 'nf-notas'); ?></button></p>
        </form>
    </div>

    <div class="content-section">
        <h2 class="section-title"><?php esc_html_e('Webhook WooCommerce', 'nf-notas'); ?></h2>
        <p><?php esc_html_e('Configure no WooCommerce o webhook de pedido para enviar para esta URL:', 'nf-notas'); ?></p>
        <p><code style="word-break: break-all;"><?php echo esc_html($webhook_url); ?></code></p>
        <p><?php esc_html_e('O plugin receberá o webhook e encaminhará para a API com seu token automaticamente.', 'nf-notas'); ?></p>
        <p><strong><?php esc_html_e('Evento:', 'nf-notas'); ?></strong> <?php esc_html_e('Order updated ou Order created (status: completed, processing)', 'nf-notas'); ?></p>
    </div>
</div>
