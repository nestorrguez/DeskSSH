# Plan técnico — 001 Core

**Cómo** se construye lo descrito en [`spec.md`](./spec.md), respetando la
[`constitution.md`](../constitution.md). Las propuestas de stack son el punto de
partida recomendado, no un dogma; las decisiones abiertas se marcan
`[NECESITA DECISIÓN]`.

---

## 1. Resolución del conflicto web vs escritorio

Decisión de registro: **núcleo agnóstico + entrega web-first; desktop como
empaquetado posterior.**

Razones:

- El usuario quiere que "cualquiera pueda acceder en la red" → favorece web.
- El **navegador no puede abrir conexiones SSH/TCP crudas**, así que en el modelo
  web la sesión SSH debe vivir en un **backend** (gateway). Eso obliga, de todos
  modos, a tener un núcleo separable de la UI (Art. 5).
- Una vez que el núcleo es independiente, el **desktop** es simplemente
  empaquetar ese mismo núcleo localmente (p. ej. Tauri/Electron levantando el
  backend en `localhost`), sin reescribir lógica.

Resultado: **una sola base de lógica**, dos formas de entrega. Empezamos por web.
**Decisión confirmada (2026-06-25).**

```
┌────────────────────────────┐        ┌───────────────────────────────┐
│  Frontend (web / desktop)  │  WS/   │  Backend (gateway DeskSSH)    │
│  shell de escritorio + UI  │ <────> │  sesiones SSH + API           │
│  React + TS                │  HTTP  │  usa el NÚCLEO                 │
└────────────────────────────┘        │   ┌────────────────────────┐  │   SSH
                                       │   │  core (agnóstico)      │  │ <─────> Host
                                       │   │  adaptadores, parsers, │  │  remoto
                                       │   │  apps, sesiones        │  │ (POSIX)
                                       │   └────────────────────────┘  │
                                       └───────────────────────────────┘
```

## 2. Arquitectura por capas

1. **`core`** (agnóstico, sin UI ni I/O de red propia de presentación):
   - *Gestor de sesiones*: abstracción sobre una conexión SSH (ejecutar comando,
     abrir PTY, abrir SFTP).
   - *Adaptadores de SO*: detección + comandos específicos por familia (Art. 6).
   - *Parsers*: convierten salida de comandos en estructuras de datos; con
     fallback a salida cruda (Art. 7).
   - *Apps*: cada app define qué datos pide y qué comandos ejecuta (gestor de
     archivos, procesos, servicios, monitor, editor, logs).
   - *Transparencia*: cada comando ejecutado se registra/expone (Art. 3).
2. **`server`** (gateway web): mantiene sesiones SSH vivas, autentica al usuario,
   expone una API (HTTP para acciones puntuales, WebSocket para PTY y streams),
   aísla sesiones entre usuarios.
3. **`web`** (frontend): shell de escritorio (ventanas, taskbar, lanzador) y las
   vistas de cada app. Habla con `server`, nunca con SSH directamente.
4. **`desktop`** (posterior): empaqueta `server` + `web` en una app local.

## 3. Stack propuesto (v1)

`[NECESITA DECISIÓN]` confirmar; alternativas anotadas.

- **Lenguaje:** TypeScript en todo el stack → una sola lengua baja la barrera de
  contribución (Art. 9).
- **Monorepo:** pnpm workspaces. Paquetes: `core`, `server`, `web` (y luego
  `desktop`).
- **Backend (`server`):** Node.js + librería SSH `ssh2` (madura, soporta exec,
  PTY y SFTP) + WebSocket (`ws`). *Alternativa:* Rust (`russh`) por seguridad/
  rendimiento, a coste de mayor barrera de entrada → se descarta para v1.
- **Frontend (`web`):** React + TypeScript. Terminal con **`xterm.js`**.
  Ventanas movibles/redimensionables con una librería ligera (p. ej. estilo
  `react-rnd`) o componentes propios. `[NECESITA DECISIÓN]` framework de UI/estilos.
