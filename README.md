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
