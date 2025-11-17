#![no_std]

use soroban_sdk::auth::{Context, CustomAccountInterface};
use soroban_sdk::crypto::Hash;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env,
    Map, String, Val, Vec,
};
use stellar_accounts::smart_account::{
    add_context_rule, add_policy, add_signer, do_check_auth, get_context_rule, get_context_rules,
    remove_context_rule, remove_policy, remove_signer, update_context_rule_name,
    update_context_rule_valid_until, ContextRule, ContextRuleType, Signatures, Signer,
    SmartAccount, SmartAccountError,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    Signers,
    Threshold,
    Label,
    NextRequestId,
    Request(u32),
}

#[derive(Clone)]
#[contracttype]
pub struct WithdrawalRequest {
    pub id: u32,
    pub to: Address,
    pub amount: i128,
    pub approvals: Vec<Address>,
    pub executed: bool,
    pub initiator: Address,
    pub created_at: u64,
    pub completed_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct MultisigSummary {
    pub threshold: u32,
    pub signer_count: u32,
    pub label: String,
}

#[derive(Clone)]
#[contracttype]
pub struct WithdrawalSnapshot {
    pub id: u32,
    pub to: String,
    pub amount: i128,
    pub approvals: Vec<String>,
    pub executed: bool,
    pub initiator: String,
    pub created_at: u64,
    pub completed_at: u64,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MultisigError {
    NotInitialized = 1,
    InvalidThreshold = 2,
    InvalidAmount = 3,
    SignerNotAllowed = 4,
    RequestNotFound = 5,
    DuplicateApproval = 6,
    DestinationNotAllowed = 7,
}

#[contract]
pub struct MultisigTreasury;

fn read_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("admin not configured")
}

fn read_token(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Token)
        .expect("token not configured")
}

fn read_signers(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Signers)
        .expect("signers not configured")
}

fn read_threshold(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::Threshold)
        .expect("threshold not configured")
}

fn read_label(env: &Env) -> String {
    env.storage()
        .instance()
        .get(&DataKey::Label)
        .unwrap_or(String::from_str(env, "Treasury"))
}

fn read_request(env: &Env, id: u32) -> WithdrawalRequest {
    env.storage()
        .instance()
        .get(&DataKey::Request(id))
        .unwrap_or_else(|| panic_with_error!(env, MultisigError::RequestNotFound))
}

fn write_request(env: &Env, request: &WithdrawalRequest) {
    env.storage()
        .instance()
        .set(&DataKey::Request(request.id), request);
}

fn next_request_id(env: &Env) -> u32 {
    let mut counter = env
        .storage()
        .instance()
        .get(&DataKey::NextRequestId)
        .unwrap_or(0u32);
    let current = counter;
    counter = counter.checked_add(1).expect("request overflow");
    env.storage()
        .instance()
        .set(&DataKey::NextRequestId, &counter);
    current
}

fn validate_signer(env: &Env, signer: &Address) {
    let signers = read_signers(env);
    let allowed = signers.iter().any(|addr| addr == *signer);
    if !allowed {
        panic_with_error!(env, MultisigError::SignerNotAllowed);
    }
}

fn ensure_destination_allowed(env: &Env, to: &Address) {
    let signers = read_signers(env);
    if !signers.iter().any(|addr| addr == *to) {
        panic_with_error!(env, MultisigError::DestinationNotAllowed);
    }
}

fn maybe_execute(env: &Env, request: &mut WithdrawalRequest) -> bool {
    if request.executed {
        return true;
    }
    let threshold = read_threshold(env);
    if request.approvals.len() < threshold {
        return false;
    }
    ensure_destination_allowed(env, &request.to);
    let token = read_token(env);
    let client = token::Client::new(env, &token);
    let self_address = env.current_contract_address();
    client.transfer(&self_address, &request.to, &request.amount);
    request.executed = true;
    request.completed_at = env.ledger().timestamp();
    true
}

