#!/bin/sh
# Cleanup when Claude Code session ends
# Reads session_id from stdin JSON

input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)

SESSION_FILE="/tmp/ct-session-${session_id}.json"

if [ -n "$session_id" ] && [ -f "$SESSION_FILE" ]; then
  # Read session state from JSON
  peer_name=$(jq -r '.name // empty' "$SESSION_FILE" 2>/dev/null)
  ct_url=$(jq -r '.url // empty' "$SESSION_FILE" 2>/dev/null)
  ct_apikey=$(jq -r '.apikey // empty' "$SESSION_FILE" 2>/dev/null)

  # Disconnect from dispatcher via disconnect tool
  if [ -n "$peer_name" ] && [ -n "$ct_url" ]; then
    curl -s -X POST "${ct_url}/api/call" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${ct_apikey}" \
      -d "{\"peer\":\"${peer_name}\",\"tool\":\"disconnect\",\"args\":{}}" \
      2>/dev/null || true
  fi

  # Remove session file
  rm -f "$SESSION_FILE" 2>/dev/null
fi

exit 0
