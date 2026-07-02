// Provenance for extensions (spec 002, FR-242). Every adapter, app and (later)
// plugin manifest carries an author so the Settings panel can show who made it and
// link to them. The contact is a GitHub profile or an email — enough to reach the
// author and, for first-party (`nestorrguez`) packages, to anchor the Verified
// badge (E11). Kept minimal and serializable: it crosses the gateway as plain JSON.

export interface Author {
  /** Display name or handle. */
  readonly name: string;
  /** GitHub username (or full profile URL). */
  readonly github?: string;
  /** Contact email. */
  readonly email?: string;
}

/** The project's first-party author (`nestorrguez`). */
export const FIRST_PARTY_AUTHOR: Author = {
  name: 'nestorrguez',
  github: 'nestorrguez',
  email: 'nestorrguez15@gmail.com',
};
