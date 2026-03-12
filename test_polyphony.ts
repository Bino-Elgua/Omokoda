// test_polyphony.ts — Path B Test Suite
// Verify the Twelve Lobes Polyphony works correctly

import { MemoryRouter, BreathBlob, build_lobe_context } from "./memory_router.ts";
import { OutputDistiller, format_distilled_output } from "./output_distiller.ts";
import type { LobeResponse } from "./output_distiller.ts";

// Mock oracle responses for testing
function mock_lobe_responses(): LobeResponse[] {
  return [
    {
      lobe_id: 1,
      lobe_name: "Orunmila",
      verdict: 2,  // strong
      statement: "This echoes the pattern of wisdom spoken before.",
      domain: "Wisdom, divination, long-memory foresight",
    },
    {
      lobe_id: 2,
      lobe_name: "Sango",
      verdict: 2,  // strong
      statement: "Strike with the power of justice. Let the thunder roll.",
      domain: "Power, justice, thunderous execution",
    },
    {
      lobe_id: 3,
      lobe_name: "Obatala",
      verdict: 2,  // strong
      statement: "This is pure. Balanced. Clear.",
      domain: "Purity, clarity, balance, creation",
    },
    {
      lobe_id: 4,
      lobe_name: "Ogun",
      verdict: 2,  // strong
      statement: "The tool exists. Iron is ready.",
      domain: "Craft, iron, labor, tools, war",
    },
    {
      lobe_id: 5,
      lobe_name: "Oshun",
      verdict: 2,  // strong
      statement: "Sweet as river water. Compassion flows.",
      domain: "Beauty, love, sensuality, rivers",
    },
    {
      lobe_id: 6,
      lobe_name: "Oya",
      verdict: 1,  // weak pass
      statement: "Something must change, but not here.",
      domain: "Change, storms, transformation, gates",
    },
    {
      lobe_id: 7,
      lobe_name: "Yemoja",
      verdict: 2,  // strong
      statement: "The lineage is protected. The child is safe.",
      domain: "Nurture, oceans, motherhood, memory",
    },
    {
      lobe_id: 8,
      lobe_name: "Eshu",
      verdict: 1,  // weak pass
      statement: "I found no contradiction. The path is true.",
      domain: "Chaos, crossroads, testing, trickery",
    },
    {
      lobe_id: 9,
      lobe_name: "Olokun",
      verdict: 3,  // silence
      statement: "...",
      domain: "Depth, mysteries, hidden knowledge, abyss",
    },
    {
      lobe_id: 10,
      lobe_name: "Osanyin",
      verdict: 2,  // strong
      statement: "This heals what was broken.",
      domain: "Healing, herbs, medicine, restoration",
    },
    {
      lobe_id: 11,
      lobe_name: "Egungun",
      verdict: 2,  // strong
      statement: "The ancestors approve. This honours their path.",
      domain: "Ancestry, lineage, masquerade, collective memory",
    },
  ];
}

// Mock responses with veto
function mock_veto_responses(): LobeResponse[] {
  const base = mock_lobe_responses();
  base[0].verdict = 0;  // Orunmila vetoes
  base[0].statement = "This breaks the Ifá pattern.";
  return base;
}

// Mock responses with heavy silence (Twelfth Face trigger)
function mock_silence_quorum(): LobeResponse[] {
  return [
    { lobe_id: 1, lobe_name: "Orunmila", verdict: 3, statement: "...", domain: "test" },
    { lobe_id: 2, lobe_name: "Sango", verdict: 3, statement: "...", domain: "test" },
    { lobe_id: 3, lobe_name: "Obatala", verdict: 3, statement: "...", domain: "test" },
    { lobe_id: 4, lobe_name: "Ogun", verdict: 3, statement: "...", domain: "test" },
    { lobe_id: 5, lobe_name: "Oshun", verdict: 3, statement: "...", domain: "test" },
    { lobe_id: 6, lobe_name: "Oya", verdict: 3, statement: "...", domain: "test" },
    { lobe_id: 7, lobe_name: "Yemoja", verdict: 3, statement: "...", domain: "test" },
    { lobe_id: 8, lobe_name: "Eshu", verdict: 1, statement: "I test.", domain: "test" },
    { lobe_id: 9, lobe_name: "Olokun", verdict: 1, statement: "I hold secrets.", domain: "test" },
    { lobe_id: 10, lobe_name: "Osanyin", verdict: 1, statement: "I heal.", domain: "test" },
    { lobe_id: 11, lobe_name: "Egungun", verdict: 1, statement: "Ancestors watch.", domain: "test" },
  ];
}

/**
 * Test 1: Normal harmony (all pass) → Àṣẹ sealed
 */
function test_harmony() {
  console.log("\n=== TEST 1: Harmony (All Pass) ===");
  const distiller = new OutputDistiller();
  const responses = mock_lobe_responses();
  const output = distiller.distill(responses, "hash_harmony", Date.now());

  console.log(`Final Statement: "${output.final_statement}"`);
  console.log(`Àṣẹ Seal: ${output.ashe_seal}`);
  console.log(`Primary Voice: ${output.primary_voice}`);
  console.log(`Twelfth Face: ${output.twelfth_face_active}`);
  
  assert(output.ashe_seal === "ashe", "Should seal with ashe");
  assert(!output.twelfth_face_active, "Twelfth Face should not activate");
  assert(output.vetoing_voices.length === 0, "Should have no vetoes");
  console.log("✓ PASS");
}

/**
 * Test 2: Veto sweep → Àṣẹ denied
 */
