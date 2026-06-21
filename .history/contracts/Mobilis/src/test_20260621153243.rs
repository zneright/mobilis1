#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Default};
    use soroban_sdk::{token, Address, Env};

    fn setup_test() -> (Env, MobilisTreasuryClient<'static>, token::Client<'static>, token::StellarAssetClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let platform = Address::generate(&env);
        
        // Setup mock Token (Native XLM or USDC)
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::Client::new(&env, &token_contract.address());
        let token_admin_client = token::StellarAssetClient::new(&env, &token_contract.address());

        // Setup Mobilis Contract
        let contract_id = env.register_contract(None, MobilisTreasury);
        let client = MobilisTreasuryClient::new(&env, &contract_id);
        
        client.init(&admin, &token_contract.address(), &platform);

        // Fund TODA treasury (the contract) with 1000 tokens (e.g., 1000 XLM)
        token_admin_client.mint(&contract_id, &1000_0000000);

        (env, client, token_client, token_admin_client, platform, contract_id)
    }

    #[test]
    fn test_end_to_end_borrow_and_settle() {
        let (env, client, token_client, token_admin_client, platform, contract_id) = setup_test();
        let driver = Address::generate(&env);
        let advance_amount = 15_0000000; // 15 Tokens

        // 1. Request Advance
        client.request_advance(&driver, &advance_amount);
        
        // Verify Driver received the funds from the contract
        assert_eq!(token_client.balance(&driver), advance_amount);
        assert_eq!(client.get_debt(&driver), advance_amount);

        // 2. Simulate driver making money during their shift
        token_admin_client.mint(&driver, &5_0000000); 

        // 3. Settle Loan
        let initial_platform_balance = token_client.balance(&platform);
        let initial_contract_balance = token_client.balance(&contract_id);

        client.settle_loan(&driver);
        
        // Verify Debt is cleared
        assert_eq!(client.get_debt(&driver), 0);

        // Verify Fee Routing
        let final_platform_balance = token_client.balance(&platform);
        let final_contract_balance = token_client.balance(&contract_id);

        let coop_fee = (advance_amount * 3) / 1000; // 0.045
        let platform_fee = (advance_amount * 2) / 1000; // 0.030

        assert_eq!(final_platform_balance - initial_platform_balance, platform_fee);
        // Contract balance increases by the principal returned + the coop fee
        assert_eq!(final_contract_balance - initial_contract_balance, advance_amount + coop_fee);
    }

    #[test]
    #[should_panic(expected = "Insufficient liquidity in the cooperative treasury")]
    fn test_fails_if_treasury_empty() {
        let (env, client, _, _, _, _) = setup_test();
        let driver = Address::generate(&env);
        
        // Try to borrow 2000 tokens when treasury only has 1000
        client.request_advance(&driver, &2000_0000000);
    }
}