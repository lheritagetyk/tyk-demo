import { fdx_xor as _fdxXorSchema } from './xorSchema.js';
import { createRulesetFunction } from '@stoplight/spectral-core';
import { printValue } from '@stoplight/spectral-runtime';

// Converted from fdx_xor.ts using https://www.codeconvert.ai/typescript-to-javascript-converter

function fdx_xor(targetVal, options) {
  const { properties } = options;
  if (properties.length == 0) return;

  const results = [];
  const intersection = Object.keys(targetVal).filter(value => properties.includes(value));
  if (intersection.length !== 1) {
    var propsList = printValue(properties[0]);
    for (let i = 1; i < properties.length; i += 1) {
      propsList = propsList.concat(`, ${printValue(properties[i])}`);
    }

    results.push({
      message: `exactly 1 property must be defined of ${propsList}`,
    });
  }

  return results;
}

export default createRulesetFunction({
  input: {
    type: 'object',
  },
  options: _fdxXorSchema.fdx_xor,
}, fdx_xor);