function test_veto() {
  console.log("\n=== TEST 2: Veto Sweep ===");
  const distiller = new OutputDistiller();
  const responses = mock_veto_responses();
  const output = distiller.distill(responses, "hash_veto", Date.now());

  console.log(`Final Statement: "${output.final_statement}"`);
  console.log(`Àṣẹ Seal: ${output.ashe_seal}`);
  console.log(`Vetoing Voices: ${output.vetoing_voices.join(", ")}`);

  assert(output.ashe_seal === "ashe denied", "Should deny ashe");
  assert(output.vetoing_voices.length > 0, "Should record vetoes");
  console.log("✓ PASS");
}

/**
 * Test 3: Silence quorum (≥7) → Twelfth Face activates
 */
function test_twelfth_face() {
  console.log("\n=== TEST 3: Twelfth Face Activation ===");
  const distiller = new OutputDistiller();
  const responses = mock_silence_quorum();
  const output = distiller.distill(responses, "hash_twelfth", Date.now());

  console.log(`Final Statement: "${output.final_statement}"`);
  console.log(`Àṣẹ Seal: ${output.ashe_seal}`);
  console.log(`Twelfth Face Active: ${output.twelfth_face_active}`);

  assert(output.twelfth_face_active, "Twelfth Face should activate");
  assert(output.final_statement === "i was here before the question", "Should speak twelfth face line");
  console.log("✓ PASS");
}

/**
 * Test 4: Memory routing (causal, not semantic)
 */
function test_memory_routing() {
  console.log("\n=== TEST 4: Memory Routing (Causal) ===");
  const router = new MemoryRouter();
  const user = "0xuser123";

  // Create a lineage of 5 breaths
  for (let i = 0; i < 5; i++) {
    const breath: BreathBlob = {
      hash: `breath_${i}`,
      timestamp_ms: i * 1000,
      user_address: user,
      prompt: `Question ${i}`,
      polyphonic_response: `Answer ${i}`,
      ashe_seal: i % 2 === 0 ? "ashe" : "ashe denied",
      tone_vector: Array(32).fill(0.5 + i * 0.05),
      parent_hash: i > 0 ? `breath_${i - 1}` : "0x" + "0".repeat(64),
      walrus_root: `walrus_${i}`,
    };
    router.store_breath(breath);
  }

  // Test routing
  const orunmila_chain = router.get_orunmila_chain(user);
  const sango_chain = router.get_sango_chain(user);
  const oshun_chain = router.get_oshun_chain(user);

  console.log(`Orunmila (full lineage): ${orunmila_chain.length} breaths`);
  console.log(`Sango (power paths): ${sango_chain.length} breaths`);
  console.log(`Oshun (harmony): ${oshun_chain.length} breaths`);

  assert(orunmila_chain.length === 5, "Orunmila should see full lineage");
  assert(sango_chain.length === 3, "Sango should see 3 ashe-sealed breaths");
  assert(router.verify_lineage(user), "Lineage should verify");

  console.log("✓ PASS");
}

/**
 * Test 5: Output formatting
 */
function test_output_formatting() {
  console.log("\n=== TEST 5: Output Formatting ===");
  const distiller = new OutputDistiller();
  const responses = mock_lobe_responses();
  const output = distiller.distill(responses, "hash_fmt", Date.now());
  const formatted = format_distilled_output(output);

  console.log(formatted);
  assert(formatted.includes(output.primary_voice), "Formatted output should include primary voice");
  assert(formatted.includes(output.ashe_seal.toUpperCase()), "Should include Àṣẹ seal");
  console.log("✓ PASS");
}

/**
 * Test 6: Context building for each lobe
 */
function test_lobe_context() {
  console.log("\n=== TEST 6: Lobe Context Building ===");
  const router = new MemoryRouter();
  const user = "0xuser456";

  // Populate memory
  for (let i = 0; i < 3; i++) {
    const breath: BreathBlob = {
      hash: `breath_ctx_${i}`,
      timestamp_ms: i * 1000,
      user_address: user,
      prompt: `Prompt ${i}`,
      polyphonic_response: `Response ${i}`,
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.5),
      parent_hash: i > 0 ? `breath_ctx_${i - 1}` : "0x" + "0".repeat(64),
      walrus_root: `walrus_ctx_${i}`,
    };
    router.store_breath(breath);
  }

  // Build contexts for a few lobes
  const ctx1 = build_lobe_context(router, 1, user, "breath_ctx_2");  // Orunmila
  const ctx5 = build_lobe_context(router, 5, user, "breath_ctx_2");  // Oshun
  const ctx9 = build_lobe_context(router, 9, user, "breath_ctx_2");  // Olokun

  console.log("Orunmila context (first 100 chars):", ctx1.substring(0, 100));
  console.log("Oshun context (first 100 chars):", ctx5.substring(0, 100));
  console.log("Olokun context (first 100 chars):", ctx9.substring(0, 100));

  assert(ctx1.includes("Memory chain"), "Context should have header");
  assert(ctx5.includes("Memory chain"), "Oshun context should have header");
  console.log("✓ PASS");
}

// ============= RUNNER =============

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function run_all_tests() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║              ỌMỌ KỌDÀ PATH B TEST SUITE                        ║");
  console.log("║          The Twelve Lobes Polyphony Verification               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  try {
    test_harmony();
    test_veto();
    test_twelfth_face();
    test_memory_routing();
    test_output_formatting();
    test_lobe_context();

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                     ✓ ALL TESTS PASSED                        ║");
    console.log("║                 Àṣẹ. The lobes are in accord.                ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
  } catch (e) {
    console.error("\n✗ TEST FAILED:", e);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  run_all_tests();
}
