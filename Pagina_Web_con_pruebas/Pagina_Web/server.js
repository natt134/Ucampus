require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) { console.error('Define JWT_SECRET (mín. 16 caracteres) en .env'); process.exit(1); }

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ucampus',
  waitForConnections: true, connectionLimit: 10
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const PUBLICA = ['BIENESTAR', 'ADMIN'];          // roles que pueden publicar
const TIPOS = ['evento', 'convocatoria', 'noticia'];

/* ---------- autenticación y autorización ---------- */
const auth = (...roles) => (req, res, next) => {
  const h = req.headers.authorization || '';
  try { req.user = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', SECRET); }
  catch { return res.status(401).json({ error: 'Tu sesión terminó. Inicia sesión de nuevo.' }); }
  if (roles.length && !roles.includes(req.user.rol))
    return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' });
  next();
};

// Límite simple de intentos de login: 8 por IP cada 10 minutos
const intentos = new Map();
const limitar = (req, res, next) => {
  const k = req.ip, ahora = Date.now();
  const a = (intentos.get(k) || []).filter(t => ahora - t < 600000);
  if (a.length >= 8) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  a.push(ahora); intentos.set(k, a); next();
};

app.post('/api/auth/login', limitar, wrap(async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'Ingresa tu correo o usuario y tu contraseña.' });
  const [[u]] = await pool.query(
    `SELECT u.*, r.nombre rol FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
     WHERE (u.correo = ? OR u.nombre_usuario = ?) AND u.activo = 1`, [usuario, usuario]);
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  const user = { id: u.id_usuario, nombre: `${u.nombres} ${u.apellidos}`, rol: u.rol };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '8h' }), user });
}));

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: req.user }));

/* ---------- categorías ---------- */
app.get('/api/categorias', auth(), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id_categoria id, nombre FROM categorias_evento WHERE activo = 1 ORDER BY id_categoria');
  res.json(rows);
}));

/* ---------- publicaciones ---------- */
const BASE = `
SELECT p.id_publicacion id, p.tipo, p.titulo, p.contenido, c.nombre categoria, p.fecha_publicacion creada,
  e.fecha_inicio fecha, e.lugar, e.cupo_maximo cupo,
  u.id_usuario autor_id, CONCAT(u.nombres,' ',u.apellidos) autor, r.nombre autor_rol,
  (SELECT COUNT(*) FROM inscripciones_evento i WHERE i.id_evento = e.id_evento AND i.estado = 'confirmada') inscritos,
  (SELECT COUNT(*) FROM reacciones x WHERE x.id_publicacion = p.id_publicacion) likes,
  (SELECT COUNT(*) FROM comentarios m WHERE m.id_publicacion = p.id_publicacion AND m.estado = 'visible') comentarios,
  EXISTS(SELECT 1 FROM reacciones x WHERE x.id_publicacion = p.id_publicacion AND x.id_usuario = ?) liked,
  EXISTS(SELECT 1 FROM publicaciones_guardadas g WHERE g.id_publicacion = p.id_publicacion AND g.id_usuario = ?) guardado,
  EXISTS(SELECT 1 FROM inscripciones_evento i JOIN estudiantes s ON s.id_estudiante = i.id_estudiante
         WHERE i.id_evento = e.id_evento AND s.id_usuario = ? AND i.estado = 'confirmada') inscrito
FROM publicaciones p
JOIN usuarios u ON u.id_usuario = p.id_usuario
JOIN roles r ON r.id_rol = u.id_rol
JOIN categorias_evento c ON c.id_categoria = p.id_categoria
LEFT JOIN eventos e ON e.id_evento = p.id_evento
WHERE p.estado = 'activa'`;

app.get('/api/publicaciones', auth(), wrap(async (req, res) => {
  const { tipo, categoria, q } = req.query;
  const prm = [req.user.id, req.user.id, req.user.id];
  let sql = BASE;
  if (tipo) { sql += ' AND p.tipo = ?'; prm.push(tipo); }
  if (categoria) { sql += ' AND c.nombre = ?'; prm.push(categoria); }
  if (q) { sql += ' AND (p.titulo LIKE ? OR p.contenido LIKE ?)'; prm.push(`%${q}%`, `%${q}%`); }
  const [rows] = await pool.query(sql + ' ORDER BY p.fecha_publicacion DESC LIMIT 100', prm);
  res.json(rows);
}));

