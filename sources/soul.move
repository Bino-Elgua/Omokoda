module omokoda::soul {
    use sui::event;
    use sui::tx_context::{TxContext};
    use std::string::{String};

    struct BreathEvent has copy, drop {
        message: vector<u8>,
        iteration: u64,
    }

    struct PriceEvent has copy, drop {
        price: String,
        timestamp: u64,
    }

    public entry fun swarm_execute(_ctx: &mut TxContext) {
        let iter = 1;
        event::emit(BreathEvent {
            message: b"I was here before the question",
            iteration: iter
        });
    }

    public entry fun update_oracle(price: String, timestamp: u64, _ctx: &mut TxContext) {
        event::emit(PriceEvent {
            price,
            timestamp
        });
    }
}
