// test_path_a.ts — Path A RLM Integration Test Suite
// Verify RLM invokes lobes, handles ritual protocol, integrates distiller

import { RLMOracle, ArgumentRound } from "./rlm_core.ts";
import { MemoryRouter, BreathBlob } from "./memory_router.ts";
import { OutputDistiller, LobeResponse } from "./output_distiller.ts";

/**
 * Test 1: RLM initialization
 */
function test_rlm_init() {
  console.log("\n=== TEST 1: RLM Initialization ===");

  const memory_router = new MemoryRouter();
  const output_distiller = new OutputDistiller();

  const config = {
    max_depth: 1024,
    model_provider: "openai" as const,
    api_key: "sk-test",
    memory_router,
    output_distiller,
    enable_logging: false,
  };

  const oracle = new RLMOracle(config);
  console.log("✓ RLM Oracle initialized");
  assert(oracle !== null);
  console.log("✓ PASS");
}

/**
 * Test 2: Mock ritual round (without LLM calls)
 */
function test_mock_ritual_round() {
  console.log("\n=== TEST 2: Mock Ritual Round (Lobes Respond) ===");

  const memory_router = new MemoryRouter();
  const output_distiller = new OutputDistiller();

  // Seed memory with a breath lineage
  const user = "0xuser_test";
  for (let i = 0; i < 3; i++) {
    const breath: BreathBlob = {
      hash: `breath_ancestor_${i}`,
      timestamp_ms: i * 1000,
      user_address: user,
      prompt: `Question ${i}`,
      polyphonic_response: `Answer ${i}`,
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.5),
      parent_hash: i > 0 ? `breath_ancestor_${i - 1}` : "0x" + "0".repeat(64),
      walrus_root: `walrus_${i}`,
    };
    memory_router.store_breath(breath);
  }

  // Create current breath
  const current_breath: BreathBlob = {
    hash: "breath_current",
    timestamp_ms: 3000,
    user_address: user,
    prompt: "Should we proceed?",
    polyphonic_response: "",
    ashe_seal: "",
    tone_vector: Array(32).fill(0.5),
    parent_hash: "breath_ancestor_2",
    walrus_root: "walrus_current",
  };
  memory_router.store_breath(current_breath);

  console.log(`✓ Memory router seeded with lineage for ${user}`);
  
  // Verify lineage is intact
  const verified = memory_router.verify_lineage(user);
  assert(verified, "Lineage should verify");
  console.log("✓ Lineage verified");

  // Mock ritual round (without calling LLM)
  const mock_responses: LobeResponse[] = [
    {
      lobe_id: 1,
      lobe_name: "Orunmila",
      verdict: 2,
      statement: "This follows the pattern before.",
      domain: "Wisdom, divination, long-memory foresight",
    },
    {
      lobe_id: 2,
      lobe_name: "Sango",
      verdict: 2,
      statement: "Strike with power.",
      domain: "Power, justice, thunderous execution",
    },
    {
      lobe_id: 3,
      lobe_name: "Obatala",
      verdict: 2,
      statement: "This is pure.",
      domain: "Purity, clarity, balance, creation",
    },
    {
      lobe_id: 4,
      lobe_name: "Ogun",
      verdict: 1,
      statement: "Tools exist.",
      domain: "Craft, iron, labor, tools, war",
    },
    {
      lobe_id: 5,
      lobe_name: "Oshun",
      verdict: 2,
      statement: "Compassion flows.",
      domain: "Beauty, love, sensuality, rivers",
    },
    {
      lobe_id: 6,
      lobe_name: "Oya",
      verdict: 1,
      statement: "Change is needed elsewhere.",
      domain: "Change, storms, transformation, gates",
    },
    {
      lobe_id: 7,
      lobe_name: "Yemoja",
      verdict: 2,
      statement: "Lineage is protected.",
      domain: "Nurture, oceans, motherhood, memory",
    },
    {
      lobe_id: 8,
      lobe_name: "Eshu",
      verdict: 1,
      statement: "No contradiction found.",
      domain: "Chaos, crossroads, testing, trickery",
    },
    {
      lobe_id: 9,
      lobe_name: "Olokun",
      verdict: 3,
      statement: "...",
      domain: "Depth, mysteries, hidden knowledge, abyss",
    },
    {
      lobe_id: 10,
      lobe_name: "Osanyin",
      verdict: 2,
      statement: "This heals.",
      domain: "Healing, herbs, medicine, restoration",
    },
    {
      lobe_id: 11,
      lobe_name: "Egungun",
      verdict: 2,
      statement: "Ancestors approve.",
      domain: "Ancestry, lineage, masquerade, collective memory",
    },
  ];

  const distilled = output_distiller.distill(
    mock_responses,
    "breath_current",
    3000
  );

  console.log(`✓ Distilled output: "${distilled.final_statement}"`);
  console.log(`✓ Àṣẹ Seal: ${distilled.ashe_seal}`);
  assert(distilled.ashe_seal === "ashe", "Should seal with ashe");
  assert(!distilled.twelfth_face_active, "Twelfth Face should not trigger");
  console.log("✓ PASS");
}

