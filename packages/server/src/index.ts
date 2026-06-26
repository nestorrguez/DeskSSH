// @deskssh/server — web gateway.
// Holds live SSH sessions, authenticates the gateway user and exposes the API
// (HTTP for one-off actions, WebSocket for PTY and streams). Built on @deskssh/core.

import { CORE_PACKAGE } from '@deskssh/core';

export const SERVER_PACKAGE = '@deskssh/server';
export const CORE_DEPENDENCY = CORE_PACKAGE;
