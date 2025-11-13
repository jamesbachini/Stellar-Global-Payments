#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Env, IntoVal, String, vec,
};

extern crate std;
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient as TokenAdminClient};

// Helper to create a test token
fn create_token_contract<'a>(e: &Env, admin: &Address) -> (TokenClient<'a>, TokenAdminClient<'a>) {
    let contract_address = e.register_stellar_asset_contract_v2(admin.clone());
    (
        TokenClient::new(e, &contract_address.address()),
        TokenAdminClient::new(e, &contract_address.address()),
    )
}

// Helper to setup a basic smart account
fn setup_smart_account(e: &Env) -> (Address, Address, Address, Address, Address, Address) {
    let admin = Address::generate(e);
    let token_admin = Address::generate(e);
    let account_a = Address::generate(e);
    let account_b = Address::generate(e);
    let account_c = Address::generate(e);
    let account_d = Address::generate(e);

    (admin, token_admin, account_a, account_b, account_c, account_d)
}

#[test]
fn test_init_creates_smart_account() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, account_a, account_b, account_c, account_d) = setup_smart_account(&e);

    let (token_client, _) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register smart account contract
    let contract_id = e.register(RemittanceAccount, ());
    let client = RemittanceAccountClient::new(&e, &contract_id);

    // Initialize account A
    let destinations = vec![&e, account_b.clone(), account_c.clone(), account_d.clone()];
    client.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Verify label
    let label = client.get_label();
    assert_eq!(label, String::from_str(&e, "A"));

    // Verify auth was required
    assert_eq!(
        e.auths(),
        [(
            admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    client.address.clone(),
                    soroban_sdk::symbol_short!("init"),
                    (
                        admin.clone(),
                        token_address,
                        destinations,
                        String::from_str(&e, "A"),
                    ).into_val(&e)
                )),
                sub_invocations: std::vec![]
            }
        )]
    );
}

#[test]
fn test_execute_transfer_to_allowed_destination() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _account_a_addr, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Mint tokens to account A
    token_admin_client.mint(&account_a, &1000);

    // Execute transfer from A to B
    let result = client_a.try_execute_transfer(&account_b_addr, &100);
    assert!(result.is_ok());

    // Verify balances
    assert_eq!(token_client.balance(&account_a), 900);
    assert_eq!(token_client.balance(&account_b_addr), 100);
}

#[test]
fn test_execute_transfer_to_disallowed_destination_fails() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _account_a_addr, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);
    let unauthorized_addr = Address::generate(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Mint tokens to account A
    token_admin_client.mint(&account_a, &1000);

    // Try to transfer to unauthorized address
    let result = client_a.try_execute_transfer(&unauthorized_addr, &100);
    assert!(result.is_err());
    assert_eq!(result.err(), Some(Ok(RemittanceError::NotAllowed)));

    // Verify no tokens were transferred
    assert_eq!(token_client.balance(&account_a), 1000);
    assert_eq!(token_client.balance(&unauthorized_addr), 0);
}

#[test]
fn test_execute_transfer_to_self_fails() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Mint tokens to account A
    token_admin_client.mint(&account_a, &1000);

    // Try to transfer to self (not in destinations list)
    let result = client_a.try_execute_transfer(&account_a, &100);
    assert!(result.is_err());
    assert_eq!(result.err(), Some(Ok(RemittanceError::NotAllowed)));
}

#[test]
fn test_admin_withdraw() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _account_a_addr, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Mint tokens to account A
    token_admin_client.mint(&account_a, &1000);

    // Admin withdraws funds
    let result = client_a.try_admin_withdraw(&500);
    assert!(result.is_ok());

    // Verify balances
    assert_eq!(token_client.balance(&account_a), 500);
    assert_eq!(token_client.balance(&admin), 500);
}

#[test]
fn test_update_destinations() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _account_a_addr, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);
    let new_dest = Address::generate(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Mint tokens
    token_admin_client.mint(&account_a, &1000);

    // Transfer to B should work
    let result = client_a.try_execute_transfer(&account_b_addr, &100);
    assert!(result.is_ok());

    // Transfer to new_dest should fail
    let result = client_a.try_execute_transfer(&new_dest, &100);
    assert!(result.is_err());

    // Update destinations to only include new_dest
    let new_destinations = vec![&e, new_dest.clone()];
    client_a.update_destinations(&new_destinations);

    // Now transfer to new_dest should work
    let result = client_a.try_execute_transfer(&new_dest, &100);
    assert!(result.is_ok());
    assert_eq!(token_client.balance(&new_dest), 100);

    // But transfer to B should now fail
    let result = client_a.try_execute_transfer(&account_b_addr, &100);
    assert!(result.is_err());
}

