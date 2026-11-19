'use strict';
// Módulo: Administración de usuarios y roles (HU02)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor, invocar, U, uno, ninguno, filas, ok, sinCambios } = require('./harness');

let S;
beforeEach(() => { S = cargarServidor(); });

const PERSONAS = [{ id: 5, nombre: 'Valentina Rojas', correo: 'valentina.rojas@ucundinamarca.edu.co', rol: 'ESTUDIANTE' }];
const get = (url, quien) => invocar(S, 'GET', url, { token: quien ? S.token(U[quien]) : undefined });
const cambiar = (id, body, quien = 'admin') => invocar(S, 'PATCH', `/api/usuarios/${id}/rol`, { body, token: S.token(U[quien]) });

describe('HU02 · Listar usuarios y roles', () => {
  it('CP-U01 · HU02 · El Administrador visualiza los usuarios registrados → 200', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', filas(PERSONAS));
    const r = await get('/api/usuarios', 'admin');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body, PERSONAS);
  });
  it('CP-U02 · HU02 · Solo se listan usuarios activos y no se expone el hash de contraseña', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', filas(PERSONAS));
    await get('/api/usuarios', 'admin');
    const sql = S.db.llamadas[0].sql;
    assert.ok(sql.includes('u.activo = 1'));
    assert.ok(!sql.includes('password_hash'));
  });
  it('CP-U03 · HU02 · Estudiante, docente y Bienestar no pueden listar usuarios → 403', async () => {
    for (const quien of ['est', 'doc', 'bien']) assert.equal((await get('/api/usuarios', quien)).statusCode, 403, quien);
  });
  it('CP-U04 · HU02 · Sin sesión no se puede listar usuarios → 401', async () => {
    assert.equal((await get('/api/usuarios')).statusCode, 401);
  });
  it('CP-U05 · HU02 · El Administrador obtiene la lista de roles disponibles como arreglo de nombres', async () => {
    S.db.cuando('SELECT nombre FROM roles', filas([{ nombre: 'ESTUDIANTE' }, { nombre: 'DOCENTE' }, { nombre: 'BIENESTAR' }, { nombre: 'ADMIN' }]));
    const r = await get('/api/roles', 'admin');
    assert.deepEqual(r.body, ['ESTUDIANTE', 'DOCENTE', 'BIENESTAR', 'ADMIN']);
  });
  it('CP-U06 · HU02 · Un estudiante no puede consultar la lista de roles → 403', async () => {
    assert.equal((await get('/api/roles', 'est')).statusCode, 403);
  });
});

describe('HU02 · Asignar rol a un usuario', () => {
  it('CP-U07 · HU02 · El Administrador asigna el rol BIENESTAR a otro usuario → 200 { ok: true }', async () => {
    S.db.cuando('SELECT id_rol FROM roles WHERE nombre = ?', uno({ id_rol: 3 })).cuando('UPDATE usuarios SET id_rol', ok());
    const r = await cambiar(5, { rol: 'BIENESTAR' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body, { ok: true });
    assert.deepEqual(S.db.con('UPDATE usuarios SET id_rol')[0].params, [3, '5']);
  });
  it('CP-U08 · HU02 · El Administrador no puede cambiar su propio rol → 400', async () => {
    const r = await cambiar(U.admin.id, { rol: 'ESTUDIANTE' });
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.error, 'No puedes cambiar tu propio rol.');
    assert.equal(S.db.llamadas.length, 0);
  });
  it('CP-U09 · HU02 · Rol que no existe → 400 "Rol no válido." y no se actualiza nada', async () => {
    S.db.cuando('SELECT id_rol FROM roles WHERE nombre = ?', ninguno());
    const r = await cambiar(5, { rol: 'SUPERUSUARIO' });
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.error, 'Rol no válido.');
    assert.equal(S.db.con('UPDATE').length, 0);
  });
  it('CP-U10 · HU02 · Petición sin cuerpo → 400 "Rol no válido." sin romper el servidor', async () => {
    S.db.cuando('SELECT id_rol FROM roles WHERE nombre = ?', ninguno());
    assert.equal((await cambiar(5, undefined)).statusCode, 400);
  });
  it('CP-U11 · HU02 · Asignar rol a un usuario inexistente → 404 "El usuario no existe."', async () => {
    S.db.cuando('SELECT id_rol FROM roles WHERE nombre = ?', uno({ id_rol: 3 })).cuando('UPDATE usuarios SET id_rol', sinCambios());
    const r = await cambiar(9999, { rol: 'BIENESTAR' });
    assert.equal(r.statusCode, 404);
    assert.equal(r.body.error, 'El usuario no existe.');
  });
  it('CP-U12 · HU02 · Estudiante, docente y Bienestar no pueden cambiar roles → 403', async () => {
    for (const quien of ['est', 'doc', 'bien']) assert.equal((await cambiar(5, { rol: 'ADMIN' }, quien)).statusCode, 403, quien);
    assert.equal(S.db.con('UPDATE').length, 0);
  });
});
