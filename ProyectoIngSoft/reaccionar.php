<?php
require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $idPublicacion = (int)($_POST['id_publicacion'] ?? 0);
    $idUsuario     = (int)$_SESSION['id_usuario'];

    if ($idPublicacion > 0) {
        $check = $pdo->prepare(
            "SELECT 1 FROM reacciones_publicacion WHERE id_usuario = ? AND id_publicacion = ?"
        );
        $check->execute([$idUsuario, $idPublicacion]);

        if ($check->fetchColumn()) {
            $del = $pdo->prepare(
                "DELETE FROM reacciones_publicacion WHERE id_usuario = ? AND id_publicacion = ?"
            );
            $del->execute([$idUsuario, $idPublicacion]);
        } else {
            $ins = $pdo->prepare(
                "INSERT INTO reacciones_publicacion (id_usuario, id_publicacion) VALUES (?, ?)"
            );
            $ins->execute([$idUsuario, $idPublicacion]);
        }
    }
}

$filtro = urlencode($_POST['filtro_actual'] ?? 'todo');
$ancla  = 'post-' . (int)($_POST['id_publicacion'] ?? 0);
header("Location: ../index.php?filtro={$filtro}#{$ancla}");
exit;
