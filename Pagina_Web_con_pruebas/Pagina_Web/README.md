# UCampus · v0.2 (login por rol + backend)

Express + MySQL 8 + JWT. El frontend (`public/index.html`) lo sirve el mismo servidor.

## Puesta en marcha
1. Instala Node 18+ y MySQL 8.
2. `mysql -u root -p < schema.sql`
3. Copia `.env.example` a `.env` y completa la clave de MySQL y un `JWT_SECRET` largo.
4. `npm install`
5. `npm run seed`   (crea roles, categorías, usuarios y publicaciones de ejemplo)
6. `npm start` → http://localhost:3000

## Usuarios de prueba (clave: `Ucampus2026*`)
| Rol | Correo |
|---|---|
| Administrador | admin@ucundinamarca.edu.co |
| Bienestar | bienestar@ucundinamarca.edu.co · deportes@ucundinamarca.edu.co |
| Docente | camilo.pena@ucundinamarca.edu.co |
| Estudiante | valentina.rojas@ucundinamarca.edu.co · laura.mendez@ucundinamarca.edu.co |

## Permisos por rol
| Acción | Estudiante | Docente | Bienestar | Admin |
|---|:-:|:-:|:-:|:-:|
| Consultar, buscar, filtrar, guardar, dar me gusta, comentar | ✓ | ✓ | ✓ | ✓ |
| Inscribirse a eventos / postularse | ✓ | | | |
| Crear publicaciones | | | ✓ | ✓ |
| Editar / eliminar | | | solo las suyas | todas |
| Gestionar usuarios y roles | | | | ✓ |

Los permisos se validan en el servidor (JWT de 8 h); ocultar botones en la interfaz es solo comodidad.

## API
`POST /api/auth/login` · `GET /api/auth/me` · `GET /api/categorias`
`GET|POST /api/publicaciones` · `PUT|DELETE /api/publicaciones/:id`
`POST /api/publicaciones/:id/{like|guardar|inscripcion}`
`GET|POST /api/publicaciones/:id/comentarios`
`GET /api/usuarios` · `GET /api/roles` · `PATCH /api/usuarios/:id/rol` (solo admin)

## Cambios respecto al diagrama ER
- `publicaciones` ahora tiene `tipo`, `titulo`, `id_categoria` e `id_evento` (opcional). `eventos` queda solo con lo propio del evento (fecha, lugar, cupo, requisitos).
- `eventos_guardados` → `publicaciones_guardadas` (también sirve para noticias).
- Tabla nueva `reacciones` (me gusta).
- Aún no se usan `materias`, `horarios` ni `estudiante_materia`; `espacios` es opcional y por ahora el lugar es texto libre.
