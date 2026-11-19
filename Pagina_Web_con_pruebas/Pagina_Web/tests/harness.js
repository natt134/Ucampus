'use strict';
/**
 * Arnés de pruebas unitarias para server.js (UCampus)
 * ---------------------------------------------------
 * Carga el server.js REAL, pero reemplaza sus dependencias externas por dobles
 * de prueba (stubs/fakes), de modo que cada prueba es rápida, aislada y no
 * necesita MySQL, red ni dependencias instaladas:
 *   - express          -> registra las rutas y permite invocarlas directamente
 *   - mysql2/promise   -> base de datos falsa programable por prueba
 *   - jsonwebtoken     -> firma/verificación simulada
 *   - bcryptjs         -> comparación simulada ('hash:' + clave)
 *   - dotenv           -> sin efecto
 */
const Module = require('module');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'server.js');
const SECRET = 'secreto-de-pruebas-0123456789';

/* ---------- Usuarios de ejemplo (coinciden con los roles del sistema) ---------- */
const U = {
  admin: { id: 1, nombre: 'Admin UCampus', rol: 'ADMIN' },
  bien: { id: 2, nombre: 'Bienestar Universitario', rol: 'BIENESTAR' },
  bien2: { id: 3, nombre: 'Deportes UdeC', rol: 'BIENESTAR' },
  doc: { id: 4, nombre: 'Camilo Peña', rol: 'DOCENTE' },
  est: { id: 5, nombre: 'Valentina Rojas', rol: 'ESTUDIANTE' },
};

/* ---------- Atajos para describir resultados de consultas SQL ---------- */
const uno = fila => [[fila]];            // const [[x]] = await pool.query(...)
const ninguno = () => [[]];              // sin filas
const filas = lista => [lista];          // const [rows] = await pool.query(...)
const ok = (extra = {}) => [{ affectedRows: 1, insertId: 0, ...extra }];
const sinCambios = () => [{ affectedRows: 0 }];
const falla = (msg = 'fallo simulado', code) => Object.assign(new Error(msg), code ? { code } : {});

/* ---------- Base de datos falsa ---------- */
class BaseFalsa {
  constructor() { this.reglas = []; this.llamadas = []; this.eventos = []; }
  /** Programa la respuesta para toda consulta SQL que contenga `patron`. La última regla registrada gana. */
  cuando(patron, resultado) { this.reglas.push({ patron, resultado }); return this; }
  async query(sql, params = []) {
    const limpio = sql.replace(/\s+/g, ' ').trim();
    this.llamadas.push({ sql: limpio, params });
    const regla = [...this.reglas].reverse().find(r => r.patron instanceof RegExp ? r.patron.test(limpio) : limpio.includes(r.patron));
    if (!regla) throw new Error('Consulta SQL no prevista en la prueba: ' + limpio.slice(0, 90));
    const v = typeof regla.resultado === 'function' ? regla.resultado(limpio, params) : regla.resultado;
    if (v instanceof Error) throw v;
    return v;
  }
  async getConnection() {
    const db = this;
    return {
      query: (s, p) => db.query(s, p),
      beginTransaction: async () => db.eventos.push('begin'),
      commit: async () => db.eventos.push('commit'),
      rollback: async () => db.eventos.push('rollback'),
      release: () => db.eventos.push('release'),
    };
  }
  /** Consultas ejecutadas cuyo SQL contiene `texto`. */
  con(texto) { return this.llamadas.filter(c => c.sql.includes(texto)); }
}

/* ---------- JWT falso ---------- */
function crearJwtFalso() {
  const jwt = {
    ultimaOpcion: null,
    sign(payload, secret, opciones = {}) {
      jwt.ultimaOpcion = opciones;
      return 'tok.' + Buffer.from(JSON.stringify({ p: payload, s: secret, e: opciones.expiresIn })).toString('base64');
    },
    verify(token, secret) {
      if (typeof token !== 'string' || !token.startsWith('tok.')) throw new Error('jwt malformed');
      const o = JSON.parse(Buffer.from(token.slice(4), 'base64').toString());
      if (o.s !== secret) throw new Error('invalid signature');
      if (o.e === -1) throw new Error('jwt expired');
      return o.p;
    },
  };
  return jwt;
}

/* ---------- Express falso ---------- */
function crearExpressFalso() {
  const rutas = []; let manejadorError = null; let manejador404 = null;
  const app = {
    disable() {}, listen() {},
    use(...args) {
      const fn = args[args.length - 1];
      if (typeof fn === 'function' && fn.length === 4) manejadorError = fn;
      else if (args[0] === '/api' && typeof fn === 'function') manejador404 = fn;
    },
  };
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    app[m] = (ruta, ...handlers) => rutas.push({
      metodo: m.toUpperCase(), regex: new RegExp('^' + ruta.replace(/:(\w+)/g, '([^/]+)') + '$'),
      claves: (ruta.match(/:(\w+)/g) || []).map(s => s.slice(1)), handlers,
    });
  }
  const express = () => app;
  express.json = () => (req, res, next) => next();
  express.static = () => (req, res, next) => next();
  return { express, rutas, error: () => manejadorError, noEncontrada: () => manejador404 };
}

function crearRes() {
  return {
    statusCode: 200, body: undefined, terminada: false,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; this.terminada = true; return this; },
  };
}

/* ---------- Carga del servidor real con dependencias reemplazadas ---------- */
function cargarServidor() {
  const db = new BaseFalsa();
  const exp = crearExpressFalso();
  const jwt = crearJwtFalso();
  const errores = [];
  const mocks = {
    express: exp.express,
    'mysql2/promise': { createPool: () => db },
    bcryptjs: { compare: async (plano, hash) => hash === 'hash:' + plano, hash: async p => 'hash:' + p },
    jsonwebtoken: jwt,
    dotenv: { config() {} },
  };
  process.env.JWT_SECRET = SECRET;
  console.error = (...a) => errores.push(a);     // el manejador de errores usa console.error

  const original = Module._load;
  Module._load = function (request) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return original.apply(this, arguments);
  };
  try { delete require.cache[require.resolve(SERVER)]; require(SERVER); }
  finally { Module._load = original; }

  return { db, jwt, errores, rutas: exp.rutas, manejadorError: exp.error(), manejador404: exp.noEncontrada(),
    token: (usuario, opciones) => jwt.sign(usuario, SECRET, opciones) };
}

/* ---------- Ejecuta una petición HTTP simulada contra el server.js cargado ---------- */
async function invocar(S, metodo, url, { body, token, headers = {}, ip = '10.0.0.1' } = {}) {
  const [ruta, qs] = url.split('?');
  const req = { headers: { ...headers }, body, query: Object.fromEntries(new URLSearchParams(qs || '')), ip, params: {} };
  if (token) req.headers.authorization = 'Bearer ' + token;
  const res = crearRes();
  const r = S.rutas.find(x => x.metodo === metodo && x.regex.test(ruta));
  if (!r) { await S.manejador404(req, res); return res; }
  const m = ruta.match(r.regex);
  r.claves.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1]); });
  for (const h of r.handlers) {
    let siguio = false, err;
    await h(req, res, e => { siguio = true; err = e; });
    if (err) { S.manejadorError(err, req, res, () => {}); return res; }
    if (!siguio) break;
  }
  return res;
}

module.exports = { cargarServidor, invocar, U, SECRET, uno, ninguno, filas, ok, sinCambios, falla };