fn to_snapshot(env: &Env, request: &WithdrawalRequest) -> WithdrawalSnapshot {
    let mut approvals = Vec::new(env);
    for signer in request.approvals.iter() {
        approvals.push_back(signer.to_string());
    }
    WithdrawalSnapshot {
        id: request.id,
        to: request.to.to_string(),
        amount: request.amount,
        approvals,
        executed: request.executed,
        initiator: request.initiator.to_string(),
        created_at: request.created_at,
        completed_at: request.completed_at,
    }
}

#[contractimpl]
impl MultisigTreasury {
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        signers: Vec<Address>,
        threshold: u32,
        label: String,
    ) {
        admin.require_auth();
        if signers.is_empty() {
            panic_with_error!(env, MultisigError::InvalidThreshold);
        }
        if threshold == 0 || threshold as usize > signers.len() {
            panic_with_error!(env, MultisigError::InvalidThreshold);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        env.storage().instance().set(&DataKey::Label, &label);
        env.storage()
            .instance()
            .set(&DataKey::NextRequestId, &0u32);
        let admin_signers = Vec::from_array(&env, [Signer::Delegated(admin.clone())]);
        let policies: Map<Address, Val> = Map::new(&env);
        add_context_rule(
            &env,
            &ContextRuleType::Default,
            &String::from_str(&env, "Admin Rule"),
            None,
            &admin_signers,
            &policies,
        );
    }

    pub fn get_summary(env: Env) -> MultisigSummary {
        let threshold = read_threshold(&env);
        let signers = read_signers(&env);
        MultisigSummary {
            threshold,
            signer_count: signers.len() as u32,
            label: read_label(&env),
        }
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        read_signers(&env)
    }

    pub fn list_requests(env: Env) -> Vec<WithdrawalSnapshot> {
        let mut result = Vec::new(&env);
        let next_id = env
            .storage()
            .instance()
            .get::<_, u32>(&DataKey::NextRequestId)
            .unwrap_or(0);
        let mut current = 0u32;
        while current < next_id {
            if let Some(request) = env
                .storage()
                .instance()
                .get::<_, WithdrawalRequest>(&DataKey::Request(current))
            {
                result.push_back(to_snapshot(&env, &request));
            }
            current = current.saturating_add(1);
        }
        result
    }

    pub fn propose_withdraw(env: Env, to: Address, amount: i128) -> u32 {
        if amount <= 0 {
            panic_with_error!(env, MultisigError::InvalidAmount);
        }
        ensure_destination_allowed(&env, &to);
        let signer = env.invoker();
        validate_signer(&env, &signer);

        let id = next_request_id(&env);
        let approvals = Vec::from_array(&env, [signer.clone()]);
        let mut request = WithdrawalRequest {
            id,
            to,
            amount,
            approvals,
            executed: false,
            initiator: signer,
            created_at: env.ledger().timestamp(),
            completed_at: 0,
        };

        if maybe_execute(&env, &mut request) {
            request.completed_at = env.ledger().timestamp();
        }

        write_request(&env, &request);
        id
    }

    pub fn approve_withdraw(env: Env, request_id: u32) -> bool {
        let signer = env.invoker();
        validate_signer(&env, &signer);

        let mut request = read_request(&env, request_id);
        if request.executed {
            return true;
        }

        if request.approvals.iter().any(|addr| addr == signer) {
            panic_with_error!(env, MultisigError::DuplicateApproval);
        }

        request.approvals.push_back(signer);
        let executed = maybe_execute(&env, &mut request);
        if executed && request.completed_at == 0 {
            request.completed_at = env.ledger().timestamp();
        }
        write_request(&env, &request);
        executed
    }
}

#[contractimpl]
impl SmartAccount for MultisigTreasury {
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

#[contractimpl]
impl CustomAccountInterface for MultisigTreasury {
    type Signature = Signatures;
    type Error = SmartAccountError;
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signatures: Signatures,
        auth_contexts: Vec<Context>,
    ) -> Result<(), SmartAccountError> {
        do_check_auth(&env, &signature_payload, &signatures, &auth_contexts)?;
        Ok(())
    }
}
