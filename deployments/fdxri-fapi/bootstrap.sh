#!/bin/bash

source scripts/common.sh
deployment="fdxri-fapi"

dashboard_base_url="http://tyk-dashboard.localhost:3000"
dashboard_admin_api_credentials=$(cat deployments/tyk/volumes/tyk-dashboard/tyk_analytics.conf | jq -r .admin_secret)
dashboard_user_api_key=$(get_context_data "1" "dashboard-user" "1" "api-key")
gateway_base_url="http://tyk-gateway.localhost:8080"
gateway_api_credentials=$(cat deployments/tyk/volumes/tyk-gateway/tyk.conf | jq -r .secret)
keycloak_base_url="http://keycloak:8180"


log_start_deployment
log_message "Remove pre-existing log files"
rm -rf ./deployments/fdxri-fapi/volumes/logs/* > /dev/null 2>&1

log_message "Login to the FDX docker registry"
cat ./deployments/fdxri-fapi/key/fdx_ri_copy.json | docker login -u _json_key --password-stdin https://gcr.io
log_message "  Completed Login to the FDX docker registry"

log_message "Recreating fdxri-tomact and fdx_progress_container"
$(generate_docker_compose_command) up -d --no-deps --force-recreate postgres tomcat 1>/dev/null 2>>logs/bootstrap.log


log_message "Waiting for Keycloak to respond ok"
wait_for_response "$keycloak_base_url/health/ready" "200"

# Add this line - give Keycloak a few more seconds to fully initialize
sleep 10

log_message "Configuring Keycloak to disable SSL requirement"
docker exec tyk-demo-keycloak-1 /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8180 --realm master --user admin --password admin
docker exec tyk-demo-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE
log_ok
bootstrap_progress

#Load all UK and FAPI Keycloak clients
if [ -f "./deployments/fdxri-fapi/fapi-setup/export-restore/restorekeycloak.sh" ]; then
       log_message "Running UK Keycloake Setup"
       bash ./deployments/fdxri-fapi/fapi-setup/export-restore/restorekeycloak.sh
       if [ $? -eq 0 ]; then
           log_ok
       else
           log_message "ERROR: restorekeycloak.sh failed"
           exit 1
       fi
   else
       log_message "ERROR: restorekeycloak.sh not found"
       exit 1
   fi


log_message "Obtaining keycloak user access token"
api_response="$(curl $keycloak_base_url/realms/master/protocol/openid-connect/token -s \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password")"
access_token=$(echo $api_response | jq -r '.access_token')
log_message "access_token: $access_token"
log_ok
bootstrap_progress

log_message "Creating a new initial access token"
api_response="$(curl $keycloak_base_url/admin/realms/fapi-demo/clients-initial-access -s \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $access_token" \
  -d '{"count": 5}')"
initial_access_token=$(echo $api_response | jq -r '.token')
log_message "initial_access_token: $initial_access_token"
log_ok
bootstrap_progress

log_message "Creating FDX Core API"
create_api "deployments/fdxri-fapi/data/tyk-dashboard/tykoas-fdx-core.json" "$dashboard_user_api_key"
bootstrap_progress

log_message "Creating FDX Core FAPI API"
create_api "deployments/fdxri-fapi/data/tyk-dashboard/tykoas-fdx-core-fapi.json" "$dashboard_user_api_key"
bootstrap_progress

log_message "Creating UK Accounts and Transactions API"
create_api "deployments/fdxri-fapi/fapi-setup/ukaccounts/accounts-and-transaction.json" "$dashboard_user_api_key"
bootstrap_progress

log_message "Creating Payments InitiationAPI"
create_api "deployments/fdxri-fapi/fapi-setup/ukaccounts/payment-initiation-api.json" "$dashboard_user_api_key"
bootstrap_progress

log_message "Creating FDX Customer API"
if create_api "deployments/fdxri-fapi/data/tyk-dashboard/tykoas-fdx-customer.json" "$dashboard_user_api_key"; then
    log_message "FDX Customer API created successfully"
else
    log_message "WARNING: Failed to create FDX Customer API - check if file is in Tyk API definition format"
fi
bootstrap_progress

log_message "Creating UK Open Banking Policy"
create_policy "deployments/fdxri-fapi/data/tyk-dashboard/openbankingfapi_policy.json" "$dashboard_user_api_key"
bootstrap_progress

log_message "Creating FDX Policy"
create_policy "deployments/fdxri-fapi/data/tyk-dashboard/fdx_policy.json" "$dashboard_user_api_key"
bootstrap_progress


log_message "Creating FDX NoOpPolicy"
create_policy "deployments/fdxri-fapi/data/tyk-dashboard/fdxNoOp_policy.json" "$dashboard_user_api_key"
bootstrap_progress


log_message "Creating FDX FDX Core Account Basic Policy"
create_policy "deployments/fdxri-fapi/data/tyk-dashboard/fdx_core_account_basic_policy.json" "$dashboard_user_api_key"
bootstrap_progress

# Enterprise Portal setup
portal_base_url="http://tyk-portal.localhost:3100"
log_message "Waiting for Enterprise Portal to be ready"
wait_for_response "$portal_base_url/ready" "200" "" "10"
if [ $? -eq 0 ]; then
    # Get Portal Admin API token
    portal_admin_api_token=$(get_context_data "1" "enterprise-portal-admin" "1" "api-key")
   if [ -n "$portal_admin_api_token" ]; then
    
        log_message "SUCCESS: We have a portal"

        #Create Keycloak Consent Required Webhook

        # Create temporary files
        tmp=$(mktemp)
        webhook_data=$(mktemp)


        cat > "$webhook_data" << 'EOF'
                {
                  "Name": "KeyCloak Consent Required",
                  "URL": "http://host.docker.internal:8899/webhooks/tyk",
                  "Method": "POST",
                  "Timeout": 60,
                  "Events": [
                    "AccessRequestApproved"
                  ]
                }
EOF

        log_message "Creating webhook..."
        code=$(curl -sS -o "$tmp" -w '%{http_code}' \
          -X POST "$portal_base_url/portal-api/webhooks" \
          -H "Authorization: $portal_admin_api_token" \
          -H "Content-Type: application/json" \
          --data-binary "@$webhook_data")

        if [ "$code" != "200" ] && [ "$code" != "201" ]; then
          log_message "Create Webhook FAILED (HTTP $code): "
        fi

        if [ "$code" != "200" ] && [ "$code" != "201" ]; then
            log_message "Create Webhook FAILED (HTTP $code): "
            log_message "Response body:"
            cat "$tmp"
        else
            log_message "Create Webhook SUCCESS (HTTP $code)"
            log_message "Response:"
            cat "$tmp"
        fi
        
        # Cleanup temporary files
        rm -f "$tmp" "$webhook_data"




        #PUBLISH FDX Product
        product2_file="deployments/fdxri-fapi/data/tyk-portal/fdx-core-fapi-product.json"
        product_file="deployments/fdxri-fapi/data/tyk-portal/fdx-core-product.json"
        product_description_file="deployments/fdxri-fapi/data/tyk-portal/fdx-core-portal-description.yaml"
        product_path=$(jq -r '.Path' "$product_file")


        # Create the product (Portal API, Portal token)
        tmp=$(mktemp)
        code=$(curl -sS -o "$tmp" -w '%{http_code}' \
          -X POST "$portal_base_url/portal-api/products" \
          -H "Authorization: $portal_admin_api_token" \
          -H "Content-Type: application/json" \
          --data-binary "@$product_file")

        if [ "$code" != "200" ] && [ "$code" != "201" ]; then
          log_message "Create product FAILED (HTTP $code): $(cat "$tmp")"
          rm -f "$tmp"; exit 1
        fi

        # Portal often returns {"Status":"OK","Message":"<ReferenceID>"} — resolve numeric ID
        ref_id=$(jq -r '.Message // .ReferenceID // empty' "$tmp")
        rm -f "$tmp"
        log_message "Product created (ReferenceID: ${ref_id:-unknown})"

        product_id=$(curl -sS "$portal_base_url/portal-api/products" \
          -H "Authorization: $portal_admin_api_token" \
          | jq -r --arg ref "$ref_id" --arg p "$product_path" '
              ( .[] | select(.ReferenceID==$ref) | .ID ),
              ( .[] | select(.Path==$p) | .ID )
            ' | head -n1)

        log_message "Created product with ID: $product_id"
        bootstrap_progress

        api_id=$(curl -sS "$portal_base_url/portal-api/products/${product_id}" \
          -H "Authorization: $portal_admin_api_token" \
          | jq -r '.APIDetails[0].APIID')

        
        log_message "Created product and APIID: $api_id"
        bootstrap_progress


        # Upload OAS file
        uploadcode=$(curl -X POST \
              "$portal_base_url/portal-api/products/${product_id}/api-details/${api_id}/oas" \
              -H "Authorization: ${portal_admin_api_token}" \
              -F "file=@${product_description_file}")

        log_message "Uploaded OAS file this is response codeL $uploadcode"
        bootstrap_progress

        # Push to Dashboard (policies/plans sync)
        curl -sS -X PUT "$portal_base_url/portal-api/providers/1/synchronize" \
          -H "Authorization: $portal_admin_api_token" >/dev/null

        # Wait for sync to complete
        sleep 2

        ############ END OF Configure FDX Core FAPI Product ############

        ############ Configure UK and FDX Core- FAPI Product ############
        tmp2=$(mktemp)
        code2=$(curl -sS -o "$tmp2" -w '%{http_code}' \
          -X POST "$portal_base_url/portal-api/products" \
          -H "Authorization: $portal_admin_api_token" \
          -H "Content-Type: application/json" \
          --data-binary "@$product2_file")

        if [ "$code2" != "200" ] && [ "$code2" != "201" ]; then
          log_message "Create product FAILED (HTTP $code2): $(cat "$tmp2")"
          rm -f "$tmp2"; exit 1
        fi

        # Portal often returns {"Status":"OK","Message":"<ReferenceID>"} — resolve numeric ID
        ref_id2=$(jq -r '.Message // .ReferenceID // empty' "$tmp2")
        rm -f "$tmp2"
        log_message "Product created (ReferenceID: ${ref_id2:-unknown})"

        product_id2=$(curl -sS "$portal_base_url/portal-api/products" \
          -H "Authorization: $portal_admin_api_token" \
          | jq -r --arg ref "$ref_id2" --arg p "$product_path" '
              ( .[] | select(.ReferenceID==$ref) | .ID ),
              ( .[] | select(.Path==$p) | .ID )
            ' | head -n1)

        log_message "Created product with ID: $product_id2"
        bootstrap_progress

        api_id2=$(curl -sS "$portal_base_url/portal-api/products/${product_id2}" \
          -H "Authorization: $portal_admin_api_token" \
          | jq -r '.APIDetails[1].APIID')

        
        log_message "Created product and APIID: $api_id2"
        bootstrap_progress


        # Upload OAS file
        uploadcode2=$(curl -X POST \
              "$portal_base_url/portal-api/products/${product_id2}/api-details/${api_id2}/oas" \
              -H "Authorization: ${portal_admin_api_token}" \
              -F "file=@${product_description_file}")

        log_message "Uploaded OAS file this is response codeL $uploadcode"
        bootstrap_progress

        # Push to Dashboard (policies/plans sync)
        curl -sS -X PUT "$portal_base_url/portal-api/providers/1/synchronize" \
          -H "Authorization: $portal_admin_api_token" >/dev/null

        # Wait for sync to complete
        sleep 2


        ############ END OF Configure second product ############

        if [ -n "$product_id" ]; then
        log_message "LAURA: We found the product $product_id"

        if [ -n "$product_id2" ]; then
        log_message "LAURA: We found the product #2 $product_id2"
         else
            log_message "ERROR: Could not find product #2 in portal"
         fi

        log_message "Configuring OAuth2.0 Provider for Keycloak DCR"
            oauth_provider_data='{
                "Name": "FDX DCR Provider",
                "Type": "Keycloak",
                "WellKnownURL": "http://keycloak:8180/realms/fapi-demo/.well-known/openid-configuration",
                "SSLInsecureSkipVerify": true,
                "RegistrationAccessToken": "'$initial_access_token'"
            }'

            oauth_provider_response=$(curl --location "$portal_base_url/portal-api/oauth-providers" -s \
                --header 'Content-Type: application/json' \
                --header "Authorization: $portal_admin_api_token" \
                --data "$oauth_provider_data")
            log_message "OAuth2 Provider Response: $oauth_provider_response"
            oauth_provider_id=$(echo $oauth_provider_response | jq -r '.ID')
            log_message "Created OAuth2 Provider with ID: $oauth_provider_id"
            bootstrap_progress

            # create client type for end user authentication and authorization for OAuth provider
            client_type_data_fdx='{
                "Name": "FDX End User",
                "Description": "Client type FDX End User",
                "GrantType": ["authorization_code"],
                "ResponseTypes": ["code"],
                "TokenEndpointAuthMethod": ["client_secret_post"],
                "ApplicationType": "confidential"
            }'
           client_type_response=$(curl --location "$portal_base_url/portal-api/oauth-providers/$oauth_provider_id/client-types" -s \
                --header 'Content-Type: application/json' \
                --header "Authorization: $portal_admin_api_token" \
                --data "$client_type_data_fdx")
            log_message "Client Type Response: $client_type_response"
            client_type_id=$(echo $client_type_response | jq -r '.ID')
            log_message "Created Client Type FDX  with ID: $client_type_id"
            bootstrap_progress

            # Link client type to product
            log_message "Linking client type to product : $product_id"
            curl --location --request POST "$portal_base_url/portal-api/products/$product_id/client_types" -s \
                --header 'Content-Type: application/json' \
                --header "Authorization: $portal_admin_api_token" \
                --data "{\"ID\": $client_type_id}" -o /dev/null
            bootstrap_progress

            # Link client type to product #2
            log_message "Linking client type to product : $product_id2"
            curl --location --request POST "$portal_base_url/portal-api/products/$product_id2/client_types" -s \
                --header 'Content-Type: application/json' \
                --header "Authorization: $portal_admin_api_token" \
                --data "{\"ID\": $client_type_id}" -o /dev/null
            bootstrap_progress

            # Final sync to ensure everything is properly configured
            log_message "Final provider synchronization"
            curl --location --request PUT "$portal_base_url/portal-api/providers/$provider_id/synchronize" -s \
                --header "Authorization: $portal_admin_api_token" -o /dev/null
            log_ok

            ##Seed Keycloak with users/bank customers


            REALM="fapi-demo"
            ADMIN_USER="admin"
            ADMIN_PASS="admin"
            IMPORT_FILE="deployments/fdxri-fapi/users.json"

            log_message "Laura IMPORT File: $IMPORT_FILE"

            # Get admin token
            TOKEN=$(curl -s -X POST "$keycloak_base_url/realms/master/protocol/openid-connect/token" \
              -d "client_id=admin-cli" \
              -d "username=$ADMIN_USER" \
              -d "password=$ADMIN_PASS" \
              -d "grant_type=password" | jq -r .access_token)

            log_message "Laura TOKEN: $TOKEN"

            if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
              echo "Failed to get admin token"
              exit 1
            fi

            ## Import users into keycloak
           import_response=$(curl -s -X POST "$keycloak_base_url/admin/realms/$REALM/partialImport" \
              -H "Authorization: Bearer $TOKEN" \
              -H "Content-Type: application/json" \
              --data-binary @"$IMPORT_FILE")

             log_message "Laura Should have imported: $import_response"

            ##End Seed Keycloak


            ## Import Scopes into keycloak

             log_message "Laura IMPORT SCOPES"

            # Loop through scopes.json
            jq -c '.[]' deployments/fdxri-fapi/fdxscopes.json | while read -r scope; do
              NAME=$(echo "$scope" | jq -r .name)

              echo "Creating scope: $NAME"
              # Create scope
              curl -sS -X POST "$keycloak_base_url/admin/realms/$REALM/client-scopes" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d "$scope" -i

              # Find scope id
              SCOPE_ID=$(curl -sS "$keycloak_base_url/admin/realms/$REALM/client-scopes" \
                -H "Authorization: Bearer $TOKEN" \
                | jq -r ".[] | select(.name==\"$NAME\") | .id")

              # add to Assigned-Type Optional
              curl -s -X PUT \
              -H "Authorization: Bearer $TOKEN" \
              "$keycloak_base_url/admin/realms/$REALM/default-optional-client-scopes/$SCOPE_ID"

            done


            ## End import Scopes into Keycloak



           
        else
            log_message "ERROR: Could not find product in portal"
            exit 1
        fi #End the check for the API Product

   else
        log_message "ERROR: Could not get Portal Admin API token"
        exit 1
    fi #end check if portal admin api token
else
    log_message "ERROR: Enterprise Portal is not available. Please ensure portal deployment is running."
    exit 1
fi

# Start fdxwebui service (DPoP signing service + Vite dev server)
log_message "Starting fdxwebui service (DPoP signing service + Vite dev server)"
if [ -f "./deployments/fdxri-fapi/fdxwebui/Dockerfile" ]; then
    $(generate_docker_compose_command) up -d --build fdxwebui 1>/dev/null 2>>logs/bootstrap.log
    if [ $? -eq 0 ]; then
        log_message "  Waiting for fdxwebui services to be ready..."
        # Wait for DPoP service to be healthy
        for i in {1..30}; do
            if curl -s http://localhost:3010/health > /dev/null 2>&1; then
                log_message "  ✓ DPoP signing service is ready on port 3010"
                break
            fi
            if [ $i -eq 30 ]; then
                log_message "  ⚠️  DPoP service did not become ready in time"
            fi
            sleep 1
        done
        # Wait for Vite dev server
        for i in {1..30}; do
            if curl -s http://localhost:3030 > /dev/null 2>&1; then
                log_message "  ✓ Vite dev server is ready on port 3030"
                break
            fi
            if [ $i -eq 30 ]; then
                log_message "  ⚠️  Vite dev server did not become ready in time"
            fi
            sleep 1
        done
        log_ok
    else
        log_message "ERROR: Failed to start fdxwebui service"
    fi
else
    log_message "WARNING: fdxwebui Dockerfile not found, skipping fdxwebui startup"
fi
bootstrap_progress

log_end_deployment
# Echo credentials for Admin, Example Developer and Example Consumer
echo -e "\033[2K
▼ FDXRI
  ▽ FDXRI ($(get_service_image_tag "fdxri-tomcat"))
          URL : http://localhost:8090/fdxapi/accounts
  ▽ FDX Web UI
          Web UI : http://localhost:3030
          DPoP Service : http://localhost:3010"

