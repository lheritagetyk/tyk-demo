// fdx-consent-api.js
// FDX Consent API implementation
// Implements the FDX Consent API specification endpoints

import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

const router = express.Router();

// ----------------------
// Helper Functions
// ----------------------

async function getUserConsents(userId) {
  // This would typically fetch from Keycloak user attributes
  // For now, we'll use the consent service API
  const consentServiceUrl = process.env.CONSENT_SERVICE_URL || "http://localhost:8900";
  
  try {
    const response = await fetch(`${consentServiceUrl}/api/consents/${userId}`);
    if (response.ok) {
      const data = await response.json();
      return data.consents || [];
    }
  } catch (error) {
    console.error("Error fetching consents:", error);
  }
  
  return [];
}

async function getConsentGrant(userId, consentId) {
  const consentServiceUrl = process.env.CONSENT_SERVICE_URL || "http://localhost:8900";
  
  try {
    const response = await fetch(`${consentServiceUrl}/api/consents/${userId}/${consentId}`);
    if (response.ok) {
      const data = await response.json();
      const consent = data.consentGrant;
      if (consent) {
        consent.userId = userId; // Add userId for authorization checks
      }
      return consent;
    }
  } catch (error) {
    console.error("Error fetching consent:", error);
  }
  
  return null;
}

function enrichConsentGrant(consentGrant, clientId, dataProviderInfo) {
  // Add parties information according to FDX spec
  return {
    ...consentGrant,
    parties: [
      {
        name: dataProviderInfo?.name || "Data Provider",
        type: "DATA_PROVIDER",
        homeUri: dataProviderInfo?.homeUri || "https://example.com",
        logoUri: dataProviderInfo?.logoUri || "",
        registry: dataProviderInfo?.registry || "FDX",
        registeredEntityName: dataProviderInfo?.registeredEntityName || "Data Provider",
        registeredEntityId: dataProviderInfo?.registeredEntityId || "",
      },
      {
        name: clientId || "Data Recipient",
        type: "DATA_RECIPIENT",
        homeUri: "",
        logoUri: "",
        registry: "FDX",
        registeredEntityName: clientId || "Data Recipient",
        registeredEntityId: "",
      },
    ],
    links: {
      self: {
        href: `/consents/${consentGrant.id}`,
        action: "GET",
      },
    },
  };
}

// ----------------------
// FDX Consent API Endpoints
// ----------------------

/**
 * GET /consents/{consentId}
 * Get a Consent Grant
 */
router.get("/consents/:consentId", async (req, res) => {
  try {
    const { consentId } = req.params;
    const userId = req.user?.sub || req.headers["x-user-id"];
    const clientId = req.user?.client_id || req.headers["x-client-id"];
    
    if (!userId) {
      return res.status(401).json({
        code: "603",
        message: "Authentication failed",
        debugMessage: "User ID not found in request",
      });
    }
    
    // Get consent grant
    const consentGrant = await getConsentGrant(userId, consentId);
    
    if (!consentGrant) {
      return res.status(404).json({
        code: "1107",
        message: "Data not found for request parameters",
        debugMessage: `Consent grant ${consentId} not found`,
      });
    }
    
    // Check if user has access to this consent
    if (consentGrant.userId !== userId) {
      return res.status(403).json({
        code: "403",
        message: "Forbidden",
        debugMessage: "User does not have access to this consent grant",
      });
    }
    
    // Enrich with parties information
    const enrichedConsent = enrichConsentGrant(consentGrant, clientId, {
      name: "FDX Data Provider",
      homeUri: "https://example.com",
      registry: "FDX",
      registeredEntityName: "FDX Data Provider",
      registeredEntityId: "",
    });
    
    // Set FAPI interaction ID header
    const interactionId = req.headers["x-fapi-interaction-id"] || crypto.randomUUID();
    res.setHeader("x-fapi-interaction-id", interactionId);
    
    res.json(enrichedConsent);
  } catch (error) {
    console.error("Error getting consent grant:", error);
    const interactionId = req.headers["x-fapi-interaction-id"] || crypto.randomUUID();
    res.setHeader("x-fapi-interaction-id", interactionId);
    res.status(500).json({
      code: "500",
      message: "Internal server error",
      debugMessage: error.message,
    });
  }
});

