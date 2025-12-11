import type { createRulesetFunction } from '@stoplight/spectral-core';

type CustomFunctionOptionsSchema = Parameters<typeof createRulesetFunction>[0]['input'];

// Updated from original at: https://github.com/stoplightio/spectral/blob/develop/packages/functions/src/optionSchemas.ts
// Saved here for reference only

export const fdxXorSchema: Record<string, CustomFunctionOptionsSchema> = {
  fdx_xor: {
    type: 'object',
    properties: {
      properties: {
        type: 'array',
        items: {
          type: 'string',
        },
        minItems: 1,
        maxItems: 99,
        errorMessage: `"fdx_xor" and its "properties" option require at least one enumerated property name`,
        description: 'The properties to check.',
      },
    },
    additionalProperties: false,
    required: ['properties'],
    errorMessage: {
      type: `"fdx_xor" function requires at least one enumerated property name. Valid examples: { "properties": ["type"] }, { "properties": ["type", "oneOf", "$ref"] }`,
    },
  },
};
