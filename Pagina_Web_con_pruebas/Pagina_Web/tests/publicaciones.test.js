'use strict';
// Módulo: Gestión de publicaciones (HU03 crear, HU04 editar, HU05 eliminar)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor, invocar, U, uno, ninguno, ok, falla } = require('./harness');

let S;
beforeEach(() => { S = cargarServidor(); });

const valido = (o = {}) => ({ tipo: 'evento', titulo: 'Torneo de fútbol', contenido: 'Fase de grupos', categoria: 'DEPORTIVO',
  fecha: '2026-11-10', lugar: 'Cancha principal', cupo: 120, ...o });

function preparar({ categoria = true } = {}) {
  S.db.cuando('WHERE nombre = ? AND activo = 1', categoria ? uno({ id_categoria: 2 }) : ninguno())
    .cuando('INSERT INTO eventos', ok({ insertId: 10 }))
    .cuando('INSERT INTO publicaciones', ok({ insertId: 77 }));
}
const crear = (body, quien = 'bien') => invocar(S, 'POST', '/api/publicaciones', { body, token: S.token(U[quien]) });

describe('HU03 · Crear publicación · validaciones', () => {
  it('CP-P01 · HU03 · Tipo de publicación no válido → 400', async () => {
    preparar();
    const r = await crear(valido({ tipo: 'meme' }));
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.error, 'Tipo de publicación no válido.');
  });
  it('CP-P02 · HU03 · Título de 2 caracteres (bajo el mínimo) → 400', async () => {
    preparar();
    const r = await crear(valido({ titulo: 'ab' }));
    assert.equal(r.statusCode, 400);
    assert.match(r.body.error, /entre 3 y 150/);
  });
  it('CP-P03 · HU03 · Título de exactamente 3 caracteres (límite inferior) → 201', async () => {
    preparar();
    assert.equal((await crear(valido({ titulo: 'abc' }))).statusCode, 201);
  });
  it('CP-P04 · HU03 · Título de exactamente 150 caracteres (límite superior) → 201', async () => {
    preparar();
    assert.equal((await crear(valido({ titulo: 'a'.repeat(150) }))).statusCode, 201);
  });
  it('CP-P05 · HU03 · Título de 151 caracteres (sobre el máximo) → 400', async () => {
    preparar();
    assert.equal((await crear(valido({ titulo: 'a'.repeat(151) }))).statusCode, 400);
  });
  it('CP-P06 · HU03 · Título formado solo por espacios → 400', async () => {
    preparar();
    assert.equal((await crear(valido({ titulo: '     ' }))).statusCode, 400);
  });
  it('CP-P07 · HU03 · Descripción vacía → 400 "Escribe la descripción…"', async () => {
    preparar();
    const r = await crear(valido({ contenido: '   ' }));
    assert.equal(r.statusCode, 400);
    assert.match(r.body.error, /descripción/);
  });
  it('CP-P08 · HU03 · Categoría inexistente → 400 "Selecciona una categoría válida."', async () => {
    preparar({ categoria: false });
    const r = await crear(valido({ categoria: 'INVENTADA' }));
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.error, 'Selecciona una categoría válida.');
  });
  it('CP-P09 · HU03 · Evento sin fecha → 400 "necesitan una fecha válida"', async () => {
    preparar();
    const r = await crear(valido({ fecha: undefined }));
    assert.equal(r.statusCode, 400);
    assert.match(r.body.error, /fecha válida/);
  });
  it('CP-P10 · HU03 · Evento con fecha no interpretable ("abc") → 400', async () => {
    preparar();
    assert.equal((await crear(valido({ fecha: 'abc' }))).statusCode, 400);
  });
  it('CP-P11 · HU03 · Convocatoria sin fecha → 400 (también exige fecha límite)', async () => {
    preparar();
    assert.equal((await crear(valido({ tipo: 'convocatoria', fecha: '' }))).statusCode, 400);
  });
  it('CP-P12 · HU03 · Cuerpo de la petición vacío → 400 sin romper el servidor', async () => {
    preparar();
    assert.equal((await crear(undefined)).statusCode, 400);
  });
});

