'use strict';

const assert = require('assert');

describe('package', () => {
  it('provides the expected classes', () => {
    const IIIF = require('../src');
    assert(IIIF.Processor);
    assert(IIIF.Error);
  });
});