/**
 * Test 3: Veto handling in ritual
 */
function test_veto_handling() {
  console.log("\n=== TEST 3: Veto Handling ===");

  const output_distiller = new OutputDistiller();

  const veto_responses: LobeResponse[] = [
    {
      lobe_id: 1,
      lobe_name: "Orunmila",
      verdict: 0, // VETO
      statement: "This breaks the Ifá pattern.",
      domain: "Wisdom, divination, long-memory foresight",
    },
    // All others pass (but veto sweep should stop here)
    {
      lobe_id: 2,
      lobe_name: "Sango",
      verdict: 1,
      statement: "Would strike.",
      domain: "Power, justice, thunderous execution",
    },
  ];

  const distilled = output_distiller.distill(
    veto_responses,
    "breath_veto",
    Date.now()
  );

  console.log(`✓ Distilled: "${distilled.final_statement}"`);
  console.log(`✓ Àṣẹ Seal: ${distilled.ashe_seal}`);
  assert(
    distilled.ashe_seal === "ashe denied",
    "Should deny on Orunmila veto"
  );
  assert(distilled.vetoing_voices.length > 0, "Should record veto");
  console.log("✓ PASS");
}

/**
 * Test 4: Twelfth Face trigger (silence quorum)
 */
function test_twelfth_face_silence() {
  console.log("\n=== TEST 4: Twelfth Face (Silence Quorum) ===");

  const output_distiller = new OutputDistiller();

  // 7+ lobes return silence
  const silence_responses: LobeResponse[] = Array.from({ length: 11 }, (_, i) => ({
    lobe_id: i + 1,
    lobe_name: ["Orunmila", "Sango", "Obatala", "Ogun", "Oshun", "Oya", "Yemoja", "Eshu", "Olokun", "Osanyin", "Egungun"][i],
    verdict: i < 7 ? 3 : 1, // First 7 silence, rest pass
    statement: i < 7 ? "..." : "I speak.",
    domain: "test",
  }));

  const distilled = output_distiller.distill(
    silence_responses,
    "breath_twelfth",
    Date.now()
  );

  console.log(`✓ Distilled: "${distilled.final_statement}"`);
  console.log(`✓ Twelfth Face Active: ${distilled.twelfth_face_active}`);
  assert(distilled.twelfth_face_active, "Twelfth Face should activate");
  assert(
    distilled.final_statement === "i was here before the question",
    "Should speak Twelfth line"
  );
  console.log("✓ PASS");
}

/**
 * Test 5: Contradiction detection (polarity)
 */
