<?php
if (!defined('ABSPATH')) exit;
$api = new NF_Notas_Api_Client();
$saved = false;
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['nf_notas_config_focus'])) {
    check_admin_referer('nf_notas_config_focus');
    $ambiente = sanitize_text_field($_POST['ambiente'] ?? 'homologacao');
    $token_homologacao = sanitize_text_field($_POST['token_homologacao'] ?? '');
    $token_producao = sanitize_text_field($_POST['token_producao'] ?? '');
    $result = $api->post('api/config/focus', array(
        'ambiente' => $ambiente,
        'token_homologacao' => $token_homologacao,
        'token_producao' => $token_producao
    ));
    if (isset($result['sucesso']) && $result['sucesso']) {
        $saved = true;
    } else {
        $error = $result['erro'] ?? 'Erro ao salvar';
    }
}

$config = $api->get('api/config/focus');
$dados = isset($config['dados']) ? $config['dados'] : $config;
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('Configuração Focus NFe', 'nf-notas'); ?></h1>

    <?php if ($saved): ?>
    <div class="notice notice-success"><p><?php esc_html_e('Configurações salvas com sucesso.', 'nf-notas'); ?></p></div>
    <?php endif; ?>
    <?php if ($error): ?>
    <div class="notice notice-error"><p><?php echo esc_html($error); ?></p></div>
    <?php endif; ?>
    <?php if (isset($config['erro'])): ?>
    <div class="notice notice-error"><p><?php echo esc_html($config['erro']); ?></p></div>
    <?php endif; ?>

    <div class="content-section">
        <form method="post">
            <?php wp_nonce_field('nf_notas_config_focus'); ?>
            <input type="hidden" name="nf_notas_config_focus" value="1" />

            <div class="form-group">
                <label for="ambiente"><?php esc_html_e('Ambiente', 'nf-notas'); ?></label>
                <select name="ambiente" id="ambiente" class="form-select">
                    <option value="homologacao" <?php selected($dados['ambiente'] ?? 'homologacao', 'homologacao'); ?>><?php esc_html_e('Homologação', 'nf-notas'); ?></option>
                    <option value="producao" <?php selected($dados['ambiente'] ?? '', 'producao'); ?>><?php esc_html_e('Produção', 'nf-notas'); ?></option>
                </select>
            </div>

            <div class="form-group">
                <label for="token_homologacao"><?php esc_html_e('Token Homologação', 'nf-notas'); ?></label>
                <input type="password" name="token_homologacao" id="token_homologacao" class="form-input" value="" placeholder="<?php echo esc_attr($dados['token_atual_preview'] ?? ''); ?>" />
                <span class="form-help"><?php esc_html_e('Deixe em branco para manter o atual. Preview:', 'nf-notas'); ?> <?php echo esc_html($dados['token_atual_preview'] ?? '-'); ?></span>
            </div>

            <div class="form-group">
                <label for="token_producao"><?php esc_html_e('Token Produção', 'nf-notas'); ?></label>
                <input type="password" name="token_producao" id="token_producao" class="form-input" value="" placeholder="••••••••" />
                <span class="form-help"><?php esc_html_e('Obrigatório quando ambiente for Produção.', 'nf-notas'); ?></span>
            </div>

            <p><button type="submit" class="btn btn-primary"><?php esc_html_e('Salvar', 'nf-notas'); ?></button></p>
        </form>
    </div>
</div>
