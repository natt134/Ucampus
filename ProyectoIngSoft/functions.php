<?php
/**
 * functions.php
 * Toda la lógica de acceso a datos vive aquí, separada de la vista (index.php).
 * Tablas usadas: usuarios, roles, estudiantes, eventos, categorias_evento,
 * espacios, inscripciones_evento, publicaciones, comentarios,
 * reacciones_publicacion (ver sql/extension.sql).
 */

const CATEGORIA_COLOR = [
    'ACADÉMICO'     => '#2F6B4F',
    'DEPORTIVO'     => '#B5473A',
    'CULTURAL'      => '#8355B0',
    'BIENESTAR'     => '#C99A2E',
    'TALLER'        => '#2B7A8C',
    'CONVOCATORIA'  => '#14332B',
    'OTRO'          => '#6B6B6B',
];

const AVATAR_COLORS = ['#2F6B4F', '#C99A2E', '#8355B0', '#2B7A8C', '#B5473A', '#14332B'];

function colorFor(string $seed): string
{
    $suma = 0;
    foreach (str_split($seed) as $c) {
        $suma += ord($c);
    }
    return AVATAR_COLORS[$suma % count(AVATAR_COLORS)];
}

function iniciales(string $nombres, string $apellidos): string
{
    $n = mb_substr(trim($nombres), 0, 1);
    $a = mb_substr(trim($apellidos), 0, 1);
    return mb_strtoupper($n . $a);
}

function tiempoRelativo(string $fechaSql): string
{
    $fecha = new DateTime($fechaSql);
    $ahora = new DateTime();
    $diffSeg = $ahora->getTimestamp() - $fecha->getTimestamp();

    if ($diffSeg < 60)    return 'ahora';
    if ($diffSeg < 3600)  return 'hace ' . floor($diffSeg / 60) . ' min';
    if ($diffSeg < 86400) return 'hace ' . floor($diffSeg / 3600) . ' h';
    if ($diffSeg < 604800) return 'hace ' . floor($diffSeg / 86400) . ' d';

    $meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return (int)$fecha->format('d') . ' ' . $meses[(int)$fecha->format('n') - 1] . ' ' . $fecha->format('Y');
}

