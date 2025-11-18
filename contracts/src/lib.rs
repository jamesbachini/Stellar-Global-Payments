#![no_std]

use soroban_sdk::auth::{Context, CustomAccountInterface};
use soroban_sdk::crypto::Hash;
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, symbol_short, token, vec, Address, Env,
    Map, String, Symbol, Val, Vec,
};
use stellar_accounts::smart_account::{
    add_context_rule, add_policy, add_signer, do_check_auth, get_context_rule, get_context_rules,
    remove_context_rule, remove_policy, remove_signer, update_context_rule_name,
    update_context_rule_valid_until, ContextRule, ContextRuleType, Signatures, Signer,
    SmartAccount, SmartAccountError,
};

mod test;

#[allow(dead_code)]
mod soroswap_router {
    use super::*;

    #[contractclient(name = "SoroswapRouterClient")]
    pub trait SoroswapRouterContract {
        fn swap_exact_tokens_for_tokens(
            env: Env,
            amount_in: i128,
            amount_out_min: i128,
            path: Vec<Address>,
            to: Address,
            deadline: u64,
        ) -> Vec<i128>;
    }
}

use soroswap_router::SoroswapRouterClient;

#[allow(dead_code)]
mod multisig_treasury {
    use super::*;

    #[contractclient(name = "MultisigTreasuryClient")]
    pub trait MultisigTreasuryContract {
        fn propose_withdraw(env: Env, signer: Address, to: Address, amount: i128) -> u32;
        fn approve_withdraw(env: Env, signer: Address, request_id: u32) -> bool;
    }
}

use multisig_treasury::MultisigTreasuryClient;

const ADMIN_KEY: Symbol = symbol_short!("admin");
const TOKEN_KEY: Symbol = symbol_short!("token");
const DEST_KEY: Symbol = symbol_short!("dest");
const LABEL_KEY: Symbol = symbol_short!("label");
const ROUTER_KEY: Symbol = symbol_short!("router");
const FOREX_TOKEN_KEY: Symbol = symbol_short!("fx_tok");

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RemittanceError {
    NotInitialized = 1,
    NotAllowed = 2,
    ForexNotConfigured = 3,
    InvalidAmount = 4,
    SwapFailed = 5,
}

#[contract]
pub struct RemittanceAccount;

fn read_admin(env: &Env) -> Result<Address, RemittanceError> {
    env.storage()
        .instance()
        .get::<_, Address>(&ADMIN_KEY)
        .ok_or(RemittanceError::NotInitialized)
}

fn read_token(env: &Env) -> Result<Address, RemittanceError> {
    env.storage()
        .instance()
        .get::<_, Address>(&TOKEN_KEY)
        .ok_or(RemittanceError::NotInitialized)
}

fn read_destinations(env: &Env) -> Result<Vec<Address>, RemittanceError> {
    env.storage()
        .instance()
        .get::<_, Vec<Address>>(&DEST_KEY)
        .ok_or(RemittanceError::NotInitialized)
}

fn read_router(env: &Env) -> Result<Address, RemittanceError> {
    env.storage()
        .instance()
        .get::<_, Address>(&ROUTER_KEY)
        .ok_or(RemittanceError::ForexNotConfigured)
}

fn read_forex_token(env: &Env) -> Result<Address, RemittanceError> {
    env.storage()
        .instance()
        .get::<_, Address>(&FOREX_TOKEN_KEY)
        .ok_or(RemittanceError::ForexNotConfigured)
}

fn ensure_destination_allowed(env: &Env, to: &Address) -> Result<(), RemittanceError> {
    let allowed = read_destinations(env)?;
    if allowed.iter().any(|addr| addr == *to) {
        Ok(())
    } else {
        Err(RemittanceError::NotAllowed)
    }
}

