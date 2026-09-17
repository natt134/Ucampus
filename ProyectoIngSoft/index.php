<?php
require __DIR__ . '/config.php';
require __DIR__ . '/functions.php';

$usuarioActual   = obtenerUsuarioActual($pdo);
$idEstudiante    = obtenerIdEstudiante($pdo, $usuarioActual['id_usuario']);
$filtroPermitido = ['todo', 'evento', 'actividad', 'publicacion', 'convocatoria'];
$filtro          = in_array($_GET['filtro'] ?? 'todo', $filtroPermitido) ? $_GET['filtro'] : 'todo';

$feed      = construirFeed($pdo, $filtro, $usuarioActual['id_usuario'], $idEstudiante);
$novedades = obtenerNovedades($pdo);

$titulos = [
    'todo'         => ['Lo que pasa hoy en el campus', 'Eventos, avisos y publicaciones de toda la comunidad, en orden de llegada.'],
    'evento'       => ['Eventos del campus', 'Todo lo programado por facultades, docentes y bienestar.'],
    'actividad'    => ['Actividades', 'Deporte, cultura y talleres abiertos para toda la comunidad.'],
    'publicacion'  => ['Novedades', 'Lo que la comunidad está contando ahora mismo.'],
    'convocatoria' => ['Convocatorias', 'Oportunidades académicas y de movilidad, abiertas para inscribirte.'],
];
[$tituloFeed, $subtituloFeed] = $titulos[$filtro];

// --- calendario del mes actual (o del mes pedido por GET) ---
$anioCal = (int)($_GET['anio'] ?? date('Y'));
$mesCal  = (int)($_GET['mes'] ?? date('n'));
if ($mesCal < 1)  { $mesCal = 12; $anioCal--; }
if ($mesCal > 12) { $mesCal = 1;  $anioCal++; }

