# V1 data model is ready for accounts

2026-10-27 · #69

## Context

Three feature issues come after V1: games (#65), card sets (#67) and accounts with sync (#45). Each changes what is saved and how. Phases 4 to 6 are about to decide how layouts, formats and saves are stored, and every Phase 3 PR adds more code that calls a play session a "game". If V1 keeps its current model, the later issues have to migrate everyone's saves and rewrite storage, and once saves are in a backend that migration also runs on cloud data.

## Decision

V1 makes the data model and storage ready for those issues, without building any of them:

- **Terms:** a **game** is the card game being designed. A play session is a **session**. The spec, UI copy and code use these terms (see the glossary in `docs/requirements.md`).
- **Storage interface (AR-6):** saves go through a small interface (`get`, `put`, `list`, `delete`) over separately saved items: sessions, snapshots, layouts, formats, card sets and settings. Each item has a stable id, `updatedAt`, the save format version (PS-5) and an optional `gameId`. IndexedDB is the only V1 implementation.
- **Profile keys (PS-7):** saves are keyed by the app's base path and a profile. V1 has only the "guest" profile.
- **Card sets (AR-4):** card definitions loaded from a CSV belong to a card set, a model of its own. A pile records the card set it was loaded from.
- **Options resolver (AR-7):** layouts, formats and control settings read options through one resolver with account, game and session levels. Only the account level exists in V1.
- **No backend in V1.** Accounts, sync, the games screen and the card library screen stay after V1.

## Rejected

- **Building accounts into V1.** It adds a backend, sign-in, a privacy note and a dependency before the playtest tool itself is finished, and V1 must be complete even if later work never happens.
- **Keeping the current model and migrating later.** Cheaper now, but every later issue would need a save migration, and sync would need a storage rewrite. Migrating cloud data is riskier than local data.

## Why

The changes are small while there is no saving code yet: the interface, keys and fields are designed once in Phase 6 instead of being retrofitted. V1 still works on its own: a single guest profile, account-level options only and an IndexedDB store are a complete design, not placeholders.

## Costs

- A mechanical rename in code (`GameState`, `gameStore`, `model/game.ts`) before 3j.
- Phase 6 builds a small storage interface instead of calling `idb-keyval` directly.
- The design brief says "New game" and "resume last game". Screens built from it say "New session" and "Resume last session" instead.
