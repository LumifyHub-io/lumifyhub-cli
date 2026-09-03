# LumifyHub CLI

Sync your LumifyHub pages locally as markdown files. Search, edit with your favorite editor, and push changes back to the cloud.

## Installation

```bash
npm install -g lumifyhub-cli
```

## Quick Start

```bash
lh login    # Authenticate with your account
lh pull     # Download your pages as markdown
# Edit files in ~/.lumifyhub/pages/
lh push     # Push changes back to LumifyHub
```

## Authentication

```bash
# Log in with your CLI token
lh login

# Check current user
lh whoami

# Log out
lh logout
```

To get a CLI token:
1. Go to [Account Settings](https://lumifyhub.io/account) in LumifyHub
2. Navigate to the **CLI** tab
3. Generate a new token

### Syncing Pages

```bash
# Pull all pages from LumifyHub
lh pull

# Pull pages from a specific workspace
lh pull -w my-workspace

# Force pull (overwrite local changes)
lh pull --force

# Push local changes to LumifyHub
lh push

# Push changes from a specific workspace
lh push -w my-workspace

# Check sync status
lh status
```

### Searching

```bash
# Search through local pages
lh search "query"

# Search in a specific workspace
lh search "query" -w my-workspace
```

## Local Storage

Pages are stored as Markdown files with YAML frontmatter:

```
~/.lumifyhub/pages/
├── workspace-slug/
│   ├── page-one.md
│   └── page-two.md
└── another-workspace/
    └── notes.md
```

Each file includes metadata:

```markdown
---
id: "uuid"
title: "Page Title"
workspace_id: "uuid"
workspace_slug: "workspace-slug"
slug: "page-slug"
updated_at: "2025-01-06T..."
local_hash: "abc123"
remote_hash: "abc123"
---

Your page content here...
```

## Creating New Pages

Add a new markdown file with frontmatter to create a page:

```markdown
---
title: My New Page
workspace_slug: my-workspace
---

# My New Page

Your content here...
```

Then run `lh push` to create it on LumifyHub.

## Direct CRUD (no filesystem sync)

These commands hit the API directly — useful for scripting and AI agents.
Add `--json` to any of them for machine-readable output.

```bash
# Pages
lh page list [-w workspace] [--parent <id|path|root>] [--json]
lh page get <id|path> [-w workspace] [--json]
lh page create <title> -w <workspace> [-c content | --from-file f] [--parent <id|path>]
lh page update <id> [-t title] [-c content | --from-file f]
lh page delete <id>

# Databases
lh db list [-w workspace] [--json]
lh db create <title> -w <workspace>
lh db get <id> [--json]
lh db delete <id>

# Database rows
lh row list <db-id> [--json]
lh row get <db-id> <row-id> [--json]
lh row create <db-id> -t <title> [--prop key=value ...] [-d data-source-id]
lh row update <db-id> <row-id> [-t title] [--prop key=value ...] [-d data-source-id]
lh row delete <db-id> <row-id>

# Boards (Kanban)
lh board list [-w workspace] [--json]
lh board create <title> -w <workspace> [--private]
lh board get <id> [--json]
lh board delete <id>

# Lists (Kanban columns)
lh list ls <board-id> [--json]
lh list create <board-id> -n <name> [-p position]
lh list update <board-id> <list-id> [-n name] [-p position] [--completed]
lh list delete <board-id> <list-id>

# Cards
lh card list <board-id> [-l list-id] [--json]
lh card create <board-id> -l <list-id> -t <title> [-d description]
lh card get <board-id> <card-id> [--json]
lh card update <board-id> <card-id> [-t title] [-l list-id] [--due iso] [--completed]
lh card delete <board-id> <card-id>
```

### Page hierarchy

Pages nest, and a page's `path` is the slugs of every ancestor down to
itself (`business/cornerlot/development`). A slug only has to be unique among
its siblings, so the path — not the title — is what tells three pages called
"Development" apart. `lh page list` prints `workspace/path`, and every page
in `--json` carries `path` and `parent_page_id`.

```bash
# Top-level pages of a workspace
lh page list -w saads-workspace --parent root

# Children of a page, by id or by path
lh page list --parent cornerlot
lh page list --parent business/cornerlot

# A page by path. A trailing sub-path is enough as long as it is unambiguous;
# if it matches in several workspaces you get a 409 listing them — pass -w.
lh page get cornerlot/development --json
lh page get lumifyhub -w blackarc-labs

# Create under a parent, by id or by path
lh page create "Roadmap" -w saads-workspace --parent cornerlot
```

`--parent-id` is still accepted on `create` as an alias of `--parent`.

### Client header

Every request carries `X-LumifyHub-Client: lh/<version>`, with the version
baked in from `package.json` at build time. The server records it as
provenance, so a card created through `lh` shows "via lh/0.3.0" on its
timeline. `lh --version` prints the same value.

`--prop key=value` accepts plain strings, numbers, booleans, JSON arrays/objects,
and resolves select option **names** to IDs server-side (e.g. `--prop status=Done`).
Property keys may be either the property's machine ID or its display name.

## Documentation

Full documentation at [lumifyhub.io/cli](https://lumifyhub.io/cli)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Link globally for testing
npm link
```

## License

MIT