#[contractimpl]
impl RemittanceAccount {
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        destinations: Vec<Address>,
        label: String,
    ) {
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&TOKEN_KEY, &token);
        env.storage().instance().set(&DEST_KEY, &destinations);
        env.storage().instance().set(&LABEL_KEY, &label);
        let signers = vec![&env, Signer::Delegated(admin)];
        let policies: Map<Address, Val> = Map::new(&env);
        add_context_rule(
            &env,
            &ContextRuleType::Default,
            &String::from_str(&env, "Admin Rule"),
            None, // No expiration
            &signers,
            &policies,
        );
    }

    /// Execute a transfer to one of the whitelisted destinations
    pub fn execute_transfer(env: Env, to: Address, amount: i128) -> Result<(), RemittanceError> {
        let allowed = read_destinations(&env)?;
        if !allowed.iter().any(|addr| addr == to) {
            return Err(RemittanceError::NotAllowed);
        }
        let token = read_token(&env)?;
        let self_address = env.current_contract_address();
        let client = token::Client::new(&env, &token);
        client.transfer(&self_address, &to, &amount);
        Ok(())
    }

    /// Withdrawal to the admin address
    pub fn admin_withdraw(env: Env, amount: i128) -> Result<(), RemittanceError> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        let token = read_token(&env)?;
        let self_address = env.current_contract_address();
        let client = token::Client::new(&env, &token);
        client.transfer(&self_address, &admin, &amount);
        Ok(())
    }

    /// Update the allowed destinations
    pub fn update_destinations(
        env: Env,
        destinations: Vec<Address>,
    ) -> Result<(), RemittanceError> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&DEST_KEY, &destinations);
        Ok(())
    }

    /// Get the account label
    pub fn get_label(env: Env) -> String {
        env.storage()
            .instance()
            .get::<_, String>(&LABEL_KEY)
            .unwrap_or(String::from_str(&env, ""))
    }

    pub fn configure_forex(
        env: Env,
        router: Address,
        counter_token: Address,
    ) -> Result<(), RemittanceError> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&ROUTER_KEY, &router);
        env.storage()
            .instance()
            .set(&FOREX_TOKEN_KEY, &counter_token);
        Ok(())
    }

    pub fn execute_forex_transfer(
        env: Env,
        to: Address,
        amount: i128,
        min_amount_out: i128,
        deadline: u64,
        swap_to_counter: bool,
    ) -> Result<(), RemittanceError> {
        if amount <= 0 || min_amount_out <= 0 {
            return Err(RemittanceError::InvalidAmount);
        }

        ensure_destination_allowed(&env, &to)?;

        let router = read_router(&env)?;
        let counter_token = read_forex_token(&env)?;
        let primary_token = read_token(&env)?;

        let mut path = Vec::new(&env);
        let output_token = if swap_to_counter {
            path.push_back(primary_token.clone());
            path.push_back(counter_token.clone());
            counter_token
        } else {
            path.push_back(counter_token.clone());
            path.push_back(primary_token.clone());
            primary_token
        };

        let router_client = SoroswapRouterClient::new(&env, &router);
        let self_address = env.current_contract_address();
        let swap_amounts = router_client.swap_exact_tokens_for_tokens(
            &amount,
            &min_amount_out,
            &path,
            &self_address,
            &deadline,
        );

        let len = swap_amounts.len();
        if len < 2 {
            return Err(RemittanceError::SwapFailed);
        }
        let last_index = len - 1;
        let amount_out = swap_amounts
            .get(last_index)
            .ok_or(RemittanceError::SwapFailed)?;

        let token_client = token::Client::new(&env, &output_token);
        token_client.transfer(&self_address, &to, &amount_out);
        Ok(())
    }

    pub fn initiate_multisig_withdraw(
        env: Env,
        multisig: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), RemittanceError> {
        if amount <= 0 {
            return Err(RemittanceError::InvalidAmount);
        }
        ensure_destination_allowed(&env, &multisig)?;
        let client = MultisigTreasuryClient::new(&env, &multisig);
        let signer = env.current_contract_address();
        client.propose_withdraw(&signer, &to, &amount);
        Ok(())
    }

    pub fn approve_multisig_withdraw(
        env: Env,
        multisig: Address,
        request_id: u32,
    ) -> Result<(), RemittanceError> {
        ensure_destination_allowed(&env, &multisig)?;
        let client = MultisigTreasuryClient::new(&env, &multisig);
        let signer = env.current_contract_address();
        client.approve_withdraw(&signer, &request_id);
        Ok(())
    }
}

// OpenZeppelin SmartAccount Trait
#[contractimpl]
impl SmartAccount for RemittanceAccount {
    fn add_context_rule(
        env: &Env,
        context_type: ContextRuleType,
        name: String,
        valid_until: Option<u32>,
        signers: Vec<Signer>,
        policies: Map<Address, Val>,
    ) -> ContextRule {
        env.current_contract_address().require_auth();
        add_context_rule(env, &context_type, &name, valid_until, &signers, &policies)
    }

    fn get_context_rule(env: &Env, context_rule_id: u32) -> ContextRule {
        get_context_rule(env, context_rule_id)
    }

    fn get_context_rules(env: &Env, context_type: ContextRuleType) -> Vec<ContextRule> {
        get_context_rules(env, &context_type)
    }

    fn update_context_rule_name(env: &Env, context_rule_id: u32, name: String) -> ContextRule {
        env.current_contract_address().require_auth();
        update_context_rule_name(env, context_rule_id, &name)
    }

    fn update_context_rule_valid_until(
        env: &Env,
        context_rule_id: u32,
        valid_until: Option<u32>,
    ) -> ContextRule {
        env.current_contract_address().require_auth();
        update_context_rule_valid_until(env, context_rule_id, valid_until)
    }

    fn remove_context_rule(env: &Env, context_rule_id: u32) {
        env.current_contract_address().require_auth();
        remove_context_rule(env, context_rule_id);
    }

    fn add_signer(env: &Env, context_rule_id: u32, signer: Signer) {
        env.current_contract_address().require_auth();
        add_signer(env, context_rule_id, &signer);
    }

    fn remove_signer(env: &Env, context_rule_id: u32, signer: Signer) {
        env.current_contract_address().require_auth();
        remove_signer(env, context_rule_id, &signer);
    }

    fn add_policy(env: &Env, context_rule_id: u32, policy: Address, policy_params: Val) {
        env.current_contract_address().require_auth();
        add_policy(env, context_rule_id, &policy, policy_params);
    }

    fn remove_policy(env: &Env, context_rule_id: u32, policy: Address) {
        env.current_contract_address().require_auth();
        remove_policy(env, context_rule_id, &policy);
    }
}

// CustomAccountInterface For Authorization
#[contractimpl]
impl CustomAccountInterface for RemittanceAccount {
    type Signature = Signatures;
    type Error = SmartAccountError;
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signatures: Signatures,
        auth_contexts: Vec<Context>,
    ) -> Result<(), SmartAccountError> {
        // OZ's authorization matching
        do_check_auth(&env, &signature_payload, &signatures, &auth_contexts)?;
        Ok(())
    }
}
