# LumifyHub CLI

Sync and manage your LumifyHub pages locally.

## Installation

```bash
npm install -g lumifyhub-cli
```

Or use directly with npx:

```bash
npx lumifyhub-cli <command>
```

## Usage

### Authentication

```bash
# Log in with your API token
lh login

# Check current user
lh whoami

# Log out
lh logout
```

Get your API token at: https://lumifyhub.com/settings/api

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
