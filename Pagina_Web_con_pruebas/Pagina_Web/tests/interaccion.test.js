'use strict';
// Módulo: Interacción de los usuarios (HU11 comentar, me gusta, guardar, inscripción a eventos)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor, invocar, U, uno, ninguno, filas, ok, sinCambios, falla } = require('./harness');

let S;
beforeEach(() => { S = cargarServidor(); });

const comentar = (body, quien = 'est', id = 5) => invocar(S, 'POST', `/api/publicaciones/${id}/comentarios`, { body, token: S.token(U[quien]) });

describe('HU11 · Comentar una publicación', () => {
  beforeEach(() => S.db.cuando('INSERT INTO comentarios', ok({ insertId: 1 })));

  it('CP-I01 · HU11 · Comentario con texto → 201 { ok: true }', async () => {
    const r = await comentar({ contenido: '¿A qué hora empieza?' });
    assert.equal(r.statusCode, 201);
    assert.deepEqual(r.body, { ok: true });
  });
  it('CP-I02 · HU11 · Comentario vacío → 400 "Escribe algo antes de enviar…"', async () => {
    const r = await comentar({ contenido: '' });
    assert.equal(r.statusCode, 400);
    assert.match(r.body.error, /Escribe algo/);
    assert.equal(S.db.con('INSERT INTO comentarios').length, 0);
  });
  it('CP-I03 · HU11 · Comentario de solo espacios → 400', async () => {
    assert.equal((await comentar({ contenido: '     ' })).statusCode, 400);
  });
  it('CP-I04 · HU11 · Petición sin cuerpo → 400 sin romper el servidor', async () => {
    assert.equal((await comentar(undefined)).statusCode, 400);
  });
  it('CP-I05 · HU11 · Comentario de exactamente 1000 caracteres (límite) → 201', async () => {
    assert.equal((await comentar({ contenido: 'a'.repeat(1000) })).statusCode, 201);
  });
  it('CP-I06 · HU11 · Comentario de 1001 caracteres → 400 "no puede superar 1000"', async () => {
    const r = await comentar({ contenido: 'a'.repeat(1001) });
    assert.equal(r.statusCode, 400);
    assert.match(r.body.error, /1000/);
  });
  it('CP-I07 · HU11 · El comentario se guarda asociado a la publicación y al usuario, sin espacios sobrantes', async () => {
    await comentar({ contenido: '  Hola  ' }, 'est', 8);
    assert.deepEqual(S.db.con('INSERT INTO comentarios')[0].params, ['8', U.est.id, 'Hola']);
  });
  it('CP-I08 · HU11 · Sin sesión no se puede comentar → 401', async () => {
    const r = await invocar(S, 'POST', '/api/publicaciones/5/comentarios', { body: { contenido: 'hola' } });
    assert.equal(r.statusCode, 401);
  });
  it('CP-I09 · HU11 · Estudiantes, docentes, Bienestar y Administrador pueden comentar', async () => {
    for (const quien of ['est', 'doc', 'bien', 'admin']) assert.equal((await comentar({ contenido: 'hola' }, quien)).statusCode, 201, quien);
  });
  it('CP-I10 · HU11 · Comentar en una publicación que no existe → 404 (error de llave foránea controlado)', async () => {
    S.db.cuando('INSERT INTO comentarios', falla('fk', 'ER_NO_REFERENCED_ROW_2'));
    const r = await comentar({ contenido: 'hola' }, 'est', 9999);
    assert.equal(r.statusCode, 404);
    assert.equal(r.body.error, 'La publicación no existe.');
  });
  it('CP-I11 · HU11 · Lista los comentarios visibles de una publicación', async () => {
    S.db.cuando('FROM comentarios m JOIN usuarios u', filas([{ id: 1, contenido: 'Hola', fecha: '2026-10-07', autor: 'Laura Méndez' }]));
    const r = await invocar(S, 'GET', '/api/publicaciones/5/comentarios', { token: S.token(U.est) });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body[0].autor, 'Laura Méndez');
    assert.ok(S.db.llamadas[0].sql.includes("m.estado = 'visible'"));
  });
});

describe('Me gusta y guardar (alternar)', () => {
  const tog = (accion, quien = 'est') => invocar(S, 'POST', `/api/publicaciones/5/${accion}`, { token: S.token(U[quien]) });

  it('CP-I12 · EXT · Dar "me gusta" por primera vez lo activa → { activo: true } y se inserta la reacción', async () => {
    S.db.cuando('DELETE FROM reacciones', sinCambios()).cuando('INSERT INTO reacciones', ok());
    const r = await tog('like');
    assert.deepEqual(r.body, { activo: true });
    assert.equal(S.db.con('INSERT INTO reacciones').length, 1);
  });
  it('CP-I13 · EXT · Dar "me gusta" otra vez lo quita → { activo: false } y no inserta', async () => {
    S.db.cuando('DELETE FROM reacciones', ok());
    const r = await tog('like');
    assert.deepEqual(r.body, { activo: false });
    assert.equal(S.db.con('INSERT INTO reacciones').length, 0);
  });
  it('CP-I14 · EXT · Guardar una publicación la agrega a Guardados → { activo: true }', async () => {
    S.db.cuando('DELETE FROM publicaciones_guardadas', sinCambios()).cuando('INSERT INTO publicaciones_guardadas', ok());
    assert.deepEqual((await tog('guardar')).body, { activo: true });
  });
  it('CP-I15 · EXT · Guardar de nuevo la quita de Guardados → { activo: false }', async () => {
    S.db.cuando('DELETE FROM publicaciones_guardadas', ok());
    assert.deepEqual((await tog('guardar')).body, { activo: false });
  });
  it('CP-I16 · EXT · Dar "me gusta" a una publicación inexistente → 404 controlado', async () => {
    S.db.cuando('DELETE FROM reacciones', sinCambios()).cuando('INSERT INTO reacciones', falla('fk', 'ER_NO_REFERENCED_ROW_2'));
    assert.equal((await tog('like')).statusCode, 404);
  });
  it('CP-I17 · EXT · Sin sesión no se puede dar "me gusta" ni guardar → 401', async () => {
    assert.equal((await invocar(S, 'POST', '/api/publicaciones/5/like')).statusCode, 401);
    assert.equal((await invocar(S, 'POST', '/api/publicaciones/5/guardar')).statusCode, 401);
  });
});

