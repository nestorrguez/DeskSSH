# Tareas — 001 Core

> **Estado: pendiente.** Este desglose se completa **al inicio de la sesión de
> código**, una vez cerradas las decisiones abiertas de [`spec.md`](./spec.md) §9
> y [`plan.md`](./plan.md) §8. No se escribe código de una tarea que no exista
> aquí (ver `CLAUDE.md`).

## Precondiciones antes de generar tareas

- [ ] Confirmada la dirección **web-first + núcleo agnóstico** (plan §1).
- [ ] Elegida la **licencia** open source (spec §9.1).
- [ ] Confirmado el **stack** (plan §3).
- [ ] Acordado el **subconjunto de apps** del primer hito codeado (spec §9.7).

## Esqueleto de tareas (se rellenará por hito)

### M0 — Andamiaje
- [ ] Inicializar monorepo (workspaces) y paquetes `core`, `server`, `web`.
- [ ] Añadir `LICENSE` y `CONTRIBUTING.md`.
- [ ] CI básica (lint + test + build).

### M1 — Núcleo de conexión
- [ ] (pendiente de desglose) Sesión SSH: exec / PTY / SFTP. → FR-030, FR-031
- [ ] (pendiente) Detección de SO + adaptador Debian/Ubuntu. → FR-004, Art. 6
- [ ] (pendiente) Punto único de ejecución con registro de transparencia. → FR-013

> El resto de hitos (M2–M5) se desglosa cuando se aborden, siguiendo `plan.md` §6.