async function limpiar(b, tipoFijo) {
  const tipo = tipoFijo || b.tipo;
  const titulo = String(b.titulo || '').trim(), contenido = String(b.contenido || '').trim();
  if (!TIPOS.includes(tipo)) return { error: 'Tipo de publicación no válido.' };
  if (titulo.length < 3 || titulo.length > 150) return { error: 'El título debe tener entre 3 y 150 caracteres.' };
  if (!contenido) return { error: 'Escribe la descripción de la publicación.' };
  const [[c]] = await pool.query('SELECT id_categoria FROM categorias_evento WHERE nombre = ? AND activo = 1', [b.categoria]);
  if (!c) return { error: 'Selecciona una categoría válida.' };
  let fecha = null;
  if (tipo !== 'noticia') {
    fecha = new Date(b.fecha);
    if (!b.fecha || isNaN(fecha)) return { error: 'Los eventos y convocatorias necesitan una fecha válida.' };
  }
  const cupo = Math.max(0, parseInt(b.cupo, 10) || 0);
  return { tipo, titulo, contenido, idCat: c.id_categoria, fecha, cupo, lugar: String(b.lugar || '').trim().slice(0, 150) };
}

app.post('/api/publicaciones', auth(...PUBLICA), wrap(async (req, res) => {
  const d = await limpiar(req.body || {});
  if (d.error) return res.status(400).json({ error: d.error });
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    let idEvento = null;
    if (d.tipo !== 'noticia') {
      const [r] = await cx.query(
        'INSERT INTO eventos (id_usuario_creador, fecha_inicio, lugar, cupo_maximo, requiere_inscripcion) VALUES (?,?,?,?,?)',
        [req.user.id, d.fecha, d.lugar, d.cupo || null, d.cupo ? 1 : 0]);
      idEvento = r.insertId;
    }
    const [p] = await cx.query(
      'INSERT INTO publicaciones (id_usuario, id_categoria, id_evento, tipo, titulo, contenido) VALUES (?,?,?,?,?,?)',
      [req.user.id, d.idCat, idEvento, d.tipo, d.titulo, d.contenido]);
    await cx.commit();
    res.status(201).json({ id: p.insertId });
  } catch (e) { await cx.rollback(); throw e; } finally { cx.release(); }
}));

// BIENESTAR solo toca lo suyo; ADMIN toca todo.
async function propia(req, res) {
  const [[p]] = await pool.query("SELECT id_usuario, id_evento, tipo FROM publicaciones WHERE id_publicacion = ? AND estado = 'activa'", [req.params.id]);
  if (!p) { res.status(404).json({ error: 'La publicación no existe.' }); return null; }
  if (req.user.rol !== 'ADMIN' && p.id_usuario !== req.user.id) { res.status(403).json({ error: 'Solo puedes modificar tus propias publicaciones.' }); return null; }
  return p;
}

app.put('/api/publicaciones/:id', auth(...PUBLICA), wrap(async (req, res) => {
  const p = await propia(req, res); if (!p) return;
  const d = await limpiar(req.body || {}, p.tipo);
  if (d.error) return res.status(400).json({ error: d.error });
  await pool.query('UPDATE publicaciones SET id_categoria=?, titulo=?, contenido=? WHERE id_publicacion=?', [d.idCat, d.titulo, d.contenido, req.params.id]);
  if (p.id_evento) await pool.query('UPDATE eventos SET fecha_inicio=?, lugar=?, cupo_maximo=?, requiere_inscripcion=? WHERE id_evento=?',
    [d.fecha, d.lugar, d.cupo || null, d.cupo ? 1 : 0, p.id_evento]);
  res.json({ ok: true });
}));

app.delete('/api/publicaciones/:id', auth(...PUBLICA), wrap(async (req, res) => {
  const p = await propia(req, res); if (!p) return;
  await pool.query("UPDATE publicaciones SET estado = 'eliminada' WHERE id_publicacion = ?", [req.params.id]);
  res.json({ ok: true });
}));

/* ---------- interacción: me gusta, guardar, comentar, inscribirse ---------- */
const alternar = (tabla, extra) => wrap(async (req, res) => {
  const prm = [req.params.id, req.user.id];
  const [d] = await pool.query(`DELETE FROM ${tabla} WHERE id_publicacion = ? AND id_usuario = ?`, prm);
  if (!d.affectedRows) await pool.query(`INSERT INTO ${tabla} (id_publicacion, id_usuario) VALUES (?, ?)`, prm);
  res.json({ activo: !d.affectedRows });
});
app.post('/api/publicaciones/:id/like', auth(), alternar('reacciones'));
app.post('/api/publicaciones/:id/guardar', auth(), alternar('publicaciones_guardadas'));

