# Sincronización local de Veridar

Herramienta para volcar los respaldos JSON que exporta Veridar
(`commissioning_ed2_respaldo_*.json`) a una base de datos SQLite en tu
propio equipo, para poder consultar o cruzar el inventario (por ejemplo,
de varias tablets o varias visitas) sin depender de abrir la app.

**Todo es local.** El script no hace ninguna llamada de red: solo lee el
JSON que le indiques y escribe en un archivo `.sqlite` en este mismo equipo.
No sube nada a internet ni a ningún servicio externo — los datos son
confidenciales y así se quedan.

## Requisitos

- Node.js 22.5 o superior (usa `node:sqlite`, incluido en Node; no hace
  falta instalar ninguna dependencia con `npm install`).

## Uso

```bash
node db/sync-veridar.js <ruta-al-respaldo.json>
```

Por defecto crea/actualiza `db/veridar.sqlite`. Para usar otra ruta:

```bash
node db/sync-veridar.js <ruta-al-respaldo.json> --db=/ruta/a/otra.sqlite
```

Puedes correrlo varias veces con respaldos de distintos dispositivos o
fechas: cada punto se identifica por su `id` y solo se sobrescribe cuando
el respaldo trae un `mod` (marca de tiempo de última edición) igual o más
reciente que el que ya hay guardado — el mismo criterio que usa Veridar al
fusionar respaldos entre dispositivos, para no pisar cambios más nuevos.

## Qué guarda y qué no

- Guarda: disciplina, nivel, plano (sección), código, sistema, tipo,
  estado, fecha de revisión, responsable, posición, notas, y cuántas fotos
  tiene cada punto (`num_fotos`).
- **No guarda las fotos en sí** (vienen como imágenes en base64 dentro del
  respaldo y pueden pesar mucho): solo el conteo. Si en algún momento hace
  falta consultarlas, se abren desde el respaldo JSON original o desde la
  propia app.

## Esquema

```
secciones(id, disciplina, nivel, nombre, archivo, revision, prioridad, carpeta)
puntos(id, seccion_id, disciplina, nivel, codigo, sistema, tipo, subtipo,
       estado, fecha_revision, responsable, x, y, notas, num_fotos,
       grupo, dev, mod, origen_archivo, importado_en)
```

`estado` es siempre uno de: `pendiente`, `conforme`, `discrepancia`,
`noexiste`, `noplano` (igual que en Veridar).

## Consultas de ejemplo

Con el propio Node:

```bash
node -e "
const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('./db/veridar.sqlite');
console.log(db.prepare('SELECT estado, COUNT(*) n FROM puntos GROUP BY estado').all());
"
```

O con cualquier cliente de SQLite instalado localmente (`sqlite3
db/veridar.sqlite`).

`db/veridar.sqlite` no se sube al repositorio (ver `.gitignore`): es una
base de datos con información real de obra y debe quedarse en tu equipo.