describe('HU03 · Crear publicación · guardado', () => {
  it('CP-P13 · HU03 · Evento válido → 201 con el id de la nueva publicación', async () => {
    preparar();
    const r = await crear(valido());
    assert.equal(r.statusCode, 201);
    assert.deepEqual(r.body, { id: 77 });
  });
  it('CP-P14 · HU03 · El guardado usa transacción (begin → commit → release)', async () => {
    preparar();
    await crear(valido());
    assert.deepEqual(S.db.eventos, ['begin', 'commit', 'release']);
  });
  it('CP-P15 · HU03 · Un evento inserta primero en `eventos` y luego en `publicaciones`', async () => {
    preparar();
    await crear(valido());
    const orden = S.db.llamadas.map(c => c.sql).filter(s => s.startsWith('INSERT'));
    assert.ok(orden[0].includes('INTO eventos') && orden[1].includes('INTO publicaciones'));
    assert.equal(S.db.con('INSERT INTO publicaciones')[0].params[2], 10); // id_evento enlazado
  });
  it('CP-P16 · HU03 · Una noticia NO crea registro en `eventos` y no necesita fecha', async () => {
    preparar();
    const r = await crear(valido({ tipo: 'noticia', fecha: undefined, cupo: undefined }));
    assert.equal(r.statusCode, 201);
    assert.equal(S.db.con('INSERT INTO eventos').length, 0);
    assert.equal(S.db.con('INSERT INTO publicaciones')[0].params[2], null);
  });
  it('CP-P17 · HU03 · Con cupo 120 el evento queda con inscripción requerida', async () => {
    preparar();
    await crear(valido({ cupo: '120' }));
    const p = S.db.con('INSERT INTO eventos')[0].params;
    assert.equal(p[3], 120); assert.equal(p[4], 1);
  });
  it('CP-P18 · HU03 · Cupo negativo o no numérico se guarda como "sin cupo" (null)', async () => {
    preparar();
    await crear(valido({ cupo: -5 }));
    await crear(valido({ cupo: 'abc' }));
    for (const c of S.db.con('INSERT INTO eventos')) { assert.equal(c.params[3], null); assert.equal(c.params[4], 0); }
  });
  it('CP-P19 · HU03 · El título y la descripción se guardan sin espacios sobrantes (trim)', async () => {
    preparar();
    await crear(valido({ titulo: '  Taller de pintura  ', contenido: '  Mural  ' }));
    const p = S.db.con('INSERT INTO publicaciones')[0].params;
    assert.equal(p[4], 'Taller de pintura'); assert.equal(p[5], 'Mural');
  });
  it('CP-P20 · HU03 · El lugar se recorta a 150 caracteres', async () => {
    preparar();
    await crear(valido({ lugar: 'L'.repeat(300) }));
    assert.equal(S.db.con('INSERT INTO eventos')[0].params[2].length, 150);
  });
  it('CP-P21 · HU03 · Si falla el INSERT de la publicación se hace rollback y se responde 500', async () => {
    preparar();
    S.db.cuando('INSERT INTO publicaciones', falla('disco lleno'));
    const r = await crear(valido());
    assert.equal(r.statusCode, 500);
    assert.deepEqual(S.db.eventos, ['begin', 'rollback', 'release']);
  });
});

describe('HU02 · Permisos para crear publicaciones', () => {
  it('CP-P22 · HU02 · Estudiante intenta publicar → 403', async () => {
    preparar();
    const r = await crear(valido(), 'est');
    assert.equal(r.statusCode, 403);
    assert.equal(r.body.error, 'Tu rol no tiene permiso para esta acción.');
  });
  it('CP-P23 · HU02 · Docente intenta publicar → 403', async () => {
    preparar();
    assert.equal((await crear(valido(), 'doc')).statusCode, 403);
  });
  it('CP-P24 · HU02 · Bienestar y Administrador sí pueden publicar → 201', async () => {
    preparar();
    assert.equal((await crear(valido(), 'bien')).statusCode, 201);
    assert.equal((await crear(valido(), 'admin')).statusCode, 201);
  });
  it('CP-P25 · HU02 · Publicar sin iniciar sesión → 401', async () => {
    preparar();
    const r = await invocar(S, 'POST', '/api/publicaciones', { body: valido() });
    assert.equal(r.statusCode, 401);
  });
});

/* ---------------- Editar y eliminar ---------------- */
function existente({ dueno = 2, idEvento = 10, tipo = 'evento' } = {}) {
  S.db.cuando('SELECT id_usuario, id_evento, tipo FROM publicaciones', uno({ id_usuario: dueno, id_evento: idEvento, tipo }))
    .cuando('WHERE nombre = ? AND activo = 1', uno({ id_categoria: 2 }))
    .cuando('UPDATE publicaciones SET id_categoria', ok())
    .cuando('UPDATE eventos SET fecha_inicio', ok())
    .cuando("UPDATE publicaciones SET estado = 'eliminada'", ok());
}
const editar = (id, body, quien = 'bien') => invocar(S, 'PUT', '/api/publicaciones/' + id, { body, token: S.token(U[quien]) });
const borrar = (id, quien = 'bien') => invocar(S, 'DELETE', '/api/publicaciones/' + id, { token: S.token(U[quien]) });

