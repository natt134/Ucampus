UNICUNDI CONECTA — versión conectada a MySQL
=============================================

ESTRUCTURA
  delisof-app/
    config.php          -> conexión PDO a la base de datos "delisof"
    functions.php        -> todas las consultas (eventos, publicaciones, comentarios...)
    index.php            -> la página, arma el feed leyendo directamente de la BD
    actions/
      publicar.php        -> INSERT en publicaciones (el "composer")
      comentar.php         -> INSERT en comentarios
      reaccionar.php       -> toggle de "me gusta" (INSERT/DELETE)
      inscribir.php        -> toggle de inscripción a un evento
    assets/style.css     -> todo el diseño visual
    sql/extension.sql    -> UNA tabla nueva que faltaba en tu esquema (ver abajo)

PASOS PARA CORRERLO
  1. Crea la base con tu archivo original (el que ya tenías, con las tablas
     usuarios, eventos, publicaciones, comentarios, etc.).
  2. Ejecuta también sql/extension.sql (agrega la tabla reacciones_publicacion,
     necesaria para los "me gusta" — tu esquema original solo tenía comentarios,
     no reacciones).
  3. Abre config.php y pon tu usuario/contraseña reales de MySQL.
  4. Copia la carpeta delisof-app dentro de tu servidor (XAMPP/WAMP/Laragon:
     carpeta htdocs o www) y entra a http://localhost/delisof-app/

NOTAS IMPORTANTES
  - No hay login todavía: config.php simula que el usuario conectado es el
    id_usuario = 1 (tu "estudiante01" de ejemplo). Cuando tengas la pantalla
    de login, reemplaza esa parte por la validación real contra
    usuarios.correo + usuarios.password_hash (con password_verify).
  - "Inscribirme" solo aparece en eventos con requiere_inscripcion = 1, y solo
    funciona para usuarios que tengan fila en la tabla `estudiantes` (según tu
    esquema, inscripciones_evento apunta a estudiantes, no a usuarios en general).
  - Todo el feed (eventos + publicaciones) se arma y ordena en PHP dentro de
    functions.php -> construirFeed(), leyendo directo de tus tablas con PDO.
  - No usa JavaScript: los "me gusta", comentarios e inscripciones son formularios
    normales que hacen POST y recargan la página (patrón Post/Redirect/Get).