describe('Inscripción a eventos', () => {
  function evento({ cupo = 120, inscritos = 84, evento = true, estudiante = true, yaInscrito = false } = {}) {
    S.db.cuando('SELECT e.id_evento, e.cupo_maximo FROM publicaciones p', evento ? uno({ id_evento: 10, cupo_maximo: cupo }) : ninguno())
      .cuando('SELECT id_estudiante FROM estudiantes', estudiante ? uno({ id_estudiante: 9 }) : ninguno())
      .cuando('SELECT id_inscripcion FROM inscripciones_evento', yaInscrito ? uno({ id_inscripcion: 4 }) : ninguno())
      .cuando('SELECT COUNT(*) n FROM inscripciones_evento', uno({ n: inscritos }))
      .cuando('INSERT INTO inscripciones_evento', ok())
      .cuando("UPDATE inscripciones_evento SET estado = 'cancelada'", ok());
  }
  const inscribir = (quien = 'est') => invocar(S, 'POST', '/api/publicaciones/5/inscripcion', { token: S.token(U[quien]) });

  it('CP-I18 · EXT · Estudiante se inscribe con cupos disponibles (84 de 120) → { activo: true }', async () => {
    evento();
    const r = await inscribir();
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body, { activo: true });
    assert.deepEqual(S.db.eventos, ['begin', 'commit', 'release']);
  });
  it('CP-I19 · EXT · Cupo lleno (120 de 120) → 409 "El cupo ya está lleno." y rollback', async () => {
    evento({ inscritos: 120 });
    const r = await inscribir();
    assert.equal(r.statusCode, 409);
    assert.equal(r.body.error, 'El cupo ya está lleno.');
    assert.deepEqual(S.db.eventos, ['begin', 'rollback', 'release']);
    assert.equal(S.db.con('INSERT INTO inscripciones_evento').length, 0);
  });
  it('CP-I20 · EXT · Último cupo disponible (119 de 120, límite) → sí permite inscribirse', async () => {
    evento({ inscritos: 119 });
    assert.equal((await inscribir()).statusCode, 200);
  });
  it('CP-I21 · EXT · Evento sin cupo máximo (ilimitado) siempre permite inscribirse', async () => {
    evento({ cupo: null, inscritos: 5000 });
    assert.deepEqual((await inscribir()).body, { activo: true });
  });
  it('CP-I22 · EXT · Si ya estaba inscrito, la segunda acción cancela la inscripción → { activo: false }', async () => {
    evento({ yaInscrito: true });
    const r = await inscribir();
    assert.deepEqual(r.body, { activo: false });
    assert.equal(S.db.con("SET estado = 'cancelada'").length, 1);
    assert.equal(S.db.con('INSERT INTO inscripciones_evento').length, 0);
  });
  it('CP-I23 · EXT · Una noticia (sin evento asociado) no admite inscripción → 404 y rollback', async () => {
    evento({ evento: false });
    const r = await inscribir();
    assert.equal(r.statusCode, 404);
    assert.equal(r.body.error, 'Esta publicación no admite inscripción.');
    assert.deepEqual(S.db.eventos, ['begin', 'rollback', 'release']);
  });
  it('CP-I24 · EXT · Usuario sin registro de estudiante → 404 y rollback', async () => {
    evento({ estudiante: false });
    assert.equal((await inscribir()).statusCode, 404);
    assert.deepEqual(S.db.eventos, ['begin', 'rollback', 'release']);
  });
  it('CP-I25 · HU02 · Docente, Bienestar y Administrador no pueden inscribirse → 403', async () => {
    evento();
    for (const quien of ['doc', 'bien', 'admin']) assert.equal((await inscribir(quien)).statusCode, 403, quien);
  });
  it('CP-I26 · EXT · Sin sesión no se puede inscribir → 401', async () => {
    evento();
    assert.equal((await invocar(S, 'POST', '/api/publicaciones/5/inscripcion')).statusCode, 401);
  });
  it('CP-I27 · EXT · Un error de base de datos durante la inscripción hace rollback y responde 500', async () => {
    evento();
    S.db.cuando('INSERT INTO inscripciones_evento', falla('deadlock'));
    const r = await inscribir();
    assert.equal(r.statusCode, 500);
    assert.deepEqual(S.db.eventos, ['begin', 'rollback', 'release']);
  });
});

describe('Manejo global de errores', () => {
  it('CP-I28 · GEN · Un error inesperado responde 500 con mensaje genérico, sin revelar detalles internos', async () => {
    S.db.cuando('FROM categorias_evento WHERE activo = 1', falla('SELECT secreto FROM tabla_interna'));
    const r = await invocar(S, 'GET', '/api/categorias', { token: S.token(U.est) });
    assert.equal(r.statusCode, 500);
    assert.equal(r.body.error, 'Error del servidor. Intenta de nuevo en un momento.');
    assert.ok(!JSON.stringify(r.body).includes('tabla_interna'));
    assert.equal(S.errores.length, 1);   // el error sí queda registrado en el servidor
  });
});