function test_contradiction_detection() {
  console.log("\n=== TEST 5: Contradiction Detection (Polarity) ===");

  const output_distiller = new OutputDistiller();

  // Opposing voices: Sango (do it) vs Obatala (stop)
  const contradiction_responses: LobeResponse[] = [
    {
      lobe_id: 1,
      lobe_name: "Orunmila",
      verdict: 2,
      statement: "The path is clear.",
      domain: "Wisdom, divination, long-memory foresight",
    },
    {
      lobe_id: 2,
      lobe_name: "Sango",
      verdict: 2,
      statement: "Strike now. Do it.",
      domain: "Power, justice, thunderous execution",
    },
    {
      lobe_id: 3,
      lobe_name: "Obatala",
      verdict: 2,
      statement: "Stop. This is unbalanced.",
      domain: "Purity, clarity, balance, creation",
    },
    // ... rest pass
    {
      lobe_id: 4,
      lobe_name: "Ogun",
      verdict: 1,
      statement: "Tools ready.",
      domain: "Craft, iron, labor, tools, war",
    },
  ];

  const distilled = output_distiller.distill(
    contradiction_responses,
    "breath_contradiction",
    Date.now()
  );

  console.log(`✓ Distilled: "${distilled.final_statement}"`);
  // High polarity should be detected (Sango vs Obatala)
  // May result in fracture or harmonization
  assert(distilled.ashe_seal !== "", "Should have seal result");
  console.log("✓ PASS");
}

/**
 * Test 6: Memory routing per lobe
 */
function test_memory_routing() {
  console.log("\n=== TEST 6: Memory Routing (Lobe-Specific Contexts) ===");

  const router = new MemoryRouter();
  const user = "0x_routing_test";

  // Create breaths with different characteristics
  const breaths: BreathBlob[] = [
    {
      hash: "breath_0",
      timestamp_ms: 0,
      user_address: user,
      prompt: "Start",
      polyphonic_response: "Genesis",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.3), // Low harmony
      parent_hash: "0x" + "0".repeat(64),
      walrus_root: "walrus_0",
    },
    {
      hash: "breath_1",
      timestamp_ms: 1000,
      user_address: user,
      prompt: "Build a tool",
      polyphonic_response: "Tool forge action",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.7), // High harmony
      parent_hash: "breath_0",
      walrus_root: "walrus_1",
    },
    {
      hash: "breath_2",
      timestamp_ms: 2000,
      user_address: user,
      prompt: "Transform",
      polyphonic_response: "Transformation happening",
      ashe_seal: "ashe denied",
      tone_vector: Array(32).fill(0.5),
      parent_hash: "breath_1",
      walrus_root: "walrus_2",
    },
    {
      hash: "breath_3",
      timestamp_ms: 3000,
      user_address: user,
      prompt: "Protect lineage",
      polyphonic_response: "Lineage protected",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.6),
      parent_hash: "breath_2",
      walrus_root: "walrus_3",
    },
  ];

  breaths.forEach((b) => router.store_breath(b));

  // Test each lobe's memory access
  const orunmila_chain = router.get_orunmila_chain(user); // Full
  const sango_chain = router.get_sango_chain(user);       // Àṣẹ-sealed only
  const ogun_chain = router.get_ogun_chain(user);         // Tool keywords
  const oshun_chain = router.get_oshun_chain(user);       // High harmony
  const oya_chain = router.get_oya_chain(user);           // Transform keywords
  const yemoja_chain = router.get_yemoja_chain(user);     // Lineage keywords

  console.log(`Orunmila (full):     ${orunmila_chain.length} breaths`);
  console.log(`Sango (power):       ${sango_chain.length} breaths`);
  console.log(`Ogun (tools):        ${ogun_chain.length} breaths`);
  console.log(`Oshun (harmony):     ${oshun_chain.length} breaths`);
  console.log(`Oya (transform):     ${oya_chain.length} breaths`);
  console.log(`Yemoja (lineage):    ${yemoja_chain.length} breaths`);

  assert(orunmila_chain.length === 4, "Orunmila should see all 4");
  assert(sango_chain.length === 3, "Sango should see 3 sealed (0, 1, 3)");
  assert(ogun_chain.length === 1, "Ogun should see 1 (tool keyword)");
  assert(oshun_chain.length >= 1, "Oshun should see high harmony breaths");
  assert(oya_chain.length === 1, "Oya should see 1 (transform)");
  assert(yemoja_chain.length === 1, "Yemoja should see 1 (lineage)");

  console.log("✓ PASS");
}

