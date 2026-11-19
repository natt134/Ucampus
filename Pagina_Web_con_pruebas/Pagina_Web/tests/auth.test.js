'use strict';
// Módulo: Autenticación y autorización (HU01 inicio de sesión)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor, invocar, U, SECRET, uno, ninguno } = require('./harness');

let S;
beforeEach(() => { S = cargarServidor(); });

const FILA = { id_usuario: 5, nombres: 'Valentina', apellidos: 'Rojas', rol: 'ESTUDIANTE', password_hash: 'hash:Ucampus2026*' };
const login = (body, opts) => invocar(S, 'POST', '/api/auth/login', { body, ...opts });

describe('HU01 · POST /api/auth/login', () => {
  it('CP-A01 · HU01 · Login sin contraseña → 400 con mensaje de campos obligatorios', async () => {
    const r = await login({ usuario: 'valentina' });
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.error, 'Ingresa tu correo o usuario y tu contraseña.');
  });
  it('CP-A02 · HU01 · Login sin usuario → 400 con mensaje de campos obligatorios', async () => {
    const r = await login({ password: 'x' });
    assert.equal(r.statusCode, 400);
  });
  it('CP-A03 · HU01 · Login con cuerpo vacío (undefined) → 400 sin romper el servidor', async () => {
    const r = await login(undefined);
    assert.equal(r.statusCode, 400);
  });
  it('CP-A04 · HU01 · Usuario inexistente → 401 "Correo o contraseña incorrectos."', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', ninguno());
    const r = await login({ usuario: 'nadie@x.co', password: 'Ucampus2026*' });
    assert.equal(r.statusCode, 401);
    assert.equal(r.body.error, 'Correo o contraseña incorrectos.');
  });
  it('CP-A05 · HU01 · Contraseña incorrecta → 401 con el mismo mensaje (no revela qué dato falló)', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', uno(FILA));
    const r = await login({ usuario: 'valentina.rojas@ucundinamarca.edu.co', password: 'mala' });
    assert.equal(r.statusCode, 401);
    assert.equal(r.body.error, 'Correo o contraseña incorrectos.');
  });
  it('CP-A06 · HU01 · Credenciales correctas → 200 con token y usuario {id, nombre, rol}', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', uno(FILA));
    const r = await login({ usuario: 'valentina.rojas@ucundinamarca.edu.co', password: 'Ucampus2026*' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body.user, { id: 5, nombre: 'Valentina Rojas', rol: 'ESTUDIANTE' });
    assert.deepEqual(S.jwt.verify(r.body.token, SECRET), r.body.user);
  });
  it('CP-A07 · HU01 · El token se emite con vigencia de 8 horas', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', uno(FILA));
    await login({ usuario: 'valentina', password: 'Ucampus2026*' });
    assert.equal(S.jwt.ultimaOpcion.expiresIn, '8h');
  });
  it('CP-A08 · HU01 · La respuesta nunca incluye el hash de la contraseña', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', uno(FILA));
    const r = await login({ usuario: 'valentina', password: 'Ucampus2026*' });
    assert.ok(!JSON.stringify(r.body).includes('hash'));
  });
  it('CP-A09 · HU01 · Solo se consultan usuarios activos (activo = 1)', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', ninguno());
    await login({ usuario: 'valentina', password: 'x' });
    assert.ok(S.db.llamadas[0].sql.includes('u.activo = 1'));
  });
  it('CP-A10 · HU01 · Se puede ingresar con correo o con nombre de usuario (ambos parámetros)', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', ninguno());
    await login({ usuario: 'valentina.rojas', password: 'x' });
    assert.deepEqual(S.db.llamadas[0].params, ['valentina.rojas', 'valentina.rojas']);
  });
  it('CP-A11 · HU01 · Intento de inyección SQL viaja como parámetro y no dentro del SQL', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', ninguno());
    const ataque = "' OR 1=1 --";
    const r = await login({ usuario: ataque, password: 'x' });
    assert.equal(r.statusCode, 401);
    assert.ok(!S.db.llamadas[0].sql.includes('OR 1=1'));
    assert.equal(S.db.llamadas[0].params[0], ataque);
  });
});

