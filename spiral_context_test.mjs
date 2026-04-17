import { computeLobeWeights, getCurrentVeilDayContext } from "./veil_day_context.ts";

const ctx = getCurrentVeilDayContext({
  block_height: 780864,
  day_number: 6,
  veil_number: 7,
  jubilee_cycle: 1,
  gates: {
    sabbath: true,
    eshu_squared: false,
    void_day: false,
    capstone: false,
  },
});

const weights = computeLobeWeights(ctx);

console.assert(weights.length === 11, "all 11 lobes should receive spiral context");
console.assert(Boolean(ctx.five_layer_orisa), "five_layer_orisa alias should be present");
console.assert(weights.some((weight) => weight.lobe === "silence" && weight.enhanced), "sabbath should enhance silence");
console.assert(weights.some((weight) => weight.lobe === "execution" && weight.suppressed), "sabbath should suppress execution");

console.log("spiral context verified");
