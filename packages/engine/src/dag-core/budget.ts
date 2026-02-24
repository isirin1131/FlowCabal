/**
 * Rough token estimation: ~4 chars per token for English, ~2 for CJK.
 * Good enough for budget planning — not a precise tokenizer.
 */
export function estimateTokens(text: string): number {
  let cjkCount = 0;
  let otherCount = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    // CJK Unified Ideographs + common ranges
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      cjkCount++;
    } else {
      otherCount++;
    }
  }
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}

/**
 * Check if content fits within a token budget.
 */
export function fitsInBudget(text: string, maxTokens: number): boolean {
  return estimateTokens(text) <= maxTokens;
}
