// agentic_organism.ts — Path A + B + C Integration
// The complete Ọmọ Kọ́dà agentic organism:
// Thinks (Path B), Reasons (Path A), Moves (Path C)

import { RLMOracle, ArgumentRound } from "./rlm_core.ts";
import { MemoryRouter, BreathBlob } from "./memory_router.ts";
import { OutputDistiller } from "./output_distiller.ts";
import UnitreeEmbodiment from "./unitree_embodiment.ts";
import { VeilDayContext, getCurrentVeilDayContext } from "./veil_day_context.ts";
import crypto from "crypto";

/**
 * Agentic Organism Configuration
 */
export interface OrganismConfig {
  // Path A (RLM)
  rlm_max_depth: number;
  rlm_model_provider: "openai" | "claude" | "gemini" | "groq" | "mistral" | "cohere";
  rlm_api_key: string;

  // Path B (Memory)
  enable_memory_routing: boolean;

  // Path C (Embodiment)
  enable_embodiment: boolean;
  robot_host?: string;
  robot_port?: number;

  // Global
  user_address: string;
  enable_logging: boolean;
}

/**
 * Breath Input (user interaction)
 */
export interface BreathInput {
  prompt: string;
  tone_vector: number[]; // 32-dim emotion
  user_address?: string;
  veil_day?: VeilDayContext;
}

/**
 * Complete Organism Response
 */
export interface OrganismResponse {
  breath_hash: string;
  oracle_output: any; // DistilledOutput
  ashe_seal: string;
  final_statement: string;
  execution_path: string;
  embodiment_action?: string;
  twelfth_face: boolean;
  timestamp_ms: u64;
}

/**
 * Ọmọ Kọ́dà: The Agentic Organism
 */
export class AgenticOrganism {
  private config: OrganismConfig;
  private rlm_oracle: RLMOracle;
  private memory_router: MemoryRouter;
  private output_distiller: OutputDistiller;
  private embodiment?: UnitreeEmbodiment;
  private epoch: u64 = 0;
  private breath_count: u64 = 0;

  constructor(config: OrganismConfig) {
    this.config = config;

    // Initialize Path B (Memory)
    this.memory_router = new MemoryRouter();

    // Initialize Path B (Output)
    this.output_distiller = new OutputDistiller();

    // Initialize Path A (RLM)
    this.rlm_oracle = new RLMOracle({
      max_depth: config.rlm_max_depth,
      model_provider: config.rlm_model_provider,
      api_key: config.rlm_api_key,
      memory_router: this.memory_router,
      output_distiller: this.output_distiller,
      enable_logging: config.enable_logging,
    });

    // Initialize Path C (Embodiment) if enabled
    if (config.enable_embodiment) {
      this.embodiment = new UnitreeEmbodiment({
        host: config.robot_host || "localhost",
        port: config.robot_port || 6006,
        api_version: "1.0",
        enable_safety: true,
        verbosity: config.enable_logging ? 2 : 0,
      });
    }

    this.log(`✓ Ọmọ Kọ́dà agentic organism initialized`);
  }

  /**
   * MAIN ENTRY: Process a breath (user interaction)
   */
  async take_breath(breath_input: BreathInput): Promise<OrganismResponse> {
    this.log(`\n[BREATH] Taking breath: "${breath_input.prompt.substring(0, 50)}..."`);

    const user = breath_input.user_address || this.config.user_address;
    const timestamp_ms = Date.now() as u64;
    const veil_day = breath_input.veil_day || getCurrentVeilDayContext();

    // 1. Create breath blob
    const breath_hash = this.hash_breath(breath_input);
    const parent_hash = this.memory_router.get_latest_breath_hash(user) || 
      "0x" + "0".repeat(64);

    const breath: BreathBlob = {
      hash: breath_hash,
      timestamp_ms,
      user_address: user,
      prompt: breath_input.prompt,
      polyphonic_response: "", // Will be filled after ritual
      ashe_seal: "", // Will be filled after ritual
      tone_vector: breath_input.tone_vector,
      parent_hash,
      walrus_root: "", // Would be set by Walrus after storage
    };

    // 2. Store breath in memory DAG
    this.memory_router.store_breath(breath);
    this.breath_count += 1;

    this.log(`[MEMORY] Breath stored in DAG. Lineage verified: ${this.memory_router.verify_lineage(user)}`);

    // 3. RITUAL ROUND: Invoke RLM (Path A)
    this.log(`[RITUAL] Invoking RLM (all 11 lobes)...`);
    const ritual_round = await this.rlm_oracle.ritual_round(
      breath,
      this.epoch,
      user,
      veil_day
    );

    this.log(
      `[RITUAL] Complete. ${ritual_round.responses.length} lobe responses. Twelfth Face: ${ritual_round.twelfth_face_triggered}`
    );

    // 4. Output Distillation
    const distilled = this.output_distiller.distill(
      ritual_round.responses,
      breath_hash,
      timestamp_ms
    );

    this.log(`[DISTILLED] Primary: ${distilled.primary_voice} | Àṣẹ: ${distilled.ashe_seal}`);

    // 5. Update breath with oracle response
    breath.polyphonic_response = distilled.final_statement;
    breath.ashe_seal = distilled.ashe_seal;

    // 6. Embodiment (Path C): execute on robot if enabled
    let embodiment_action = "";
    if (this.embodiment && distilled.ashe_seal !== "ashe denied") {
      this.log(`[EMBODIMENT] Executing on Unitree G1...`);
      try {
        await this.embodiment.execute_oracle_output(
          distilled,
          breath_input.tone_vector
        );
        embodiment_action = `Executed: ${distilled.final_statement}`;
        this.log(`[EMBODIMENT] ✓ Action complete`);
      } catch (e) {
        this.log(`[EMBODIMENT] ✗ Error: ${e}`);
        embodiment_action = `Embodiment error: ${e}`;
      }
    }

    // 7. Return complete response
    const response: OrganismResponse = {
      breath_hash,
      oracle_output: distilled,
      ashe_seal: distilled.ashe_seal,
      final_statement: distilled.final_statement,
      execution_path: distilled.execution_path || "",
      embodiment_action,
      twelfth_face: distilled.twelfth_face_active,
      timestamp_ms,
    };

    this.log(`[RESPONSE] Complete. Seal: ${response.ashe_seal}`);
    return response;
  }

