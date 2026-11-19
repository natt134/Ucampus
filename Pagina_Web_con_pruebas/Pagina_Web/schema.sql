-- UCampus · esquema MySQL 8 (basado en el diagrama ER del proyecto)
CREATE DATABASE IF NOT EXISTS ucampus CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ucampus;

CREATE TABLE roles (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(255)
);

CREATE TABLE programas_academicos (
  id_programa INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(30) UNIQUE,
  descripcion TEXT,
  activo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  id_rol INT NOT NULL,
  nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
  correo VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  telefono VARCHAR(20),
  foto_perfil VARCHAR(255),
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

CREATE TABLE estudiantes (
  id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL UNIQUE,
  id_programa INT NOT NULL,
  codigo_estudiantil VARCHAR(30) UNIQUE,
  semestre TINYINT,
  jornada VARCHAR(30),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_programa) REFERENCES programas_academicos(id_programa)
);

CREATE TABLE categorias_evento (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion VARCHAR(255),
  activo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE edificios (
  id_edificio INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  referencia VARCHAR(255)
);
CREATE TABLE pisos (
  id_piso INT AUTO_INCREMENT PRIMARY KEY,
  id_edificio INT NOT NULL,
  numero_piso INT NOT NULL,
  descripcion VARCHAR(255),
  FOREIGN KEY (id_edificio) REFERENCES edificios(id_edificio)
);
CREATE TABLE espacios (
  id_espacio INT AUTO_INCREMENT PRIMARY KEY,
  id_piso INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(50),
  capacidad INT,
  descripcion VARCHAR(255),
  FOREIGN KEY (id_piso) REFERENCES pisos(id_piso)
);

-- Detalle específico de eventos y convocatorias (fecha, lugar, cupo).
-- AJUSTE vs. diagrama: título, descripción y categoría viven en `publicaciones`
-- para no duplicar datos; `eventos` solo guarda lo propio del evento.
CREATE TABLE eventos (
  id_evento INT AUTO_INCREMENT PRIMARY KEY,
  id_espacio INT NULL,
  id_usuario_creador INT NOT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NULL,
  lugar VARCHAR(150),
  requisitos TEXT,
  requiere_inscripcion TINYINT(1) NOT NULL DEFAULT 0,
  cupo_maximo INT NULL,
  estado ENUM('programado','cancelado','finalizado') NOT NULL DEFAULT 'programado',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_espacio) REFERENCES espacios(id_espacio),
  FOREIGN KEY (id_usuario_creador) REFERENCES usuarios(id_usuario)
);

-- AJUSTE: se agregan tipo, titulo, id_categoria e id_evento (nullable).
CREATE TABLE publicaciones (
  id_publicacion INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_categoria INT NOT NULL,
  id_evento INT NULL UNIQUE,
  tipo ENUM('evento','convocatoria','noticia') NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  contenido TEXT NOT NULL,
  imagen_url VARCHAR(255),
  fecha_publicacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  estado ENUM('activa','eliminada') NOT NULL DEFAULT 'activa',
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_categoria) REFERENCES categorias_evento(id_categoria),
  FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
  INDEX idx_pub_estado_fecha (estado, fecha_publicacion)
);

CREATE TABLE comentarios (
  id_comentario INT AUTO_INCREMENT PRIMARY KEY,
  id_publicacion INT NOT NULL,
  id_usuario INT NOT NULL,
  contenido TEXT NOT NULL,
  fecha_comentario DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('visible','oculto') NOT NULL DEFAULT 'visible',
  FOREIGN KEY (id_publicacion) REFERENCES publicaciones(id_publicacion),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- AJUSTE: `eventos_guardados` pasa a `publicaciones_guardadas` (sirve para noticias también).
CREATE TABLE publicaciones_guardadas (
  id_usuario INT NOT NULL,
  id_publicacion INT NOT NULL,
  fecha_guardado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_publicacion),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_publicacion) REFERENCES publicaciones(id_publicacion)
);

-- NUEVA: "me gusta".
CREATE TABLE reacciones (
  id_usuario INT NOT NULL,
  id_publicacion INT NOT NULL,
  PRIMARY KEY (id_usuario, id_publicacion),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_publicacion) REFERENCES publicaciones(id_publicacion)
);

CREATE TABLE inscripciones_evento (
  id_inscripcion INT AUTO_INCREMENT PRIMARY KEY,
  id_evento INT NOT NULL,
  id_estudiante INT NOT NULL,
  fecha_inscripcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('confirmada','cancelada') NOT NULL DEFAULT 'confirmada',
  UNIQUE KEY uq_inscripcion (id_evento, id_estudiante),
  FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
  FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante)
);
