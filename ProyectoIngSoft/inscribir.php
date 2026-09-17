<?php
require __DIR__ . '/../config.php';
require __DIR__ . '/../functions.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $idEvento     = (int)($_POST['id_evento'] ?? 0);
    $idUsuario    = (int)$_SESSION['id_usuario'];
    $idEstudiante = obtenerIdEstudiante($pdo, $idUsuario);

    // Solo los usuarios que son estudiantes pueden inscribirse
    // (según el esquema, inscripciones_evento referencia a `estudiantes`, no a `usuarios`).
    if ($idEvento > 0 && $idEstudiante !== null) {
        $check = $pdo->prepare(
            "SELECT id_inscripcion, estado FROM inscripciones_evento
             WHERE id_evento = ? AND id_estudiante = ?"
        );
        $check->execute([$idEvento, $idEstudiante]);
        $existente = $check->fetch();

        if ($existente) {
            $nuevoEstado = $existente['estado'] === 'INSCRITO' ? 'CANCELADO' : 'INSCRITO';
            $upd = $pdo->prepare(
                "UPDATE inscripciones_evento
                 SET estado = ?, fecha_inscripcion = IF(? = 'INSCRITO', NOW(), fecha_inscripcion)
                 WHERE id_inscripcion = ?"
            );
            $upd->execute([$nuevoEstado, $nuevoEstado, $existente['id_inscripcion']]);
        } else {
            $ins = $pdo->prepare(
                "INSERT INTO inscripciones_evento (id_evento, id_estudiante, estado)
                 VALUES (?, ?, 'INSCRITO')"
            );
            $ins->execute([$idEvento, $idEstudiante]);
        }
    }
}

$filtro = urlencode($_POST['filtro_actual'] ?? 'todo');
header("Location: ../index.php?filtro={$filtro}");
exit;
