
// Converted from xorSchema.ts using https://www.codeconvert.ai/typescript-to-javascript-converter

export const fdx_xor = {
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
