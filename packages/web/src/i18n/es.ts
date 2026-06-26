import type { MessageKey } from './en';

// Spanish catalog. Must cover every MessageKey (enforced by the Record type).
export const es: Record<MessageKey, string> = {
  'app.tagline': 'Un escritorio gráfico sobre SSH puro',
  'login.title': 'Conectar a un servidor',
  'login.host': 'Host / IP',
  'login.port': 'Puerto',
  'login.username': 'Usuario',
  'login.authMethod': 'Autenticación',
  'login.auth.password': 'Contraseña',
  'login.auth.key': 'Clave privada (PEM)',
  'login.password': 'Contraseña',
  'login.keyFile': 'Archivo de clave',
  'login.keyHint': 'Pega tu clave privada o elige un archivo',
  'login.passphrase': 'Frase de paso (opcional)',
  'login.submit': 'Conectar',
  'login.connecting': 'Conectando…',
  'login.error': 'No se pudo conectar',
  'connected.title': 'Conectado',
  'connected.os': 'Sistema operativo',
  'connected.home': 'Inicio',
  'connected.listing': 'Directorio de inicio',
  'connected.transparency': 'Comandos ejecutados (transparencia)',
  'connected.disconnect': 'Desconectar',
  'connected.empty': 'Directorio vacío',
};
