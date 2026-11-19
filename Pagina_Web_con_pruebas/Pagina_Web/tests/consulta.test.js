'use strict';
// Módulo: Consulta, búsqueda y filtros (HU06, HU07, HU08, HU09, HU10)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor, invocar, U, filas } = require('./harness');

let S;
beforeEach(() => { S = cargarServidor(); });

const FEED = [
  { id: 2, tipo: 'evento', titulo: 'Torneo interfacultades de fútbol', categoria: 'DEPORTIVO', fecha: '2026-11-10', lugar: 'Cancha principal', cupo: 120, inscritos: 84 },
  { id: 1, tipo: 'convocatoria', titulo: 'Movilidad estudiantil 2027-1', categoria: 'ACADÉMICO', fecha: '2026-12-01', lugar: 'Oficina de Relaciones Internacionales', cupo: 30, inscritos: 0 },
];
const listar = url => invocar(S, 'GET', url, { token: S.token(U.est) });
const consulta = () => S.db.con('FROM publicaciones p')[0];

describe('HU06 · Consultar publicaciones', () => {
  beforeEach(() => S.db.cuando('FROM publicaciones p', filas(FEED)));

  it('CP-C01 · HU06 · Un usuario autenticado recibe la lista de publicaciones → 200', async () => {
    const r = await listar('/api/publicaciones');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body, FEED);
  });
  it('CP-C02 · HU06 · Sin sesión no se pueden consultar publicaciones → 401', async () => {
    const r = await invocar(S, 'GET', '/api/publicaciones');
    assert.equal(r.statusCode, 401);
  });
  it("CP-C03 · HU06 · Solo se listan publicaciones activas (las eliminadas no aparecen)", async () => {
    await listar('/api/publicaciones');
    assert.ok(consulta().sql.includes("p.estado = 'activa'"));
  });
  it('CP-C04 · HU06 · Orden de más reciente a más antigua y máximo 100 resultados', async () => {
    await listar('/api/publicaciones');
    assert.ok(consulta().sql.endsWith('ORDER BY p.fecha_publicacion DESC LIMIT 100'));
  });
  it('CP-C05 · HU06 · Cada fila incluye datos del evento: fecha, lugar, cupo e inscritos (HU09/HU10)', async () => {
    const r = await listar('/api/publicaciones');
    for (const campo of ['fecha', 'lugar', 'cupo', 'inscritos']) assert.ok(campo in r.body[0], campo);
  });
  it('CP-C06 · HU06 · Los indicadores "me gusta / guardado / inscrito" se calculan para el usuario de la sesión', async () => {
    await listar('/api/publicaciones');
    assert.deepEqual(consulta().params, [U.est.id, U.est.id, U.est.id]);
  });
});

describe('HU07 · Buscar información', () => {
  beforeEach(() => S.db.cuando('FROM publicaciones p', filas([])));

  it('CP-C07 · HU07 · Buscar "fútbol" filtra por título y descripción con LIKE', async () => {
    await listar('/api/publicaciones?q=f%C3%BAtbol');
    assert.ok(consulta().sql.includes('(p.titulo LIKE ? OR p.contenido LIKE ?)'));
    assert.deepEqual(consulta().params.slice(3), ['%fútbol%', '%fútbol%']);
  });
  it('CP-C08 · HU07 · Una búsqueda sin coincidencias devuelve lista vacía (la interfaz muestra el mensaje)', async () => {
    const r = await listar('/api/publicaciones?q=zzz');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body, []);
  });
  it('CP-C09 · HU07 · Sin término de búsqueda no se agrega la condición LIKE', async () => {
    await listar('/api/publicaciones');
    assert.ok(!consulta().sql.includes('LIKE'));
  });
  it('CP-C10 · HU07 · Texto malicioso en la búsqueda viaja como parámetro, nunca dentro del SQL', async () => {
    await listar('/api/publicaciones?q=' + encodeURIComponent("'; DROP TABLE usuarios; --"));
    assert.ok(!consulta().sql.includes('DROP'));
    assert.ok(consulta().params.some(p => String(p).includes('DROP TABLE')));
  });
});

describe('HU08 · Filtrar publicaciones', () => {
  beforeEach(() => S.db.cuando('FROM publicaciones p', filas([])));

  it('CP-C11 · HU08 · Filtrar por categoría DEPORTIVO agrega la condición por nombre de categoría', async () => {
    await listar('/api/publicaciones?categoria=DEPORTIVO');
    assert.ok(consulta().sql.includes('AND c.nombre = ?'));
    assert.equal(consulta().params[3], 'DEPORTIVO');
  });
  it('CP-C12 · HU08 · Filtrar por tipo "evento" (menú Eventos) agrega la condición por tipo', async () => {
    await listar('/api/publicaciones?tipo=evento');
    assert.ok(consulta().sql.includes('AND p.tipo = ?'));
    assert.equal(consulta().params[3], 'evento');
  });
  it('CP-C13 · HU08 · Sin filtros (quitar el filtro) vuelve a listar todo', async () => {
    await listar('/api/publicaciones');
    assert.ok(!consulta().sql.includes('c.nombre = ?') && !consulta().sql.includes('p.tipo = ?'));
  });
  it('CP-C14 · HU08 · Tipo + categoría + búsqueda combinados conservan el orden de los parámetros', async () => {
    await listar('/api/publicaciones?tipo=evento&categoria=CULTURAL&q=noche');
    assert.deepEqual(consulta().params, [5, 5, 5, 'evento', 'CULTURAL', '%noche%', '%noche%']);
  });
});

describe('Categorías', () => {
  it('CP-C15 · HU08 · Lista las categorías activas para el usuario autenticado', async () => {
    S.db.cuando('FROM categorias_evento WHERE activo = 1', filas([{ id: 1, nombre: 'ACADÉMICO' }, { id: 2, nombre: 'DEPORTIVO' }]));
    const r = await invocar(S, 'GET', '/api/categorias', { token: S.token(U.est) });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.length, 2);
  });
  it('CP-C16 · HU08 · Sin sesión no se pueden consultar las categorías → 401', async () => {
    assert.equal((await invocar(S, 'GET', '/api/categorias')).statusCode, 401);
  });
});