$mesesNombre = ['', 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
$mesesCorto  = ['', 'ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
$diasMarcados = diasConEvento($pdo, $anioCal, $mesCal);
$totalDias    = (int)date('t', mktime(0, 0, 0, $mesCal, 1, $anioCal));
$primerDia    = (int)date('N', mktime(0, 0, 0, $mesCal, 1, $anioCal)); // 1=lunes ... 7=domingo
$hoy          = new DateTime();
$esMesActual  = $hoy->format('Y') == $anioCal && $hoy->format('n') == $mesCal;

function h(?string $s): string { return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Unicundi Conecta</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>

<header class="topbar">
  <div class="brand"><span class="mark">🎓</span><span class="txt">Unicundi Conecta</span></div>
  <div class="search">
    <span>🔎</span>
    <input type="text" placeholder="Buscar eventos, publicaciones, personas…">
  </div>
  <div class="topbar-right">
    <div class="who">
      <div class="avatar"><?= h(iniciales($usuarioActual['nombres'], $usuarioActual['apellidos'])) ?></div>
      <div class="meta">
        <div class="name"><?= h($usuarioActual['nombres'] . ' ' . $usuarioActual['apellidos']) ?></div>
        <div class="role"><?= h(ucfirst(strtolower($usuarioActual['rol_nombre']))) ?></div>
      </div>
    </div>
  </div>
</header>

<div class="shell">

  <!-- ================= NAV ================= -->
  <aside class="sidebar">
    <nav class="nav-card">
      <a class="nav-item <?= $filtro === 'todo' ? 'active' : '' ?>" href="?filtro=todo"><span class="ic">🏠</span>Inicio</a>
      <a class="nav-item <?= $filtro === 'evento' ? 'active' : '' ?>" href="?filtro=evento"><span class="ic">📅</span>Eventos</a>
      <a class="nav-item <?= $filtro === 'actividad' ? 'active' : '' ?>" href="?filtro=actividad"><span class="ic">🤸</span>Actividades</a>
      <a class="nav-item <?= $filtro === 'publicacion' ? 'active' : '' ?>" href="?filtro=publicacion"><span class="ic">📰</span>Novedades</a>
      <a class="nav-item <?= $filtro === 'convocatoria' ? 'active' : '' ?>" href="?filtro=convocatoria"><span class="ic">📣</span>Convocatorias</a>
      <div class="nav-sep"></div>
      <a class="nav-item" href="#calendario"><span class="ic">🗓️</span>Calendario</a>
      <a class="nav-item" href="#"><span class="ic">👤</span>Mi perfil</a>
    </nav>
    <div class="callout">
      <div class="glyph">📣</div>
      <h4>Canal libre del campus</h4>
      <p>Publica avisos, comparte lo que pasa en tu programa y entérate de primera mano. Esto lo escribe la comunidad, no la universidad.</p>
    </div>
  </aside>

  <!-- ================= FEED ================= -->
  <main>
    <div class="feed-head">
      <h1><?= h($tituloFeed) ?></h1>
      <p><?= h($subtituloFeed) ?></p>
    </div>

    <form class="composer" action="actions/publicar.php" method="post">
      <input type="hidden" name="filtro_actual" value="<?= h($filtro) ?>">
      <div class="composer-top">
        <div class="post-head" style="padding:0;">
          <div class="avatar" style="background:<?= h(colorFor($usuarioActual['nombres'] . $usuarioActual['apellidos'])) ?>">
            <?= h(iniciales($usuarioActual['nombres'], $usuarioActual['apellidos'])) ?>
          </div>
        </div>
        <textarea name="contenido" rows="2" placeholder="¿Qué está pasando en tu facultad, <?= h($usuarioActual['nombres']) ?>?" required></textarea>
      </div>
      <div class="composer-bar">
        <button type="submit" class="btn-publish">Publicar</button>
      </div>
    </form>

    <?php if (empty($feed)): ?>
      <div class="feed-head empty-state">No hay nada en esta categoría todavía. Sé el primero en publicar algo.</div>
    <?php endif; ?>

    <?php foreach ($feed as $item): ?>
      <?php if ($item['tipo'] === 'evento'):
        $ev = $item['data'];
        $color = CATEGORIA_COLOR[$ev['categoria_nombre']] ?? '#6B6B6B';
        $fecha = new DateTime($ev['fecha_inicio']);
      ?>
      <article class="post" id="evento-<?= (int)$ev['id_evento'] ?>">
        <div class="post-head">
          <div class="avatar" style="background:<?= h(colorFor($ev['creador_nombres'] . $ev['creador_apellidos'])) ?>">
            <?= h(iniciales($ev['creador_nombres'], $ev['creador_apellidos'])) ?>
          </div>
          <div class="meta">
            <div class="name"><?= h($ev['creador_nombres'] . ' ' . $ev['creador_apellidos']) ?></div>
            <div class="sub"><?= h(tiempoRelativo($ev['fecha_creacion'])) ?></div>
          </div>
          <span class="tag" style="background:<?= h($color) ?>"><?= h($ev['categoria_nombre']) ?></span>
        </div>
        <div class="post-body"><?= h($ev['descripcion']) ?></div>
        <div class="event-box">
          <div class="event-date">
            <span class="d"><?= (int)$fecha->format('d') ?></span>
            <span class="m"><?= $mesesCorto[(int)$fecha->format('n')] ?></span>
          </div>
          <div class="event-info">
            <div style="font-weight:600;font-size:13.5px;"><?= h($ev['nombre']) ?></div>
            <div class="place">
              📍 <?= h($ev['espacio_nombre'] ?? 'Por confirmar') ?>
              <?php if ($ev['cupo_maximo']): ?>
                · <?= (int)$ev['inscritos'] ?>/<?= (int)$ev['cupo_maximo'] ?> inscritos
              <?php endif; ?>
            </div>
          </div>
          <?php if ($ev['requiere_inscripcion']): ?>
            <form action="actions/inscribir.php" method="post">
              <input type="hidden" name="id_evento" value="<?= (int)$ev['id_evento'] ?>">
              <input type="hidden" name="filtro_actual" value="<?= h($filtro) ?>">
              <button type="submit" class="event-cta <?= $ev['inscrito_actual'] ? 'joined' : '' ?>">
                <?= $ev['inscrito_actual'] ? '✓ Inscrito' : 'Inscribirme' ?>
              </button>
            </form>
          <?php endif; ?>
        </div>
      </article>

      <?php else:
        $p = $item['data'];
        $esOficial = $p['rol_nombre'] === 'BIENESTAR';
      ?>
      <article class="post" id="post-<?= (int)$p['id_publicacion'] ?>">
        <div class="post-head">
          <div class="avatar" style="background:<?= h(colorFor($p['nombres'] . $p['apellidos'])) ?>">
            <?= h(iniciales($p['nombres'], $p['apellidos'])) ?>
          </div>
          <div class="meta">
            <div class="name"><?= h($p['nombres'] . ' ' . $p['apellidos']) ?></div>
            <div class="sub"><?= h(tiempoRelativo($p['fecha_publicacion'])) ?></div>
          </div>
          <?php if ($esOficial): ?><span class="tag" style="background:var(--gold);color:var(--forest);">OFICIAL</span><?php endif; ?>
        </div>
        <div class="post-body"><?= h($p['contenido']) ?></div>
        <?php if (!empty($p['imagen_url'])): ?>
          <div class="post-media" style="background:linear-gradient(135deg, var(--moss), var(--forest));color:#fff;">🖼️</div>
        <?php endif; ?>

        <div class="post-actions">
          <form action="actions/reaccionar.php" method="post" style="display:contents;">
            <input type="hidden" name="id_publicacion" value="<?= (int)$p['id_publicacion'] ?>">
            <input type="hidden" name="filtro_actual" value="<?= h($filtro) ?>">
            <button type="submit" class="act <?= $p['reacciono_actual'] ? 'liked' : '' ?>">
              <span class="icon"><?= $p['reacciono_actual'] ? '♥' : '♡' ?></span><?= (int)$p['reacciones'] ?>
            </button>
          </form>
          <span class="act" style="pointer-events:none;"><span class="icon">💬</span><?= (int)$p['num_comentarios'] ?></span>
        </div>

        <details class="comments-toggle">
          <summary>Ver / escribir comentarios</summary>
          <div class="comments-body">
            <?php foreach (obtenerComentarios($pdo, $p['id_publicacion']) as $c): ?>
              <div class="comment">
                <div class="avatar" style="background:<?= h(colorFor($c['nombres'] . $c['apellidos'])) ?>">
                  <?= h(iniciales($c['nombres'], $c['apellidos'])) ?>
                </div>
                <div class="bubble"><b><?= h($c['nombres'] . ' ' . $c['apellidos']) ?></b><br><?= h($c['contenido']) ?></div>
              </div>
            <?php endforeach; ?>
            <form action="actions/comentar.php" method="post" class="comment-add">
              <input type="hidden" name="id_publicacion" value="<?= (int)$p['id_publicacion'] ?>">
              <input type="hidden" name="filtro_actual" value="<?= h($filtro) ?>">
              <input type="text" name="contenido" placeholder="Escribe un comentario…" required>
              <button type="submit">Enviar</button>
            </form>
          </div>
        </details>
      </article>
      <?php endif; ?>
    <?php endforeach; ?>
  </main>

  <!-- ================= RIGHT PANEL ================= -->
  <aside class="rightpanel" id="calendario">
    <div class="panel">
      <div class="panel-head"><h3>Calendario</h3></div>
      <div class="cal-nav">
        <a href="?filtro=<?= h($filtro) ?>&mes=<?= $mesCal - 1 ?>&anio=<?= $anioCal ?>#calendario">‹</a>
        <span class="cal-title"><?= ucfirst($mesesNombre[$mesCal]) ?> <?= $anioCal ?></span>
        <a href="?filtro=<?= h($filtro) ?>&mes=<?= $mesCal + 1 ?>&anio=<?= $anioCal ?>#calendario">›</a>
      </div>
      <div class="cal-grid">
        <?php foreach (['LUN','MAR','MIE','JUE','VIE','SAB','DOM'] as $d): ?><span><?= $d ?></span><?php endforeach; ?>
        <?php for ($i = 1; $i < $primerDia; $i++): ?><div class="day muted"></div><?php endfor; ?>
        <?php for ($d = 1; $d <= $totalDias; $d++):
          $clases = ['day'];
          if ($esMesActual && (int)$hoy->format('j') === $d) $clases[] = 'today';
          if (in_array($d, $diasMarcados, true)) $clases[] = 'has-event';
        ?>
          <div class="<?= implode(' ', $clases) ?>"><?= $d ?></div>
        <?php endfor; ?>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Novedades</h3></div>
      <?php foreach ($novedades as $n):
        $color = CATEGORIA_COLOR[$n['categoria_nombre']] ?? '#6B6B6B';
        $fn = new DateTime($n['fecha_inicio']);
      ?>
        <div class="novedad">
          <div class="thumb" style="background:<?= h($color) ?>">📌</div>
          <div class="body">
            <div class="title"><?= h($n['nombre']) ?></div>
            <div class="date"><?= (int)$fn->format('d') ?> de <?= $mesesNombre[(int)$fn->format('n')] ?>, <?= $fn->format('Y') ?></div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <p class="foot-note">Unicundi Conecta · Universidad de Cundinamarca<br>Datos leídos en vivo desde la base de datos <code>delisof</code>.</p>
  </aside>

</div>
</body>
</html>
