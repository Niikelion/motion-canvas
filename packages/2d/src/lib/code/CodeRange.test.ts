import {describe, expect, test} from 'vitest';
import {
  consolidateCodeRanges,
  findAllCodeRanges,
  inverseCodeRange,
  isPointInCodeRange,
  pointToPoint,
} from './CodeRange';

describe('CodeRange', () => {
  test('should detect ranges', () => {
    expect(
      isPointInCodeRange([50, 50], pointToPoint(0, 0, 100, 100)),
      'Should work within both ranges',
    ).toBeTruthy();
    expect(
      isPointInCodeRange([50, 1000], pointToPoint(0, 0, 100, 100)),
      'Should accept any column when within lines',
    ).toBeTruthy();
    expect(
      isPointInCodeRange([50, 50], pointToPoint(0, 0, Infinity, Infinity)),
      'Should work with infinity',
    ).toBeTruthy();
    expect(
      isPointInCodeRange([100, 100], pointToPoint(0, 0, 100, 100)),
      'Should reject points on the outer edge',
    ).toBeFalsy();
  });

  test('should consolidate ranges that are completely contained', () => {
    expect(
      consolidateCodeRanges([
        pointToPoint(0, 0, 100, 100),
        pointToPoint(20, 0, 50, 0),
      ]),
    ).toEqual([pointToPoint(0, 0, 100, 100)]);
    expect(
      consolidateCodeRanges([
        pointToPoint(20, 0, 50, 0),
        pointToPoint(0, 0, 100, 100),
      ]),
    ).toEqual([pointToPoint(0, 0, 100, 100)]);
  });

  test('should combine ranges that overlap', () => {
    expect(
      consolidateCodeRanges([
        pointToPoint(0, 5, 0, 10),
        pointToPoint(0, 7, 0, 13),
      ]),
    ).toEqual([pointToPoint(0, 5, 0, 13)]);
    expect(
      consolidateCodeRanges([
        pointToPoint(0, 7, 2, 13),
        pointToPoint(0, 5, 2, 10),
      ]),
    ).toEqual([pointToPoint(0, 5, 2, 13)]);
  });

  test('should not combine ranges that do not overlap', () => {
    expect(
      consolidateCodeRanges([
        pointToPoint(0, 5, 0, 10),
        pointToPoint(0, 7, 0, 13),
        pointToPoint(1, 5, 1, 10),
      ]),
    ).toEqual([pointToPoint(0, 5, 0, 13), pointToPoint(1, 5, 1, 10)]);
  });

  test('should invert empty ranges', () => {
    expect(inverseCodeRange([])).toEqual([
      pointToPoint(0, 0, Infinity, Infinity),
    ]);
  });

  test('should treat pattern as an exact match when passing a string to findAllCodeRanges', () => {
    const code = [
      `const fn = () => {`,
      `  const x = 10;`,
      `  return x;`,
      `};`,
      `const fn2 = () => {`,
      `  // NO OP`,
      `};`,
    ].join('\n');

    expect(findAllCodeRanges(code, '()')).toEqual([
      pointToPoint(0, 11, 0, 13),
      pointToPoint(4, 12, 4, 14),
    ]);
  });

  test('should treat pattern as a regular expression (with special characters) when passing a RegExp to findAllCodeRanges', () => {
    const code = [
      `const fn = () => {`,
      `  const x = 10;`,
      `  return x;`,
      `};`,
      `const fn2 = () => {`,
      `  // NO OP`,
      `};`,
    ].join('\n');

    expect(findAllCodeRanges(code, new RegExp('\\(\\)'))).toEqual([
      pointToPoint(0, 11, 0, 13),
      pointToPoint(4, 12, 4, 14),
    ]);
    expect(findAllCodeRanges(code, /\(\)/)).toEqual([
      pointToPoint(0, 11, 0, 13),
      pointToPoint(4, 12, 4, 14),
    ]);
  });
});
