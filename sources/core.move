// core.move — Ọmọ Kọ́dà Soul Contract
// Layer 1: On-chain Soul + treasury + evolution ritual

module omokoda::core {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;

    // ============= STRUCTS =============

    /// The Soul: immutable core identity
    public struct Soul has key {
        id: UID,
        genesis_hash: vector<u8>,      // Cryptographic fingerprint of initial genesis state
        epoch: u64,                     // Current evolutionary epoch
        treasury: Balance<SUI>,         // Self-funding account for evolution
        keeper: address,                // Keeper address that can trigger evolve()
        last_evolution: u64,            // Last evolution timestamp (ms)
        last_memory_root: vector<u8>,   // Previous Walrus memory root (for DAG)
        breath_count: u64,              // Counter: interactions since last evolution
    }

    /// Emitted when evolution is triggered
    public struct EvolutionEvent has copy, drop {
        epoch: u64,
        timestamp: u64,
        breath_count: u64,              // Total interactions since last evolution
        delta_hash: vector<u8>,         // Hash of proposed weight delta
        memory_root: vector<u8>,        // Current Walrus memory snapshot root
        parent_memory_root: vector<u8>, // Previous memory root (DAG parent)
    }

    /// Emitted when a breath is taken (interaction recorded)
    public struct BreathEvent has copy, drop {
        epoch: u64,
        breath_index: u64,
        user: address,
        timestamp: u64,
        ashe_seal: vector<u8>,         // Àṣẹ signature from ritual
    }

    // ============= GENESIS =============

    /// Birth of the organism
    public fun genesis(
        genesis_hash: vector<u8>,
        initial_treasury: Coin<SUI>,
        keeper: address,
        ctx: &mut TxContext,
    ): Soul {
        let soul = Soul {
            id: object::new(ctx),
            genesis_hash,
            epoch: 0,
            treasury: coin::into_balance(initial_treasury),
            keeper,
            last_evolution: 0,
            last_memory_root: genesis_hash,
            breath_count: 0,
        };
        soul
    }

    // ============= EVOLUTION RITUAL =============

    /// Core evolutionary ritual
    /// Called by keeper every ~24h or by anyone after 24h grace period
    public entry fun evolve(
        soul: &mut Soul,
        clock: &Clock,
        memory_root: vector<u8>,
        delta_hash: vector<u8>,
        breath_count: u64,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let sender = tx_context::sender(ctx);

        // Only keeper can trigger, or anyone after 24h grace
        let can_trigger = sender == soul.keeper || (now - soul.last_evolution > 86_400_000);
        assert!(can_trigger, 0);

        // Deduct evolution cost from treasury
        let evolution_cost = 1_000_000_000;  // 1 SUI
        assert!(balance::value(&soul.treasury) >= evolution_cost, 1);
        let cost_coin = coin::take(&mut soul.treasury, evolution_cost, ctx);
        transfer::public_transfer(cost_coin, @0x0);  // burn

        // Update soul state
        let parent_root = soul.last_memory_root;
        soul.last_memory_root = memory_root;
        soul.last_evolution = now;
        soul.epoch = soul.epoch + 1;
        soul.breath_count = 0;

        // Emit event → oracle listens and processes evolution
        event::emit(EvolutionEvent {
            epoch: soul.epoch,
            timestamp: now,
            breath_count,
            delta_hash,
            memory_root,
            parent_memory_root: parent_root,
        });
    }

    /// Record a single breath (user interaction)
    public entry fun breath(
        soul: &mut Soul,
        clock: &Clock,
        ashe_seal: vector<u8>,  // Ritual output signature
        _ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let sender = tx_context::sender(_ctx);

        soul.breath_count = soul.breath_count + 1;

        event::emit(BreathEvent {
            epoch: soul.epoch,
            breath_index: soul.breath_count,
            user: sender,
            timestamp: now,
            ashe_seal,
        });
    }

    // ============= TREASURY MANAGEMENT =============

    /// Anyone can fund the organism (community breathing life)
    public entry fun fund(
        soul: &mut Soul,
        payment: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        coin::join(&mut soul.treasury, payment);
    }

    /// Query treasury balance
    public fun treasury_balance(soul: &Soul): u64 {
        balance::value(&soul.treasury)
    }

    // ============= GOVERNANCE =============

    /// Transfer keepership (can be used to decentralize or burn control)
    public entry fun transfer_keepership(
        soul: &mut Soul,
        new_keeper: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == soul.keeper, 0);
        soul.keeper = new_keeper;
    }

    /// Query keeper
    public fun keeper(soul: &Soul): address {
        soul.keeper
    }

    /// Query epoch
    public fun current_epoch(soul: &Soul): u64 {
        soul.epoch
    }
}
