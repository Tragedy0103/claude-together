#!/bin/sh
# Cleanup when Claude Code session ends
# Reads session_id from stdin JSON

input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)

if [ -n "$session_id" ]; then
  # Read peer name from temp file
  peer_name=$(cat "/tmp/ct-peer-${session_id}" 2>/dev/null)

  # Deregister from dispatcher
  if [ -n "$peer_name" ]; then
    curl -s -X POST "http://localhost:3456/channel/send" \
      -H "Content-Type: application/json" \
      -d "{\"from\":\"system\",\"to\":\"*\",\"content\":\"${peer_name} left the team.\"}" \
      2>/dev/null || true
  fi

  # Remove peer file
  rm -f "/tmp/ct-peer-${session_id}" 2>/dev/null
fi

exit 0
