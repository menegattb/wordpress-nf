<?php
if (!defined('ABSPATH')) exit;
$api = new NF_Notas_Api_Client();
$result = $api->get('api/nfse/buscar');
$notas = array();
if (isset($result['dados']) && is_array($result['dados'])) {
    $notas = $result['dados'];
} elseif (isset($result['sucesso']) && $result['sucesso'] && isset($result['notas'])) {
    $notas = $result['notas'];
}
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('Notas Fiscais', 'nf-notas'); ?></h1>

    <?php if (isset($result['erro'])): ?>
    <div class="notice notice-error">
        <p><?php echo esc_html($result['erro']); ?></p>
    </div>
    <?php elseif (empty($notas)): ?>
    <div class="content-section">
        <p><?php esc_html_e('Nenhuma nota encontrada.', 'nf-notas'); ?></p>
    </div>
    <?php else: ?>
    <div class="table-container">
        <table class="table">
            <thead>
                <tr>
                    <th><?php esc_html_e('Referência', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Tipo', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Status', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Chave', 'nf-notas'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($notas as $nota):
                    $ref = $nota['referencia'] ?? $nota['ref'] ?? '-';
                    $tipo = $nota['tipo_nota'] ?? ($nota['chave_nfe'] ? 'nfe' : 'nfse');
                    $status = $nota['status_focus'] ?? $nota['status'] ?? '-';
                    $chave = $nota['chave_nfse'] ?? $nota['chave_nfe'] ?? '-';
                    $statusClass = (strpos(strtolower($status), 'autorizado') !== false) ? 'status-autorizado' : ((strpos(strtolower($status), 'processando') !== false) ? 'status-processando' : 'status-erro');
                ?>
                <tr>
                    <td><?php echo esc_html($ref); ?></td>
                    <td><?php echo esc_html(strtoupper($tipo)); ?></td>
                    <td><span class="status-badge <?php echo esc_attr($statusClass); ?>"><?php echo esc_html($status); ?></span></td>
                    <td><?php echo esc_html($chave); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>
