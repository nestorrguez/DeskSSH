import type { Author } from '@deskssh/core';

// The project's first-party author, mirrored web-side. The Desk (web) must import
// only *types* from `@deskssh/core` — pulling a runtime value drags in the Node-only
// `ssh2` (native `.node` bindings), which the browser bundle can't build. So this
// value lives here instead of being imported from core's `FIRST_PARTY_AUTHOR`.
// `Author` itself is a type-only import, which is erased at build.
export const FIRST_PARTY_AUTHOR: Author = {
  name: 'nestorrguez',
  github: 'nestorrguez',
  email: 'nestorrguez15@gmail.com',
};
