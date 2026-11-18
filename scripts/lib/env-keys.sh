#!/usr/bin/env bash
# Shared helpers for reading KEY=VALUE lines from dotenv-style files.
# shellcheck shell=bash

# Returns 0 if the basename should be skipped for the given app (local-only keys).
env_key_is_skipped() {
  local app="$1"
  local key="$2"

  case "$app" in
    web)
      case "$key" in
        CYPRESS_*) return 0 ;;
      esac
      ;;
  esac

  return 1
}

# Strip surrounding single or double quotes from a value (one layer).
env_strip_quotes() {
  local value="$1"

  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "$value"
}

# True when value looks like an unfilled sample.env placeholder.
env_value_is_placeholder() {
  local value="$1"

  [[ "$value" =~ ^YOUR_ ]] || [[ "$value" =~ ^your- ]]
}

# Print unique KEY names from a dotenv file (one per line), honoring app skip rules.
# Usage: env_list_keys <app> <env-file>
env_list_keys() {
  local app="$1"
  local env_file="$2"
  local line key

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"

    if env_key_is_skipped "$app" "$key"; then
      continue
    fi

    printf '%s\n' "$key"
  done <"$env_file"
}

# Print KEY<TAB>VALUE rows from a dotenv file (single-line values only).
# Usage: env_list_pairs <app> <env-file>
env_list_pairs() {
  local app="$1"
  local env_file="$2"
  local line key raw value

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    raw="${line#*=}"
    raw="${raw#"${raw%%[![:space:]]*}"}"
    value="$(env_strip_quotes "$raw")"

    if env_key_is_skipped "$app" "$key"; then
      continue
    fi

    printf '%s\t%s\n' "$key" "$value"
  done <"$env_file"
}
