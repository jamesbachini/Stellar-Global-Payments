#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, symbol_short, token, Address, Env, Map, String,
    Symbol, Val, Vec, vec,
};
use soroban_sdk::auth::{Context, CustomAccountInterface};
use soroban_sdk::crypto::Hash;

// Import OpenZeppelin stellar-accounts framework
use stellar_accounts::smart_account::{
    add_context_rule, add_policy, add_signer, do_check_auth, get_context_rule, get_context_rules,
    remove_context_rule, remove_policy, remove_signer, update_context_rule_name,
    update_context_rule_valid_until, ContextRule, ContextRuleType, Signatures, Signer,
    SmartAccount, SmartAccountError,
};

mod test;

// Storage keys
const ADMIN_KEY: Symbol = symbol_short!("admin");
const TOKEN_KEY: Symbol = symbol_short!("token");
const DEST_KEY: Symbol = symbol_short!("dest");
const LABEL_KEY: Symbol = symbol_short!("label");

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RemittanceError {
    NotInitialized = 1,
    NotAllowed = 2,
}

#[contract]
pub struct RemittanceAccount;

// Helper functions to read from storage
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

#[contractimpl]
impl RemittanceAccount {
    /// Initialize the smart account with admin, token, allowed destinations, and label
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        destinations: Vec<Address>,
        label: String,
    ) {
        // Require admin authorization
        admin.require_auth();

        // Store configuration
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&TOKEN_KEY, &token);
        env.storage().instance().set(&DEST_KEY, &destinations);
        env.storage().instance().set(&LABEL_KEY, &label);

        // Create default context rule with admin as delegated signer
        // This allows the admin to authorize all operations on this smart account
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

    /// Execute a transfer to one of the allowed destinations
    /// The destination must be in the whitelist set during initialization
    pub fn execute_transfer(env: Env, to: Address, amount: i128) -> Result<(), RemittanceError> {
        // Validate destination is in allowed set
        let allowed = read_destinations(&env)?;
        if !allowed.iter().any(|addr| addr == to) {
            return Err(RemittanceError::NotAllowed);
        }

        // Get token contract and execute transfer
        let token = read_token(&env)?;
        let self_address = env.current_contract_address();

        // Call token transfer - authorization will be checked via __check_auth
        let client = token::Client::new(&env, &token);
        client.transfer(&self_address, &to, &amount);

        Ok(())
    }

    /// Admin-only withdrawal to the admin address
    pub fn admin_withdraw(env: Env, amount: i128) -> Result<(), RemittanceError> {
        let admin = read_admin(&env)?;
        let token = read_token(&env)?;
        let self_address = env.current_contract_address();

        // Call token transfer - authorization will be checked via __check_auth
        let client = token::Client::new(&env, &token);
        client.transfer(&self_address, &admin, &amount);

        Ok(())
    }

    /// Update the allowed destinations (admin only)
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
}

// Implement the OpenZeppelin SmartAccount trait
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

    fn update_context_rule_name(
        env: &Env,
        context_rule_id: u32,
        name: String,
    ) -> ContextRule {
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

    fn add_policy(
        env: &Env,
        context_rule_id: u32,
        policy: Address,
        policy_params: Val,
    ) {
        env.current_contract_address().require_auth();
        add_policy(env, context_rule_id, &policy, policy_params);
    }

    fn remove_policy(env: &Env, context_rule_id: u32, policy: Address) {
        env.current_contract_address().require_auth();
        remove_policy(env, context_rule_id, &policy);
    }
}

// Implement CustomAccountInterface for smart account authorization
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
        // Use OpenZeppelin's authorization matching algorithm
        do_check_auth(&env, &signature_payload, &signatures, &auth_contexts)?;
        Ok(())
    }
}
