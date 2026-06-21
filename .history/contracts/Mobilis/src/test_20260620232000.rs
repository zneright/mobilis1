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
        
        // Setup mock USDC
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::Client::new(&env, &token_contract.address());
        let token_admin_client = token::StellarAssetClient::new(&env, &token_contract.address());

        // Setup Mobilis Contract
        let contract_id = env.register_contract(None, MobilisTreasury);
        let client = MobilisTreasuryClient::new(&env, &contract_id);
        
        client.init(&admin, &token_contract.address(), &platform);

        // Fund TODA treasury with 1000 USDC
        token_admin_client.mint(&contract_id, &1000_0000000);

        (env, client, token_client, token_admin_client, platform, contract_id)
    }

    #[test]
    fn test_1_happy_path_execute_end_to_end() {
        let (env, client, token_client, token_admin_client, _, _) = setup_test();
        let driver = Address::generate(&env);
        let advance_amount = 15_0000000;

        // Request Advance
        client.request_advance(&driver, &advance_amount);
        assert_eq!(token_client.balance(&driver), advance_amount);

        // Mint extra to driver to simulate their shift earnings for repayment
        token_admin_client.mint(&driver, &1_0000000); 

        // Settle Loan
        client.settle_loan(&driver);
        
        // Assert debt is cleared
        assert_eq!(client.get_debt(&driver), 0);
    }

    #[test]
    #[should_panic(expected = "Driver already has an active advance")]
    fn test_2_edge_case_duplicate_advance_fails() {
        let (env, client, _, _, _, _) = setup_test();
        let driver = Address::generate(&env);
        
        client.request_advance(&driver, &15_0000000);
        client.request_advance(&driver, &15_0000000); // Should panic
    }

    #[test]
    fn test_3_state_verification_after_advance() {
        let (env, client, _, _, _, _) = setup_test();
        let driver = Address::generate(&env);
        let advance_amount = 20_0000000;

        assert_eq!(client.get_debt(&driver), 0);
        client.request_advance(&driver, &advance_amount);
        
        // Verify storage reflects exactly the requested amount
        assert_eq!(client.get_debt(&driver), advance_amount);
    }

    #[test]
    #[should_panic(expected = "No active loan found")]
    fn test_4_edge_case_settle_without_loan_fails() {
        let (env, client, _, _, _, _) = setup_test();
        let driver = Address::generate(&env);
        
        // Attempt to settle when no debt exists
        client.settle_loan(&driver);
    }

    #[test]
    fn test_5_state_verification_after_settlement() {
        let (env, client, token_client, token_admin_client, platform, contract_id) = setup_test();
        let driver = Address::generate(&env);
        let advance_amount = 100_0000000; // 100 USDC for easy math
        
        client.request_advance(&driver, &advance_amount);
        
        // Give driver money to pay fees
        token_admin_client.mint(&driver, &10_0000000); 
        
        let initial_treasury = token_client.balance(&contract_id);
        let initial_platform = token_client.balance(&platform);

        client.settle_loan(&driver);

        let final_treasury = token_client.balance(&contract_id);
        let final_platform = token_client.balance(&platform);

        // 100 USDC loan: 0.3% is 0.3 USDC, 0.2% is 0.2 USDC
        assert_eq!(final_treasury - initial_treasury, 100_3000000);
        assert_eq!(final_platform - initial_platform, 0_2000000);
    }
}