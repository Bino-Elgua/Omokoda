/**
 * veil_day_context.ts
 * Wiring: Ritual-Codex (5-layer Orisa) -> Omo Koda (11-lobe polyphony)
 *
 * Injects sacred time context into the agentic organism so that:
 * - Each lobe's activation weight is modulated by the day's Orisa
 * - Veil assignments align with the current sacred calendar position
 * - Sabbath gates suppress certain lobes, enhance others
 * - The 11-lobe polyphony reflects the Orisa governance of the moment
 */

// ============================================================================
// 1. SACRED TIME TYPES (mirrored from ritual-codex)
// ============================================================================

export interface FiveLayerOrisa {
  day: OrisaName;
  week: OrisaName;
  moon: OrisaName;
  year: OrisaName;
  jubilee: OrisaName;
}

export type OrisaName =
  | "Esu"
  | "Sango"
  | "Osun"
  | "Yemoja"
  | "Oya"
  | "Ogun"
  | "Obatala";

export interface VeilDayContext {
  block_height: number;
  day_number: number;
  veil_number: number; // 1-50 in the 350-day cycle
  jubilee_cycle: number;

  five_layer: FiveLayerOrisa;

  gates: {
    sabbath: boolean;
    eshu_squared: boolean;
    void_day: boolean;
    capstone: boolean;
  };

  economic: {
    minting_active: boolean;
    new_contracts_allowed: boolean;
    tithe_enforced: boolean;
    multiplier: number;
    settle_only: boolean;
  };
}

// ============================================================================
// 2. LOBE ACTIVATION WEIGHTS — Orisa -> Lobe Mapping
// ============================================================================

/**
 * The 11 lobes of Omo Koda, mapped to Orisa archetypes.
 * Each Orisa has affinity with specific lobes.
 */
export type LobeName =
  | "perception"    // Sensory input processing
  | "memory"        // Causal Merkle chain recall
  | "reasoning"     // Logical inference
  | "creativity"    // Generative, novel synthesis
  | "empathy"       // Emotional modeling
  | "ethics"        // EBO constraint evaluation
  | "execution"     // Action planning
  | "vigilance"     // Threat/anomaly detection
  | "communion"     // Inter-agent communication
  | "divination"    // Oracle/Ifa integration
  | "silence";      // Veto, restraint, observation

export interface LobeWeight {
  lobe: LobeName;
  base_weight: number;     // 0-1, default activation
  orisa_modifier: number;  // Multiplier from current Orisa
  final_weight: number;    // base * modifier
  suppressed: boolean;     // Forced off by gate
  enhanced: boolean;       // Boosted by gate
}

/**
 * Orisa -> lobe affinity map.
 * Each Orisa enhances (2x) or suppresses (0.5x) specific lobes.
 */
const ORISA_LOBE_AFFINITY: Record<OrisaName, Partial<Record<LobeName, number>>> = {
  Esu: {
    perception: 1.5,
    divination: 2.0,
    creativity: 1.5,
    vigilance: 1.3,
    silence: 0.5,      // Esu speaks, doesn't silence
  },
  Sango: {
    execution: 2.0,
    reasoning: 1.5,
    vigilance: 1.5,
    empathy: 0.7,      // Thunder is not gentle
    silence: 0.3,
  },
  Osun: {
    empathy: 2.0,
    creativity: 1.8,
    communion: 1.5,
    memory: 1.3,
    vigilance: 0.7,    // Osun flows, not guards
  },
  Yemoja: {
    memory: 2.0,
    empathy: 1.8,
    ethics: 1.5,
    communion: 1.3,
    execution: 0.7,    // Nurture before action
  },
  Oya: {
    creativity: 2.0,
    vigilance: 1.8,
    execution: 1.5,
    perception: 1.3,
    silence: 0.5,      // Wind howls
    memory: 0.7,       // Change disrupts memory
  },
  Ogun: {
    execution: 2.0,
    reasoning: 1.8,
    perception: 1.5,
    ethics: 1.2,
    empathy: 0.5,      // Iron is not soft
    creativity: 0.7,
  },
  Obatala: {
    silence: 2.0,
    ethics: 2.0,
    reasoning: 1.5,
    memory: 1.3,
    execution: 0.3,    // Rest, don't act
    creativity: 0.5,   // Clarity over novelty
  },
};

/**
 * Gate-specific overrides.
 */
const GATE_OVERRIDES: Record<string, Partial<Record<LobeName, { suppress?: boolean; enhance?: boolean; modifier?: number }>>> = {
  sabbath: {
    execution: { suppress: true, modifier: 0.1 },
    silence: { enhance: true, modifier: 3.0 },
    ethics: { enhance: true, modifier: 2.0 },
    reasoning: { modifier: 1.5 },
    creativity: { suppress: true, modifier: 0.3 },
  },
  eshu_squared: {
    divination: { enhance: true, modifier: 2.5 },
    perception: { enhance: true, modifier: 1.8 },
    vigilance: { enhance: true, modifier: 1.5 },
    ethics: { modifier: 1.3 },
  },
  void_day: {
    execution: { suppress: true, modifier: 0.0 },
    creativity: { suppress: true, modifier: 0.0 },
    communion: { suppress: true, modifier: 0.0 },
    silence: { enhance: true, modifier: 5.0 },
    divination: { enhance: true, modifier: 2.0 },
    memory: { modifier: 1.5 },
  },
  capstone: {
    reasoning: { enhance: true, modifier: 2.0 },
    memory: { enhance: true, modifier: 2.0 },
    ethics: { enhance: true, modifier: 1.5 },
    execution: { modifier: 1.5 },
  },
};

