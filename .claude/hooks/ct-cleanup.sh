#!/bin/sh
# Cleanup when Claude Code session ends
# Reads session_id from stdin JSON

input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)

if [ -n "$session_id" ]; then
  # Read peer name and URL from temp files
  peer_name=$(cat "/tmp/ct-peer-${session_id}" 2>/dev/null)
  ct_url=$(cat "/tmp/ct-url-${session_id}" 2>/dev/null)
  ct_url="${ct_url:-http://localhost:3456}"
  ct_apikey=$(cat "/tmp/ct-apikey-${session_id}" 2>/dev/null)

  # Disconnect from dispatcher via disconnect tool
  if [ -n "$peer_name" ]; then
    curl -s -X POST "${ct_url}/api/call" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${ct_apikey}" \
      -d "{\"peer\":\"${peer_name}\",\"tool\":\"disconnect\",\"args\":{}}" \
      2>/dev/null || true
  fi

  # Remove temp files
  rm -f "/tmp/ct-peer-${session_id}" "/tmp/ct-url-${session_id}" "/tmp/ct-apikey-${session_id}" 2>/dev/null
fi

exit 0
