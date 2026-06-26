# Glosario de DeskSSH

Vocabulario del dominio. DeskSSH traduce constantemente entre dos mundos
—la **metáfora de escritorio** y los **comandos del sistema**— así que un
lenguaje compartido evita confusiones.

| Término | Definición |
|--------|------------|
| **Host** | Un servidor remoto al que se conecta por SSH. Tiene credenciales, dirección, puerto y un adaptador de SO asociado. |
| **Sesión** | Una conexión SSH viva con un host, capaz de ejecutar comandos y abrir canales (PTY, SFTP). |
| **Núcleo (core)** | Lógica agnóstica del frontend: gestión de sesiones, adaptadores, parsers y definición de apps. |
| **Adaptador de SO** | Módulo que conoce las particularidades de una familia de sistemas (comandos, flags, rutas) y expone una interfaz uniforme. |
| **App de escritorio** | Una "aplicación" dentro de DeskSSH (gestor de archivos, terminal, monitor…). Cada una mapea acciones de GUI a conjuntos de comandos. |
| **Acción** | Interacción del usuario (doble clic, arrastrar, botón) que se resuelve en uno o más comandos remotos. |
| **VFS (Virtual File System)** | Vista del sistema de archivos remoto que el cliente construye y cachea a partir de `ls`/`stat`/SFTP. |
| **Shell de escritorio** | La capa de UI que dibuja ventanas, taskbar, lanzador e iconos. La "cara" de DeskSSH. |
| **Transparencia de comandos** | Capacidad de inspeccionar el comando exacto detrás de cada acción (ver Constitución, Art. 3). |
| **Round trip** | Un ciclo petición→ejecución→respuesta contra el host remoto. Unidad de coste de latencia. |
| **Degradación elegante** | Ofrecer menos funcionalidad (no fallar) cuando el remoto no soporta algo. |
| **Backend / gateway** | En el modelo web, el servicio que mantiene las sesiones SSH y sirve la UI. El navegador no abre SSH directamente. |

## Mapa metáfora ↔ comando (ejemplos ilustrativos, no exhaustivo)

| Acción de escritorio | Comando(s) equivalente(s) (orientativo) |
|----------------------|------------------------------------------|
| Abrir carpeta | `ls`, `stat -c` / SFTP `readdir` |
| Propiedades de archivo | `stat`, `file`, `getfacl` |
| Copiar / mover / borrar | `cp` / `mv` / `rm` (con confirmación) |
| Crear carpeta | `mkdir` |
| Abrir terminal | canal PTY sobre SSH |
| Administrador de tareas | `ps -eo`, `top -b -n1`, `kill` |
| Monitor del sistema | `free`, `df`, `uptime`, `cat /proc/...` |
| Gestor de servicios | `systemctl list-units`, `systemctl start/stop/status` |
| Visor de logs | `journalctl`, `tail -f` sobre canal |
| Editor de texto | leer vía SFTP/`cat`, guardar vía SFTP |
| Conexiones de red | `ss -tulpn`, `ip a` |
