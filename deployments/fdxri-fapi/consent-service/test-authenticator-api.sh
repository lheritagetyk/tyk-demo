#!/bin/bash
# Test script to check if we can add the authenticator via API

KC_URL="http://localhost:8180"
REALM="fapi-demo"
FLOW_ALIAS="browser"

# Get admin token (you'll need to update this with your admin credentials)
echo "Getting admin token..."
ADMIN_TOKEN=$(curl -s -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
  echo "Failed to get admin token"
  exit 1
fi

echo "✓ Got admin token"

# Get the flow ID
echo "Getting flow ID..."
FLOW_ID=$(curl -s -X GET "${KC_URL}/admin/realms/${REALM}/authentication/flows" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq -r ".[] | select(.alias==\"${FLOW_ALIAS}\") | .id")

if [ -z "$FLOW_ID" ]; then
  echo "Failed to get flow ID"
  exit 1
fi

echo "✓ Flow ID: ${FLOW_ID}"

# Try to add the authenticator execution
echo "Attempting to add authenticator execution..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${KC_URL}/admin/realms/${REALM}/authentication/flows/${FLOW_ALIAS}/executions/execution" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "fdx-consent-authenticator",
    "requirement": "REQUIRED"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo ""
echo "HTTP Status: ${HTTP_CODE}"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"




