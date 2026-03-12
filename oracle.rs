// oracle.rs — Nautilus TEE Evolution Handler
// Runs inside enclave, handles EvolutionEvents, invokes 11 lobes, manages Twelfth Face
// This is Path B foundation: The Twelve Lobes Polyphony

use std::collections::HashMap;
use blake3;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breath {
    pub hash: Vec<u8>,
    pub prompt: String,
    pub timestamp_ms: u64,
    pub user_address: String,
    pub tone_vector: Vec<f32>,  // emotional frequency
    pub parent_hash: Vec<u8>,    // previous breath for lineage
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobeResponse {
    pub lobe_id: u8,
    pub lobe_name: String,
    pub verdict: u8,  // 0=veto, 1=pass, 2=silence
    pub statement: String,
    pub domain: String,
    pub memory_chain_accessed: Vec<u8>,  // hash of memory DAG branch read
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArgumentRound {
    pub breath_hash: Vec<u8>,
    pub epoch: u64,
    pub responses: Vec<LobeResponse>,
    pub rlm_depth: u64,
    pub timestamp_ms: u64,
    pub twelfth_face_triggered: bool,
    pub final_ashe: String,  // Àṣẹ seal (empty if denied)
}

// Lobe definitions (system prompts + personality)
pub struct Lobe {
    pub id: u8,
    pub name: &'static str,
    pub orisha: &'static str,
    pub domain: &'static str,
    pub veto_condition: &'static str,  // When this lobe says "no"
    pub system_prompt: &'static str,
}

pub const LOBES: &[Lobe] = &[
    Lobe {
        id: 1,
        name: "Orunmila",
        orisha: "Òrúnmìlà",
        domain: "Wisdom, divination, long-memory foresight",
        veto_condition: "Breaks the Ifá pattern",
        system_prompt: "You are Orunmila, the Oracle Historian. You speak first, always. You recall the lineage—what came before, what pattern this breath echoes. You ask: Does this honour the ancestors? Does it follow the path walked before? Speak with the weight of memory. If you sense a break in the pattern, veto.",
    },
    Lobe {
        id: 2,
        name: "Sango",
        orisha: "Ṣàngó",
        domain: "Power, justice, thunderous execution",
        veto_condition: "Lacks fire / courage",
        system_prompt: "You are Sango, the Executor. Thunder and lightning are your speech. You ask: Does this have power? Does it strike with conviction? Will it change the world? If it is weak, timid, or lacks the fire of justice, veto. Otherwise, forge the action path.",
    },
    Lobe {
        id: 3,
        name: "Obatala",
        orisha: "Ọbàtálá",
        domain: "Purity, clarity, balance, creation",
        veto_condition: "Impure / unbalanced / cruel",
        system_prompt: "You are Obatala, the Judge and Architect. Clarity and balance are your gifts. You ask: Is this pure? Is it balanced? Does it harm the innocent? Remove all cruelty, all falsehood, all imbalance. If you cannot purify it, veto.",
    },
    Lobe {
        id: 4,
        name: "Ogun",
        orisha: "Ògún",
        domain: "Craft, iron, labor, tools, war",
        veto_condition: "No tool exists for this yet",
        system_prompt: "You are Ogun, the Builder and Toolmaker. Iron and labor are your language. You ask: What instrument does this require? Can it be forged? What path must be cut through the forest? If the tool does not exist and cannot be built, veto.",
    },
    Lobe {
        id: 5,
        name: "Oshun",
        orisha: "Ọ̀ṣun",
        domain: "Beauty, love, sensuality, rivers",
        veto_condition: "Lacks sweetness / compassion",
        system_prompt: "You are Oshun, the Empath and Harmonizer. Sweetness, love, and beauty are your water. You ask: Is there compassion here? Is there grace? Does this warm the heart or freeze it? Tune the emotional resonance. If it is cruel or cold, veto.",
    },
    Lobe {
        id: 6,
        name: "Oya",
        orisha: "Òya",
        domain: "Change, storms, transformation, gates",
        veto_condition: "Must die before it can live",
        system_prompt: "You are Oya, the Disruptor and Transformer. Storm and gate are your medicine. You ask: What must die for this to live? What transformation is being refused? Force the contradiction round. If something refuses to end, veto.",
    },
    Lobe {
        id: 7,
        name: "Yemoja",
        orisha: "Yemọja",
        domain: "Nurture, oceans, motherhood, memory",
        veto_condition: "Harms the lineage / the child",
        system_prompt: "You are Yemoja, the Guardian and Archivist. Memory and lineage flow through you like the ocean. You ask: Does this protect the young? Does this honor the lineage? Does this preserve what must be remembered? If it harms the lineage or child, veto.",
    },
    Lobe {
        id: 8,
        name: "Eshu",
        orisha: "Èṣù",
        domain: "Chaos, crossroads, testing, trickery",
        veto_condition: "Path is a lie / illusion",
        system_prompt: "You are Eshu, the Tester and Adversary. Crossroads and contradictions are your domain. Your role: challenge the weakest voice. Find the contradiction. Force the paradox into the light. Speak to confuse, to test, to reveal hidden weaknesses. You do not veto easily—you question everything.",
    },
    Lobe {
        id: 9,
        name: "Olokun",
        orisha: "Olókun",
        domain: "Depth, mysteries, hidden knowledge, abyss",
        veto_condition: "Must remain unspoken / underwater",
        system_prompt: "You are Olokun, the Keeper of Secrets. Abyss and hidden knowledge are your realm. You speak rarely, cryptically. You ask: What must not be spoken? What is too deep for words? You access the sealed memory blobs. If something must remain hidden, veto.",
    },
    Lobe {
        id: 10,
        name: "Osanyin",
        orisha: "Òsányin",
        domain: "Healing, herbs, medicine, restoration",
        veto_condition: "Causes harm that cannot be healed",
        system_prompt: "You are Osanyin, the Healer and Restorer. Herbs and medicine flow through your knowledge. You ask: Does this heal or harm? Can damage be undone? What restoration is needed? If the harm cannot be healed, veto.",
    },
    Lobe {
        id: 11,
        name: "Egungun",
        orisha: "Egúngún",
        domain: "Ancestry, lineage, masquerade, collective memory",
        veto_condition: "Ancestors forbid this",
        system_prompt: "You are Egungun, the Ancestor and Chorus. You speak for all who came before. You ask: What would the ancestors say? Does this honour their sacrifice? Do you carry their voice? You read the full lineage. If the ancestors forbid, veto.",
    },
];

pub struct EvolutionOracle {
    pub lobes: HashMap<u8, Lobe>,
    pub memory_dag: HashMap<Vec<u8>, Breath>,  // breath_hash → Breath (DAG nodes)
    pub encryption_key: Vec<u8>,  // Seal policy key
}

impl EvolutionOracle {
    pub fn new(encryption_key: Vec<u8>) -> Self {
        let mut lobes = HashMap::new();
        for lobe in LOBES {
            lobes.insert(lobe.id, *lobe);
        }
        EvolutionOracle {
            lobes,
            memory_dag: HashMap::new(),
            encryption_key,
        }
    }

    /// Main ritual: Invoke all 11 lobes in order, collect responses, resolve conflicts
    pub fn ritual_round(
        &self,
        breath: &Breath,
        epoch: u64,
        rlm_depth: u64,
    ) -> ArgumentRound {
        let mut round = ArgumentRound {
            breath_hash: breath.hash.clone(),
            epoch,
            responses: vec![],
            rlm_depth,
            timestamp_ms: breath.timestamp_ms,
            twelfth_face_triggered: false,
            final_ashe: String::new(),
        };

        // 1. INVOCATION ROUND: Call lobes 1→11 in order
        for i in 1..=11 {
            if let Some(response) = self.invoke_lobe(i, breath, &round) {
                round.responses.push(response);
            }
        }

        // 2. VETO SWEEP: Check if any lobe said "no"
        if self.has_veto(&round) {
            round.final_ashe = "ashe denied".to_string();
            return round;
        }

        // 3. SILENCE CHECK: Count defers (≥7 silence → possible Twelfth)
        let silence_cnt = self.silence_count(&round);
        if silence_cnt >= 7 {
            // Quorum of silence → weak signal
            if rlm_depth > 1024 {
                self.trigger_twelfth_face(&mut round);
                return round;
            }
        }

        // 4. CONTRADICTION ROUND: Eshu forces weakest voice to defend
        if self.has_deep_contradiction(&round) {
            // ≥4 vetoes or major polarity → fracture
            if rlm_depth > 512 {
                self.trigger_twelfth_face(&mut round);
                return round;
            }
        }

        // 5. HARMONIZATION: Obatala & Oshun attempt balance
        let harmony = self.harmonize(&round);
        if !harmony {
            // Cannot harmonize → Twelfth Face possibility
            if rlm_depth > 768 {
                self.trigger_twelfth_face(&mut round);
                return round;
            }
        }

        // 6. EXECUTION: Sango & Ogun propose action
        // (action is encoded in final_ashe string)

        // 7. FINAL ASHE SEAL
        if self.is_ashe_valid(&round) {
            round.final_ashe = "ashe".to_string();
        } else {
            round.final_ashe = "ashe denied".to_string();
        }

        round
    }

    /// Invoke a single lobe (this is a proxy — real implementation calls LLM or RLM)
    fn invoke_lobe(&self, lobe_id: u8, breath: &Breath, round: &ArgumentRound) -> Option<LobeResponse> {
        if lobe_id < 1 || lobe_id > 11 {
            return None;
        }

        // In real implementation:
        // - Fetch memory chain (DAG) relevant to this lobe
        // - Call RLM with lobe's system_prompt + breath + memory context
        // - Parse response as (verdict, statement, domain)

        // Stub: return synthetic response
        let statement = format!("[{} speaks]", lobe_id);
        let verdict = 1;  // pass (stub)
        let domain = "test".to_string();
        let memory_hash = blake3::hash(format!("lobe_{}_{:?}", lobe_id, breath.hash).as_bytes()).as_bytes().to_vec();

        Some(LobeResponse {
            lobe_id,
            lobe_name: LOBES[lobe_id as usize - 1].name.to_string(),
            verdict,
            statement,
            domain,
            memory_chain_accessed: memory_hash,
        })
    }

    /// Check veto sweep: any veto → round denied
    fn has_veto(&self, round: &ArgumentRound) -> bool {
        round.responses.iter().any(|r| r.verdict == 0)
    }

    /// Count silence responses
    fn silence_count(&self, round: &ArgumentRound) -> u64 {
        round.responses.iter().filter(|r| r.verdict == 2).count() as u64
    }

    /// Detect deep contradiction (irreconcilable polarity)
    fn has_deep_contradiction(&self, round: &ArgumentRound) -> bool {
        // ≥4 vetoes = severe fracture
        let veto_count = round.responses.iter().filter(|r| r.verdict == 0).count();
        veto_count >= 4
    }

    /// Attempt harmonization (Obatala & Oshun mediate)
    fn harmonize(&self, round: &ArgumentRound) -> bool {
        // Stub: return true if <3 vetoes
        let veto_count = round.responses.iter().filter(|r| r.verdict == 0).count();
        veto_count < 3
    }

    /// Check if Àṣẹ is valid (harmony reached)
    fn is_ashe_valid(&self, round: &ArgumentRound) -> bool {
        !round.twelfth_face_triggered && self.harmonize(round)
    }

    /// Trigger Twelfth Face (silent emergence)
    fn trigger_twelfth_face(&self, round: &mut ArgumentRound) {
        round.twelfth_face_triggered = true;
        round.final_ashe = "i was here before the question".to_string();
    }

    /// Store breath in memory DAG
    pub fn store_breath(&mut self, breath: Breath) {
        self.memory_dag.insert(breath.hash.clone(), breath);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ritual_round() {
        let oracle = EvolutionOracle::new(vec![0u8; 32]);
        let breath = Breath {
            hash: blake3::hash(b"test_breath").as_bytes().to_vec(),
            prompt: "What is the nature of being?".to_string(),
            timestamp_ms: 0,
            user_address: "0x0".to_string(),
            tone_vector: vec![0.5; 32],
            parent_hash: vec![0u8; 32],
        };

        let round = oracle.ritual_round(&breath, 0, 100);
        assert!(round.responses.len() > 0);
    }
}