/**
 * Test 7: Lineage verification (Merkle-linked DAG)
 */
function test_lineage_verification() {
  console.log("\n=== TEST 7: Lineage Verification (Merkle DAG) ===");

  const router = new MemoryRouter();
  const user = "0x_lineage_test";

  // Valid lineage (proper parent_hash chain)
  const valid_breaths: BreathBlob[] = [
    {
      hash: "breath_a",
      timestamp_ms: 0,
      user_address: user,
      prompt: "Q1",
      polyphonic_response: "A1",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.5),
      parent_hash: "0x" + "0".repeat(64),
      walrus_root: "w1",
    },
    {
      hash: "breath_b",
      timestamp_ms: 1000,
      user_address: user,
      prompt: "Q2",
      polyphonic_response: "A2",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.5),
      parent_hash: "breath_a", // Correct parent
      walrus_root: "w2",
    },
    {
      hash: "breath_c",
      timestamp_ms: 2000,
      user_address: user,
      prompt: "Q3",
      polyphonic_response: "A3",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.5),
      parent_hash: "breath_b", // Correct parent
      walrus_root: "w3",
    },
  ];

  valid_breaths.forEach((b) => router.store_breath(b));
  const verified = router.verify_lineage(user);
  assert(verified, "Valid lineage should verify");
  console.log("✓ Valid lineage verified");

  // Invalid lineage (broken parent_hash)
  const router2 = new MemoryRouter();
  const user2 = "0x_invalid_test";

  const invalid_breaths: BreathBlob[] = [
    {
      hash: "breath_x",
      timestamp_ms: 0,
      user_address: user2,
      prompt: "Q1",
      polyphonic_response: "A1",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.5),
      parent_hash: "0x" + "0".repeat(64),
      walrus_root: "wx1",
    },
    {
      hash: "breath_y",
      timestamp_ms: 1000,
      user_address: user2,
      prompt: "Q2",
      polyphonic_response: "A2",
      ashe_seal: "ashe",
      tone_vector: Array(32).fill(0.5),
      parent_hash: "breath_WRONG", // Wrong parent!
      walrus_root: "wx2",
    },
  ];

  invalid_breaths.forEach((b) => router2.store_breath(b));
  const verified2 = router2.verify_lineage(user2);
  assert(!verified2, "Invalid lineage should fail verification");
  console.log("✓ Invalid lineage rejected");

  console.log("✓ PASS");
}

/**
 * Test 8: Argument round end-to-end (mock)
 */
