import { createRulesetFunction, IFunctionResult } from '@stoplight/spectral-core';
import { printValue } from '@stoplight/spectral-runtime';

import { fdxXorSchema } from './xorSchema';

// Updated from original at: https://github.com/stoplightio/spectral/blob/develop/packages/functions/src/xor.ts
// Saved here for reference only

export type Options = {
  /** test to verify if exactly one of the provided keys are present in object */
  properties: string[];
};

export default createRulesetFunction<Record<string, unknown>, Options>(
  {
    input: {
      type: 'object',
    },
    options: fdxXorSchema.fdx_xor,
  },

  function fdx_xor(targetVal, { properties }) {
    if (properties.length == 0) return;

    const results: IFunctionResult[] = [];

    const intersection = Object.keys(targetVal).filter(value => -1 !== properties.indexOf(value));
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
  },
);