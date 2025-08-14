/// <reference types="jest" />
'use strict';

import { describe, it } from '@jest/globals';
import assert from 'assert';
import * as IIIF from '../src';

describe('package', () => {
  it('provides the expected classes', () => {
    assert(IIIF.Processor);
    assert(IIIF.IIIFError);
  });
});