// ============================================================================
// 3. CONTEXT COMPUTATION
// ============================================================================

const ALL_LOBES: LobeName[] = [
  "perception", "memory", "reasoning", "creativity", "empathy",
  "ethics", "execution", "vigilance", "communion", "divination", "silence",
];

/**
 * Compute lobe activation weights for the current veil-day context.
 * The 5-layer Orisa governance modulates each lobe's weight.
 * Gates (Sabbath, Void, etc.) can suppress or enhance lobes.
 */
export function computeLobeWeights(ctx: VeilDayContext): LobeWeight[] {
  const weights: LobeWeight[] = [];

  for (const lobe of ALL_LOBES) {
    let modifier = 1.0;

    // Layer 1: Day Orisa (strongest influence, weight 0.4)
    const dayAffinity = ORISA_LOBE_AFFINITY[ctx.five_layer.day]?.[lobe] ?? 1.0;
    // Layer 2: Week Orisa (weight 0.25)
    const weekAffinity = ORISA_LOBE_AFFINITY[ctx.five_layer.week]?.[lobe] ?? 1.0;
    // Layer 3: Moon Orisa (weight 0.15)
    const moonAffinity = ORISA_LOBE_AFFINITY[ctx.five_layer.moon]?.[lobe] ?? 1.0;
    // Layer 4: Year Orisa (weight 0.1)
    const yearAffinity = ORISA_LOBE_AFFINITY[ctx.five_layer.year]?.[lobe] ?? 1.0;
    // Layer 5: Jubilee Orisa (weight 0.1)
    const jubileeAffinity = ORISA_LOBE_AFFINITY[ctx.five_layer.jubilee]?.[lobe] ?? 1.0;

    // Weighted combination
    modifier =
      dayAffinity * 0.4 +
      weekAffinity * 0.25 +
      moonAffinity * 0.15 +
      yearAffinity * 0.1 +
      jubileeAffinity * 0.1;

    let suppressed = false;
    let enhanced = false;

    // Apply gate overrides
    const activeGates: string[] = [];
    if (ctx.gates.sabbath) activeGates.push("sabbath");
    if (ctx.gates.eshu_squared) activeGates.push("eshu_squared");
    if (ctx.gates.void_day) activeGates.push("void_day");
    if (ctx.gates.capstone) activeGates.push("capstone");

    for (const gate of activeGates) {
      const override = GATE_OVERRIDES[gate]?.[lobe];
      if (override) {
        if (override.suppress) suppressed = true;
        if (override.enhance) enhanced = true;
        if (override.modifier !== undefined) {
          modifier *= override.modifier;
        }
      }
    }

    // Apply economic multiplier
    modifier *= ctx.economic.multiplier;

    // Base weight is 1.0 for all lobes
    const base_weight = 1.0;
    const final_weight = Math.max(0, base_weight * modifier);

    weights.push({
      lobe,
      base_weight,
      orisa_modifier: modifier,
      final_weight,
      suppressed,
      enhanced,
    });
  }

  return weights;
}

/**
 * Get the current veil-day context.
 * In production, queries the Ritual-Codex BTC Time bridge.
 * Falls back to Gregorian approximation if unavailable.
 */
export function getCurrentVeilDayContext(): VeilDayContext {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sunday
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getUTCFullYear(), 0, 1).getTime()) / 86400000
  );

  const orisaNames: OrisaName[] = [
    "Esu", "Sango", "Osun", "Yemoja", "Oya", "Ogun", "Obatala",
  ];

  const dayOrisa = orisaNames[dayOfWeek % 7];
  const weekOrisa = orisaNames[Math.floor(dayOfYear / 7) % 7];
  const moonOrisa = orisaNames[Math.floor(dayOfYear / 28) % 7];
  const yearOrisa = orisaNames[now.getUTCFullYear() % 7];
  const jubileeOrisa = orisaNames[Math.floor(now.getUTCFullYear() / 50) % 7];

  const veilNumber = (dayOfYear % 350) + 1;
  const isSabbath = dayOfWeek === 6;
  const isEshuSquared = veilNumber % 12 === 0;
  const isVoid = dayOfYear === 364;
  const isCapstone = dayOfYear % 343 === 342;

  return {
    block_height: 0, // Would be populated from BTC RPC
    day_number: dayOfYear,
    veil_number: veilNumber,
    jubilee_cycle: 1,
    five_layer: {
      day: dayOrisa,
      week: weekOrisa,
      moon: moonOrisa,
      year: yearOrisa,
      jubilee: jubileeOrisa,
    },
    gates: {
      sabbath: isSabbath,
      eshu_squared: isEshuSquared,
      void_day: isVoid,
      capstone: isCapstone,
    },
    economic: {
      minting_active: !isVoid,
      new_contracts_allowed: !isSabbath,
      tithe_enforced: isEshuSquared,
      multiplier: isSabbath ? 1.1 : isEshuSquared ? 1.369 : 1.0,
      settle_only: isSabbath,
    },
  };
}

/**
 * Format lobe weights for logging/display.
 */
export function formatLobeWeights(weights: LobeWeight[]): string {
  const lines = weights.map((w) => {
    const bar = "#".repeat(Math.round(w.final_weight * 10));
    const flags = [
      w.suppressed ? "SUPPRESSED" : "",
      w.enhanced ? "ENHANCED" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `  ${w.lobe.padEnd(14)} ${bar.padEnd(25)} ${w.final_weight.toFixed(3)} ${flags}`;
  });
  return `[Omo Koda Lobe Activation]\n${lines.join("\n")}`;
}
