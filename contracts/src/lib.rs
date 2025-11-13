#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, symbol_short, vec, Address, Env, Symbol, Vec,
};
use soroban_sdk::token::Client as TokenClient;

use openzeppelin_stellar_accounts::prelude::{
    AccountContext, AccountPolicy, Calls, CustomAccountInterface, ExecutionAuthorization,
};

const ADMIN_KEY: Symbol = symbol_short!("admin");
const TOKEN_KEY: Symbol = symbol_short!("token");
const DEST_KEY: Symbol = symbol_short!("dest");
const LABEL_KEY: Symbol = symbol_short!("label");

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RemittanceError {
    NotInitialized = 1,
    NotAllowed = 2,
    NotAdmin = 3,
    InvalidContext = 4,
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

fn token_client(env: &Env) -> Result<TokenClient, RemittanceError> {
    let token = read_token(env)?;
    Ok(TokenClient::new(env, &token))
}

#[contractimpl]
impl RemittanceAccount {
    pub fn init(env: Env, admin: Address, token: Address, destinations: Vec<Address>, label: Vec<u8>) {
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&TOKEN_KEY, &token);
        env.storage().instance().set(&DEST_KEY, &destinations);
        env.storage().instance().set(&LABEL_KEY, &label);
    }

    pub fn update_destinations(env: Env, destinations: Vec<Address>) -> Result<(), RemittanceError> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&DEST_KEY, &destinations);
        Ok(())
    }

    pub fn admin_withdraw(env: Env, amount: i128) -> Result<(), RemittanceError> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        let client = token_client(&env)?;
        let self_address = env.current_contract_address();
        client.transfer(&self_address, &admin, &amount);
        Ok(())
    }

    pub fn execute_transfer(env: Env, to: Address, amount: i128) -> Result<(), RemittanceError> {
        let allowed = read_destinations(&env)?;
        if !allowed.iter().any(|addr| addr == &to) {
            return Err(RemittanceError::NotAllowed);
        }
        let client = token_client(&env)?;
        let self_address = env.current_contract_address();
        client.transfer(&self_address, &to, &amount);
        Ok(())
    }
}

#[contractimpl]
impl CustomAccountInterface for RemittanceAccount {
    fn describe_policies(env: Env) -> Vec<AccountPolicy> {
        let token = read_token(&env).unwrap_or_else(|_| Address::from_contract_id(&env, [0; 32]));
        let allowed = read_destinations(&env).unwrap_or_else(|_| vec![&env]);

        let mut policies = vec![&env];

        let transfer_policy = AccountPolicy::builder(&env)
            .label(b"remit")
            .allow(Calls::token_transfer(token.clone(), allowed.clone()))
            .build();

        policies.push_back(transfer_policy);

        let admin_policy = AccountPolicy::builder(&env)
            .label(b"admin-withdraw")
            .require_signer(read_admin(&env).unwrap_or_else(|_| Address::from_contract_id(&env, [0; 32])))
            .allow(Calls::token_transfer(token, vec![&env, read_admin(&env).unwrap()]))
            .build();

        policies.push_back(admin_policy);
        policies
    }

    fn authorize(env: Env, auth: ExecutionAuthorization) -> Result<(), RemittanceError> {
        match auth.context() {
            AccountContext::TokenTransfer { to, .. } => {
                let allowed = read_destinations(&env)?;
                if !allowed.iter().any(|addr| addr == to) {
                    return Err(RemittanceError::NotAllowed);
                }
                Ok(())
            }
            AccountContext::Custom(label) if label == b"admin-withdraw" => {
                let admin = read_admin(&env)?;
                admin.require_auth();
                Ok(())
            }
            _ => Err(RemittanceError::InvalidContext),
        }
    }
}