describe('HU01 · Límite de intentos de inicio de sesión', () => {
  it('CP-A12 · HU01 · Los primeros 8 intentos fallidos responden 401 y el 9.º responde 429', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', ninguno());
    for (let i = 1; i <= 8; i++) assert.equal((await login({ usuario: 'a', password: 'b' })).statusCode, 401, 'intento ' + i);
    const r = await login({ usuario: 'a', password: 'b' });
    assert.equal(r.statusCode, 429);
    assert.equal(r.body.error, 'Demasiados intentos. Espera unos minutos.');
  });
  it('CP-A13 · HU01 · El bloqueo es por dirección IP: otra IP puede seguir intentando', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', ninguno());
    for (let i = 0; i < 9; i++) await login({ usuario: 'a', password: 'b' }, { ip: '1.1.1.1' });
    const r = await login({ usuario: 'a', password: 'b' }, { ip: '2.2.2.2' });
    assert.equal(r.statusCode, 401);
  });
  it('CP-A21 · HU01 · Hallazgo H-02: el límite de 8 intentos también cuenta los inicios de sesión EXITOSOS desde la misma IP', async () => {
    S.db.cuando('FROM usuarios u JOIN roles r', uno(FILA));
    for (let i = 1; i <= 8; i++) assert.equal((await login({ usuario: 'valentina', password: 'Ucampus2026*' })).statusCode, 200);
    const r = await login({ usuario: 'valentina', password: 'Ucampus2026*' });
    assert.equal(r.statusCode, 429);   // comportamiento actual: ver informe, hallazgo H-02
  });
});

describe('Middleware auth · GET /api/auth/me', () => {
  it('CP-A14 · HU01 · Sin token → 401 "Tu sesión terminó"', async () => {
    const r = await invocar(S, 'GET', '/api/auth/me');
    assert.equal(r.statusCode, 401);
    assert.match(r.body.error, /sesión terminó/);
  });
  it('CP-A15 · HU01 · Token mal formado → 401', async () => {
    const r = await invocar(S, 'GET', '/api/auth/me', { token: 'basura' });
    assert.equal(r.statusCode, 401);
  });
  it('CP-A16 · HU01 · Token firmado con otra clave secreta → 401', async () => {
    const falso = S.jwt.sign(U.est, 'otra-clave-distinta');
    const r = await invocar(S, 'GET', '/api/auth/me', { token: falso });
    assert.equal(r.statusCode, 401);
  });
  it('CP-A17 · HU01 · Token vencido → 401', async () => {
    const r = await invocar(S, 'GET', '/api/auth/me', { token: S.token(U.est, { expiresIn: -1 }) });
    assert.equal(r.statusCode, 401);
  });
  it('CP-A18 · HU01 · Encabezado sin el prefijo "Bearer " → 401', async () => {
    const r = await invocar(S, 'GET', '/api/auth/me', { headers: { authorization: S.token(U.est) } });
    assert.equal(r.statusCode, 401);
  });
  it('CP-A19 · HU01 · Token válido → 200 con los datos del usuario y su rol', async () => {
    const r = await invocar(S, 'GET', '/api/auth/me', { token: S.token(U.est) });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.user.rol, 'ESTUDIANTE');
  });
});

describe('Rutas no definidas', () => {
  it('CP-A20 · GEN · Una ruta /api inexistente responde 404 "Ruta no encontrada."', async () => {
    const r = await invocar(S, 'GET', '/api/no-existe', { token: S.token(U.est) });
    assert.equal(r.statusCode, 404);
    assert.equal(r.body.error, 'Ruta no encontrada.');
  });
});
