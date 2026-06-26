# DeskSSH Glossary

Domain vocabulary. DeskSSH constantly translates between two worlds —the **desktop
metaphor** and **system commands**— so a shared language avoids confusion.

| Term | Definition |
|------|------------|
| **Host** | A remote server connected to via SSH. Has credentials, address, port and an associated OS adapter. |
| **Session** | A live SSH connection to a host, able to run commands and open channels (PTY, SFTP). |
| **Core** | Frontend-agnostic logic: session management, adapters, parsers and app definitions. |
| **OS adapter** | A module that knows the specifics of a system family (commands, flags, paths) and exposes a uniform interface. |
| **Desktop app** | An "application" inside DeskSSH (file manager, terminal, monitor…). Each maps GUI actions to command sets. |
| **Action** | A user interaction (double click, drag, button) that resolves into one or more remote commands. |
| **VFS (Virtual File System)** | The view of the remote filesystem that the client builds and caches from `ls`/`stat`/SFTP. |
| **Desktop shell** | The UI layer that draws windows, taskbar, launcher and icons. The "face" of DeskSSH. |
| **Command transparency** | The ability to inspect the exact command behind each action (see Constitution, Art. 3). |
| **Round trip** | A request→execute→response cycle against the remote host. The unit of latency cost. |
| **Graceful degradation** | Offering less functionality (not failing) when the remote doesn't support something. |
| **Backend / gateway** | In the web model, the service that keeps SSH sessions alive and serves the UI. The browser never opens SSH directly. |

## Metaphor ↔ command map (illustrative, not exhaustive)

| Desktop action | Equivalent command(s) (indicative) |
|----------------|-------------------------------------|
| Open folder | `ls`, `stat -c` / SFTP `readdir` |
| File properties | `stat`, `file`, `getfacl` |
| Copy / move / delete | `cp` / `mv` / `rm` (with confirmation) |
| Create folder | `mkdir` |
| Open terminal | PTY channel over SSH |
| Task manager | `ps -eo`, `top -b -n1`, `kill` |
| System monitor | `free`, `df`, `uptime`, `cat /proc/...` |
| Service manager | `systemctl list-units`, `systemctl start/stop/status` |
| Log viewer | `journalctl`, `tail -f` over a channel |
| Text editor | read via SFTP/`cat`, save via SFTP |
| Network connections | `ss -tulpn`, `ip a` |
