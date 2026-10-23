#!/bin/sh
# Saves your Anthropic API key to .env without echoing it to the screen.
cd "$(dirname "$0")" || exit 1
tries=0
while [ "$tries" -lt 3 ]; do
  tries=$((tries + 1))
  printf "Paste your Anthropic API key and press Enter (input is hidden): "
  stty -echo
  read -r KEY
  stty echo
  echo
  # Drop stray spaces, quotes and a pasted "ANTHROPIC_API_KEY=" prefix.
  KEY=$(printf '%s' "$KEY" | tr -d ' \t\r"'"'" | sed 's/^ANTHROPIC_API_KEY=//')
  case "$KEY" in
    sk-ant-*)
      printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" > .env
      chmod 600 .env
      echo "Saved to .env (key ending in ...$(printf '%s' "$KEY" | tail -c 4)). Claude will restart the server."
      exit 0
      ;;
    "") echo "Nothing was pasted. Try again." ;;
    *) echo "Got ${#KEY} characters, but Anthropic keys start with sk-ant-. Try again." ;;
  esac
done
echo "Nothing saved. Run: sh ./set-key.sh"
exit 1
