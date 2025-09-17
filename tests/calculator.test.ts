import Calculator from '../src/calculator';

describe('Calculator', () => {
  it('provides the expected classes', () => {
    expect(Calculator[2]).toBeDefined();
    expect(Calculator[3]).toBeDefined();
  });
});
