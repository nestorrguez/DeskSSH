# Git workflow

How we branch, commit, review and release DeskSSH. This project uses **GitHub Flow with a
`develop` integration branch** plus **SemVer release tags** and **Conventional Commits**.
It complements [`../CONTRIBUTING.md`](../CONTRIBUTING.md) (ground rules, spec-first, local dev).

## TL;DR

- Start every change from **`develop`**, on a short-lived branch (`feat/…`, `fix/…`, `docs/…`).
- Open a **PR into `develop`**. CI must pass. Delete the branch after merge.
- **`main` is releases only** — never commit to it directly. Releasing = merge `develop → main`
  and tag `vX.Y.Z`.
- **Spec before code** (see CONTRIBUTING). Reference the `FR-`/Article in commits and PRs.

## Branches

| Branch            | Lives for | Purpose                                                                                                                               |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **`main`**        | forever   | Released, published, stable. One commit = one shippable state. Every release is tagged. Protected — no direct commits, no force-push. |
| **`develop`**     | forever   | Integration line. The base for all day-to-day work; always green (CI passes).                                                         |
| **`feat/*`** etc. | short     | One change each. Branch off `develop`, merge back via PR, then delete.                                                                |
| **`hotfix/*`**    | short     | Urgent fix for something already on `main`. Branch off `main`; merge into **both** `main` (patch tag) and `develop`.                  |

### Naming topic branches

`type/short-kebab-description`, using the same types as commits:

```
feat/handler-registry      fix/files-symlink-crash      docs/adapter-authoring
chore/bump-deps            refactor/session-manager     test/manifest-parity
```

For a whole spec epic, use the **spec number**: `NNN-slug` (e.g. `002-extensions`,
`003-language-packs`) — it maps 1:1 to `specs/NNN-*/`.

## Commits — Conventional Commits

```
type(scope): imperative subject in English, <= 72 chars

Body: what changed and WHY. Reference the FR-/Article it serves (spec-first).
Wrap at ~72 cols.

Co-Authored-By: Name <email>          # when pair/AI-assisted
BREAKING CHANGE: describe the break    # triggers a major (or 0.x minor) bump
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `style`.
**Scope** (optional): a package or area — `core`, `server`, `web`, `extensions`, `adapters`, `i18n`.

- English only (code, comments, docs, commit messages — see CONTRIBUTING).
- Keep commits focused; one logical change each. `feat`/`fix` that change behavior must have
  their spec updated **first**.
- Put a release marker `[X.Y.Z]` in the subject only on the commit that bumps the version.

## Pull requests

- **Base branch:** `develop` for features/fixes; `main` only for release merges and hotfixes.
- CI (format-check, lint, typecheck, test, build) must be green before merge.
- Describe **what** and **why**; link the `FR-`/Article and the spec doc touched.
- **Merge style:** squash when the branch is a messy WIP; a plain merge when the commits are
  already clean and meaningful. Delete the branch after merge.
- Self-review is fine for a solo maintainer, but still open the PR so CI runs and history is
  traceable.

## Keeping in sync (pulling / rebasing)

```bash
git checkout develop && git pull --ff-only            # get latest integration
git checkout -b feat/my-change                        # branch off develop

# ...work, commit...

git fetch origin
git rebase origin/develop                             # replay your work on top; fix conflicts
```

- Prefer **rebase** to keep topic branches linear on top of `develop`; avoid merge commits
  inside a topic branch.
- **Never rebase or force-push `main` or `develop`.** Only rebase your own topic branch, and
  only before it is merged.
- `git config pull.ff only` (or `pull.rebase true`) avoids accidental merge commits when pulling.

## Releases (SemVer + tags)

DeskSSH versions several parts independently (Desk, Contract, app-runtime, each app, each
adapter) — see the **version ledger** [`../specs/002-extensions/versions.md`](../specs/002-extensions/versions.md).
The **product** release version lives in `packages/cli/package.json` and
`packages/web/src/version.ts` (kept in lockstep).

To cut a release:

```bash
git checkout develop && git pull --ff-only
# 1. bump the product version in cli/package.json + web/src/version.ts (and any
#    Contract/app-runtime/app/adapter versions that changed), and LOG it in versions.md
# 2. commit: chore(release): vX.Y.Z  [X.Y.Z]
git checkout main && git merge --no-ff develop        # bring the release onto main
git tag -a vX.Y.Z -m "DeskSSH vX.Y.Z"                 # annotated tag
git push origin main --follow-tags
# 3. publish (see specs/private notes): pnpm build:dist, then npm publish from the
#    package dir (2FA push). Update README if it advertises the shipped version.
git checkout develop && git merge main                # keep develop in sync with main
```

Under 0.x, a **minor** bump (`0.1.x → 0.2.0`) is treated as potentially breaking: a `^0.1.0`
range does not admit `0.2.0`. Bump the ranges that target a bumped surface.

## Recommended branch protection (GitHub settings → Branches)

These can't be set from git; configure them once in the repo settings:

- **`main`:** require a PR before merging, require status checks (CI) to pass, disallow force
  pushes and deletions. Optionally require linear history.
- **`develop`:** require status checks to pass; disallow force pushes.
