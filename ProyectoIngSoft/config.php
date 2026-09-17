<?php
/**
 * config.php
 * Conexión a la base de datos "delisof" (ver delisof.sql que ya tienes)
 * y arranque de una sesión mínima de demostración.
 */

$DB_HOST = 'localhost';
$DB_NAME = 'delisof';
$DB_USER = 'root';   // <-- cámbialo por tu usuario de MySQL
$DB_PASS = '';       // <-- cámbialo por tu contraseña de MySQL

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    die('No se pudo conectar a la base de datos: ' . $e->getMessage());
}

/*
 * Sesión de demostración.
 * Como todavía no hay pantalla de login conectada, se simula que
 * el usuario autenticado es el id_usuario = 1 (el "estudiante01"
 * que ya viene insertado en delisof.sql).
 *
 * Cuando conectes un login real, aquí es donde debes guardar
 * $_SESSION['id_usuario'] = <id que vino de la validación de
 * correo + password_hash>.
 */
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (!isset($_SESSION['id_usuario'])) {
    $_SESSION['id_usuario'] = 1;
}
