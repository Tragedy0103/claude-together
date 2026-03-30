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
  ct_auth=$(jq -r '.auth // empty' "$SESSION_FILE" 2>/dev/null)

  # Parse auth: "Header-Name:value" or bare value (defaults to x-api-key)
  auth_header_name=""
  auth_header_value=""
  if [ -n "$ct_auth" ]; then
    case "$ct_auth" in
      *:*) auth_header_name="${ct_auth%%:*}"; auth_header_value="${ct_auth#*:}" ;;
      *)   auth_header_name="x-api-key"; auth_header_value="$ct_auth" ;;
    esac
  fi

  # Disconnect from dispatcher via disconnect tool
  if [ -n "$peer_name" ] && [ -n "$ct_url" ]; then
    if [ -n "$auth_header_name" ]; then
      curl -s -X POST "${ct_url}/api/call" \
        -H "Content-Type: application/json" \
        -H "${auth_header_name}: ${auth_header_value}" \
        -d "{\"peer\":\"${peer_name}\",\"tool\":\"disconnect\",\"args\":{}}" \
        2>/dev/null || true
    else
      curl -s -X POST "${ct_url}/api/call" \
        -H "Content-Type: application/json" \
        -d "{\"peer\":\"${peer_name}\",\"tool\":\"disconnect\",\"args\":{}}" \
        2>/dev/null || true
    fi
  fi

  # Remove session file
  rm -f "$SESSION_FILE" 2>/dev/null
fi

exit 0