app.get('/api/publicaciones/:id/comentarios', auth(), wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id_comentario id, m.contenido, m.fecha_comentario fecha, CONCAT(u.nombres,' ',u.apellidos) autor
     FROM comentarios m JOIN usuarios u ON u.id_usuario = m.id_usuario
     WHERE m.id_publicacion = ? AND m.estado = 'visible' ORDER BY m.fecha_comentario`, [req.params.id]);
  res.json(rows);
}));

app.post('/api/publicaciones/:id/comentarios', auth(), wrap(async (req, res) => {
  const t = String((req.body || {}).contenido || '').trim();
  if (!t) return res.status(400).json({ error: 'Escribe algo antes de enviar el comentario.' });
  if (t.length > 1000) return res.status(400).json({ error: 'El comentario no puede superar 1000 caracteres.' });
  await pool.query('INSERT INTO comentarios (id_publicacion, id_usuario, contenido) VALUES (?,?,?)', [req.params.id, req.user.id, t]);
  res.status(201).json({ ok: true });
}));

app.post('/api/publicaciones/:id/inscripcion', auth('ESTUDIANTE'), wrap(async (req, res) => {
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [[ev]] = await cx.query(
      `SELECT e.id_evento, e.cupo_maximo FROM publicaciones p JOIN eventos e ON e.id_evento = p.id_evento
       WHERE p.id_publicacion = ? AND p.estado = 'activa' FOR UPDATE`, [req.params.id]);
    const [[est]] = await cx.query('SELECT id_estudiante FROM estudiantes WHERE id_usuario = ?', [req.user.id]);
    if (!ev || !est) { await cx.rollback(); return res.status(404).json({ error: 'Esta publicación no admite inscripción.' }); }
    const [[ya]] = await cx.query("SELECT id_inscripcion FROM inscripciones_evento WHERE id_evento = ? AND id_estudiante = ? AND estado = 'confirmada'", [ev.id_evento, est.id_estudiante]);
    if (ya) {
      await cx.query("UPDATE inscripciones_evento SET estado = 'cancelada' WHERE id_inscripcion = ?", [ya.id_inscripcion]);
      await cx.commit(); return res.json({ activo: false });
    }
    const [[{ n }]] = await cx.query("SELECT COUNT(*) n FROM inscripciones_evento WHERE id_evento = ? AND estado = 'confirmada'", [ev.id_evento]);
    if (ev.cupo_maximo && n >= ev.cupo_maximo) { await cx.rollback(); return res.status(409).json({ error: 'El cupo ya está lleno.' }); }
    await cx.query(`INSERT INTO inscripciones_evento (id_evento, id_estudiante) VALUES (?,?)
                    ON DUPLICATE KEY UPDATE estado = 'confirmada', fecha_inscripcion = NOW()`, [ev.id_evento, est.id_estudiante]);
    await cx.commit(); res.json({ activo: true });
  } catch (e) { await cx.rollback(); throw e; } finally { cx.release(); }
}));

/* ---------- administración de usuarios y roles (HU02) ---------- */
app.get('/api/usuarios', auth('ADMIN'), wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id_usuario id, CONCAT(u.nombres,' ',u.apellidos) nombre, u.correo, r.nombre rol
     FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol WHERE u.activo = 1 ORDER BY u.nombres`);
  res.json(rows);
}));
app.get('/api/roles', auth('ADMIN'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT nombre FROM roles ORDER BY id_rol');
  res.json(rows.map(r => r.nombre));
}));
app.patch('/api/usuarios/:id/rol', auth('ADMIN'), wrap(async (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
  const [[r]] = await pool.query('SELECT id_rol FROM roles WHERE nombre = ?', [(req.body || {}).rol]);
  if (!r) return res.status(400).json({ error: 'Rol no válido.' });
  const [u] = await pool.query('UPDATE usuarios SET id_rol = ? WHERE id_usuario = ?', [r.id_rol, req.params.id]);
  if (!u.affectedRows) return res.status(404).json({ error: 'El usuario no existe.' });
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((e, req, res, next) => {
  console.error(e);
  if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'La publicación no existe.' });
  res.status(500).json({ error: 'Error del servidor. Intenta de nuevo en un momento.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UCampus en http://localhost:${PORT}`));