- **Desktop (futuro):** **Tauri** preferido (ligero, Rust) sobre Electron, salvo
  que se quiera reusar Node del `server` dentro del binario → entonces Electron.

## 4. Diseño del núcleo

### Contrato de capacidades (IR de adaptadores)

El núcleo define un **contrato de capacidades**: un catálogo cerrado de operaciones
abstractas y **tipadas** que las apps invocan **sin saber en qué SO corren**. Es el
"lenguaje intermedio" del sistema (una *representación intermedia*, IR). Dos piezas:

1. **Contrato (interfaz tipada).** Cada capacidad declara entradas y, sobre todo,
   una **salida normalizada**. Ejemplos:
   - `listDir(path) → FileEntry[]` — no texto, sino un array de
     `{ name, type, size, mode, owner, mtime }`.
   - `listProcesses() → Process[]`
   - `readFile(path) → bytes` · `writeFile(path, bytes) → void`
   - `serviceAction(name, action) → ServiceState`

   El valor está en el **tipo de la salida**: si una app sabe que `listDir`
   devuelve un `FileEntry[]`, ya no le importa cómo se obtuvo ni en qué plataforma.

2. **Manifiestos de adaptador (declarativos) + válvula de escape.** Cada plataforma
   implementa el contrato. El 80% de los casos, de forma **declarativa** (plantilla
   de comando + spec de normalización de la salida); el 20% difícil (busybox,
   PowerShell) con un **hook en código**.

**Reglas que lo sostienen:**
- Las apps **nunca** parsean salida cruda; solo consumen tipos del contrato. El
  parseo y su *fallback* viven en el adaptador (refuerza el Art. 7).
- **Normalizar en origen**: pedir salida estructurada (`stat -c`, `ps -eo`,
  `ConvertTo-Json`…) en vez de parsear formato humano.
- **Huecos de capacidad**: si una plataforma no soporta una operación (p. ej.
  `chmod` en Windows), el adaptador la declara *no soportada* y la UI degrada con
  elegancia, en lugar de fingir.

#### Primitivas no interactivas > pilotar TUIs

Corolario del contrato (y respuesta a "cómo emular nano"): DeskSSH **no maneja
herramientas interactivas remotas** (nano, vim, top…) enviándoles pulsaciones por
un PTY —sería frágil e imposible de normalizar—. Usa **primitivas no interactivas
y estructuradas** y **emula la experiencia en el cliente**:
- **Editor** = `readFile` + `writeFile` + un editor propio en la GUI (no se lanza
  nano en el remoto).
- **Monitor** = `listProcesses`/`systemMetrics` por *polling*, no un `top` vivo.
- La **única** excepción deliberada es la **app de terminal**, que sí expone el
  shell crudo (ahí el usuario ve `bash`/`PowerShell`/`csh`).

### Adaptadores de SO
- El contrato anterior expone una **interfaz uniforme** (`listDir`, `stat`,
  `listProcesses`, `listServices`, `serviceAction`, `systemMetrics`, …).
- Cada **familia de SO** es un adaptador que implementa ese contrato, de forma
  declarativa cuando es posible.
  **v1 cubre solo Debian/Ubuntu/Mint** (ver roadmap de hosts abajo).
- Detección al conectar (`/etc/os-release`, `uname`), con un adaptador POSIX
  genérico de respaldo para Unix-likes aún no soportados.
- Preferir salidas legibles por máquina (`stat -c '%n|%s|%a|...'`, `ps -eo ...`,
  flags `--json` cuando existan) sobre parsear formato humano.

#### Roadmap de hosts soportados

El número de tier indica **prioridad de roadmap, NO dificultad** (ver columna
*Esfuerzo*). Se prioriza Windows por popularidad pese a ser el más costoso.

