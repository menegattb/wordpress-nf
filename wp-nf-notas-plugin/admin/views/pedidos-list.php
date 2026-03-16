<?php
if (!defined('ABSPATH')) exit;
$api = new NF_Notas_Api_Client();
$result = $api->get('api/pedidos?limite=50');
$pedidos = is_array($result) ? $result : (isset($result['pedidos']) ? $result['pedidos'] : (isset($result['dados']) ? $result['dados'] : array()));
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('Pedidos', 'nf-notas'); ?></h1>

    <?php if (isset($result['erro'])): ?>
    <div class="notice notice-error">
        <p><?php echo esc_html($result['erro']); ?></p>
    </div>
    <?php elseif (empty($pedidos)): ?>
    <div class="content-section">
        <p><?php esc_html_e('Nenhum pedido encontrado.', 'nf-notas'); ?></p>
    </div>
    <?php else: ?>
    <div class="table-container">
        <table class="table">
            <thead>
                <tr>
                    <th><?php esc_html_e('ID', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Cliente', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Status', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Origem', 'nf-notas'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($pedidos as $p):
                    $dados = is_array($p['dados_pedido'] ?? null) ? $p['dados_pedido'] : $p;
                    $id = $p['pedido_id'] ?? $p['id'] ?? '-';
                    $cliente = $dados['nome'] ?? $dados['razao_social'] ?? '-';
                    $status = $p['status'] ?? '-';
                    $origem = $p['origem'] ?? '-';
                ?>
                <tr>
                    <td><?php echo esc_html($id); ?></td>
                    <td><?php echo esc_html($cliente); ?></td>
                    <td><?php echo esc_html($status); ?></td>
                    <td><?php echo esc_html($origem); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>
