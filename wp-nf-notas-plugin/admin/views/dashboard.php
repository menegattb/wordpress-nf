<?php
if (!defined('ABSPATH')) exit;
$settings = NF_Notas_Settings::get_instance();
$api = new NF_Notas_Api_Client();
$configured = $settings->is_configured();
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('NF Notas - Dashboard', 'nf-notas'); ?></h1>

    <?php if (!$configured): ?>
    <div class="notice notice-warning">
        <p><?php esc_html_e('Configure a URL da API e o token em', 'nf-notas'); ?> 
            <a href="<?php echo esc_url(admin_url('admin.php?page=nf-notas-config-token')); ?>"><?php esc_html_e('Token API', 'nf-notas'); ?></a>.
        </p>
    </div>
    <?php else:
        $health = $api->get('health');
        $notasResp = $api->get('api/pedidos/notas/listar?limite=5');
        $pedidosResp = $api->get('api/pedidos?limite=5');
        $notasCount = isset($notasResp['dados']) ? count($notasResp['dados']) : 0;
        $pedidosData = is_array($pedidosResp) ? $pedidosResp : (isset($pedidosResp['pedidos']) ? $pedidosResp['pedidos'] : array());
        $pedidosCount = is_array($pedidosData) ? count($pedidosData) : 0;
    ?>
    <div class="card-grid">
        <div class="card">
            <h3><?php esc_html_e('Status API', 'nf-notas'); ?></h3>
            <div class="value"><?php echo ($health && !isset($health['erro'])) ? esc_html__('Conectado', 'nf-notas') : esc_html__('Erro', 'nf-notas'); ?></div>
        </div>
        <div class="card">
            <h3><?php esc_html_e('Notas (últimas)', 'nf-notas'); ?></h3>
            <div class="value"><?php echo isset($notasResp['erro']) ? '-' : $notasCount; ?></div>
        </div>
        <div class="card">
            <h3><?php esc_html_e('Pedidos (últimos)', 'nf-notas'); ?></h3>
            <div class="value"><?php echo isset($pedidosResp['erro']) ? '-' : $pedidosCount; ?></div>
        </div>
    </div>

    <div class="content-section">
        <h2 class="section-title"><?php esc_html_e('Links rápidos', 'nf-notas'); ?></h2>
        <p>
            <a href="<?php echo esc_url(admin_url('admin.php?page=nf-notas-notas')); ?>"><?php esc_html_e('Ver todas as notas', 'nf-notas'); ?></a> |
            <a href="<?php echo esc_url(admin_url('admin.php?page=nf-notas-pedidos')); ?>"><?php esc_html_e('Ver pedidos', 'nf-notas'); ?></a> |
            <a href="<?php echo esc_url(admin_url('admin.php?page=nf-notas-config-focus')); ?>"><?php esc_html_e('Config Focus NFe', 'nf-notas'); ?></a> |
            <a href="<?php echo esc_url(admin_url('admin.php?page=nf-notas-config-token')); ?>"><?php esc_html_e('Token API', 'nf-notas'); ?></a>
        </p>
    </div>
    <?php endif; ?>
</div>
