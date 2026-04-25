# Daily Data Sync Workflow

## Overview

`sync-data.yml` is a GitHub Actions workflow that **automatically syncs marketplace skill data** from the external data repository ([Harries/skills-data-hub](https://github.com/Harries/skills-data-hub)) into the main `skills-desktop` project. It keeps the app's built-in skill catalog up-to-date without manual intervention.

## Trigger

| Trigger | Schedule | Description |
|---------|----------|-------------|
| `schedule` | `0 0 * * *` (UTC) | Runs daily at **00:00 UTC / 08:00 Beijing Time** |
| `workflow_dispatch` | Manual | Can be triggered manually from the GitHub Actions UI |

## Workflow Steps

```
┌─────────────────────────────────────────────────────────┐
│  1. Checkout main repo (skills-desktop)                 │
│  2. Checkout data repo (Harries/skills-data-hub)        │
│  3. Setup Node.js 20                                    │
│  4. Copy marketplace.json → public/data/marketplace.json│
│  5. Count skills in marketplace.json                    │
│  6. Update README.md with latest skill count            │
│  7. Commit & push if changes detected                   │
│  8. Trigger downstream build workflow                   │
└─────────────────────────────────────────────────────────┘
```

### Step-by-Step Breakdown

#### 1. Checkout Main Repository
Clones `skills-desktop` (the current repo) into `main-repo/` directory.

#### 2. Checkout skills-data-hub
Clones the public data repository `Harries/skills-data-hub` into `data-hub/` directory. This repo hosts the curated marketplace skill catalog as JSON files.

#### 3. Setup Node.js
Installs Node.js 20 for running the skill count script.

#### 4. Sync Data Files
Copies `data-hub/data/marketplace.json` to `main-repo/public/data/marketplace.json`. This is the core data file that powers the Marketplace page in the app.

#### 5. Get Skill Count
Parses `marketplace.json` using Node.js to count the total number of skills. Falls back to `53000` if the file is missing or parsing fails.

#### 6. Update README Stats
Uses `sed` to replace the skill count number in `README.md` (e.g., `53000+ open-source Skills` → `54200+ open-source Skills`). Only updates if the count differs from the fallback.

#### 7. Commit & Push
If any files changed, commits with message:
```
chore: sync data from skills-data-hub (YYYY-MM-DD)
```
Committed as `github-actions[bot]`.

#### 8. Trigger Build Workflow
If changes were pushed, dispatches a `data-updated` event via `repository-dispatch` to trigger any downstream build workflows (e.g., rebuilding the app with fresh data).

## Data Flow

```
Harries/skills-data-hub          skills-desktop
┌──────────────────┐             ┌──────────────────────────┐
│ data/             │             │ public/data/             │
│  marketplace.json │ ──copy──▶  │  marketplace.json        │
└──────────────────┘             │                          │
                                 │ README.md                │
                                 │  (skill count updated)   │
                                 └──────────────────────────┘
```

## Permissions

- **`contents: write`** — Required to push commits back to the main repository.
- **`GITHUB_TOKEN`** — Used to trigger downstream build workflows via repository dispatch.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Not Found` on checkout | Data repo name/owner incorrect | Verify `Harries/skills-data-hub` exists and is public |
| No changes committed | `marketplace.json` hasn't changed since last sync | Expected behavior, no action needed |
| Skill count shows `53000` | Parsing failed or file missing | Check if `marketplace.json` is valid JSON |
| Build not triggered | No data changes detected | The dispatch only fires when files actually change |
