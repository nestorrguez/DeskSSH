# Especificación funcional — 001 Core (experiencia base)

Define **qué** hace DeskSSH y **por qué**, sin entrar en cómo se implementa
(eso está en `plan.md`). Las decisiones abiertas se marcan `[NECESITA DECISIÓN]`
y se listan al final.

Relacionado: [`../constitution.md`](../constitution.md) · [`../glossary.md`](../glossary.md)

---

## 1. Problema

Administrar un servidor Linux sin entorno gráfico obliga a conocer la línea de
comandos. Las alternativas gráficas existentes:

- **Escritorio remoto (VNC/RDP/X)**: exige un entorno gráfico instalado y consume
  ancho de banda transmitiendo píxeles; inviable en servidores headless.
- **Paneles web (Cockpit, Webmin)**: requieren instalar y mantener un agente en el
  servidor, y ofrecen una UX de "formulario web", no de escritorio.

Falta una herramienta que dé una **experiencia de escritorio real** sobre
**cualquier servidor con solo SSH**, sin instalar nada y sin transmitir píxeles.

## 2. Propuesta de valor

DeskSSH presenta un **escritorio familiar** (ventanas, gestor de archivos,
terminal, monitor, editor, servicios) cuyo backend es **SSH puro**: cada
interacción se traduce en comandos ejecutados en el host. Sin agentes, sin
streaming, y con **transparencia**: siempre puedes ver el comando detrás del clic.

## 3. Objetivos (v1)

- O1. Conectar a hosts remotos por SSH (clave o contraseña) y gestionarlos.
- O2. Ofrecer un shell de escritorio con ventanas y multitarea básica.
- O3. Incluir un conjunto inicial de apps útiles (ver §6).
- O4. Funcionar **agentless** sobre servidores Linux comunes.
- O5. Hacer visible el comando equivalente de cada acción (transparencia).

## 4. No-objetivos (v1)

- Streaming de escritorio o aplicaciones gráficas remotas (prohibido por la
  constitución).
- Soporte para Windows como host remoto (objetivo a futuro, no v1).
- Multiusuario/colaboración en tiempo real sobre la misma sesión.
- Orquestación de flotas (gestión masiva de muchos servidores a la vez).
- Tienda de apps / plugins de terceros (la arquitectura lo permitirá, pero no es v1).

## 5. Personas y casos de uso

- **Sysadmin / DevOps** — administra VPS y servidores; quiere rapidez y ver qué se
  ejecuta. *"Reviso servicios y logs sin memorizar flags."*
- **Desarrollador** — despliega en un VPS; quiere gestionar archivos y procesos
  con comodidad. *"Subo un build y reinicio el servicio sin abrir 3 terminales."*
- **Persona que aprende Linux** — la transparencia de comandos le enseña.
  *"Veo qué comando hace cada cosa que pulso."*
- **Usuario con un VPS pero poca soltura en CLI** — administra su servidor con una
  GUI sin tener que dominar la terminal.

### Recorrido principal

1. El usuario añade un host (dirección, usuario, método de autenticación).
2. Se conecta; DeskSSH detecta el SO y abre el **escritorio**.
3. Abre el **gestor de archivos**, navega, copia un archivo (ve la confirmación y,
   opcionalmente, el comando).
4. Abre el **monitor del sistema** y el **gestor de servicios**, reinicia un
   servicio (confirmación obligatoria por ser acción sensible).
5. Abre una **terminal** real para algo puntual. Cierra la sesión.

## 6. Requisitos funcionales

### Conexión y hosts
- **FR-001** Añadir, editar y eliminar hosts (nombre, dirección, puerto, usuario).
- **FR-002** Autenticación por clave SSH y por contraseña. `[NECESITA DECISIÓN]`
  ¿soporte de `ssh-agent`/passphrase en v1?
- **FR-003** Conectar/desconectar; mostrar estado de la sesión (conectando, viva,
  caída, error).
- **FR-004** Detectar la familia de SO del host para elegir el adaptador (Art. 6).
- **FR-005** Nunca persistir secretos en claro (Art. 4). `[NECESITA DECISIÓN]`
  almacén de credenciales (keychain del SO, cifrado local, no persistir).

### Shell de escritorio
- **FR-010** Mostrar un escritorio con ventanas movibles/redimensionables y una
  barra de tareas.
