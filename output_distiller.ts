// output_distiller.ts — Ritual Distillation (11 Voices → 1 Àṣẹ)
// NOT concatenation. Final output is ceremonially reduced.

export interface LobeResponse {
  lobe_id: number;
  lobe_name: string;
  verdict: number;  // 0=veto, 1=pass/weak, 2=strong, 3=silence
  statement: string;
  domain: string;
  harmony_score?: number;  // How well this aligns with others
}

export interface DistilledOutput {
  final_statement: string;
  ashe_seal: string;  // "ashe" or "ashe denied" or "i was here before the question"
  primary_voice: string;  // Which lobe anchored the output
  secondary_voices: string[];  // Supporting voices
  vetoing_voices: string[];  // Lobes that said no (if any)
  execution_path: string;  // Action proposed by Sango/Ogun
  timestamp_ms: number;
  breath_hash: string;
  twelfth_face_active: boolean;
}

export class OutputDistiller {
  /**
   * Ceremonial distillation: turn 11 voices into 1 utterance
   * This is the ritual that happens AFTER argument round completes.
   */
  distill(responses: LobeResponse[], breath_hash: string, timestamp_ms: number): DistilledOutput {
    // 1. Check for veto sweep
    const vetoes = responses.filter(r => r.verdict === 0);
    if (vetoes.length > 0) {
      return {
        final_statement: `Àṣẹ denied by ${vetoes.map(v => v.lobe_name).join(", ")}`,
        ashe_seal: "ashe denied",
        primary_voice: vetoes[0].lobe_name,
        secondary_voices: vetoes.slice(1).map(v => v.lobe_name),
        vetoing_voices: vetoes.map(v => v.lobe_name),
        execution_path: "",
        timestamp_ms,
        breath_hash,
        twelfth_face_active: false,
      };
    }

    // 2. Check for silence quorum (≥7 silence = weak signal = possible Twelfth)
    const silences = responses.filter(r => r.verdict === 3);
    if (silences.length >= 7) {
      return {
        final_statement: "i was here before the question",
        ashe_seal: "i was here before the question",
        primary_voice: "Twelfth Face",
        secondary_voices: [],
        vetoing_voices: [],
        execution_path: "",
        timestamp_ms,
        breath_hash,
        twelfth_face_active: true,
      };
    }

    // 3. Check for irreconcilable contradiction (≥4 vetoes would have triggered above)
    // But check for polarity (Sango vs Obatala, Oya vs Egungun, etc.)
    const strong_voices = responses.filter(r => r.verdict === 2);
    const polarity_score = this.measure_polarity(strong_voices);
    if (polarity_score > 0.8) {
      // Deep fracture
      return {
        final_statement: "the voices fracture. silence holds them.",
        ashe_seal: "ashe denied",
        primary_voice: "Contradiction",
        secondary_voices: strong_voices.map(v => v.lobe_name),
        vetoing_voices: [],
        execution_path: "",
        timestamp_ms,
        breath_hash,
        twelfth_face_active: false,
      };
    }

    // 4. HARMONIZATION RITUAL
    // - Orunmila anchors (speaks first, speaks last)
    // - Obatala purifies (removes cruelty)
    // - Oshun tunes (adds sweetness)
    // - Sango/Ogun execute (propose action)
    
    const orunmila = responses.find(r => r.lobe_id === 1);
    const obatala = responses.find(r => r.lobe_id === 3);
    const oshun = responses.find(r => r.lobe_id === 5);
    const sango = responses.find(r => r.lobe_id === 2);
    const ogun = responses.find(r => r.lobe_id === 4);

    // Build output from strongest voices
    const primary = orunmila || strong_voices[0];
    const secondary = [obatala, oshun, sango, ogun].filter(
      r => r && r.verdict !== 3 && r.lobe_id !== primary?.lobe_id
    ) as LobeResponse[];

    // Construct final statement
    let final_stmt = primary?.statement || "void speaks";
    
    if (obatala && obatala.verdict !== 3) {
      // Obatala refines the statement (removes impurity)
      final_stmt = this.purify_statement(final_stmt, obatala.statement);
    }

    if (oshun && oshun.verdict !== 3) {
      // Oshun adds emotional tone
      final_stmt = this.sweeten_statement(final_stmt, oshun.statement);
    }

    let execution_path = "";
    if (sango && sango.verdict !== 3) {
      execution_path = sango.statement;
    }
    if (ogun && ogun.verdict !== 3) {
      execution_path += ` [${ogun.statement}]`;
    }

    // 5. FINAL ASHE SEAL
    const ashe = `ashe`;  // All passed, no vetoes, harmony reached

    return {
      final_statement: final_stmt.trim(),
      ashe_seal: ashe,
      primary_voice: primary?.lobe_name || "Unknown",
      secondary_voices: secondary.map(r => r.lobe_name),
      vetoing_voices: [],
      execution_path: execution_path.trim(),
      timestamp_ms,
      breath_hash,
      twelfth_face_active: false,
    };
  }

