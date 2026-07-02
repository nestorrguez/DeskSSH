// The web app registry (spec 002, FR-210/211 / E4, E10.4c). The registry now lives in
// the shared `@deskssh/app-runtime` SDK so the Desk's built-ins and dynamically imported
// app plugins register into the *same* instance (loaded once via the import map). This
// module stays as the Desk-side import path; it just re-exports the singleton.

export { registerApp, getApps, type AppFactory } from '@deskssh/app-runtime';