#[test]
fn test_multiple_transfers_between_accounts() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _, _, _, _) = setup_smart_account(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Create 4 smart accounts
    let account_a = e.register(RemittanceAccount, ());
    let account_b = e.register(RemittanceAccount, ());
    let account_c = e.register(RemittanceAccount, ());
    let account_d = e.register(RemittanceAccount, ());

    let client_a = RemittanceAccountClient::new(&e, &account_a);
    let client_b = RemittanceAccountClient::new(&e, &account_b);
    let client_c = RemittanceAccountClient::new(&e, &account_c);
    let client_d = RemittanceAccountClient::new(&e, &account_d);

    // Initialize each account with the others as destinations
    let dest_a = vec![&e, account_b.clone(), account_c.clone(), account_d.clone()];
    let dest_b = vec![&e, account_a.clone(), account_c.clone(), account_d.clone()];
    let dest_c = vec![&e, account_a.clone(), account_b.clone(), account_d.clone()];
    let dest_d = vec![&e, account_a.clone(), account_b.clone(), account_c.clone()];

    client_a.init(&admin, &token_address, &dest_a, &String::from_str(&e, "A"));
    client_b.init(&admin, &token_address, &dest_b, &String::from_str(&e, "B"));
    client_c.init(&admin, &token_address, &dest_c, &String::from_str(&e, "C"));
    client_d.init(&admin, &token_address, &dest_d, &String::from_str(&e, "D"));

    // Mint initial balances
    token_admin_client.mint(&account_a, &1000);
    token_admin_client.mint(&account_b, &1000);
    token_admin_client.mint(&account_c, &1000);
    token_admin_client.mint(&account_d, &1000);

    // A -> B: 100
    client_a.execute_transfer(&account_b, &100);
    assert_eq!(token_client.balance(&account_a), 900);
    assert_eq!(token_client.balance(&account_b), 1100);

    // B -> C: 200
    client_b.execute_transfer(&account_c, &200);
    assert_eq!(token_client.balance(&account_b), 900);
    assert_eq!(token_client.balance(&account_c), 1200);

    // C -> D: 150
    client_c.execute_transfer(&account_d, &150);
    assert_eq!(token_client.balance(&account_c), 1050);
    assert_eq!(token_client.balance(&account_d), 1150);

    // D -> A: 250
    client_d.execute_transfer(&account_a, &250);
    assert_eq!(token_client.balance(&account_d), 900);
    assert_eq!(token_client.balance(&account_a), 1150);

    // Verify total supply unchanged
    let total = token_client.balance(&account_a)
        + token_client.balance(&account_b)
        + token_client.balance(&account_c)
        + token_client.balance(&account_d);
    assert_eq!(total, 4000);
}

#[test]
fn test_get_context_rules() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _account_a_addr, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);

    let (token_client, _) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Get default context rules (should have 1 from init)
    let rules = client_a.get_context_rules(&ContextRuleType::Default);
    assert_eq!(rules.len(), 1);

    // Get the first rule
    let rule = client_a.get_context_rule(&0);
    assert_eq!(rule.name, String::from_str(&e, "Admin Rule"));
}

#[test]
fn test_zero_amount_transfer() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Mint tokens
    token_admin_client.mint(&account_a, &1000);

    // Transfer 0 amount (should succeed but not move anything)
    let result = client_a.try_execute_transfer(&account_b_addr, &0);
    assert!(result.is_ok());

    // Verify balances unchanged
    assert_eq!(token_client.balance(&account_a), 1000);
    assert_eq!(token_client.balance(&account_b_addr), 0);
}

#[test]
fn test_transfer_more_than_balance_fails() {
    let e = Env::default();
    e.mock_all_auths();

    let (admin, token_admin, _, account_b_addr, account_c_addr, account_d_addr) = setup_smart_account(&e);

    let (token_client, token_admin_client) = create_token_contract(&e, &token_admin);
    let token_address = token_client.address.clone();

    // Register and initialize account A
    let account_a = e.register(RemittanceAccount, ());
    let client_a = RemittanceAccountClient::new(&e, &account_a);

    let destinations = vec![&e, account_b_addr.clone(), account_c_addr.clone(), account_d_addr.clone()];
    client_a.init(
        &admin,
        &token_address,
        &destinations,
        &String::from_str(&e, "A"),
    );

    // Mint only 100 tokens
    token_admin_client.mint(&account_a, &100);

    // Try to transfer 1000 (more than balance)
    let result = client_a.try_execute_transfer(&account_b_addr, &1000);
    assert!(result.is_err()); // Should fail at token contract level

    // Verify balance unchanged
    assert_eq!(token_client.balance(&account_a), 100);
}
