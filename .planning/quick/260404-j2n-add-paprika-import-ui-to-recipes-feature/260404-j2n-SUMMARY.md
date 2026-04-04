---
phase: 260404-j2n
plan: 01
type: quick
subsystem: frontend/recipes
tags: [recipes, paprika-import, file-upload, ui]
tech-stack:
  patterns: [raw-fetch-for-multipart, inline-result-feedback, hidden-file-input-pattern]
key-files:
  modified:
    - frontend/lib/recipes.ts
    - frontend/app/(app)/recipes/page.tsx
decisions:
  - Used raw fetch() (not apiFetch) for multipart file upload to avoid Content-Type conflict
  - Result panel rendered inline (not modal) below header row, above search bar
  - File input reset after each import to allow re-importing the same file
metrics:
  duration: 135s
  completed: 2026-04-04T11:48:43Z
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260404-j2n: Add Paprika Import UI to Recipes Feature

**One-liner:** Paprika recipe import via .paprikarecipes file upload with spinner, success/error feedback panel, and auto-refresh of recipe grid.

## What Was Built

### Task 1 — `importPaprikaFile` function in `frontend/lib/recipes.ts`

Added two exports:
- `PaprikaImportResult` interface matching the backend's `ImportResult` shape (`id`, `title`, `status`, `error`)
- `importPaprikaFile(file: File): Promise<PaprikaImportResult[]>` — uses raw `fetch()` with `FormData` (same pattern as `uploadPhoto`) to POST to `/api/recipes/import/paprika` with Bearer auth header

**Commit:** `ec3e973`

### Task 2 — Import button and result UI in `frontend/app/(app)/recipes/page.tsx`

- Added `fileInputRef`, `importing`, `importResults`, `importError` state
- Added `handlePaprikaImport` handler: uploads file, sets results, calls `loadAll()` to refresh grid, resets input
- "Import Paprika" button with upload icon added to the LEFT of "Add Recipe" in the page header (secondary outline style)
- Hidden `<input type="file" accept=".paprikarecipes">` wired via ref
- Result panel renders between header and search bar when results or error are present:
  - Green banner: success count
  - Red error list: per-recipe failures with title and error message
  - "Dismiss" button to clear panel

**Commit:** `3f64800`

## Checkpoint Pending

Task 3 is a `checkpoint:human-verify` — the user must visually confirm the UI at http://localhost:3000/recipes.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all UI is fully wired to the backend endpoint.

## Self-Check

- [x] `frontend/lib/recipes.ts` modified and committed (`ec3e973`)
- [x] `frontend/app/(app)/recipes/page.tsx` modified and committed (`3f64800`)
- [x] TypeScript compiles with no errors (`npx tsc --noEmit` returned clean)
- [x] `importPaprikaFile` and `PaprikaImportResult` exported from lib/recipes.ts
- [x] `loadAll()` called after import to refresh recipe list
- [x] File input restricted to `.paprikarecipes`