/** Usuario autenticado (demo: $_SESSION['id_usuario']), con su rol. */
function obtenerUsuarioActual(PDO $pdo): ?array
{
    $stmt = $pdo->prepare(
        "SELECT u.*, r.nombre AS rol_nombre
         FROM usuarios u
         JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = ?"
    );
    $stmt->execute([$_SESSION['id_usuario']]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** id_estudiante asociado a un id_usuario, o null si no es estudiante. */
function obtenerIdEstudiante(PDO $pdo, int $idUsuario): ?int
{
    $stmt = $pdo->prepare("SELECT id_estudiante FROM estudiantes WHERE id_usuario = ?");
    $stmt->execute([$idUsuario]);
    $row = $stmt->fetch();
    return $row ? (int)$row['id_estudiante'] : null;
}

/** Todos los eventos publicados, con su categoría, espacio y creador. */
function obtenerEventos(PDO $pdo, ?int $idEstudianteActual): array
{
    $stmt = $pdo->query(
        "SELECT e.*, c.nombre AS categoria_nombre,
                esp.nombre AS espacio_nombre,
                u.nombres AS creador_nombres, u.apellidos AS creador_apellidos
         FROM eventos e
         JOIN categorias_evento c ON c.id_categoria = e.id_categoria
         LEFT JOIN espacios esp ON esp.id_espacio = e.id_espacio
         JOIN usuarios u ON u.id_usuario = e.id_usuario_creador
         WHERE e.estado = 'PUBLICADO'
         ORDER BY e.fecha_inicio DESC"
    );
    $eventos = $stmt->fetchAll();

    foreach ($eventos as &$ev) {
        $c = $pdo->prepare(
            "SELECT COUNT(*) FROM inscripciones_evento
             WHERE id_evento = ? AND estado = 'INSCRITO'"
        );
        $c->execute([$ev['id_evento']]);
        $ev['inscritos'] = (int)$c->fetchColumn();

        $ev['inscrito_actual'] = false;
        if ($idEstudianteActual !== null) {
            $s = $pdo->prepare(
                "SELECT 1 FROM inscripciones_evento
                 WHERE id_evento = ? AND id_estudiante = ? AND estado = 'INSCRITO'"
            );
            $s->execute([$ev['id_evento'], $idEstudianteActual]);
            $ev['inscrito_actual'] = (bool)$s->fetchColumn();
        }
    }
    unset($ev);
    return $eventos;
}

/** Todas las publicaciones visibles, con su autor y contadores. */
function obtenerPublicaciones(PDO $pdo, int $idUsuarioActual): array
{
    $stmt = $pdo->query(
        "SELECT p.*, u.nombres, u.apellidos, r.nombre AS rol_nombre
         FROM publicaciones p
         JOIN usuarios u ON u.id_usuario = p.id_usuario
         JOIN roles r ON r.id_rol = u.id_rol
         WHERE p.estado = 'PUBLICADA'
         ORDER BY p.fecha_publicacion DESC"
    );
    $publicaciones = $stmt->fetchAll();

    foreach ($publicaciones as &$p) {
        $c = $pdo->prepare("SELECT COUNT(*) FROM reacciones_publicacion WHERE id_publicacion = ?");
        $c->execute([$p['id_publicacion']]);
        $p['reacciones'] = (int)$c->fetchColumn();

        $r = $pdo->prepare(
            "SELECT 1 FROM reacciones_publicacion WHERE id_publicacion = ? AND id_usuario = ?"
        );
        $r->execute([$p['id_publicacion'], $idUsuarioActual]);
        $p['reacciono_actual'] = (bool)$r->fetchColumn();

        $n = $pdo->prepare("SELECT COUNT(*) FROM comentarios WHERE id_publicacion = ? AND estado = 'VISIBLE'");
        $n->execute([$p['id_publicacion']]);
        $p['num_comentarios'] = (int)$n->fetchColumn();
    }
    unset($p);
    return $publicaciones;
}

function obtenerComentarios(PDO $pdo, int $idPublicacion): array
{
    $stmt = $pdo->prepare(
        "SELECT c.*, u.nombres, u.apellidos
         FROM comentarios c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         WHERE c.id_publicacion = ? AND c.estado = 'VISIBLE'
         ORDER BY c.fecha_comentario ASC"
    );
    $stmt->execute([$idPublicacion]);
    return $stmt->fetchAll();
}

/**
 * Combina eventos + publicaciones en un solo feed ordenado por fecha,
 * aplicando el filtro elegido en el menú lateral.
 */
function construirFeed(PDO $pdo, string $filtro, int $idUsuarioActual, ?int $idEstudianteActual): array
{
    $eventos       = obtenerEventos($pdo, $idEstudianteActual);
    $publicaciones = obtenerPublicaciones($pdo, $idUsuarioActual);

    $items = [];
    foreach ($eventos as $e) {
        $items[] = ['tipo' => 'evento', 'fecha' => $e['fecha_inicio'], 'data' => $e];
    }
    foreach ($publicaciones as $p) {
        $items[] = ['tipo' => 'publicacion', 'fecha' => $p['fecha_publicacion'], 'data' => $p];
    }

    $items = match ($filtro) {
        'evento'       => array_values(array_filter($items, fn($i) => $i['tipo'] === 'evento')),
        'publicacion'  => array_values(array_filter($items, fn($i) => $i['tipo'] === 'publicacion')),
        'convocatoria' => array_values(array_filter($items, fn($i) =>
            $i['tipo'] === 'evento' && $i['data']['categoria_nombre'] === 'CONVOCATORIA')),
        'actividad'    => array_values(array_filter($items, fn($i) =>
            $i['tipo'] === 'evento' && in_array($i['data']['categoria_nombre'], ['DEPORTIVO', 'CULTURAL', 'TALLER']))),
        default        => $items,
    };

    usort($items, fn($a, $b) => strtotime($b['fecha']) <=> strtotime($a['fecha']));
    return $items;
}

/** Eventos destacados para el panel de "Novedades". */
function obtenerNovedades(PDO $pdo): array
{
    $stmt = $pdo->query(
        "SELECT e.*, c.nombre AS categoria_nombre
         FROM eventos e
         JOIN categorias_evento c ON c.id_categoria = e.id_categoria
         WHERE e.estado = 'PUBLICADO'
           AND c.nombre IN ('CONVOCATORIA', 'BIENESTAR', 'ACADÉMICO')
         ORDER BY e.fecha_inicio DESC
         LIMIT 3"
    );
    return $stmt->fetchAll();
}

/** Días del mes dado que tienen al menos un evento (para pintar el calendario). */
function diasConEvento(PDO $pdo, int $anio, int $mes): array
{
    $stmt = $pdo->prepare(
        "SELECT DISTINCT DAY(fecha_inicio) AS dia
         FROM eventos
         WHERE estado = 'PUBLICADO' AND YEAR(fecha_inicio) = ? AND MONTH(fecha_inicio) = ?"
    );
    $stmt->execute([$anio, $mes]);
    return array_map('intval', array_column($stmt->fetchAll(), 'dia'));
}
