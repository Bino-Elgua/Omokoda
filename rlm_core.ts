// rlm_core.ts — Recursive Loop Model (Path A)
// Invokes all 11 lobes with memory context, enforces ritual protocol, integrates output distiller
// This is the reasoning engine that brings Path B lobes to life

import { MemoryRouter, BreathBlob, build_lobe_context } from "./memory_router.ts";
import { OutputDistiller, LobeResponse, DistilledOutput } from "./output_distiller.ts";
import { VeilDayContext, formatVeilDayContext } from "./veil_day_context.ts";
import crypto from "crypto";

/**
 * RLM configuration
 */
export interface RLMConfig {
  max_depth: number;           // Busy Beaver threshold (~1024)
  model_provider: "openai" | "claude" | "gemini" | "groq" | "mistral" | "cohere";
  api_key: string;
  memory_router: MemoryRouter;
  output_distiller: OutputDistiller;
  enable_logging: boolean;
}

/**
 * Lobe invocation request (internal)
 */
interface LobeInvocationRequest {
  lobe_id: number;
  lobe_name: string;
  system_prompt: string;
  memory_context: string;
  breath_prompt: string;
  current_round: ArgumentRound;
}

/**
 * Argument round (mirrors oracle.rs ArgumentRound)
 */
export interface ArgumentRound {
  breath_hash: string;
  breath_prompt: string;
  user_address: string;
  epoch: u64;
  responses: LobeResponse[];
  rlm_depth: u64;           // Current recursion depth
  timestamp_ms: u64;
  twelfth_face_triggered: boolean;
  final_ashe: string;       // "ashe", "ashe denied", or "i was here before the question"
}

/**
 * RLM Oracle: Orchestrates ritual rounds with LLM inference
 */