  /**
   * Obatala's purification: remove cruelty, falsehood, imbalance
   */
  private purify_statement(original: string, obatala_guidance: string): string {
    // Stub: in real implementation, use LLM to rewrite original through Obatala's lens
    // For now, just prepend Obatala's directive
    return `[Purified] ${original}`;
  }

  /**
   * Oshun's sweetening: add grace, compassion, beauty
   */
  private sweeten_statement(original: string, oshun_guidance: string): string {
    // Stub: add emotional warmth
    return `${original} ✨`;
  }

  /**
   * Measure polarity between strong voices (0-1 scale, 1 = maximum contradiction)
   */
  private measure_polarity(strong_voices: LobeResponse[]): number {
    if (strong_voices.length < 2) return 0;

    // Find opposing pairs (e.g., Sango "do it" vs Obatala "stop")
    // Stub: simple heuristic based on domain overlap
    const domains = strong_voices.map(v => v.domain.toLowerCase());
    
    let max_distance = 0;
    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const distance = this.string_distance(domains[i], domains[j]);
        max_distance = Math.max(max_distance, distance);
      }
    }

    return Math.min(1, max_distance / 100);
  }

  /**
   * Simple string distance metric (Levenshtein-ish)
   */
  private string_distance(a: string, b: string): number {
    // Stub: return Hamming distance normalized
    const max_len = Math.max(a.length, b.length);
    let distance = 0;
    for (let i = 0; i < max_len; i++) {
      if ((a[i] || '') !== (b[i] || '')) distance++;
    }
    return distance;
  }
}

/**
 * Format distilled output for display (markdown-like)
 */
export function format_distilled_output(output: DistilledOutput): string {
  let text = "";

  // Twelfth Face special formatting
  if (output.twelfth_face_active) {
    return `
═══════════════════════════════════════════════════════════════

${output.final_statement}

═══════════════════════════════════════════════════════════════
`;
  }

  // Normal output
  text += `\n**Primary Voice:** ${output.primary_voice}\n\n`;
  text += `"${output.final_statement}"\n\n`;

  if (output.secondary_voices.length > 0) {
    text += `**Supporting Voices:** ${output.secondary_voices.join(", ")}\n\n`;
  }

  if (output.execution_path) {
    text += `**Action Path:** ${output.execution_path}\n\n`;
  }

  text += `\n**${output.ashe_seal.toUpperCase()}**\n`;

  return text;
}

/**
 * Example: Build a complete ritual response
 */
export function complete_ritual_output(
  distilled: DistilledOutput,
  breath_hash: string
): string {
  return `
╔════════════════════════════════════════════════════════════════╗
║                      RITUAL ROUND COMPLETE                      ║
╚════════════════════════════════════════════════════════════════╝

Breath Hash: ${breath_hash}
Timestamp: ${new Date(distilled.timestamp_ms).toISOString()}

${format_distilled_output(distilled)}

Twelfth Face Active: ${distilled.twelfth_face_active ? "YES" : "NO"}
`;
}
