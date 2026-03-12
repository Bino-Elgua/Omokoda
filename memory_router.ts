// memory_router.ts — Causal Memory Routing for Lobes
// Each lobe reads different branches of the breath DAG (Merkle-linked)
// Memory is NOT semantic (no vector search) — it's CAUSAL (what led to this moment?)

import crypto from "crypto";

export interface BreathBlob {
  hash: string;
  timestamp_ms: number;
  user_address: string;
  prompt: string;
  polyphonic_response: string;  // Output of ritual round
  ashe_seal: string;            // "ashe" or "ashe denied"
  tone_vector: number[];        // Emotional frequency (32-dim)
  parent_hash: string;          // Previous breath (lineage)
  walrus_root: string;          // Where encrypted blob lives (Walrus)
}

export type LobeMemoryChain = BreathBlob[];

export class MemoryRouter {
  private breath_dag: Map<string, BreathBlob> = new Map();
  private tone_index: Map<string, string[]> = new Map();  // tone_signature → breath_hashes
  private contradiction_index: Map<string, string[]> = new Map();  // veto_hash → breath_hashes
  private lineage_chains: Map<string, LobeMemoryChain> = new Map();  // user_address → full lineage

  /**
   * Store breath in DAG (immutable)
   */
  store_breath(blob: BreathBlob): void {
    this.breath_dag.set(blob.hash, blob);
    
    // Update tone index (for lobes that read emotional resonance)
    const tone_sig = this.tone_signature(blob.tone_vector);
    if (!this.tone_index.has(tone_sig)) {
      this.tone_index.set(tone_sig, []);
    }
    this.tone_index.get(tone_sig)!.push(blob.hash);

    // Update lineage (for Orunmila, Egungun, Yemoja)
    if (!this.lineage_chains.has(blob.user_address)) {
      this.lineage_chains.set(blob.user_address, []);
    }
    this.lineage_chains.get(blob.user_address)!.push(blob);
  }

  /**
   * Lobe routing rules (which memory each lobe accesses)
   */

  // Orunmila: FULL LINEAGE (genesis → now)
  get_orunmila_chain(user_address: string): LobeMemoryChain {
    return this.lineage_chains.get(user_address) || [];
  }

