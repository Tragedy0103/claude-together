---
name: ct:install
description: Install claude-together globally so any Claude Code session can use it.
---

# Install claude-together

Set up claude-together for global use across all Claude Code projects.

## Steps

1. **Detect project path**: The claude-together repo is at the current working directory. Store this as `$CT_PATH`.

2. **Install dependencies**:
   ```bash
   cd $CT_PATH && npm run install:all
   ```

3. **Copy skills to global config**:
   ```bash
   mkdir -p ~/.claude/skills
   cp -r $CT_PATH/.claude/skills/ct:* ~/.claude/skills/
   ```

4. **Copy cleanup hook**:
   ```bash
   mkdir -p ~/.claude/hooks
   cp $CT_PATH/.claude/hooks/ct-cleanup.sh ~/.claude/hooks/
   ```

5. **Add MCP server to global settings**: Read `~/.claude/settings.json` (create if not exists). Merge in:
   - Under `mcpServers`, add:
     ```json
     "ct-channel": {
       "command": "npx",
       "args": ["tsx", "$CT_PATH/client/channel.ts"]
     }
     ```
     Replace `$CT_PATH` with the actual absolute path.
   - Under `hooks.SessionEnd`, add (if not already present):
     ```json
     {
       "hooks": [
         {
           "type": "command",
           "command": "sh ~/.claude/hooks/ct-cleanup.sh"
         }
       ]
     }
     ```
   - Be careful to **merge** with existing settings, not overwrite them.

6. **Confirm**: Tell the user installation is complete. They can now use `/ct:connect <name> [url]` from any project.