| Tier | Hosts | Esfuerzo | Notas |
|------|-------|----------|-------|
| **1** (v1) | Debian / Ubuntu / Mint | base | POSIX + GNU coreutils + systemd |
| **2** | Windows | **alto** | No-POSIX: familia de adaptadores PowerShell propia. Sigue siendo agentless (PowerShell viene en el SO). Prioridad por popularidad, no por facilidad. |
| **3** | Resto de Linux mainstream (RHEL/Fedora/Rocky, Arch, openSUSE) | bajo | Mismo paradigma que v1 (systemd + GNU); difieren sobre todo en el gestor de paquetes |
| **4** | macOS, FreeBSD | medio | Userland BSD; init `launchd` (macOS) / `rc.d` (FreeBSD), no systemd |
| **5** | Alpine | medio | `busybox` (flags recortados), OpenRC, musl |

> Nota constitución: cuando llegue el Tier 2, habrá que **generalizar la redacción
> "utilidades POSIX" del Art. 2** (sigue siendo agentless, pero ya no POSIX).

### Parsers y resiliencia
- Cada parser recibe salida + código de salida; ante formato inesperado, devuelve
  un resultado "degradado" con la salida cruda (Art. 7), nunca lanza y rompe.

### Transparencia
- Toda ejecución pasa por un único punto que registra `{comando, host, timestamp,
  exitCode}` y lo hace consultable desde la UI (FR-013, Art. 3).

### Rendimiento (Art. 8)
- Caché de listados del VFS con invalidación por acción.
- Batching de comandos relacionados en una sola invocación cuando sea posible.
- UI optimista en operaciones de archivos, con reconciliación.

## 5. Seguridad (Art. 4)

- El backend es la superficie crítica: autenticación de usuario del gateway,
  aislamiento estricto de sesiones por usuario, rate limiting.
- Secretos: nunca en claro ni en logs. `[NECESITA DECISIÓN]` almacén (keychain del
  SO / cifrado local con clave derivada / no persistir y pedir cada vez).
- Acciones destructivas: confirmación obligatoria en la capa de app (FR-090).
- Verificación de host key SSH (evitar MITM); política de `known_hosts`.
- Auditoría: el registro de transparencia sirve también como traza de auditoría.

## 6. Fases / hitos

- **M0 — Andamiaje:** monorepo, paquetes vacíos, CI básica, licencia, contribuir.
- **M1 — Núcleo de conexión:** sesión SSH (exec/PTY/SFTP) + detección de SO +
  adaptador Debian/Ubuntu. Demostrable por tests/CLI mínima.
- **M2 — Shell + Terminal + Gestor de archivos:** primer escritorio usable.
- **M3 — Procesos + Monitor + Servicios:** administración básica.
- **M4 — Editor + Visor de logs + transparencia en UI:** experiencia v1 completa.
- **M5 — Empaquetado desktop** (si se confirma): Tauri/Electron del mismo núcleo.

`[NECESITA DECISIÓN]` qué apps entran en M2 vs más tarde (subconjunto de spec §6).

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Salida de comandos varía por SO/locale/versión | Parseo frágil | Adaptadores + salidas máquina + fallback a crudo (Art. 6/7) |
| Latencia por round trips | UX lenta | Caché, batching, UI optimista (Art. 8) |
| Backend = gateway SSH expuesto | Riesgo de seguridad alto | Auth, aislamiento, host keys, auditoría (§5) |
| Sobre-alcance de apps | v1 nunca termina | Cerrar subconjunto mínimo de apps por hito |
| Acoplar lógica a la UI | Rompe desktop futuro | Núcleo agnóstico estricto (Art. 5) |

## 8. Decisiones

**Cerradas (2026-06-25):**
- **Web-first** + núcleo agnóstico como arquitectura de v1.
- **Licencia AGPL-3.0-or-later** (ver `constitution.md` y `LICENSE`).

**Abiertas:**
1. Stack: confirmar TS/Node/`ssh2`/React; framework de UI/estilos.
2. Almacén de credenciales.
3. Apps incluidas en cada hito (M2 en concreto).
4. Tauri vs Electron para el empaquetado desktop (cuando llegue M5).