- **FR-011** Lanzador de apps ("menú de inicio") para abrir las apps disponibles.
- **FR-012** Soportar varias ventanas/apps abiertas simultáneamente sobre una
  misma sesión.
- **FR-013** Indicador visible para inspeccionar el comando de la última acción
  (transparencia, Art. 3).

### App: Gestor de archivos
- **FR-020** Navegar el árbol de directorios remoto con iconos y detalles.
- **FR-021** Crear carpeta, renombrar, copiar, mover y borrar (borrar/sobrescribir
  exigen confirmación, Art. 4).
- **FR-022** Ver propiedades (tamaño, permisos, propietario, fechas).
- **FR-023** Subir y descargar archivos entre el equipo del usuario y el host.
- **FR-024** `[NECESITA DECISIÓN]` ¿drag & drop en v1 o en una iteración posterior?

### App: Terminal
- **FR-030** Terminal interactiva real (PTY sobre SSH) con redimensionado.
- **FR-031** Reusar la sesión SSH del host ya conectado.

### App: Procesos / Administrador de tareas
- **FR-040** Listar procesos (uso de CPU/mem, PID, usuario, comando).
- **FR-041** Terminar un proceso (confirmación obligatoria).

### App: Monitor del sistema
- **FR-050** Mostrar CPU, memoria, disco y uptime, con refresco periódico.

### App: Gestor de servicios
- **FR-060** Listar servicios (systemd en v1) y su estado.
- **FR-061** Iniciar, parar y reiniciar servicios (confirmación obligatoria).
- **FR-062** Ver el estado/log reciente de un servicio.

### App: Editor de texto
- **FR-070** Abrir, editar y guardar archivos de texto remotos.
- **FR-071** Avisar de ediciones sin guardar al cerrar.

### App: Visor de logs
- **FR-080** Ver y seguir (`tail -f`/`journalctl -f`) logs en streaming.

### Transversales
- **FR-090** Toda acción destructiva pide confirmación explícita (Art. 4).
- **FR-091** Si el parseo de una salida falla, mostrar la salida cruda sin romper
  la app (Art. 7).
- **FR-092** Mostrar latencia/estado de las operaciones de red en curso (Art. 8).

## 7. Requisitos no funcionales

- **NFR-Seguridad** — Cumplir el Artículo 4 de la constitución íntegramente.
- **NFR-Portabilidad** — Funcionar en Debian/Ubuntu, RHEL/Fedora y Arch al menos,
  vía adaptadores (Art. 6).
- **NFR-Rendimiento** — Operaciones comunes (listar carpeta, refrescar monitor)
  perceptiblemente fluidas en latencias de red típicas; minimizar round trips.
- **NFR-Resiliencia** — Ningún fallo de parseo/red tira la aplicación (Art. 7).
- **NFR-Accesibilidad / i18n** — UI navegable por teclado; textos preparados para
  traducción (al menos ES/EN). `[NECESITA DECISIÓN]` alcance de i18n en v1.
- **NFR-Apertura** — Stack y dependencias 100% open source (Art. 9).

## 8. Criterios de aceptación (v1, alto nivel)

- Un usuario puede añadir un host Linux real, conectarse y abrir el escritorio.
- Puede navegar archivos, abrir una terminal funcional, ver procesos/servicios y
  editar un archivo, todo agentless.
- Cada acción destructiva pide confirmación; ningún secreto se guarda en claro.
- Un fallo de parseo en un host "raro" muestra salida cruda sin crashear.

## 9. Decisiones abiertas `[NECESITA DECISIÓN]`

1. ~~Licencia open source~~ → **Resuelto (2026-06-25): AGPL-3.0-or-later** (ver
   `constitution.md` y `LICENSE`).
2. **Confirmar web-first** como modelo de entrega de v1 (ver `plan.md`).
3. Soporte de `ssh-agent`/passphrase en v1 (FR-002).
4. Almacén de credenciales: keychain del SO, cifrado local o no persistir (FR-005).
5. Drag & drop en el gestor de archivos en v1 o después (FR-024).
6. Alcance de i18n en v1 (NFR-Accesibilidad/i18n).
7. Conjunto mínimo de apps que entra en el primer hito codeado (subconjunto de §6).
