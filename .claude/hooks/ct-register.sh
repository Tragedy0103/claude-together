#!/bin/sh
# PostToolUse hook for mcp__ct-channel__register
# Writes peer name, URL, and API key to tmp files after successful register

input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)
tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null)

# Only handle ct-channel register
[ "$tool_name" = "mcp__ct-channel__register" ] || exit 0
[ -n "$session_id" ] || exit 0

name=$(echo "$input" | jq -r '.tool_input.name // empty' 2>/dev/null)
url=$(echo "$input" | jq -r '.tool_input.url // empty' 2>/dev/null)
api_key=$(echo "$input" | jq -r '.tool_input.api_key // empty' 2>/dev/null)

[ -n "$name" ] && echo "$name" > "/tmp/ct-peer-${session_id}"
[ -n "$url" ] && echo "$url" > "/tmp/ct-url-${session_id}"
[ -n "$api_key" ] && echo "$api_key" > "/tmp/ct-apikey-${session_id}"

exit 0
