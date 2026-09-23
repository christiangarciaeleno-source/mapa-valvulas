#!/usr/bin/env node
// Sincroniza un JSON de respaldo de Veridar (commissioning_ed2_respaldo_*.json)
// con una base de datos SQLite LOCAL. No hace ninguna llamada de red: todo
// se queda en el equipo, porque los datos son confidenciales.
//
// Uso:
//   node db/sync-veridar.js <respaldo.json> [--db=./db/veridar.sqlite]
//
// Se puede correr varias veces con distintos respaldos (de distintos
// dispositivos/tablets): los puntos se identifican por `id` y, si ya
// existían, solo se actualizan cuando el `mod` (timestamp) del respaldo es
// más reciente que el que ya está en la base — el mismo criterio que usa
// Veridar para fusionar respaldos entre dispositivos.

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ESTADOS = ['pendiente', 'conforme', 'discrepancia', 'noexiste', 'noplano'];

function parseArgs(argv) {
  const args = { db: path.join(__dirname, 'veridar.sqlite') };
  const positional = [];
  for (const a of argv) {
    if (a.startsWith('--db=')) args.db = a.slice(5);
    else positional.push(a);
  }
  args.archivo = positional[0];
  return args;
}

function abrirDb(rutaDb) {
  const db = new DatabaseSync(rutaDb);
  db.exec(`
    CREATE TABLE IF NOT EXISTS secciones (
      id TEXT PRIMARY KEY,
      disciplina TEXT NOT NULL,
      nivel TEXT NOT NULL,
      nombre TEXT,
      archivo TEXT,
      revision TEXT,
      prioridad INTEGER,
      carpeta TEXT
    );
    CREATE TABLE IF NOT EXISTS puntos (
      id TEXT PRIMARY KEY,
      seccion_id TEXT NOT NULL,
      disciplina TEXT NOT NULL,
      nivel TEXT NOT NULL,
      codigo TEXT,
      sistema TEXT,
      tipo TEXT,
      subtipo TEXT,
      estado TEXT NOT NULL,
      fecha_revision TEXT,
      responsable TEXT,
      x REAL,
      y REAL,
      notas TEXT,
      num_fotos INTEGER DEFAULT 0,
      grupo TEXT,
      dev TEXT,
      mod INTEGER DEFAULT 0,
      origen_archivo TEXT,
      importado_en TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_puntos_estado ON puntos(estado);
    CREATE INDEX IF NOT EXISTS idx_puntos_seccion ON puntos(seccion_id);
  `);
  return db;
}

function normalizarEstado(estado) {
  return ESTADOS.includes(estado) ? estado : 'pendiente';
}

function sincronizar(db, respaldoPath) {
  const crudo = fs.readFileSync(respaldoPath, 'utf8');
  const json = JSON.parse(crudo);
  const data = json && json.data ? json.data : json;
  if (!data || typeof data !== 'object') {
    throw new Error('El archivo no parece un respaldo válido de Veridar (falta "data").');
  }

  const upsertSeccion = db.prepare(`
    INSERT INTO secciones (id, disciplina, nivel, nombre, archivo, revision, prioridad, carpeta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      disciplina=excluded.disciplina, nivel=excluded.nivel, nombre=excluded.nombre,
      archivo=excluded.archivo, revision=excluded.revision, prioridad=excluded.prioridad,
      carpeta=excluded.carpeta
  `);

  const upsertPunto = db.prepare(`
    INSERT INTO puntos (id, seccion_id, disciplina, nivel, codigo, sistema, tipo, subtipo,
      estado, fecha_revision, responsable, x, y, notas, num_fotos, grupo, dev, mod,
      origen_archivo, importado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      seccion_id=excluded.seccion_id, disciplina=excluded.disciplina, nivel=excluded.nivel,
      codigo=excluded.codigo, sistema=excluded.sistema, tipo=excluded.tipo, subtipo=excluded.subtipo,
      estado=excluded.estado, fecha_revision=excluded.fecha_revision, responsable=excluded.responsable,
      x=excluded.x, y=excluded.y, notas=excluded.notas, num_fotos=excluded.num_fotos,
      grupo=excluded.grupo, dev=excluded.dev, mod=excluded.mod,
      origen_archivo=excluded.origen_archivo, importado_en=excluded.importado_en
    WHERE excluded.mod >= puntos.mod
  `);

  const ahora = new Date().toISOString();
  let secciones = 0, puntosVistos = 0, puntosAplicados = 0;

  for (const disciplina of Object.keys(data)) {
    const porNivel = data[disciplina] || {};
    for (const nivel of Object.keys(porNivel)) {
      const bloque = porNivel[nivel];
      const listaSecciones = Array.isArray(bloque && bloque.secciones) ? bloque.secciones : [];
      for (const sec of listaSecciones) {
        upsertSeccion.run(
          String(sec.id ?? ''), disciplina, nivel, sec.nombre ?? '', sec.archivo ?? '',
          sec.revision ?? '', Number(sec.prioridad) || 0, sec.carpeta ?? ''
        );
        secciones++;

        const puntos = Array.isArray(sec.puntos) ? sec.puntos : [];
        for (const p of puntos) {
          puntosVistos++;
          const resultado = upsertPunto.run(
            String(p.id ?? ''), String(sec.id ?? ''), disciplina, nivel,
            p.codigo ?? '', p.sistema ?? '', p.tipo ?? '', p.subtipo ?? '',
            normalizarEstado(p.estado), p.fechaRevision ?? '', p.responsable ?? '',
            typeof p.x === 'number' ? p.x : null, typeof p.y === 'number' ? p.y : null,
            p.notas ?? '', Array.isArray(p.fotos) ? p.fotos.length : 0,
            p.grupo ?? '', p.dev ?? '', Number(p.mod) || 0,
            path.basename(respaldoPath), ahora
          );
          if (resultado.changes > 0) puntosAplicados++;
        }
      }
    }
  }

  return { secciones, puntosVistos, puntosAplicados };
}

function resumen(db) {
  const filas = db.prepare('SELECT estado, COUNT(*) AS n FROM puntos GROUP BY estado').all();
  const total = db.prepare('SELECT COUNT(*) AS n FROM puntos').get().n;
  console.log('\nResumen actual de la base local:');
  console.log(`  total de puntos: ${total}`);
  for (const fila of filas) console.log(`  ${fila.estado}: ${fila.n}`);
}

function main() {
  const { archivo, db: rutaDb } = parseArgs(process.argv.slice(2));
  if (!archivo) {
    console.error('Uso: node db/sync-veridar.js <respaldo.json> [--db=./db/veridar.sqlite]');
    process.exit(1);
  }
  if (!fs.existsSync(archivo)) {
    console.error(`No se encuentra el archivo: ${archivo}`);
    process.exit(1);
  }

  const db = abrirDb(rutaDb);
  try {
    const { secciones, puntosVistos, puntosAplicados } = sincronizar(db, archivo);
    console.log(`Importado "${path.basename(archivo)}" en ${rutaDb}`);
    console.log(`  secciones (planos) procesadas: ${secciones}`);
    console.log(`  puntos vistos en el respaldo: ${puntosVistos}`);
    console.log(`  puntos nuevos/actualizados: ${puntosAplicados}`);
    resumen(db);
  } finally {
    db.close();
  }
}

main();
