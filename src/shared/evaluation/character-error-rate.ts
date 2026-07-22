export function normalizeForCharacterErrorRate(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

export function characterErrorRate(reference: string, candidate: string): number {
  const expected = Array.from(normalizeForCharacterErrorRate(reference));
  const actual = Array.from(normalizeForCharacterErrorRate(candidate));
  if (expected.length === 0) {
    return actual.length === 0 ? 0 : 1;
  }

  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
    const current = new Array<number>(actual.length + 1);
    current[0] = expectedIndex;
    for (let actualIndex = 1; actualIndex <= actual.length; actualIndex += 1) {
      const substitutionCost = expected[expectedIndex - 1] === actual[actualIndex - 1] ? 0 : 1;
      current[actualIndex] = Math.min(
        (previous[actualIndex] ?? 0) + 1,
        (current[actualIndex - 1] ?? 0) + 1,
        (previous[actualIndex - 1] ?? 0) + substitutionCost,
      );
    }
    previous = current;
  }

  return (previous[actual.length] ?? expected.length) / expected.length;
}
