# Constitución de DeskSSH

Principios **no negociables**. Toda spec, plan, tarea o línea de código debe
respetarlos. Si algo entra en conflicto con la constitución, gana la
constitución; cambiarla requiere una enmienda explícita en este documento (con
fecha y motivo).

Última revisión: 2026-06-25.

---

## Artículo 1 — Sin escritorio remoto (la premisa)

DeskSSH **no transmite píxeles** ni reusa el entorno gráfico del servidor. No es
VNC, RDP, X-forwarding, SPICE ni similar. La interfaz se **sintetiza en el
cliente** a partir de datos obtenidos por SSH. Cualquier propuesta que viole esto
está fuera del proyecto, por muy útil que parezca.

## Artículo 2 — Agentless

DeskSSH **no instala software, agentes ni daemons** en el host remoto. Asume
únicamente:

- un servidor SSH funcionando, y
- utilidades POSIX/Unix estándar ya presentes (`sh`, `ls`, `stat`, `ps`, `df`, …).

Si una función necesita algo que no es estándar, debe **degradar con elegancia**
(ofrecer menos, no fallar) y nunca exigir cambios en el servidor.

## Artículo 3 — Transparencia de comandos

El usuario siempre puede **ver el comando** que una acción de la GUI va a
ejecutar (o ha ejecutado). DeskSSH es una herramienta de administración, no una
caja negra: enseñar el comando genera confianza y, de paso, enseña la línea de
comandos. La salida cruda siempre debe ser accesible.

## Artículo 4 — La seguridad no es opcional

- Nunca se almacenan secretos (contraseñas, frases de paso, claves privadas) en
  texto plano ni aparecen en logs.
- Principio de **mínimo privilegio**: DeskSSH actúa con los permisos del usuario
  SSH; no escala privilegios por su cuenta.
- En el modelo web, el backend es una **puerta de acceso SSH**: se trata como
  componente crítico (autenticación, aislamiento de sesiones, auditoría).
- Toda operación destructiva (borrar, sobrescribir, matar procesos, parar
  servicios) requiere **confirmación explícita** del usuario.

## Artículo 5 — Núcleo agnóstico del frontend

La lógica (sesiones SSH, adaptadores de SO, parsers, definición de "apps") vive
en un **núcleo independiente de la presentación**. Esto permite servir una web y,
con el mismo núcleo, empaquetar una app de escritorio. Ninguna regla de negocio
vive en componentes de UI.

## Artículo 6 — Portabilidad por adaptadores

Los servidores difieren (Debian/Ubuntu, RHEL/Fedora, Arch, BSD; `bash`/`sh`;
GNU vs BSD coreutils). Las diferencias se aíslan en una **capa de adaptadores**.
El resto del sistema habla con una interfaz uniforme y no asume una distro
concreta. Se prefieren salidas legibles por máquina (`stat -c`, `ps -eo`, flags
`--json` cuando existan) frente a parsear formato humano.

## Artículo 7 — Resiliencia y degradación elegante

La diversidad de servidores hace que el parseo falle a veces. Un fallo de parseo
**nunca** debe tirar la app: se muestra la salida cruda y se sigue. Cada round
trip puede fallar o tardar; la UI lo refleja sin bloquearse.

## Artículo 8 — Rendimiento consciente de la latencia

Cada acción de la GUI es, potencialmente, un viaje de ida y vuelta por la red.
El diseño debe **minimizar round trips** (batching, caché de listados, UI
optimista) y nunca asumir latencia cero.

## Artículo 9 — 100% open source y amigable para contribuir

DeskSSH es y será completamente open source bajo **AGPL-3.0-or-later**. Se elige
AGPL (copyleft fuerte con cláusula de red) precisamente porque el proyecto es
web-first: garantiza que cualquier mejora, incluso si solo se ofrece como servicio
accesible por red, vuelva a la comunidad. Se prioriza además una barrera de
entrada baja para contribuidores: stack mainstream, documentación en `specs/`,
decisiones explicadas y trazables. Sin dependencias propietarias en el camino
crítico ni con licencias incompatibles con AGPL-3.0.

## Artículo 10 — Primitivas no interactivas y estructuradas

DeskSSH **no pilota herramientas interactivas remotas** (nano, vim, top, etc.)
enviándoles pulsaciones por un PTY: es frágil, dependiente de versión e imposible
de normalizar entre plataformas. En su lugar, toda función se construye sobre
**primitivas no interactivas y de salida estructurada** definidas en el contrato
de capacidades (p. ej. `readFile`/`writeFile` en vez de lanzar un editor remoto),
y la experiencia se **emula en el cliente**. Se prefiere siempre pedir salida
legible por máquina antes que parsear formato humano.

La **única excepción deliberada** es la app de **terminal**, que expone el shell
crudo a propósito (y donde el usuario sí ve `bash`/`PowerShell`/`csh`).

Este artículo es la base que hace viable la portabilidad del Artículo 6: sin
salidas estructuradas, el contrato de capacidades no podría normalizar entre SO.

---

## Enmiendas

- *(ninguna todavía)*

## Decisiones cerradas

- **Licencia: AGPL-3.0-or-later** (decidida 2026-06-25). Cierra la "laguna de red"
  de la GPL, coherente con el modelo web-first y con el objetivo de mantener el
  proyecto 100% abierto. Ver Artículo 9 y el archivo `LICENSE`.
