<?php
require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $contenido = trim($_POST['contenido'] ?? '');

    if ($contenido !== '') {
        $stmt = $pdo->prepare(
            "INSERT INTO publicaciones (id_usuario, contenido) VALUES (?, ?)"
        );
        $stmt->execute([$_SESSION['id_usuario'], $contenido]);
    }
}

header('Location: ../index.php?filtro=' . urlencode($_POST['filtro_actual'] ?? 'todo'));
exit;
