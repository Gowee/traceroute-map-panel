// mathematics-related utils

export function round(number: number, ndigits: number): number {
  // https://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-only-if-necessary
  const factor = 10 ** ndigits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export function parseIntChecked(string: string, radix?: number) {
  const num = parseInt(string, radix);
  if (Object.is(num, NaN)) {
    throw TypeError(`Expected an interger number, got a ${string} as NaN`);
  }
  return num;
}

export function parseFloatChecked(string: string) {
  const num = parseFloat(string);
  if (Object.is(num, NaN)) {
    throw TypeError(`Expected an float number, got a ${string} as NaN`);
  }
  return num;
}
