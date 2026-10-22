import { describe, it, expect } from 'vitest';
import { exGstFromIncl, GST_RATE } from './money.js';

describe('exGstFromIncl', () => {
  it('uses 15% NZ GST', () => expect(GST_RATE).toBe(0.15));
  it('115 incl -> 100 ex', () => expect(exGstFromIncl(115)).toBe(100));
  it('100 incl -> 86.96 ex (rounded to the cent)', () => expect(exGstFromIncl(100)).toBe(86.96));
  it('0 -> 0', () => expect(exGstFromIncl(0)).toBe(0));
});