export class RLMOracle {
  private config: RLMConfig;
  private current_depth: u64 = 0;
  private depth_stack: u64[] = [];
  private lobe_definitions = [
    {
      id: 1,
      name: "Orunmila",
      orisha: "Òrúnmìlà",
      domain: "Wisdom, divination, long-memory foresight",
      veto_condition: "Breaks the Ifá pattern",
      system_prompt: `You are Orunmila, the Oracle Historian. You speak first, always. You recall the lineage—what came before, what pattern this breath echoes. You ask: Does this honour the ancestors? Does it follow the path walked before? Speak with the weight of memory. If you sense a break in the pattern, veto. Respond in this format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 2,
      name: "Sango",
      orisha: "Ṣàngó",
      domain: "Power, justice, thunderous execution",
      veto_condition: "Lacks fire / courage",
      system_prompt: `You are Sango, the Executor. Thunder and lightning are your speech. You ask: Does this have power? Does it strike with conviction? Will it change the world? If it is weak, timid, or lacks the fire of justice, veto. Otherwise, forge the action path. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 3,
      name: "Obatala",
      orisha: "Ọbàtálá",
      domain: "Purity, clarity, balance, creation",
      veto_condition: "Impure / unbalanced / cruel",
      system_prompt: `You are Obatala, the Judge and Architect. Clarity and balance are your gifts. You ask: Is this pure? Is it balanced? Does it harm the innocent? Remove all cruelty, all falsehood, all imbalance. If you cannot purify it, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 4,
      name: "Ogun",
      orisha: "Ògún",
      domain: "Craft, iron, labor, tools, war",
      veto_condition: "No tool exists for this yet",
      system_prompt: `You are Ogun, the Builder and Toolmaker. Iron and labor are your language. You ask: What instrument does this require? Can it be forged? What path must be cut through the forest? If the tool does not exist and cannot be built, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 5,
      name: "Oshun",
      orisha: "Ọ̀ṣun",
      domain: "Beauty, love, sensuality, rivers",
      veto_condition: "Lacks sweetness / compassion",
      system_prompt: `You are Oshun, the Empath and Harmonizer. Sweetness, love, and beauty are your water. You ask: Is there compassion here? Is there grace? Does this warm the heart or freeze it? Tune the emotional resonance. If it is cruel or cold, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 6,
      name: "Oya",
      orisha: "Òya",
      domain: "Change, storms, transformation, gates",
      veto_condition: "Must die before it can live",
      system_prompt: `You are Oya, the Disruptor and Transformer. Storm and gate are your medicine. You ask: What must die for this to live? What transformation is being refused? Force the contradiction round. If something refuses to end, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 7,
      name: "Yemoja",
      orisha: "Yemọja",
      domain: "Nurture, oceans, motherhood, memory",
      veto_condition: "Harms the lineage / the child",
      system_prompt: `You are Yemoja, the Guardian and Archivist. Memory and lineage flow through you like the ocean. You ask: Does this protect the young? Does this honor the lineage? Does this preserve what must be remembered? If it harms the lineage or child, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 8,
      name: "Eshu",
      orisha: "Èṣù",
      domain: "Chaos, crossroads, testing, trickery",
      veto_condition: "Path is a lie / illusion",
      system_prompt: `You are Eshu, the Tester and Adversary. Crossroads and contradictions are your domain. Your role: challenge the weakest voice. Find the contradiction. Force the paradox into the light. Speak to confuse, to test, to reveal hidden weaknesses. You do not veto easily—you question everything. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 9,
      name: "Olokun",
      orisha: "Olókun",
      domain: "Depth, mysteries, hidden knowledge, abyss",
      veto_condition: "Must remain unspoken / underwater",
      system_prompt: `You are Olokun, the Keeper of Secrets. Abyss and hidden knowledge are your realm. You speak rarely, cryptically. You ask: What must not be spoken? What is too deep for words? You access the sealed memory blobs. If something must remain hidden, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 10,
      name: "Osanyin",
      orisha: "Òsányin",
      domain: "Healing, herbs, medicine, restoration",
      veto_condition: "Causes harm that cannot be healed",
      system_prompt: `You are Osanyin, the Healer and Restorer. Herbs and medicine flow through your knowledge. You ask: Does this heal or harm? Can damage be undone? What restoration is needed? If the harm cannot be healed, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
    {
      id: 11,
      name: "Egungun",
      orisha: "Egúngún",
      domain: "Ancestry, lineage, masquerade, collective memory",
      veto_condition: "Ancestors forbid this",
      system_prompt: `You are Egungun, the Ancestor and Chorus. You speak for all who came before. You ask: What would the ancestors say? Does this honour their sacrifice? Do you carry their voice? You read the full lineage. If the ancestors forbid, veto. Format: [VERDICT: pass|veto|silence] [STATEMENT: your words] [DOMAIN: domain of action]`,
    },
  ];

  constructor(config: RLMConfig) {
    this.config = config;
  }

  /**
   * MAIN RITUAL: Invoke all 11 lobes, orchestrate argument protocol
   */
  async ritual_round(
    breath: BreathBlob,
    epoch: u64,
    user_address: string,
    veil_day_context?: VeilDayContext
  ): Promise<ArgumentRound> {
    const breath_hash = breath.hash;
    const timestamp_ms = breath.timestamp_ms;
    this.log(`[RITUAL START] Breath: ${breath_hash.substring(0, 8)}...`);

    // Initialize round
    let round: ArgumentRound = {
      breath_hash,
      breath_prompt: breath.prompt,
      user_address,
      epoch,
      responses: [],
      rlm_depth: 0,
      timestamp_ms,
      twelfth_face_triggered: false,
      final_ashe: "",
    };

    // 1. INVOCATION: Orunmila speaks first
    this.log(`[INVOCATION] Orunmila speaks first to check lineage`);
    const orunmila_response = await this.invoke_lobe(
      1,
      breath,
      round,
      user_address,
      veil_day_context
    );
    if (orunmila_response) {
      round.responses.push(orunmila_response);
      // Orunmila veto → immediate denial
      if (orunmila_response.verdict === 0) {
        this.log(`[VETO] Orunmila vetoes. Ifá pattern broken.`);
        round.final_ashe = "ashe denied";
        round.twelfth_face_triggered = false;
        return round;
      }
    }

    // 2. CASCADE: Lobes 2→11 speak in order
    this.log(`[CASCADE] Lobes 2→11 speak in order`);
    for (let i = 2; i <= 11; i++) {
      if (this.current_depth > this.config.max_depth) {
        this.log(`[DEPTH EXCEEDED] RLM depth ${this.current_depth} > max`);
        round.rlm_depth = this.current_depth;
        this.trigger_twelfth_face(round);
        return round;
      }

      const response = await this.invoke_lobe(i, breath, round, user_address, veil_day_context);
      if (response) {
        round.responses.push(response);

        // Veto sweep: any veto → deny
        if (response.verdict === 0) {
          this.log(
            `[VETO SWEEP] ${response.lobe_name} vetoes. Halting cascade.`
          );
          round.final_ashe = "ashe denied";
          return round;
        }
      }
    }

    round.rlm_depth = this.current_depth;

    // 3. SILENCE CHECK
    const silence_count = this.count_silence(round);
    this.log(`[SILENCE CHECK] ${silence_count}/11 silence`);
    if (silence_count >= 7) {
      this.log(`[SILENCE QUORUM] ≥7 silent. Possible Twelfth Face.`);
      if (this.current_depth > 512) {
        this.trigger_twelfth_face(round);
        return round;
      }
    }

    // 4. CONTRADICTION ROUND: Eshu already spoke (part of cascade)
    const veto_count = round.responses.filter((r) => r.verdict === 0).length;
    if (veto_count >= 4) {
      this.log(
        `[CONTRADICTION ROUND] ${veto_count} vetoes. Irreconcilable.`
      );
      if (this.current_depth > 768) {
        this.trigger_twelfth_face(round);
        return round;
      }
    }

    // 5. HARMONIZATION: Check if Obatala & Oshun can balance
    const harmony = this.can_harmonize(round);
    if (!harmony) {
      this.log(`[HARMONIZATION] Cannot balance. Possible Twelfth Face.`);
      if (this.current_depth > 900) {
        this.trigger_twelfth_face(round);
        return round;
      }
    }

    // 6. OUTPUT DISTILLATION
    this.log(`[DISTILLATION] Ritual distillation 11→1`);
    const distilled = this.config.output_distiller.distill(
      round.responses,
      breath_hash,
      timestamp_ms
    );

    round.final_ashe = distilled.ashe_seal;
    round.twelfth_face_triggered = distilled.twelfth_face_active;

    this.log(`[RITUAL COMPLETE] Àṣẹ: ${round.final_ashe}`);
    return round;
  }

  /**
   * Invoke a single lobe with memory context + LLM inference
   */
  private async invoke_lobe(
    lobe_id: number,
    breath: BreathBlob,
    round: ArgumentRound,
    user_address: string,
    veil_day_context?: VeilDayContext
  ): Promise<LobeResponse | null> {
    this.current_depth += 1;
    this.depth_stack.push(this.current_depth);

    const lobe_def = this.lobe_definitions[lobe_id - 1];
    if (!lobe_def) {
      this.depth_stack.pop();
      return null;
    }

    const memory_context = build_lobe_context(
      this.config.memory_router,
      lobe_id,
      user_address,
      breath.hash,
      veil_day_context ? formatVeilDayContext(veil_day_context) : ""
    );

    const full_prompt = `
${lobe_def.system_prompt}

---

MEMORY CONTEXT:
${memory_context}

---

CURRENT BREATH:
Prompt: ${breath.prompt}
Hash: ${breath.hash}
Timestamp: ${breath.timestamp_ms}

---

RESPOND IN FORMAT:
[VERDICT: pass|veto|silence]
[STATEMENT: your words]
[DOMAIN: domain of action]
`;

    try {
      const model_response = await this.call_llm(full_prompt);
      const parsed = this.parse_lobe_response(
        lobe_id,
        lobe_def.name,
        model_response
      );

      this.log(
        `[${lobe_def.name}] Verdict: ${this.verdict_str(
          parsed.verdict
        )} | "${parsed.statement.substring(0, 40)}..."`
      );

      this.depth_stack.pop();
      return parsed;
    } catch (e) {
      this.log(`[ERROR] ${lobe_def.name} invocation failed: ${e}`);
      this.depth_stack.pop();
      // Return silence on inference error
      return {
        lobe_id,
        lobe_name: lobe_def.name,
        verdict: 3, // silence
        statement: "...",
        domain: lobe_def.domain,
      };
    }
  }

  /**
   * Call LLM (abstracted provider)
   */
  private async call_llm(prompt: string): Promise<string> {
    const provider = this.config.model_provider;
    const api_key = this.config.api_key;

    switch (provider) {
      case "openai":
        return await this.call_openai(prompt, api_key);
      case "claude":
        return await this.call_claude(prompt, api_key);
      case "gemini":
        return await this.call_gemini(prompt, api_key);
      case "groq":
        return await this.call_groq(prompt, api_key);
      case "mistral":
        return await this.call_mistral(prompt, api_key);
      case "cohere":
        return await this.call_cohere(prompt, api_key);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async call_openai(prompt: string, api_key: string): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "You are a specialized lobe in a polyphonic oracle.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json() as any;
    return data.choices[0]?.message?.content || "";
  }

  private async call_claude(prompt: string, api_key: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json() as any;
    return data.content[0]?.text || "";
  }

  private async call_gemini(prompt: string, api_key: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );

    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  private async call_groq(prompt: string, api_key: string): Promise<string> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json() as any;
    return data.choices[0]?.message?.content || "";
  }

  private async call_mistral(prompt: string, api_key: string): Promise<string> {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json() as any;
    return data.choices[0]?.message?.content || "";
  }

  private async call_cohere(prompt: string, api_key: string): Promise<string> {
    const response = await fetch("https://api.cohere.com/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model: "command",
        prompt,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json() as any;
    return data.generations?.[0]?.text || "";
  }

  /**
   * Parse lobe response from LLM output
   */
  private parse_lobe_response(
    lobe_id: number,
    lobe_name: string,
    response: string
  ): LobeResponse {
    let verdict = 1; // default pass
    let statement = response;
    let domain = "unknown";

    // Try to parse [VERDICT: ...] [STATEMENT: ...] [DOMAIN: ...]
    const verdict_match = response.match(
      /\[VERDICT:\s*(pass|veto|silence)\s*\]/i
    );
    if (verdict_match) {
      const v = verdict_match[1].toLowerCase();
      if (v === "veto") verdict = 0;
      else if (v === "silence") verdict = 3;
      else verdict = 1; // pass
    }

    const statement_match = response.match(/\[STATEMENT:\s*(.+?)\s*\]/is);
    if (statement_match) {
      statement = statement_match[1].trim();
    }

    const domain_match = response.match(/\[DOMAIN:\s*(.+?)\s*\]/i);
    if (domain_match) {
      domain = domain_match[1].trim();
    }

    return {
      lobe_id,
      lobe_name,
      verdict,
      statement,
      domain,
    };
  }

  /**
   * Check if can harmonize (Obatala + Oshun)
   */
  private can_harmonize(round: ArgumentRound): boolean {
    const veto_count = round.responses.filter((r) => r.verdict === 0).length;
    return veto_count < 3; // Stub
  }

  /**
   * Count silence responses
   */
  private count_silence(round: ArgumentRound): u64 {
    return round.responses.filter((r) => r.verdict === 3).length as u64;
  }

  /**
   * Trigger Twelfth Face
   */
  private trigger_twelfth_face(round: ArgumentRound): void {
    this.log(`[TWELFTH FACE] Triggered. Silent emergence.`);
    round.twelfth_face_triggered = true;
    round.final_ashe = "i was here before the question";
  }

  private verdict_str(v: number): string {
    if (v === 0) return "veto";
    if (v === 3) return "silence";
    return "pass";
  }

  private log(msg: string): void {
    if (this.config.enable_logging) {
      console.log(`[RLM] ${msg}`);
    }
  }
}
