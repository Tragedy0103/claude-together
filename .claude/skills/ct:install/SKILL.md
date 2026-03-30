---
name: ct:install
description: Install claude-together globally so any Claude Code session can use it.
---

# Install claude-together

Set up claude-together for global use across all Claude Code projects.

## Steps

1. **Detect project path**: The claude-together repo is at the current working directory. Store this as `$CT_PATH`.

2. **Install client dependencies** (一般使用者只需要 client，server 不在此安裝):
   ```bash
   cd $CT_PATH && npm run install:client
   ```
   > **注意：** 此安裝只包含 client（channel）。Server 需要另外部署（Docker / GKE），不會在本機啟動。如需自行架設 server，請參閱 README.md 的 Docker Deployment 章節。

3. **Ask user about global setup**: Before proceeding, explain to the user what global setup will do and ask for confirmation:

   > 接下來需要進行全域設定，這會修改 `~/.claude/` 底下的檔案：
   >
   > **為什麼需要全域設定？**
   > claude-together 的 skills（如 `/ct:connect`、`/ct:session-rules`）和 MCP server 設定需要安裝到全域 `~/.claude/` 目錄，這樣你在**任何專案**中開啟 Claude Code 都能使用這些功能。如果只放在專案內，其他專案的 session 就無法加入團隊協作。
   >
   > **具體會做什麼？**
   > - 複製 skills 到 `~/.claude/skills/`（ct:connect, ct:disconnect, ct:ask, ct:decide, ct:team, ct:session-rules, ct:session-memory）
   > - 複製 cleanup hook 到 `~/.claude/hooks/`
   > - 在 `~/.claude/settings.json` 加入 MCP server 和 SessionEnd hook 設定
   > - 在 `~/.claude/CLAUDE.md` 加入 session rules/memory 使用說明
   >
   > 是否要繼續？

   **Wait for user confirmation before proceeding.** If the user declines, stop here.

4. **Copy skills to global config**:
   ```bash
   mkdir -p ~/.claude/skills
   cp -r $CT_PATH/.claude/skills/ct:* ~/.claude/skills/
   cp -r $CT_PATH/.claude/skills/ct:session-memory ~/.claude/skills/
   cp -r $CT_PATH/.claude/skills/ct:session-rules ~/.claude/skills/
   ```

5. **Copy cleanup hook**:
   ```bash
   mkdir -p ~/.claude/hooks
   cp $CT_PATH/.claude/hooks/ct-cleanup.sh ~/.claude/hooks/
   ```

6. **Add MCP server to global settings**: Read `~/.claude/settings.json` (create if not exists). Merge in:
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

7. **Add claude-together section to global CLAUDE.md**: Read `~/.claude/CLAUDE.md` (create if not exists). If it does not already contain a `## Claude-Together` section, append the following block:

   ```markdown

   ## Claude-Together

   首次安裝請執行 `/ct:install`，會自動完成 MCP 設定、skills 複製、hooks 註冊等全域配置。
   ```

   If there is an old `## Claude-Together Channel Policy` section, remove it (replaced by session rules).

8. **Add session rules & memory instructions to global CLAUDE.md**: If `~/.claude/CLAUDE.md` does not already contain `## Session Rules`, append the following block:

   ```markdown

   ## Session Rules

   Session rules 是當前 session 內的**硬性規則**，**每次回覆前必須讀取** `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md`（如果存在）並嚴格遵守。Session 結束後自動消失。

   ### 使用方式
   - `/ct:session-rules <規則>` — 新增一條規則
   - `/ct:session-rules list` — 查看所有規則
   - `/ct:session-rules remove <編號>` — 移除特定規則
   - `/ct:session-rules clear` — 清除所有規則

   ### 自動讀取
   **每次回覆前**，先讀取 `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md`。如果檔案存在，必須遵守其中所有規則。

   ## Session Memory

   Session memory 是當前 session 內的筆記，用於保存重要上下文以防 context 壓縮遺失。Session 結束後自動消失。與 session rules 不同，**不需要每次都讀取**，有需要時才查閱。

   ### 使用方式
   - `/ct:session-memory <內容>` — 儲存一條筆記
   - `/ct:session-memory read` — 查看所有筆記
   - `/ct:session-memory clear` — 清除所有筆記

   ### 何時使用
   - 當重要的上下文資訊（架構決策、debug 發現、工作狀態）可能因 context 壓縮而遺失時
   - 當需要在長對話中追蹤多個工作項目的進度時
   - 當 context 使用率超過 60% 時，主動存入未完成工作和關鍵發現

   儲存位置：`/tmp/claude-session-${CLAUDE_SESSION_ID}.md`
   ```

9. **Confirm**: Tell the user installation is complete. They can now use `/ct:connect <server-url> <name> [api-key]` from any project.
