---
applyTo: "db/**"
---

# Herramienta de sincronización local (`db/`)

`db/sync-veridar.js` importa respaldos JSON de Veridar a una base SQLite
local. Es la única "sincronización" que existe en este proyecto — no hay
backend ni nube.

Al tocar este código:

- **Ningún tipo de red.** Nada de `fetch`, clientes HTTP, SDKs de nube
  (Supabase, Firebase, AWS, etc.) ni de mensajería. Si en algún momento se
  pide de verdad un backend remoto, es una decisión explícita del usuario,
  no algo que se añada de forma incidental aquí.
- **Sin dependencias externas.** El script usa `node:sqlite` (incluido en
  Node ≥ 22.5) a propósito, para que corra en cualquier equipo de obra sin
  `npm install`. No añadas paquetes de npm salvo que el usuario lo pida
  explícitamente y explique por qué `node:sqlite` no alcanza.
- **Mismo criterio de fusión que Veridar.** Los conflictos entre respaldos
  se resuelven por `id` + `mod` (el `mod` más reciente gana), igual que la
  fusión "🔀" dentro de la propia app. No inventes otro criterio (por
  ejemplo "el último importado gana") sin dejarlo explícito y justificado.
- **El esquema SQL sigue al esquema de `data` en `index.html`.** Si
  `index.html` cambia la forma de `punto` o `seccion` (ver
  `.github/instructions/veridar-app.instructions.md`), este script y
  `db/README.md` deben actualizarse en el mismo cambio: columnas nuevas,
  normalización de valores, etc.
- **No hay que copiar las fotos** (`fotos[]`) a SQLite — son base64 y
  pueden ser pesadas; hoy solo se guarda `num_fotos`. Si se pide guardar
  las fotos en algún momento, coméntalo antes de implementarlo: cambia el
  tamaño y la naturaleza de la base de datos local.
- Cualquier script de prueba debe usar un JSON de respaldo **ficticio**
  (como el de los ejemplos en `db/README.md`), nunca un respaldo real
  exportado de un edificio.
