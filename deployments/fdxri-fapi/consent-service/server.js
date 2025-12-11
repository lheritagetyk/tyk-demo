// consent-service/server.js
// Service to handle FDX fine-grained consent flow
// Integrates with Keycloak authentication flow and FDX Core API

import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ----------------------
// Configuration
// ----------------------
const {
  PORT = 8900,
  
  // Keycloak
  KC_BASE_URL = "http://keycloak:8180",
  KC_REALM = "fapi-demo",
  KC_ADMIN_USERNAME = "admin",
  KC_ADMIN_PASSWORD = "admin",
  KC_ADMIN_REALM = "master",
  
  // FDX Core API
  FDX_API_BASE_URL = "http://fdxri-tomcat:8090/fdxapi",
  
  // Tyk Gateway (for proxying FDX API calls)
  TYK_GATEWAY_URL = "http://tyk-gateway.localhost:8080",
} = process.env;

// ----------------------
// Helper Functions
// ----------------------

async function getKeycloakAdminToken() {
  const url = `${KC_BASE_URL}/realms/${KC_ADMIN_REALM}/protocol/openid-connect/token`;
  
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: KC_ADMIN_USERNAME,
      password: KC_ADMIN_PASSWORD,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Keycloak admin authentication failed: ${resp.status}`);
  }
  
  const data = await resp.json();
  return data.access_token;
}

async function getUserInfo(adminToken, userId) {
  const url = `${KC_BASE_URL}/admin/realms/${KC_REALM}/users/${userId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  
  if (!resp.ok) {
    throw new Error(`Failed to get user info: ${resp.status}`);
  }
  
  return resp.json();
}

async function updateUserAttributes(adminToken, userId, attributes) {
  const url = `${KC_BASE_URL}/admin/realms/${KC_REALM}/users/${userId}`;
  const user = await getUserInfo(adminToken, userId);
  
  // Merge new attributes with existing ones
  const updatedAttributes = {
    ...user.attributes,
    ...attributes,
  };
  
  // Convert arrays to Keycloak format (array of strings)
  for (const [key, value] of Object.entries(updatedAttributes)) {
    if (Array.isArray(value)) {
      updatedAttributes[key] = value.map(String);
    } else {
      updatedAttributes[key] = [String(value)];
    }
  }
  
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...user,
      attributes: updatedAttributes,
    }),
  });
  
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Failed to update user attributes: ${resp.status} ${txt}`);
  }
}

async function getAccountsFromFDX(accessToken, userId) {
  // Get user's accounts from FDX Core API
  // This requires the user to have authenticated and have a valid access token
  const url = `${FDX_API_BASE_URL}/accounts?resultType=lightweight`;
  
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-fapi-interaction-id": crypto.randomUUID(),
      "FDX-API-Actor-Type": "USER",
    },
  });
  
  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`FDX API error: ${resp.status} ${errorText}`);
    throw new Error(`Failed to fetch accounts: ${resp.status}`);
  }
  
  return resp.json();
}

function createConsentGrant(selectedAccounts, dataClusters, durationType = "TIME_BOUND", durationPeriod = 365) {
  const consentId = crypto.randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  
  // Calculate expiration time
  let expirationTime;
  if (durationType === "ONE_TIME") {
    expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  } else if (durationType === "TIME_BOUND") {
    expirationTime = new Date(Date.now() + durationPeriod * 24 * 60 * 60 * 1000).toISOString();
  } else {
    // PERSISTENT - no expiration
    expirationTime = null;
  }
  
  const consentGrant = {
    id: consentId,
    status: "ACTIVE",
    createdTime: now,
    updatedTime: now,
    expirationTime: expirationTime,
    durationType: durationType,
    durationPeriod: durationPeriod,
    lookbackPeriod: 60, // 60 days lookback
    resources: selectedAccounts.map(accountId => ({
      resourceType: "ACCOUNT",
      resourceId: accountId,
      dataClusters: dataClusters || ["ACCOUNT_DETAILED", "TRANSACTIONS", "STATEMENTS"],
    })),
  };
  
  return consentGrant;
}

// ----------------------
// API Endpoints
// ----------------------

// Health check
app.get("/healthz", (_, res) => res.json({ ok: true, service: "fdx-consent-service" }));

// Get accounts for user (supports both access token and session code)
app.post("/api/accounts", async (req, res) => {
  try {
    const { accessToken, sessionCode, userId } = req.body;
    
    // If we have an access token, use it directly
    if (accessToken) {
      const accounts = await getAccountsFromFDX(accessToken);
      return res.json({ accounts: accounts.accounts || [] });
    }
    
    // If we have session code, use Keycloak Admin API to get user info
    // and then fetch accounts (this is for authentication flow)
    if (sessionCode && userId) {
      const adminToken = await getKeycloakAdminToken();
      
      // Get user info to verify session and get username
      const user = await getUserInfo(adminToken, userId);
      const username = user.username;
      
      console.log(`Fetching accounts for user: ${username} (userId: ${userId})`);
      
      // Try to fetch accounts using the user's username
      // The FDX API might accept username in a query parameter or header
      // If not, we'll need to use a service account token
      try {
        // Option 1: Try fetching with username as query parameter
        const url = `${FDX_API_BASE_URL}/accounts?resultType=lightweight&username=${encodeURIComponent(username)}`;
        const resp = await fetch(url, {
          headers: {
            "x-fapi-interaction-id": crypto.randomUUID(),
            "FDX-API-Actor-Type": "USER",
            // Note: FDX API might require some form of authentication even for username-based lookup
            // You may need to configure a service account token here
          },
        });
        
        if (resp.ok) {
          const data = await resp.json();
          return res.json({ accounts: data.accounts || [] });
        } else {
          console.warn(`FDX API returned ${resp.status} for username lookup, trying alternative method`);
        }
      } catch (error) {
        console.error(`Error fetching accounts with username: ${error.message}`);
      }
      
      // Option 2: If username lookup doesn't work, return empty and log the issue
      // In production, you would:
      // 1. Use a service account token with permissions to fetch accounts
      // 2. Or issue a temporary token for the user
      // 3. Or use FDX API's user identification mechanism
      console.warn(`Could not fetch accounts for user ${username}. FDX API may require access token.`);
      return res.json({ 
        accounts: [],
        message: `Account fetching requires access token. User: ${username}`,
        userId: userId,
        username: username
      });
    }
    
    return res.status(400).json({ error: "accessToken or (sessionCode and userId) is required" });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: error.message });
  }
});

// Store consent grant
app.post("/api/consents", async (req, res) => {
  try {
    const { userId, selectedAccounts, dataClusters, durationType, durationPeriod } = req.body;
    
    if (!userId || !selectedAccounts || !Array.isArray(selectedAccounts)) {
      return res.status(400).json({ 
        error: "userId and selectedAccounts (array) are required" 
      });
    }
    
    const adminToken = await getKeycloakAdminToken();
    
    // Create consent grant
    const consentGrant = createConsentGrant(
      selectedAccounts,
      dataClusters || ["ACCOUNT_DETAILED", "TRANSACTIONS", "STATEMENTS"],
      durationType,
      durationPeriod
    );
    
    // Get existing consents
    const user = await getUserInfo(adminToken, userId);
    const existingConsents = JSON.parse(
      user.attributes?.["fdx.consents"]?.[0] || "[]"
    );
    
    // Add new consent
    existingConsents.push(consentGrant);
    
    // Store in Keycloak user attributes
    await updateUserAttributes(adminToken, userId, {
      "fdx.consents": JSON.stringify(existingConsents),
      "fdx.active.consent.id": consentGrant.id,
    });
    
    res.json({ 
      success: true, 
      consentGrant,
      message: "Consent grant stored successfully" 
    });
  } catch (error) {
    console.error("Error storing consent:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's consent grants
app.get("/api/consents/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const adminToken = await getKeycloakAdminToken();
    const user = await getUserInfo(adminToken, userId);
    
    const consents = JSON.parse(
      user.attributes?.["fdx.consents"]?.[0] || "[]"
    );
    
    res.json({ consents });
  } catch (error) {
    console.error("Error fetching consents:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific consent grant
app.get("/api/consents/:userId/:consentId", async (req, res) => {
  try {
    const { userId, consentId } = req.params;
    const adminToken = await getKeycloakAdminToken();
    const user = await getUserInfo(adminToken, userId);
    
    const consents = JSON.parse(
      user.attributes?.["fdx.consents"]?.[0] || "[]"
    );
    
    const consent = consents.find(c => c.id === consentId);
    
    if (!consent) {
      return res.status(404).json({ error: "Consent not found" });
    }
    
    res.json({ consentGrant: consent });
  } catch (error) {
    console.error("Error fetching consent:", error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke consent grant
app.put("/api/consents/:userId/:consentId/revocation", async (req, res) => {
  try {
    const { userId, consentId } = req.params;
    const { reason = "USER_ACTION", initiator = "INDIVIDUAL" } = req.body;
    
    const adminToken = await getKeycloakAdminToken();
    const user = await getUserInfo(adminToken, userId);
    
    const consents = JSON.parse(
      user.attributes?.["fdx.consents"]?.[0] || "[]"
    );
    
    const consentIndex = consents.findIndex(c => c.id === consentId);
    
    if (consentIndex === -1) {
      return res.status(404).json({ error: "Consent not found" });
    }
    
    // Update consent status
    consents[consentIndex].status = "REVOKED";
    consents[consentIndex].updatedTime = new Date().toISOString();
    consents[consentIndex].revocation = {
      reason,
      initiator,
      updatedTime: new Date().toISOString(),
    };
    
    // Update in Keycloak
    await updateUserAttributes(adminToken, userId, {
      "fdx.consents": JSON.stringify(consents),
    });
    
    res.status(204).send();
  } catch (error) {
    console.error("Error revoking consent:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mount FDX Consent API routes (must be before static routes)
import fdxConsentApi from "./fdx-consent-api.js";
app.use("/", fdxConsentApi);

// Serve consent selection UI
app.get("/consent", (req, res) => {
  res.sendFile("consent-ui.html", { root: __dirname });
});

app.listen(PORT, () => {
  console.log(`FDX Consent Service listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
  console.log(`Consent UI: http://localhost:${PORT}/consent`);
  console.log(`FDX Consent API: http://localhost:${PORT}/consents/{consentId}`);
});