/**
 * PUT /consents/{consentId}/revocation
 * Revoke a Consent Grant
 */
router.put("/consents/:consentId/revocation", async (req, res) => {
  try {
    const { consentId } = req.params;
    const { reason = "USER_ACTION", initiator = "INDIVIDUAL" } = req.body;
    const userId = req.user?.sub || req.headers["x-user-id"];
    
    if (!userId) {
      return res.status(401).json({
        code: "603",
        message: "Authentication failed",
        debugMessage: "User ID not found in request",
      });
    }
    
    // Validate reason and initiator
    const validReasons = ["BUSINESS_RULE", "USER_ACTION"];
    const validInitiators = ["DATA_ACCESS_PLATFORM", "DATA_PROVIDER", "DATA_RECIPIENT", "INDIVIDUAL"];
    
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        code: "400",
        message: "Invalid Input",
        debugMessage: `Invalid reason. Must be one of: ${validReasons.join(", ")}`,
      });
    }
    
    if (!validInitiators.includes(initiator)) {
      return res.status(400).json({
        code: "400",
        message: "Invalid Input",
        debugMessage: `Invalid initiator. Must be one of: ${validInitiators.join(", ")}`,
      });
    }
    
    // Revoke consent via consent service
    const consentServiceUrl = process.env.CONSENT_SERVICE_URL || "http://localhost:8900";
    const response = await fetch(
      `${consentServiceUrl}/api/consents/${userId}/${consentId}/revocation`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason, initiator }),
      }
    );
    
    if (response.status === 404) {
      return res.status(404).json({
        code: "1107",
        message: "Data not found for request parameters",
        debugMessage: `Consent grant ${consentId} not found`,
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json(error);
    }
    
    // Set FAPI interaction ID header
    const interactionId = req.headers["x-fapi-interaction-id"] || crypto.randomUUID();
    res.setHeader("x-fapi-interaction-id", interactionId);
    
    res.status(204).send();
  } catch (error) {
    console.error("Error revoking consent:", error);
    const interactionId = req.headers["x-fapi-interaction-id"] || crypto.randomUUID();
    res.setHeader("x-fapi-interaction-id", interactionId);
    res.status(500).json({
      code: "500",
      message: "Internal server error",
      debugMessage: error.message,
    });
  }
});

/**
 * GET /consents/{consentId}/revocation
 * Retrieve Consent Revocation record
 */
router.get("/consents/:consentId/revocation", async (req, res) => {
  try {
    const { consentId } = req.params;
    const userId = req.user?.sub || req.headers["x-user-id"];
    
    if (!userId) {
      return res.status(401).json({
        code: "603",
        message: "Authentication failed",
        debugMessage: "User ID not found in request",
      });
    }
    
    // Get consent grant
    const consentGrant = await getConsentGrant(userId, consentId);
    
    if (!consentGrant) {
      return res.status(404).json({
        code: "1107",
        message: "Data not found for request parameters",
        debugMessage: `Consent grant ${consentId} not found`,
      });
    }
    
    // Check if consent is revoked
    if (consentGrant.status !== "REVOKED") {
      return res.status(404).json({
        code: "1107",
        message: "Data not found for request parameters",
        debugMessage: "Consent revocation record not found",
      });
    }
    
    // Return revocation list
    const revocations = consentGrant.revocation
      ? [
          {
            status: "REVOKED",
            reason: consentGrant.revocation.reason,
            initiator: consentGrant.revocation.initiator,
            updatedTime: consentGrant.revocation.updatedTime,
          },
        ]
      : [];
    
    // Set FAPI interaction ID header
    const interactionId = req.headers["x-fapi-interaction-id"] || crypto.randomUUID();
    res.setHeader("x-fapi-interaction-id", interactionId);
    
    res.json({ revocations });
  } catch (error) {
    console.error("Error getting consent revocation:", error);
    const interactionId = req.headers["x-fapi-interaction-id"] || crypto.randomUUID();
    res.setHeader("x-fapi-interaction-id", interactionId);
    res.status(500).json({
      code: "500",
      message: "Internal server error",
      debugMessage: error.message,
    });
  }
});

export default router;