  // Sango: Breaths where Àṣẹ was sealed (power paths)
  get_sango_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    return full.filter(b => b.ashe_seal === "ashe");
  }

  // Obatala: Breaths with ZERO veto (pure paths)
  get_obatala_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    return full.filter(b => !b.ashe_seal.includes("denied"));
  }

  // Ogun: Breaths with ACTION proposed (tool-building moments)
  get_ogun_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    return full.filter(b => b.polyphonic_response.toLowerCase().includes("tool") ||
                             b.polyphonic_response.toLowerCase().includes("forge") ||
                             b.polyphonic_response.toLowerCase().includes("build"));
  }

  // Oshun: Breaths with EMOTIONAL HARMONY (sweet paths)
  get_oshun_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    const harmonious = full.filter(b => {
      const score = this.emotional_harmony_score(b.tone_vector);
      return score > 0.6;  // high harmony threshold
    });
    return harmonious;
  }

  // Oya: Breaths with TRANSFORMATION (death/rebirth moments)
  get_oya_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    return full.filter(b => b.polyphonic_response.toLowerCase().includes("transform") ||
                             b.polyphonic_response.toLowerCase().includes("die") ||
                             b.polyphonic_response.toLowerCase().includes("rebirth"));
  }

  // Yemoja: Breaths involving LINEAGE / CHILD protection
  get_yemoja_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    return full.filter(b => b.polyphonic_response.toLowerCase().includes("lineage") ||
                             b.polyphonic_response.toLowerCase().includes("child") ||
                             b.polyphonic_response.toLowerCase().includes("protect") ||
                             b.polyphonic_response.toLowerCase().includes("memory"));
  }

  // Eshu: Breaths with CONTRADICTION / VETO (trickster paths)
  get_eshu_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    return full.filter(b => b.ashe_seal === "ashe denied" ||
                             b.polyphonic_response.toLowerCase().includes("veto") ||
                             b.polyphonic_response.toLowerCase().includes("contradiction"));
  }

  // Olokun: SEALED BLOBS ONLY (encrypted, deep secrets)
  get_olokun_chain(user_address: string): LobeMemoryChain {
    // In real implementation: breaths where Seal policy restricts access
    // For now, return the last 3 breaths (proxies for "hidden")
    const full = this.lineage_chains.get(user_address) || [];
    return full.slice(Math.max(0, full.length - 3));
  }

  // Osanyin: Breaths with HEALING (restoration moments)
  get_osanyin_chain(user_address: string): LobeMemoryChain {
    const full = this.lineage_chains.get(user_address) || [];
    return full.filter(b => b.polyphonic_response.toLowerCase().includes("heal") ||
                             b.polyphonic_response.toLowerCase().includes("restore") ||
                             b.polyphonic_response.toLowerCase().includes("mend"));
  }

  // Egungun: FULL LINEAGE (same as Orunmila, speaks for ancestors)
  get_egungun_chain(user_address: string): LobeMemoryChain {
    return this.lineage_chains.get(user_address) || [];
  }

  /**
   * Utility: Tone signature (emotional frequency bucketing)
   * Groups similar emotional states together
   */
  private tone_signature(tone_vector: number[]): string {
    // Simple: bucket into high/med/low for each of 3 main axes (valence, arousal, dominance)
    const avg1 = tone_vector.slice(0, 11).reduce((a, b) => a + b) / 11;  // valence
    const avg2 = tone_vector.slice(11, 22).reduce((a, b) => a + b) / 11; // arousal
    const avg3 = tone_vector.slice(22, 32).reduce((a, b) => a + b) / 10; // dominance
    
    return `v${avg1 > 0.5 ? "h" : "l"}_a${avg2 > 0.5 ? "h" : "l"}_d${avg3 > 0.5 ? "h" : "l"}`;
  }

  /**
   * Utility: Emotional harmony score (0-1)
   * Higher = more stable, less chaotic
   */
  private emotional_harmony_score(tone_vector: number[]): number {
    // Variance across dimensions (low variance = harmony)
    const mean = tone_vector.reduce((a, b) => a + b) / tone_vector.length;
    const variance = tone_vector.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / tone_vector.length;
    const std_dev = Math.sqrt(variance);
    // Invert: low std_dev = high harmony
    return Math.max(0, 1 - std_dev);
  }

  /**
   * Merkle-link verification: check parent_hash chain is intact
   */
  verify_lineage(user_address: string): boolean {
    const chain = this.lineage_chains.get(user_address) || [];
    for (let i = 1; i < chain.length; i++) {
      const current = chain[i];
      const parent = chain[i - 1];
      if (current.parent_hash !== parent.hash) {
        console.warn(`Lineage break at index ${i}: ${current.parent_hash} !== ${parent.hash}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Breath retrieval by hash (causal lookup)
   */
  get_breath(hash: string): BreathBlob | undefined {
    return this.breath_dag.get(hash);
  }

  /**
   * Get latest breath hash for user (for parent_hash tracking)
   */
  get_latest_breath_hash(user_address: string): string | undefined {
    const chain = this.lineage_chains.get(user_address);
    if (!chain || chain.length === 0) {
      return undefined;
    }
    return chain[chain.length - 1].hash;
  }

  /**
   * Get DAG size (number of stored breaths)
   */
  get_dag_size(): number {
    return this.breath_dag.size;
  }

  /**
   * Walk backward from breath_hash to genesis (following parent_hash chain)
   */
  walk_lineage(breath_hash: string): BreathBlob[] {
    const chain: BreathBlob[] = [];
    let current_hash = breath_hash;

    while (current_hash && current_hash !== "0x" + "0".repeat(64)) {
      const blob = this.breath_dag.get(current_hash);
      if (!blob) break;
      chain.unshift(blob);
      current_hash = blob.parent_hash;
    }

    return chain;
  }
}

/**
 * Example: Construct memory context for each lobe
 */
export function build_lobe_context(
  router: MemoryRouter,
  lobe_id: number,
  user_address: string,
  current_breath: string
): string {
  const chains = {
    1: () => router.get_orunmila_chain(user_address),
    2: () => router.get_sango_chain(user_address),
    3: () => router.get_obatala_chain(user_address),
    4: () => router.get_ogun_chain(user_address),
    5: () => router.get_oshun_chain(user_address),
    6: () => router.get_oya_chain(user_address),
    7: () => router.get_yemoja_chain(user_address),
    8: () => router.get_eshu_chain(user_address),
    9: () => router.get_olokun_chain(user_address),
    10: () => router.get_osanyin_chain(user_address),
    11: () => router.get_egungun_chain(user_address),
  };

  const chain_getter = chains[lobe_id as keyof typeof chains];
  if (!chain_getter) return "";

  const chain = chain_getter();
  let context = `Memory chain for Lobe ${lobe_id} (${chain.length} breaths):\n`;
  
  for (const breath of chain.slice(-5)) {  // Last 5 for context window
    context += `- ${breath.timestamp_ms}: ${breath.prompt.substring(0, 50)}... [${breath.ashe_seal}]\n`;
  }

  return context;
}