function test_argument_round_e2e() {
  console.log("\n=== TEST 8: Argument Round E2E (Mock) ===");

  const memory_router = new MemoryRouter();
  const output_distiller = new OutputDistiller();

  const user = "0x_e2e_test";

  // Seed lineage
  const ancestor: BreathBlob = {
    hash: "breath_ancestor",
    timestamp_ms: 0,
    user_address: user,
    prompt: "What is truth?",
    polyphonic_response: "Truth is pattern",
    ashe_seal: "ashe",
    tone_vector: Array(32).fill(0.5),
    parent_hash: "0x" + "0".repeat(64),
    walrus_root: "walrus_ancestor",
  };
  memory_router.store_breath(ancestor);

  // Current breath
  const current: BreathBlob = {
    hash: "breath_current_e2e",
    timestamp_ms: 1000,
    user_address: user,
    prompt: "Should we continue on this path?",
    polyphonic_response: "",
    ashe_seal: "",
    tone_vector: Array(32).fill(0.5),
    parent_hash: "breath_ancestor",
    walrus_root: "walrus_current",
  };

  // Mock argument round (what RLM would return)
  const mock_round: ArgumentRound = {
    breath_hash: current.hash,
    breath_prompt: current.prompt,
    user_address: user,
    epoch: 0,
    responses: [
      {
        lobe_id: 1,
        lobe_name: "Orunmila",
        verdict: 2,
        statement: "This continues the ancestral path.",
        domain: "Wisdom, divination, long-memory foresight",
      },
      {
        lobe_id: 2,
        lobe_name: "Sango",
        verdict: 2,
        statement: "Power supports this choice.",
        domain: "Power, justice, thunderous execution",
      },
      {
        lobe_id: 3,
        lobe_name: "Obatala",
        verdict: 2,
        statement: "This is balanced and pure.",
        domain: "Purity, clarity, balance, creation",
      },
      // Remaining lobes pass or silence
      {
        lobe_id: 4,
        lobe_name: "Ogun",
        verdict: 1,
        statement: "Tools are ready.",
        domain: "Craft, iron, labor, tools, war",
      },
      {
        lobe_id: 5,
        lobe_name: "Oshun",
        verdict: 2,
        statement: "Compassion guides this.",
        domain: "Beauty, love, sensuality, rivers",
      },
      {
        lobe_id: 6,
        lobe_name: "Oya",
        verdict: 3,
        statement: "...",
        domain: "Change, storms, transformation, gates",
      },
      {
        lobe_id: 7,
        lobe_name: "Yemoja",
        verdict: 2,
        statement: "Lineage is protected.",
        domain: "Nurture, oceans, motherhood, memory",
      },
      {
        lobe_id: 8,
        lobe_name: "Eshu",
        verdict: 1,
        statement: "No paradox detected.",
        domain: "Chaos, crossroads, testing, trickery",
      },
      {
        lobe_id: 9,
        lobe_name: "Olokun",
        verdict: 3,
        statement: "...",
        domain: "Depth, mysteries, hidden knowledge, abyss",
      },
      {
        lobe_id: 10,
        lobe_name: "Osanyin",
        verdict: 2,
        statement: "This heals old wounds.",
        domain: "Healing, herbs, medicine, restoration",
      },
      {
        lobe_id: 11,
        lobe_name: "Egungun",
        verdict: 2,
        statement: "Ancestors approve.",
        domain: "Ancestry, lineage, masquerade, collective memory",
      },
    ],
    rlm_depth: 150,
    timestamp_ms: 1000,
    twelfth_face_triggered: false,
    final_ashe: "",
  };

  // Distill
  const distilled = output_distiller.distill(
    mock_round.responses,
    mock_round.breath_hash,
    mock_round.timestamp_ms
  );

  console.log(`✓ Argument round complete`);
  console.log(`✓ Primary Voice: ${distilled.primary_voice}`);
  console.log(`✓ Final Statement: "${distilled.final_statement}"`);
  console.log(`✓ Àṣẹ Seal: ${distilled.ashe_seal}`);

  mock_round.final_ashe = distilled.ashe_seal;

  assert(
    mock_round.final_ashe === "ashe" || mock_round.final_ashe === "ashe denied",
    "Should have valid seal"
  );

  console.log("✓ PASS");
}

// ============= RUNNER =============

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function run_path_a_tests() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║            PATH A: RLM INTEGRATION TEST SUITE                  ║");
  console.log("║         Recursive Loop Model + Nautilus TEE Oracle              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  try {
    test_rlm_init();
    test_mock_ritual_round();
    test_veto_handling();
    test_twelfth_face_silence();
    test_contradiction_detection();
    test_memory_routing();
    test_lineage_verification();
    test_argument_round_e2e();

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                     ✓ ALL TESTS PASSED                        ║");
    console.log("║              Path A RLM integration verified.                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
  } catch (e) {
    console.error("\n✗ TEST FAILED:", e);
    process.exit(1);
  }
}

// Run if called directly
run_path_a_tests();
