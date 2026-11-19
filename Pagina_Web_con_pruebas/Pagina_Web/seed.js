// Datos de demostración. Uso: npm run seed   (después de ejecutar schema.sql)
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const CLAVE = 'Ucampus2026*';
const dia = (n, h = 10) => { const d = new Date(Date.now() + n * 864e5); d.setHours(h, 0, 0, 0); return d; };

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'ucampus'
  });
  const [[{ n }]] = await db.query('SELECT COUNT(*) n FROM roles');
  if (n) { console.log('La base ya tiene datos. Vacía las tablas o recrea el esquema para volver a sembrar.'); return db.end(); }

  for (const [r, d] of [['ESTUDIANTE', 'Consulta, comenta e inscribe'], ['DOCENTE', 'Consulta y comenta'],
    ['BIENESTAR', 'Publica y gestiona sus publicaciones'], ['ADMIN', 'Gestiona usuarios, roles y publicaciones']])
    await db.query('INSERT INTO roles (nombre, descripcion) VALUES (?,?)', [r, d]);
  const rol = {}; (await db.query('SELECT id_rol, nombre FROM roles'))[0].forEach(r => rol[r.nombre] = r.id_rol);

  await db.query("INSERT INTO programas_academicos (nombre, codigo) VALUES ('Ingeniería de Sistemas','ISIS')");
  for (const c of ['ACADÉMICO', 'DEPORTIVO', 'CULTURAL', 'BIENESTAR', 'TALLER'])
    await db.query('INSERT INTO categorias_evento (nombre) VALUES (?)', [c]);
  const cat = {}; (await db.query('SELECT id_categoria, nombre FROM categorias_evento'))[0].forEach(c => cat[c.nombre] = c.id_categoria);

  const hash = await bcrypt.hash(CLAVE, 10);
  const U = {};
  for (const [k, rl, nom, ape, mail] of [
    ['admin', 'ADMIN', 'Admin', 'UCampus', 'admin@ucundinamarca.edu.co'],
    ['bien', 'BIENESTAR', 'Bienestar', 'Universitario', 'bienestar@ucundinamarca.edu.co'],
    ['dep', 'BIENESTAR', 'Deportes', 'UdeC', 'deportes@ucundinamarca.edu.co'],
    ['doc', 'DOCENTE', 'Camilo', 'Peña', 'camilo.pena@ucundinamarca.edu.co'],
    ['val', 'ESTUDIANTE', 'Valentina', 'Rojas', 'valentina.rojas@ucundinamarca.edu.co'],
    ['lau', 'ESTUDIANTE', 'Laura', 'Méndez', 'laura.mendez@ucundinamarca.edu.co']]) {
    const [r] = await db.query('INSERT INTO usuarios (id_rol, nombre_usuario, correo, password_hash, nombres, apellidos) VALUES (?,?,?,?,?,?)',
      [rol[rl], mail.split('@')[0], mail, hash, nom, ape]);
    U[k] = r.insertId;
    if (rl === 'ESTUDIANTE') await db.query('INSERT INTO estudiantes (id_usuario, id_programa, codigo_estudiantil, semestre, jornada) VALUES (?,1,?,6,?)', [r.insertId, 'E' + r.insertId + '0001', 'Diurna']);
  }

  const pub = async (u, tipo, c, titulo, texto, fecha, lugar, cupo) => {
    let ev = null;
    if (fecha) ev = (await db.query('INSERT INTO eventos (id_usuario_creador, fecha_inicio, lugar, cupo_maximo, requiere_inscripcion) VALUES (?,?,?,?,?)',
      [U[u], fecha, lugar, cupo || null, cupo ? 1 : 0]))[0].insertId;
    await db.query('INSERT INTO publicaciones (id_usuario, id_categoria, id_evento, tipo, titulo, contenido) VALUES (?,?,?,?,?,?)', [U[u], cat[c], ev, tipo, titulo, texto]);
  };
  await pub('dep', 'evento', 'DEPORTIVO', 'Torneo interfacultades de fútbol', 'Arranca la fase de grupos. Ingeniería vs Ciencias Administrativas abre la jornada.', dia(6, 15), 'Cancha principal', 120);
  await pub('bien', 'convocatoria', 'ACADÉMICO', 'Convocatoria de movilidad estudiantil 2027-1', 'Intercambio con universidades aliadas. Requisitos: promedio mínimo de 3.8 y 50 % de créditos aprobados.', dia(20, 17), 'Oficina de Relaciones Internacionales', 30);
  await pub('bien', 'evento', 'CULTURAL', 'Noche de talentos UdeC', 'Música, monólogos y danza hechos por estudiantes. Inscribe tu acto en Bienestar.', dia(25, 18), 'Auditorio principal', 200);
  await pub('bien', 'evento', 'TALLER', 'Taller de pintura mural', 'Nueva jornada del mural colaborativo. Materiales incluidos.', dia(10, 14), 'Bloque de Bienestar', 25);
  await pub('admin', 'noticia', 'BIENESTAR', 'Biblioteca abre hasta las 10 p. m.', 'Se amplió el horario de la biblioteca central entre semana.', null);
  console.log(`Listo. Todos los usuarios usan la clave: ${CLAVE}`);
  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
