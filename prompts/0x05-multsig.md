Create the multisig contract and frontend implemenation for the multisig tab.

The page should open up similar to the payments page with the 3 of the 4 wallets for London, New York, Buenos Aires and Singapore.
Additionally at the bottom center of the map it should have a multisig wallet.
The UI should still include everything that payments has except there is an extra option to send USDC to the multisig wallet.

Any 3/4 signatures from the wallets are required to release USDC from the multisig back to the New York wallet.

There is some example code in the OpenZeppelin smart account library which might be helpful:

create_context_rule(
    context_type: Default,
    name: "Treasury Operations",
    valid_until: None,
    signers: vec![
        &e,
        Signer::External(ed25519_verifier, alice_pubkey),
        Signer::External(secp256k1_verifier, bob_pubkey),
        Signer::Delegated(carol_contract)
    ],
    policies: map![&e, (threshold_policy, two_of_three)]
)

This code is from here: https://github.com/OpenZeppelin/stellar-contracts/tree/main/packages/accounts

All signers should use the same signatures and they should be able to sign within the contract and pass a signature to the mutlisig. The admin account will pay any transaction fees required as the smart-accounts wont hold XLM, only USDC (and EURC for forex but this isn't relevant).

So a user can go into the multisig tab and click on one of the wallets. This will open up the option to send funds to another wallet or the multisig. Once the multisig has some usdc a user can click on that wallet and say withdraw to and select which wallet out of the 4 options they want and how much funds.

The UI will then show that this counts as 1/3 signatures required and they'll have to sign the transaction with any two of the other wallets. Once they've "approved" the tx with the other wallets the USDC will be released from the multisig.

No external wallets will be used. This is for a demo so the admin wallet in the backend will sign and send all txs. The USDC funds should only move from the smart account wallets and should not be held by the admin account.

Make it look really elegant and impressive while maintaining simplicity so it clearly demonstrates the utility of multisig wallets.