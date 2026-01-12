# Snowtree

**AI generates code. You must review. You can't review all or rollback safely.**

Snowtree fixes this: **Worktree isolation + Incremental review + Stage as snapshot**.

![Snowtree Demo](assets/snowtree-show.gif)

## How It Works

- **Isolated Worktrees** — Each AI session runs in its own worktree. Work in parallel without conflicts.
- **Native CLI** — Runs Claude Code or Codex directly. No wrapper overhead.
- **Incremental Review** — Review each round, stage approved code. Next round reviews only new changes.

```
Round 1: AI codes → Review → Stage
Round 2: AI continues → Review diff → Stage
Round N: Done → Commit → Push PR
```

## Prerequisites

Install at least one AI coding agent:

| Agent | Install |
|-------|---------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `npm install -g @anthropic-ai/claude-code` |
| [Codex](https://github.com/openai/codex) | `npm install -g @openai/codex` |

## Install

**One-line installer (macOS/Linux):**

```bash
curl -fsSL https://raw.githubusercontent.com/bohutang/snowtree/main/install.sh | sh
```

**Manual download:** [GitHub Releases](https://github.com/bohutang/snowtree/releases)

| Platform | Format |
|----------|--------|
| macOS | `.dmg` (arm64, x64) |
| Linux | `.deb`, `.AppImage` (x86_64) |

## Development

```bash
make install   # Install dependencies
make run       # Start development server
make check     # Typecheck, lint, and test
make build     # Build packages
```

## Blog

[Snowtree: Review-Driven Safe AI Coding](https://www.bohutang.me/2026/01/10/snowtree-review-driven-safe-ai-coding/)

## License

Apache-2.0
