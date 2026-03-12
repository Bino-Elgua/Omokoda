// LOBES.MOVE — The Eleven Named Faces (Òrìṣà Mappings)
// Each lobe is an immutable capability + behavioral envelope
// Invoked during polyphonic argument rounds

module omokoda::lobes {
    use std::vector;
    use std::string::{Self, String};

    // Lobe identities (enum-like)
    const ORUNMILA: u8 = 1;      // Oracle / Historian
    const SANGO: u8 = 2;          // Executor / Enforcer
    const OBATALA: u8 = 3;        // Judge / Architect
    const OGUN: u8 = 4;           // Builder / Toolmaker
    const OSHUN: u8 = 5;          // Empath / Harmonizer
    const OYA: u8 = 6;            // Disruptor / Transformer
    const YEMOJA: u8 = 7;         // Guardian / Archivist
    const ESHU: u8 = 8;           // Tester / Adversary
    const OLOKUN: u8 = 9;         // Keeper of Secrets
    const OSANYIN: u8 = 10;       // Healer / Restorer
    const EGUNGUN: u8 = 11;       // Ancestor / Chorus

    // Lobe response types
    public struct LobeResponse has store, copy, drop {
        lobe_id: u8,
        verdict: u8,               // 0 = veto, 1 = pass, 2 = silence
        statement: String,         // Lobe's voice
        domain: String,            // Domain it invokes
        memory_chain_hash: vector<u8>,  // Which breath DAG it read
    }

    public struct ArgumentRound has store {
        breath_hash: vector<u8>,
        epoch: u64,
        responses: vector<LobeResponse>,
        depth: u64,                // RLM recursion depth
        timestamp_ms: u64,
        twelfth_face_triggered: bool,
        final_ashe: String,        // Àṣẹ seal (empty if denied)
    }

    // Create lobe response
    public fun create_response(
        lobe_id: u8,
        verdict: u8,
        statement: String,
        domain: String,
        memory_chain_hash: vector<u8>,
    ): LobeResponse {
        LobeResponse {
            lobe_id,
            verdict,
            statement,
            domain,
            memory_chain_hash,
        }
    }

    // Initialize argument round
    public fun new_round(
        breath_hash: vector<u8>,
        epoch: u64,
        depth: u64,
        timestamp_ms: u64,
    ): ArgumentRound {
        ArgumentRound {
            breath_hash,
            epoch,
            responses: vector::empty(),
            depth,
            timestamp_ms,
            twelfth_face_triggered: false,
            final_ashe: string::utf8(b""),
        }
    }

    // Add response to round
    public fun add_response(
        round: &mut ArgumentRound,
        response: LobeResponse,
    ) {
        vector::push_back(&mut round.responses, response);
    }

    // Check veto sweep
    public fun has_veto(round: &ArgumentRound): bool {
        let i = 0;
        let len = vector::length(&round.responses);
        while (i < len) {
            let resp = vector::borrow(&round.responses, i);
            if (resp.verdict == 0) {  // veto
                return true
            };
            i = i + 1;
        };
        false
    }

    // Count silence
    public fun silence_count(round: &ArgumentRound): u64 {
        let i = 0;
        let count = 0;
        let len = vector::length(&round.responses);
        while (i < len) {
            let resp = vector::borrow(&round.responses, i);
            if (resp.verdict == 2) {  // silence
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }

    // Trigger Twelfth Face (on uncomputable refusal)
    public fun trigger_twelfth_face(round: &mut ArgumentRound) {
        round.twelfth_face_triggered = true;
        round.final_ashe = string::utf8(b"");  // twelfth speaks in silence
    }

    // Seal with Àṣẹ (on harmony)
    public fun seal_ashe(round: &mut ArgumentRound, seal: String) {
        round.final_ashe = seal;
    }

    // Deny (no Àṣẹ, no output)
    public fun deny_round(round: &mut ArgumentRound) {
        round.final_ashe = string::utf8(b"ashe denied");
    }
}