describe('HU04 · Editar publicación', () => {
  it('CP-P26 · HU04 · El autor edita su propia publicación → 200 { ok: true }', async () => {
    existente();
    const r = await editar(5, valido());
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body, { ok: true });
  });
  it('CP-P27 · HU04 · Se actualizan título, descripción y categoría de la publicación indicada', async () => {
    existente();
    await editar(5, valido({ titulo: 'Nuevo título' }));
    assert.deepEqual(S.db.con('UPDATE publicaciones SET id_categoria')[0].params, [2, 'Nuevo título', 'Fase de grupos', '5']);
  });
  it('CP-P28 · HU04 · En un evento también se actualizan fecha, lugar y cupo', async () => {
    existente();
    await editar(5, valido({ lugar: 'Auditorio', cupo: 50 }));
    const p = S.db.con('UPDATE eventos SET fecha_inicio')[0].params;
    assert.equal(p[1], 'Auditorio'); assert.equal(p[2], 50); assert.equal(p[3], 1); assert.equal(p[4], 10);
  });
  it('CP-P29 · HU04 · Editar una noticia no toca la tabla `eventos`', async () => {
    existente({ idEvento: null, tipo: 'noticia' });
    const r = await editar(5, valido({ tipo: 'noticia', fecha: undefined }));
    assert.equal(r.statusCode, 200);
    assert.equal(S.db.con('UPDATE eventos').length, 0);
  });
  it('CP-P30 · HU04 · El tipo no se puede cambiar: un evento enviado como "noticia" sigue exigiendo fecha', async () => {
    existente();
    const r = await editar(5, valido({ tipo: 'noticia', fecha: undefined }));
    assert.equal(r.statusCode, 400);
  });
  it('CP-P31 · HU04 · Datos inválidos al editar → 400 y no se ejecuta ningún UPDATE', async () => {
    existente();
    const r = await editar(5, valido({ titulo: '' }));
    assert.equal(r.statusCode, 400);
    assert.equal(S.db.con('UPDATE').length, 0);
  });
  it('CP-P32 · HU04 · Editar una publicación inexistente o eliminada → 404', async () => {
    S.db.cuando('SELECT id_usuario, id_evento, tipo FROM publicaciones', ninguno());
    const r = await editar(999, valido());
    assert.equal(r.statusCode, 404);
    assert.equal(r.body.error, 'La publicación no existe.');
  });
  it('CP-P33 · HU04 · Bienestar NO puede editar publicaciones de otro usuario → 403', async () => {
    existente({ dueno: 3 });
    const r = await editar(5, valido(), 'bien');
    assert.equal(r.statusCode, 403);
    assert.equal(r.body.error, 'Solo puedes modificar tus propias publicaciones.');
  });
  it('CP-P34 · HU04 · El Administrador puede editar publicaciones de cualquier usuario → 200', async () => {
    existente({ dueno: 3 });
    assert.equal((await editar(5, valido(), 'admin')).statusCode, 200);
  });
  it('CP-P35 · HU04 · Estudiante intenta editar → 403', async () => {
    existente();
    assert.equal((await editar(5, valido(), 'est')).statusCode, 403);
  });
});

describe('HU05 · Eliminar publicación', () => {
  it('CP-P36 · HU05 · El autor elimina su publicación → 200 { ok: true }', async () => {
    existente();
    const r = await borrar(5);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body, { ok: true });
  });
  it("CP-P37 · HU05 · Es borrado lógico: marca estado = 'eliminada' y NO ejecuta DELETE", async () => {
    existente();
    await borrar(5);
    assert.equal(S.db.con("estado = 'eliminada'").length, 1);
    assert.equal(S.db.con('DELETE FROM').length, 0);
  });
  it('CP-P38 · HU05 · Eliminar una publicación que no existe → 404', async () => {
    S.db.cuando('SELECT id_usuario, id_evento, tipo FROM publicaciones', ninguno());
    assert.equal((await borrar(999)).statusCode, 404);
  });
  it('CP-P39 · HU05 · Bienestar NO puede eliminar publicaciones ajenas → 403', async () => {
    existente({ dueno: 3 });
    assert.equal((await borrar(5, 'bien')).statusCode, 403);
    assert.equal(S.db.con("estado = 'eliminada'").length, 0);
  });
  it('CP-P40 · HU05 · El Administrador puede eliminar cualquier publicación → 200', async () => {
    existente({ dueno: 3 });
    assert.equal((await borrar(5, 'admin')).statusCode, 200);
  });
  it('CP-P41 · HU05 · Estudiante y docente no pueden eliminar → 403', async () => {
    existente();
    assert.equal((await borrar(5, 'est')).statusCode, 403);
    assert.equal((await borrar(5, 'doc')).statusCode, 403);
  });
});
