#!/bin/bash

# Keycloak Backup Script for FAPI Demo Realm
# Usage: ./backup-keycloak.sh

set -e

BACKUP_DIR="./keycloak-backup"
KEYCLOAK_URL="http://localhost:8180"
REALM="fapi-demo"

echo "🔐 Starting Keycloak FAPI Demo Backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Get admin token
echo "📝 Getting admin token..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  echo "❌ Failed to get admin token. Check Keycloak is running and credentials are correct."
  exit 1
fi

echo "✅ Admin token obtained"

# Export entire realm (includes users, clients, roles, etc.)
echo "📦 Exporting realm: $REALM..."
curl -s "$KEYCLOAK_URL/admin/realms/$REALM" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.' > "$BACKUP_DIR/realm-$REALM.json"

echo "✅ Realm exported: $BACKUP_DIR/realm-$REALM.json"

# Export specific clients
echo "📦 Exporting clients..."

# Get fdx-sample-webapp

FDX_SAMPLE_WEBAPP=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.clientId=="fdx-sample-webapp") | .id')

if [ -n "$FDX_SAMPLE_WEBAPP" ] && [ "$FDX_SAMPLE_WEBAPP" != "null" ]; then
  curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FDX_SAMPLE_WEBAPP" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    | jq '.' > "$BACKUP_DIR/client-fdx-sample-webapp.json"
  echo "✅ Client exported: fdx-sample-webapp"
else
  echo "⚠️  Client not found: fdx-sample-webapp"
fi


# Get fapi-postman

FAPI_POSTMAN=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.clientId=="fapi-postman") | .id')

if [ -n "$FAPI_POSTMAN" ] && [ "$FAPI_POSTMAN" != "null" ]; then
  curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FAPI_POSTMAN" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    | jq '.' > "$BACKUP_DIR/client-fapi-postman.json"
  echo "✅ Client exported: fapi-postman"
else
  echo "⚠️  Client not found: fapi-postman"
fi


# Get my-client
MY_CLIENT_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.clientId=="my-client") | .id')

if [ -n "$MY_CLIENT_ID" ] && [ "$MY_CLIENT_ID" != "null" ]; then
  curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$MY_CLIENT_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    | jq '.' > "$BACKUP_DIR/client-my-client.json"
  echo "✅ Client exported: my-client"
else
  echo "⚠️  Client not found: my-client"
fi


# Get my-tpp
MY_TPP_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.clientId=="my-tpp") | .id')

if [ -n "$MY_TPP_ID" ] && [ "$MY_TPP_ID" != "null" ]; then
  curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$MY_TPP_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    | jq '.' > "$BACKUP_DIR/client-my-tpp.json"
  echo "✅ Client exported: my-tpp"
else
  echo "⚠️  Client not found: my-tpp"
fi

# Get my-tpp-public
MY_TPP_PUBLIC_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.clientId=="my-tpp-public") | .id')

if [ -n "$MY_TPP_PUBLIC_ID" ] && [ "$MY_TPP_PUBLIC_ID" != "null" ]; then
  curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$MY_TPP_PUBLIC_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    | jq '.' > "$BACKUP_DIR/client-my-tpp-public.json"
  echo "✅ Client exported: my-tpp-public"
else
  echo "⚠️  Client not found: my-tpp-public"
fi

# Get fapi-conformance-one
CONFORMANCE_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.clientId=="fapi-conformance-one") | .id')

if [ -n "$CONFORMANCE_ID" ] && [ "$CONFORMANCE_ID" != "null" ]; then
  curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$CONFORMANCE_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    | jq '.' > "$BACKUP_DIR/client-fapi-conformance-one.json"
  echo "✅ Client exported: fapi-conformance-one"
else
  echo "⚠️  Client not found: fapi-conformance-one"
fi

# Export client policies
echo "📦 Exporting client policies..."
curl -s "$KEYCLOAK_URL/admin/realms/$REALM/client-policies/policies" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.' > "$BACKUP_DIR/client-policies.json"

echo "✅ Client policies exported"

# Export client profiles
echo "📦 Exporting client profiles..."
curl -s "$KEYCLOAK_URL/admin/realms/$REALM/client-policies/profiles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.' > "$BACKUP_DIR/client-profiles.json"

echo "✅ Client profiles exported"

# Export users (optional - includes test-user)
echo "📦 Exporting users..."
curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.' > "$BACKUP_DIR/users.json"

echo "✅ Users exported"

# Create a metadata file
cat > "$BACKUP_DIR/backup-metadata.json" << EOF
{
  "backup_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "keycloak_url": "$KEYCLOAK_URL",
  "realm": "$REALM",
  "files": [
    "realm-$REALM.json",
    "client-fdx-sample-webapp.json",
    "client-fapi-postman.json",
    "client-my-tpp.json",
    "client-my-tpp-public.json",
    "client-fapi-conformance-one.json",
    "client-policies.json",
    "client-profiles.json",
    "users.json"
  ]
}
EOF

echo ""
echo "✅ ✅ ✅ Backup completed successfully! ✅ ✅ ✅"
echo "📁 Backup location: $BACKUP_DIR"
echo ""
echo "Files created:"
ls -lh "$BACKUP_DIR"