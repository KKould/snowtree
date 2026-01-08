# Snowtree

**AI writes code. You can't review it all. You can't rollback safely.**

Snowtree fixes this: **Worktree isolation + Incremental review + Stage as snapshot**.

<table>
  <tr>
    <td><img src="assets/chat.png" alt="Chat" /></td>
    <td><img src="assets/diff-review.png" alt="Diff Review" /></td>
  </tr>
</table>

## How It Works

**Isolated Worktrees** — Each AI session in its own worktree. Parallel, no conflicts.

**Native CLI** — Runs Claude Code, Codex directly. No wrapper.

**Incremental Review** — Review each round. Stage approved code. Next round, review diff only.

```
Round 1: AI codes → Review → Stage
Round 2: AI continues → Review diff → Stage
Round N: Done → Commit → Push PR
```

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/bohutang/snowtree/main/install.sh | sh
```

Or [download releases](https://github.com/bohutang/snowtree/releases): macOS `.dmg` / Linux `.deb` `.AppImage`

## Build

```bash
make install && make run
```

## License

Apache-2.0
