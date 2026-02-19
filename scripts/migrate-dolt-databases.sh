#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: migrate-dolt-databases.sh <search-dir> <data-dir> [--dry-run] [--port PORT]

Finds all beads dolt databases under <search-dir>, moves them to <data-dir>,
and configures each project for server mode so a single dolt sql-server can
serve them all.

Arguments:
  search-dir   Root directory to scan for .beads/dolt/*/ databases
  data-dir     Central directory for dolt databases (e.g. ~/.dolt-data)

Options:
  --dry-run    Show what would happen without making changes
  --port PORT  Dolt server port to configure (default: 3307)

The directory name under <data-dir> is taken from the dolt_database field in
each project's .beads/metadata.json. This must match so that beads can find
its database on the shared server.

Example:
  migrate-dolt-databases.sh ~/projects ~/.dolt-data --dry-run
  migrate-dolt-databases.sh ~/projects ~/.dolt-data
  dolt sql-server --host 127.0.0.1 --port 3307 --data-dir ~/.dolt-data
EOF
  exit 1
}

DRY_RUN=false
PORT=3307
SEARCH_DIR=""
DATA_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --port) PORT="$2"; shift 2 ;;
    --help|-h) usage ;;
    *)
      if [[ -z "$SEARCH_DIR" ]]; then
        SEARCH_DIR="$1"
      elif [[ -z "$DATA_DIR" ]]; then
        DATA_DIR="$1"
      else
        echo "error: unexpected argument: $1" >&2
        usage
      fi
      shift
      ;;
  esac
done

[[ -z "$SEARCH_DIR" || -z "$DATA_DIR" ]] && usage

SEARCH_DIR="$(cd "$SEARCH_DIR" && pwd)"
DATA_DIR="$(mkdir -p "$DATA_DIR" && cd "$DATA_DIR" && pwd)"

dolt_dirs=()
while IFS= read -r -d '' dolt_dir; do
  db_dir="$(dirname "$dolt_dir")"
  parent="$(dirname "$db_dir")"
  # only keep entries whose parent is .beads/dolt (skip nested .dolt/stats/.dolt etc.)
  case "$parent" in
    */.beads/dolt) dolt_dirs+=("$db_dir") ;;
  esac
done < <(find "$SEARCH_DIR" -path '*/.beads/dolt/*/.dolt' -type d -print0 2>/dev/null)

if [[ ${#dolt_dirs[@]} -eq 0 ]]; then
  echo "No beads dolt databases found under $SEARCH_DIR"
  exit 0
fi

echo "Found ${#dolt_dirs[@]} beads database(s) under $SEARCH_DIR"
echo ""

errors=0

for db_dir in "${dolt_dirs[@]}"; do
  # db_dir is e.g. /path/to/project/.beads/dolt/beads_foo — strip back to project root
  dolt_parent="${db_dir%/*}"          # .beads/dolt
  beads_dir="${dolt_parent%/*}"       # .beads
  project_dir="${beads_dir%/*}"       # project root
  metadata="$project_dir/.beads/metadata.json"

  if [[ ! -f "$metadata" ]]; then
    echo "SKIP  $project_dir (no metadata.json)"
    continue
  fi

  db_name=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('dolt_database',''))" "$metadata" 2>/dev/null)

  if [[ -z "$db_name" ]]; then
    echo "SKIP  $project_dir (no dolt_database in metadata.json)"
    continue
  fi

  target="$DATA_DIR/$db_name"

  if [[ -d "$target" ]]; then
    echo "SKIP  $db_name — already exists at $target"
    continue
  fi

  current_mode=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('dolt_mode','embedded'))" "$metadata" 2>/dev/null)

  echo "---"
  echo "Project:  $project_dir"
  echo "Database: $db_name"
  echo "Source:   $db_dir"
  echo "Target:   $target"
  echo "Mode:     $current_mode → server (port $PORT)"

  if $DRY_RUN; then
    echo "Action:   [dry-run] would move and configure"
    echo ""
    continue
  fi

  if ! mv "$db_dir" "$target"; then
    echo "ERROR: failed to move $db_dir → $target" >&2
    errors=$((errors + 1))
    continue
  fi
  echo "Moved:    $db_dir → $target"

  if (cd "$project_dir" && bd dolt set mode server 2>/dev/null && bd dolt set port "$PORT" 2>/dev/null); then
    echo "Config:   server mode on port $PORT"
  else
    echo "WARNING:  bd dolt set failed — update metadata.json manually" >&2
  fi

  echo ""
done

echo "==="
if $DRY_RUN; then
  echo "Dry run complete. Re-run without --dry-run to apply."
else
  echo "Migration complete."
  if [[ $errors -gt 0 ]]; then
    echo "$errors error(s) occurred."
    exit 1
  fi
  echo ""
  echo "Next steps:"
  echo "  dolt sql-server --host 127.0.0.1 --port $PORT --data-dir $DATA_DIR"
  echo "  dolt --host 127.0.0.1 --port $PORT --no-tls --user root --password \"\" sql -q \"SHOW DATABASES\""
fi
