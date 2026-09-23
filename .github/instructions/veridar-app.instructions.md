---
applyTo: "index.html"
---

# Editar Veridar (`index.html`)

Este archivo es la app completa: HTML + CSS + JS en un solo archivo, más
`pdf.js` empaquetado para leer planos en PDF. No hay build step ni
`package.json`: lo que se escribe aquí es literalmente lo que se abre en el
navegador/tablet.

Al proponer o generar cambios en este archivo:

- Respeta las constantes ya definidas — `DISC_DEF`, `NIV_DEF`, `ESTADOS`,
  `INCIDENCIA`, `TIPOS_DEF` — en vez de crear nuevos valores paralelos. Si
  hace falta un estado, disciplina, nivel o tipo nuevo, añádelo a la
  constante correspondiente, no lo escribas suelto en el código.
- Si cambias la forma de `punto`, `seccion` o del objeto `data` (añadir,
  quitar o renombrar un campo), actualiza en el mismo cambio:
  - `limpiarPuntoImp()` y la lógica de fusión/importación de respaldos,
    para que sigan aceptando respaldos antiguos sin romperse;
  - `db/sync-veridar.js` y `db/README.md` (ver
    `.github/instructions/sync-tool.instructions.md`), que dependen de esta
    misma forma de datos;
  - `.github/copilot-instructions.md`, que documenta el modelo de datos.
  Un cambio de esquema que solo toca `index.html` deja a la sincronización
  local leyendo datos desactualizados.
- No añadas llamadas de red (`fetch`, `XMLHttpRequest`, WebSockets, SDKs de
  analítica, etc.). La app se usa sin conexión en campo y maneja datos
  confidenciales; todo debe seguir funcionando 100% local.
- No metas nuevas dependencias externas (CDNs, npm). Si algo necesita una
  librería, se empaqueta inline como ya se hizo con `pdf.js`.
