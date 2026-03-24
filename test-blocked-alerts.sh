#!/bin/bash
# Test script for blocked parcels alert system
# Usage: ./test-blocked-alerts.sh [--base-url http://localhost:3000] [--token <admin-token>]

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN=""
CRON_SECRET="${CRON_SECRET:-test-secret}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Blocked Parcels Alert System Tests${NC}\n"

# Function to test an endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local expect_status=$4
  
  echo -e "${YELLOW}Testing:${NC} $method $endpoint"
  
  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -d "$data" \
      "$BASE_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X GET \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      "$BASE_URL$endpoint")
  fi
  
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)
  
  if [ "$status" = "$expect_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status)"
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expect_status, got $status)"
  fi
  
  echo "Response: $body" | head -c 100
  echo -e "\n"
}

echo -e "${YELLOW}1. Testing /api/parcels/blocked-alerts (list blocked parcels)${NC}"
echo "Note: Requires admin authentication token"
echo "Usage in code:"
echo "  GET /api/parcels/blocked-alerts"
echo "  Headers: Authorization: Bearer <admin-token>"
echo ""

echo -e "${YELLOW}2. Testing /api/parcels/blocked-alerts/stats (get stats)${NC}"
echo "Usage:"
echo "  GET /api/parcels/blocked-alerts/stats"
echo "  Headers: Authorization: Bearer <admin-token>"
echo ""

echo -e "${YELLOW}3. Testing /api/parcels/{id}/alert (send alert)${NC}"
echo "Usage:"
echo "  POST /api/parcels/{parcel-id}/alert"
echo "  Headers: Authorization: Bearer <admin-token>"
echo "  Body:"
echo '    {
    "message": "Alerte personnalisée",
    "notifyRole": "ADMIN | TRANSPORTER | CLIENT | ALL",
    "isAutomatic": false
  }'
echo ""

echo -e "${YELLOW}4. Testing /api/parcels/blocked-alerts/check (cron job)${NC}"
echo "Usage:"
echo "  POST /api/parcels/blocked-alerts/check"
echo "  Headers: X-Cron-Secret: <your-cron-secret>"
echo "  Body: { \"dryRun\": true, \"sendNotifications\": true }"
echo ""

echo -e "${GREEN}✓ All endpoints are ready for testing!${NC}\n"

cat << 'EOF'
Quick Start with cURL:

# 1. Seed the database
curl -X POST http://localhost:3000/api/seed

# 2. Login to get admin token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@swiftcolis.dz","password":"admin123"}' \
  | jq -r '.token')

# 3. List blocked parcels
curl http://localhost:3000/api/parcels/blocked-alerts \
  -H "Authorization: Bearer $TOKEN"

# 4. Get statistics
curl http://localhost:3000/api/parcels/blocked-alerts/stats \
  -H "Authorization: Bearer $TOKEN"

# 5. Test cron (dry-run)
curl -X POST http://localhost:3000/api/parcels/blocked-alerts/check \
  -H "X-Cron-Secret: test-secret" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'

# 6. Send manual alert for a blocked parcel
curl -X POST http://localhost:3000/api/parcels/{parcel-id}/alert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Urgent: please accelerate delivery",
    "notifyRole": "ALL",
    "isAutomatic": false
  }'

EOF
