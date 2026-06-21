#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Default};
    use soroban_sdk::{token, Address, Env};

    fn setup_test() -> (Env, MobilisTreasuryClient<'static>, token::Client<'static>, token::StellarAssetClient<'static>, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let platform = Address::generate(&env);
        
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::Client::new(&env, &token_contract.address());
        let token_admin_client = token::StellarAssetClient::new(&env, &token_contract.address());

        let contract_id = env.register_contract(None, MobilisTreasury);
        let client = MobilisTreasuryClient::new(&env, &contract_id);
        
        client.init(&admin, &token_contract.address(), &platform);
        token_admin_client.mint(&contract_id, &1000_0000000);

        (env, client, token_client, token_admin_client, platform, contract_id, admin)
    }

    #[test]
    fn test_end_to_end_borrow_and_settle() {
        let (env, client, token_client, token_admin_client, platform, _contract_id, admin) = setup_test();
        let driver = Address::generate(&env);
        let advance_amount = 15_0000000; 

        client.request_advance(&driver, &advance_amount);
        assert_eq!(token_client.balance(&driver), advance_amount);

        token_admin_client.mint(&driver, &5_0000000); 

        let initial_platform_balance = token_client.balance(&platform);
        let initial_admin_balance = token_client.balance(&admin);

        client.settle_loan(&driver);
        
        assert_eq!(client.get_debt(&driver), 0);

        let final_platform_balance = token_client.balance(&platform);
        let final_admin_balance = token_client.balance(&admin);

        let coop_fee = (advance_amount * 3) / 1000; 
        let platform_fee = (advance_amount * 2) / 1000; 

        assert_eq!(final_platform_balance - initial_platform_balance, platform_fee);
        // Admin balance increases by the principal returned + the coop fee
        assert_eq!(final_admin_balance - initial_admin_balance, advance_amount + coop_fee);
    }
}