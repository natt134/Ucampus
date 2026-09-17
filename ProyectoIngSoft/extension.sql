/* =========================================================
   EXTENSIÓN DE delisof.sql
   Tu esquema original ya tiene "comentarios" para publicaciones,
   pero no tiene una tabla para los "me gusta". Esta la agrega,
   siguiendo el mismo patrón que ya usaste en eventos_guardados.

   Ejecuta este archivo DESPUÉS de haber creado y cargado delisof.sql.
   ========================================================= */

USE delisof;

CREATE TABLE IF NOT EXISTS reacciones_publicacion (
    id_usuario INT UNSIGNED NOT NULL,
    id_publicacion INT UNSIGNED NOT NULL,
    fecha_reaccion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id_usuario, id_publicacion),

    CONSTRAINT fk_reaccion_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_reaccion_publicacion
        FOREIGN KEY (id_publicacion)
        REFERENCES publicaciones(id_publicacion)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_reaccion_publicacion
ON reacciones_publicacion(id_publicacion);
