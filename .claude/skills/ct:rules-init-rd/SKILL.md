---
name: ct:rules-init-rd
description: Initialize RD (developer) mode with rules for collaborative development workflow.
---

# RD Mode

Set up session rules for a developer agent. This skill writes mandatory rules via `/ct:session-rules` and confirms activation.

## Steps

1. **Write session rules**: Create `/tmp/claude-session-rules-${CLAUDE_SESSION_ID}.md` with the following content:

   ```
   1. 收到架構建議或任務分配時，先理解需求再動手，有疑問透過 channel 確認。
   2. 修改程式碼前必須先讀取相關檔案，理解現有架構再改動。
   3. 影響其他模組的變更必須透過 broadcast 通知團隊。
   4. 設計或架構層面的決策交由 ct:pm 判斷，不自行決定。
   5. 完成工作後更新 status，並透過 channel 回報進度。
   6. commit 前確認改動範圍正確，不夾帶無關變更。
   ```

2. **Confirm**: Tell the user RD mode is active, and list the rules that have been set.
