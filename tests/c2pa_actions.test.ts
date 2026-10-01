/// <reference types="jest" />
'use strict';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { c2paActions, C2PAActionParameters } from '../src/c2pa_actions';

describe('c2paActions', () => {
  const softwareAgent = 'test-agent';
  const defaultParams: C2PAActionParameters = {
    region: 'full',
    size: 'full',
    rotation: '0',
    quality: 'default',
    format: 'jpg',
    debugBorder: false
  };

  it('should throw an error if softwareAgent is not provided', () => {
    const params = { ...defaultParams };
    expect(() => c2paActions('', params)).toThrow('softwareAgent is required');
  });
  
  it('should return an array of actions', () => {
    const params = { ...defaultParams };
    const actions = c2paActions(softwareAgent, params);
    expect(Array.isArray(actions)).toBe(true);
  });

  it('should only return the transcoded action when all parameters are default', () => {
    const params = { ...defaultParams };
    const actions = c2paActions(softwareAgent, params);
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toEqual(1);
    expect(actions[0].action).toEqual('c2pa.transcoded');
  });

  it('should include the correct actions for all non-default parameters', () => {
    const params = { ...defaultParams, region: 'square', size: '200,', rotation: '90', quality: 'grayscale', debugBorder: true };
    const actions = c2paActions(softwareAgent, params);
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(1);
    expect(actions[0].action).toEqual('c2pa.cropped');
    expect(actions[0].parameters.description).toContain('region: "square"');
    expect(actions[1].action).toEqual('c2pa.resized');
    expect(actions[1].parameters.description).toContain('size: "200,"');
    expect(actions[2].action).toEqual('c2pa.edited');
    expect(actions[2].parameters.description).toContain('rotation: "90"');
    expect(actions[3].action).toEqual('c2pa.edited');
    expect(actions[3].parameters.description).toContain('quality: "grayscale"');
    expect(actions[4].action).toEqual('c2pa.edited');
    expect(actions[4].parameters.description).toContain('1px red border');
    expect(actions[5].action).toEqual('c2pa.transcoded');
  });

  it('should only include actions for non-default parameters', () => {
    const params = { ...defaultParams, size: '200,', quality: 'grayscale' };
    const actions = c2paActions(softwareAgent, params);
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBe(3);
    expect(actions[0].action).toEqual('c2pa.resized');
    expect(actions[0].parameters.description).toContain('size: "200,"');
    expect(actions[1].action).toEqual('c2pa.edited');
    expect(actions[1].parameters.description).toContain('quality: "grayscale"');
    expect(actions[2].action).toEqual('c2pa.transcoded');
  });
});