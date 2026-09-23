# Instrucciones para GitHub Copilot — Veridar

Este repositorio contiene **Veridar**, la app de commissioning/recodificación
que se usa en campo (Edificio 2). El antiguo "mapa de válvulas" quedó
obsoleto y fue reemplazado por Veridar como `index.html`.

## Qué es este proyecto

- `index.html` es una **app de una sola página, sin build step**. Incluye su
  propio CSS/JS y trae empaquetado `pdf.js` para poder cargar planos en PDF.
  No hay `package.json` ni proceso de compilación: cualquier cambio se hace
  directamente sobre ese archivo.
- Se usa muchas veces **sin conexión** (tablets/portátiles en obra), así que
  no añadas dependencias que necesiten red en tiempo de ejecución (CDNs
  externos, fuentes remotas, llamadas a APIs). Todo lo que necesite la app
  debe quedar embebido en el propio HTML, igual que `pdf.js` ahora.
- `manifest.webmanifest` y `sw.js` son soporte PWA heredado del proyecto
  anterior; sus textos ya están actualizados a Veridar pero no están
  enlazados desde `index.html` — no asumas que la app se registra como PWA
  a menos que se pida explícitamente.

## Modelo de datos de Veridar

Todo el estado de la app vive en dos objetos en memoria (persistidos en
`localStorage`/IndexedDB con las claves `ed2k_comm_data_v1` y
`ed2k_comm_planos`):

```
data[disciplina][nivel] = {
  secciones: [ seccion, ... ],   // una "sección" = un plano
  carpetas:  [ {nombre, revision, prioridad}, ... ]
}

seccion = {
  id, nombre, archivo, rotacion, revision, prioridad, carpeta,
  zonas: [...], blocs: [...],
  puntos: [ punto, ... ]
}

punto = {
  id, codigo, sistema, tipo, subtipo,
  estado,           // uno de ESTADOS
  fechaRevision, responsable,
  x, y,             // posición sobre el plano (null si no tiene, p.ej. dentro de un bloc)
  notas,
  fotos: [ dataURL, ... ],  // fotos EMBEBIDAS en base64, pueden pesar mucho
  grupo, mod,        // mod = timestamp de última modificación (para fusionar)
  dev                // id del dispositivo que hizo el cambio
}

planos[seccionId] = <imagen/PDF del plano en base64>   // separado de `data` por tamaño
```

Constantes clave a respetar cuando generes o sugieras código:

- `DISC_DEF` → disciplinas por defecto: `ARQ, ELE, FON, HVAC, PCI, OTR`.
- `NIV_DEF` → niveles por defecto: `L1, L2, L3, Roof`.
- `ESTADOS` → `pendiente, conforme, discrepancia, noexiste, noplano`.
- `INCIDENCIA` → subconjunto de `ESTADOS` que cuenta como incidencia:
  `discrepancia, noexiste, noplano`.
- `TIPOS_DEF` → tipos de punto (`Equipo`, `Válvula`, `Tubería`, `Luminaria`, …).

No inventes nuevos valores de `estado` ni de disciplina/nivel fuera de estas
listas sin que se pida explícitamente; el resto de la app (filtros, colores,
exportes CSV/Excel) depende de que estos valores sean exactamente esos.

## Exportación / respaldo (el "JSON de Veridar")

`exportarRespaldo()` genera el archivo que el usuario llama "el JSON":
`{ data, planos }`, descargado como
`commissioning_ed2_respaldo_<sufijo>_<fecha>.json`.

Hay dos formas de traer un respaldo de vuelta a la app:

- **Reemplazar** (`fileImport`): sustituye todo `data`/`planos` actuales.
- **🔀 Fusionar**: aditivo, nunca borra nada; compara por `id` y usa `mod`
  (el más reciente gana) para resolver conflictos entre dispositivos.

Cualquier herramienta externa que lea o combine estos JSON (incluida la
sincronización local, ver abajo) debe respetar esa misma regla de fusión
por `mod`, para no pisar cambios más nuevos hechos en otro dispositivo.

## Privacidad — regla no negociable

Los datos que maneja Veridar (inventario de instalaciones, notas, fotos del
edificio) son **confidenciales** y no se pueden compartir por internet.

- Nunca añadas código que envíe estos datos (ni JSON de respaldo, ni fotos,
  ni nombres de sala/equipo reales) a un servicio, API o backend externo.
- La sincronización de datos de Veridar es **local únicamente** (ver
  `db/`): un archivo SQLite en el propio equipo, sin red.
- Si necesitas datos de ejemplo para pruebas o para pedirle algo a Copilot,
  usa datos ficticios, nunca un respaldo real exportado de un edificio.

## Sincronización local (`db/`)

`db/sync-veridar.js` es un script de Node (sin dependencias externas, usa
`node:sqlite`) que importa un JSON de respaldo de Veridar a una base de
datos SQLite local (`db/veridar.sqlite` por defecto), para poder consultar
o cruzar información de varios respaldos/dispositivos sin depender de la
propia app. Ver `db/README.md` para el detalle de uso y del esquema.

Al tocar este script, mantén las mismas reglas que la app:
- el `estado` debe seguir siendo uno de `ESTADOS`;
- los conflictos por `id` se resuelven por `mod` más reciente, igual que la
  fusión dentro de Veridar;
- no añadir ninguna llamada de red.
