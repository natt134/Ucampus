<?php
require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $idPublicacion = (int)($_POST['id_publicacion'] ?? 0);
    $contenido     = trim($_POST['contenido'] ?? '');

    if ($idPublicacion > 0 && $contenido !== '') {
        $stmt = $pdo->prepare(
            "INSERT INTO comentarios (id_publicacion, id_usuario, contenido) VALUES (?, ?, ?)"
        );
        $stmt->execute([$idPublicacion, $_SESSION['id_usuario'], $contenido]);
    }
}

$filtro = urlencode($_POST['filtro_actual'] ?? 'todo');
$ancla  = 'post-' . (int)($_POST['id_publicacion'] ?? 0);
header("Location: ../index.php?filtro={$filtro}#{$ancla}");
exit;