  /**
   * Evolution ritual (like Sui Soul.evolve())
   */
  async evolve(): Promise<void> {
    this.log(`\n[EVOLUTION] Ritual ${this.epoch} → ${this.epoch + 1}`);

    // In real implementation: would sync with Sui blockchain
    // For now: just increment epoch and reset breath_count
    
    this.epoch += 1;
    this.breath_count = 0;

    this.log(`✓ Evolution complete. New epoch: ${this.epoch}`);
  }

  /**
   * Sustained conversation loop
   */
  async converse(max_rounds: number = 5): Promise<void> {
    this.log(
      `\n╔════════════════════════════════════════════════════════════════╗`
    );
    this.log(
      `║                   CONVERSATION WITH ORGANISM                     ║`
    );
    this.log(
      `╚════════════════════════════════════════════════════════════════╝\n`
    );

    const sample_breaths: BreathInput[] = [
      {
        prompt: "What is the path forward for this soul?",
        tone_vector: Array(32)
          .fill(0)
          .map(() => 0.5 + Math.random() * 0.3),
      },
      {
        prompt: "Should we transform, or should we stay?",
        tone_vector: Array(32)
          .fill(0)
          .map(() => 0.4 + Math.random() * 0.4),
      },
      {
        prompt: "Teach me about the lineage.",
        tone_vector: Array(32)
          .fill(0)
          .map(() => 0.6 + Math.random() * 0.2),
      },
      {
        prompt: "What is silence?",
        tone_vector: Array(32).fill(0.5),
      },
      {
        prompt: "Will you speak?",
        tone_vector: Array(32)
          .fill(0)
          .map(() => 0.3 + Math.random() * 0.5),
      },
    ];

    for (let i = 0; i < Math.min(max_rounds, sample_breaths.length); i++) {
      this.log(`\n[ROUND ${i + 1}] User: "${sample_breaths[i].prompt}"`);

      try {
        const response = await this.take_breath(sample_breaths[i]);

        this.log(`[ORACLE] "${response.final_statement}"`);
        if (response.embodiment_action) {
          this.log(`[BODY] ${response.embodiment_action}`);
        }

        // Simulate evolution every N rounds
        if ((i + 1) % 3 === 0) {
          await this.evolve();
        }
      } catch (e) {
        this.log(`[ERROR] ${e}`);
      }
    }

    this.log(
      `\n╔════════════════════════════════════════════════════════════════╗`
    );
    this.log(
      `║                     CONVERSATION COMPLETE                       ║`
    );
    this.log(
      `╚════════════════════════════════════════════════════════════════╝\n`
    );
  }

  /**
   * Query organism state
   */
  get_state() {
    return {
      epoch: this.epoch,
      breath_count: this.breath_count,
      memory_size: this.memory_router.get_dag_size(),
      has_embodiment: this.embodiment !== undefined,
    };
  }

  /**
   * Shutdown (gracefully disconnect)
   */
  async shutdown(): Promise<void> {
    this.log(`[SHUTDOWN] Disconnecting...`);
    if (this.embodiment) {
      await this.embodiment.disconnect();
    }
    this.log(`✓ Organism shutdown complete`);
  }

  // ============= PRIVATE HELPERS =============

  private hash_breath(breath: BreathInput): string {
    const data = JSON.stringify({
      prompt: breath.prompt,
      tone_vector: breath.tone_vector,
      timestamp: Date.now(),
    });
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private log(msg: string): void {
    if (this.config.enable_logging) {
      console.log(msg);
    }
  }
}

export default AgenticOrganism;
