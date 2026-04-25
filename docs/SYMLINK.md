# Symlink Configuration Guide / 软链接配置说明

## What are Symlinks? / 软链接是什么？

Skills Desktop uses **`~/.claude/skills`** as the central skills repository. All skills you install (from Marketplace, GitHub, or local import) are stored here.

However, different AI coding agents read skills from **their own directories**:

| Agent | Skills Directory |
|-------|-----------------|
| Claude Code | `~/.claude/skills` (primary) |
| GitHub Copilot | `~/.copilot/skills` |
| Cursor | `~/.cursor/skills` |
| OpenAI Codex | `~/.codex/skills` |
| Gemini CLI | `~/.gemini/skills` |
| Windsurf | `~/.codeium/windsurf/skills` |
| Roo | `~/.roo/skills` |
| Trae | `~/.trae/skills` |

**Symlinks (symbolic links)** solve this by creating a "shortcut" from each agent's directory to the central `~/.claude/skills` directory. This way:

- You only maintain **one copy** of your skills
- All agents share the **same skills** instantly
- Installing or removing a skill is reflected across **all linked agents**

## How It Works / 工作原理

```
~/.claude/skills/          ← Primary (real files live here)
    ├── my-skill-1/
    │   └── SKILL.md
    ├── my-skill-2/
    │   └── SKILL.md
    └── ...

~/.codex/skills   → symlink → ~/.claude/skills
~/.gemini/skills  → symlink → ~/.claude/skills
~/.trae/skills    → symlink → ~/.claude/skills
~/.roo/skills     → symlink → ~/.claude/skills
...
```

When Codex reads `~/.codex/skills`, the OS transparently redirects it to `~/.claude/skills`. Every agent sees the same skill files.

## Agent Types / 代理类型

### Native Compatible Agents / 原生兼容代理

These agents auto-scan `.claude/skills` or have their own skill loading mechanism. **No symlink needed.**

- **Claude Code** — Primary agent, skills are stored here
- **GitHub Copilot** — Native SKILL.md support
- **Cursor** — Native SKILL.md support
- **OpenCode** — Native skill support
- **Antigravity** — Native skill support
- **Amp** — Native skill support

### Symlink Required Agents / 需要软链接的代理

These agents read from their own directory. A symlink from their directory to `~/.claude/skills` is required.

- **OpenAI Codex** → `~/.codex/skills`
- **Gemini CLI** → `~/.gemini/skills`
- **Windsurf** → `~/.codeium/windsurf/skills`
- **Roo** → `~/.roo/skills`
- **Trae** → `~/.trae/skills`

## How to Configure / 配置方法

### One-Click Setup / 一键配置

In **Settings → Symlink Configuration**:
1. Click **"Setup All"** to create symlinks for all supported agents
2. Or click individual **"Link"** buttons for specific agents
3. Use **"Refresh"** to check current symlink status

### Custom Symlinks / 自定义软链接

For agents not in the predefined list (e.g., Trae CN edition), use **Settings → Custom Symlinks**:

1. Enter the target path, e.g. `~/.trae-cn/skills`
2. Click **"Add"**
3. Click **"Link"** to create the symlink

Supported path formats:
- `~/.trae-cn/skills` (tilde expands to home directory)
- `/Users/username/.custom-agent/skills` (absolute path)

### Manual Setup (Terminal) / 手动配置

```bash
# Create symlink for any agent
ln -s ~/.claude/skills ~/.codex/skills

# Verify
ls -la ~/.codex/skills
# Should show: ~/.codex/skills -> /Users/you/.claude/skills

# Remove symlink
rm ~/.codex/skills   # Only removes the link, not the actual files
```

## Troubleshooting / 常见问题

### "Path exists and is not a symlink"

The target directory already exists as a **regular directory** (not a symlink). You need to:

1. Back up any existing skills in that directory
2. Remove the directory manually: `rm -rf ~/.codex/skills`
3. Retry the Link operation in Settings

### Symlink shows "invalid"

The symlink exists but points to a different location. Click **"Link"** to recreate it pointing to `~/.claude/skills`.

### Windows requires admin rights

On Windows, creating symlinks requires either:
- Administrator privileges, or
- Developer Mode enabled (Settings → Update & Security → For Developers)

## Architecture Diagram / 架构图

```
┌─────────────────────────────────────────────┐
│              Skills Desktop App              │
│                                              │
│  Install / Import / Remove Skills            │
│         ↓                                    │
│  ~/.claude/skills/  (Primary Storage)        │
│     ├── skill-a/SKILL.md                     │
│     ├── skill-b/SKILL.md                     │
│     └── skill-c/SKILL.md                     │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────┼──────────────┐
    │ Symlinks    │              │
    ▼             ▼              ▼
~/.codex/     ~/.gemini/    ~/.trae/
  skills/       skills/       skills/
    │             │              │
    ▼             ▼              ▼
 Codex CLI   Gemini CLI     Trae Agent
 reads here  reads here     reads here
```

All agents access the **same set of skills** through symlinks, ensuring consistency and zero duplication.
