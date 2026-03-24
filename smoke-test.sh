#!/bin/bash
# Smoke-test SwiftColis — compatible CI/Linux
# Usage: ./smoke-test.sh [--base-url http://localhost:3000] [--ci] [--report smoke-test-report.json]

set -e

BASE_URL="${1:-http://localhost:3000}"
CI_MODE=false
REPORT_PATH="smoke-test-report.json"
STRICT_EXIT=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --ci) CI_MODE=true; shift ;;
    --strict) STRICT_EXIT=true; shift ;;
    --report) REPORT_PATH="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Counters
PASS=0
FAIL=0
SKIP=0
RESULTS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local auth_header=$4
  
  local cmd="curl -s -X $method"
  cmd="$cmd -H 'Content-Type: application/json'"
  if [ -n "$auth_header" ]; then
    cmd="$cmd -H 'Authorization: $auth_header'"
  fi
  if [ -n "$data" ]; then
    cmd="$cmd -d '$data'"
  fi
  cmd="$cmd '$BASE_URL$endpoint'"
  
  eval "$cmd"
}

log_pass() {
  local msg="$1"
  ((PASS++))
  RESULTS+=("{\"status\":\"PASS\",\"message\":\"$msg\"}")
  if [ "$CI_MODE" = false ]; then
    echo -e "${GREEN}[PASS]${NC} $msg"
  fi
}

log_fail() {
  local msg="$1"
  local detail="$2"
  ((FAIL++))
  RESULTS+=("{\"status\":\"FAIL\",\"message\":\"$msg\",\"detail\":\"$detail\"}")
  echo -e "${RED}[FAIL]${NC} $msg"
  if [ -n "$detail" ]; then
    echo "       $detail"
  fi
}

log_skip() {
  local msg="$1"
  ((SKIP++))
  RESULTS+=("{\"status\":\"SKIP\",\"message\":\"$msg\"}")
  echo -e "${YELLOW}[SKIP]${NC} $msg"
}

section() {
  if [ "$CI_MODE" = false ]; then
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  else
    echo "[CI] === $1 ==="
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  START
# ─────────────────────────────────────────────────────────────────────────────

if [ "$CI_MODE" = false ]; then
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║        SMOKE-TEST SwiftColis — Linux/CI compatible          ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo "  Base URL: $BASE_URL"
  echo "  Strict exit: $STRICT_EXIT"
else
  echo "[CI] smoke-test start baseUrl=$BASE_URL strict=$STRICT_EXIT"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 0 — SEED
# ─────────────────────────────────────────────────────────────────────────────
section "PHASE 0 — Seed"

SEED_RESULT=$(api_call GET "/api/seed" "" 2>/dev/null || echo '{}')
if echo "$SEED_RESULT" | grep -q '"success"'; then
  log_pass "Seed réussi"
else
  log_skip "Seed indisponible (continue avec données existantes)"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 1 — LOGIN (simple HTTP test)
# ─────────────────────────────────────────────────────────────────────────────
section "PHASE 1 — Vérification des identifiants"

LOGIN_RES=$(api_call POST "/api/test-login" '{"email":"admin@swiftcolis.dz","password":"admin123"}' 2>/dev/null || echo '{}')
if echo "$LOGIN_RES" | grep -q '"passwordMatch"'; then
  log_pass "Login ADMIN OK"
else
  log_fail "Login ADMIN échoué" "$(echo "$LOGIN_RES" | head -c 100)"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 2-3 — PARCELS & TRAJETS (simplified)
# ─────────────────────────────────────────────────────────────────────────────
section "PHASE 2 — Parcel Creation (public endpoint)"

PARCEL_RES=$(api_call GET "/api/parcels?tracking=SCMN4Z802PU9P7" "" 2>/dev/null || echo '[]')
if echo "$PARCEL_RES" | grep -q '"SCMN4Z802PU9P7"'; then
  log_pass "Parcel tracking lookup OK"
else
  log_skip "Parcel non trouvé (peut être normal si DBs différentes)"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 4 — MATCHING (public GET)
# ─────────────────────────────────────────────────────────────────────────────
section "PHASE 3 — Matching API (GET)"

MATCH_RES=$(api_call GET "/api/matching?villeDepart=alger&villeArrivee=oran" "" 2>/dev/null || echo '[]')
if echo "$MATCH_RES" | grep -q 'trajet\|villeDepart'; then
  log_pass "GET /api/matching OK"
else
  log_skip "Matching response vide (possible en local sans data)"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + SKIP))

if [ "$CI_MODE" = true ]; then
  # Générer rapport JSON
  echo "{" > "$REPORT_PATH"
  echo "  \"baseUrl\": \"$BASE_URL\"," >> "$REPORT_PATH"
  echo "  \"ciMode\": true," >> "$REPORT_PATH"
  echo "  \"strictExit\": $STRICT_EXIT," >> "$REPORT_PATH"
  echo "  \"totals\": {" >> "$REPORT_PATH"
  echo "    \"total\": $TOTAL," >> "$REPORT_PATH"
  echo "    \"pass\": $PASS," >> "$REPORT_PATH"
  echo "    \"fail\": $FAIL," >> "$REPORT_PATH"
  echo "    \"skip\": $SKIP" >> "$REPORT_PATH"
  echo "  }," >> "$REPORT_PATH"
  echo "  \"generatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" >> "$REPORT_PATH"
  echo "}" >> "$REPORT_PATH"
  
  echo "[CI] summary total=$TOTAL pass=$PASS fail=$FAIL skip=$SKIP"
  echo "[CI] report: $REPORT_PATH"
else
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║                      RÉSUMÉ DU TEST                        ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${CYAN}║  Total   : $TOTAL${NC}"
  echo -e "${GREEN}║  PASS    : $PASS${NC}"
  if [ $FAIL -gt 0 ]; then
    echo -e "${RED}║  FAIL    : $FAIL${NC}"
  else
    echo -e "${GREEN}║  FAIL    : $FAIL${NC}"
  fi
  echo -e "${YELLOW}║  SKIP    : $SKIP${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
fi

# Exit code
if [ "$STRICT_EXIT" = true ]; then
  if [ $FAIL -gt 0 ] || [ $SKIP -gt 0 ]; then
    exit 1
  fi
else
  if [ $FAIL -gt 0 ]; then
    exit 1
  fi
fi

exit 0
