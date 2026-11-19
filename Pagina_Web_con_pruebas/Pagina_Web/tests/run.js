'use strict';
// Ejecutor multiplataforma de las pruebas unitarias (Windows / Linux / macOS).
//   npm test                 -> corre todas las pruebas
//   npm run test:cobertura   -> además muestra el % de cobertura de server.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const archivos = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort().map(f => path.join(__dirname, f));
const args = ['--test'];
if (process.argv.includes('--cobertura')) args.push('--experimental-test-coverage');
if (process.argv.includes('--junit')) args.push('--test-reporter=junit', '--test-reporter-destination=' + path.join(__dirname, 'reporte.xml'));
const r = spawnSync(process.execPath, [...args, ...archivos], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
