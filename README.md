<h1 align="center">DeskSSH</h1>

<p align="center">
  <strong>Un escritorio gráfico sobre SSH puro.</strong><br>
  La GUI se sintetiza en el cliente; cada acción se traduce en comandos que se
  ejecutan en el host remoto. <em>No es escritorio remoto.</em>
</p>

---

## ¿Qué es?

Conectas por SSH a un servidor **sin entorno gráfico** y DeskSSH te muestra un
escritorio familiar —gestor de archivos, terminal, monitor del sistema, editor,
gestor de servicios…—. Detrás, cada clic ejecuta el comando equivalente (`ls`,
`stat`, `mv`, `systemctl`, `ps`…) y la interfaz se construye a partir de su salida.

### Lo que lo hace diferente

- **No es VNC/RDP/X.** No viajan píxeles: la GUI se genera localmente.
- **Agentless.** No instala nada en el servidor; solo necesita SSH y utilidades
  POSIX estándar.
- **Transparente.** Siempre puedes ver el comando que hay detrás de cada acción.
- **Open source 100%.**

## Estado

🚧 **En diseño.** El proyecto se desarrolla con **Spec-Driven Development**: ahora
mismo existe la especificación; el código llega después. Empieza por:

- [`specs/constitution.md`](specs/constitution.md) — principios del proyecto.
- [`specs/001-core/spec.md`](specs/001-core/spec.md) — qué hace DeskSSH.
- [`specs/001-core/plan.md`](specs/001-core/plan.md) — cómo se construirá.
- [`CLAUDE.md`](CLAUDE.md) — guía del repositorio y del flujo de trabajo.

## Cómo contribuir

Este proyecto sigue SDD: las discusiones de diseño ocurren en `specs/` **antes**
que en el código. Si quieres proponer algo, abre la conversación sobre el
documento correspondiente. (Guía de contribución detallada: pendiente — `M0`.)

## Licencia

[**GNU AGPL-3.0-or-later**](LICENSE). Copyleft fuerte con cláusula de red: si
modificas DeskSSH y lo ofreces como servicio accesible por red, debes publicar tus
cambios. Elegida para que el proyecto y todas sus mejoras sigan siendo libres.
Ver [`specs/constitution.md`](specs/constitution.md), Artículo 9.
