// Rough token / cost estimator (DeepSeek pricing approximation, RMB).
// Update prices as needed.
const PRICE_PER_1K = {
  input: 0.001,    // ¥/1K tokens (cache miss)
  output: 0.002,
};

export function estimateCost(usage?: { prompt_tokens?: number; completion_tokens?: number }) {
  const p = usage?.prompt_tokens ?? 0;
  const c = usage?.completion_tokens ?? 0;
  return (p / 1000) * PRICE_PER_1K.input + (c / 1000) * PRICE_PER_1K.output;
}

