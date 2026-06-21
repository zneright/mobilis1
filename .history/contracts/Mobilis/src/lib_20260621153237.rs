#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token, // Can be Native XLM or USDC
    PlatformWallet,
    DriverDebt(Address),
}

#[contract]
pub struct MobilisTreasury;

#[contractimpl]
impl MobilisTreasury {
    /// Initializes the TODA cooperative treasury contract.
    pub fn init(env: Env, admin: Address, token: Address, platform: Address) {
        admin.require_auth();
        
        // Security: Prevent re-initialization
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract is already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::PlatformWallet, &platform);
    }

    /// Driver requests a fuel advance.
    /// The contract itself transfers the Asset to the driver.
    pub fn request_advance(env: Env, driver: Address, amount: i128) {
        // Driver must sign this transaction
        driver.require_auth();
        
        let debt_key = DataKey::DriverDebt(driver.clone());
        if env.storage().instance().has(&debt_key) {
            panic!("Driver already has an active advance. Settle first.");
        }

        if amount <= 0 {
            panic!("Advance amount must be greater than zero");
        }

        let token_address: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();

        // Verify the contract treasury actually has enough funds to lend
        if token_client.balance(&contract_address) < amount {
            panic!("Insufficient liquidity in the cooperative treasury");
        }

        // Execute the physical transfer from Contract -> Driver
        token_client.transfer(&contract_address, &driver, &amount);

        // Record the debt state
        env.storage().instance().set(&debt_key, &amount);

        // Emit an event for the indexer/frontend
        env.events().publish((symbol_short!("advance"), driver), amount);
    }

    /// Driver settles the loan at the end of the shift.
    /// Contract pulls Principal + 0.3% to itself, and 0.2% to the Platform.
    pub fn settle_loan(env: Env, driver: Address) {
        // Driver must sign this transaction to authorize the pull
        driver.require_auth();

        let debt_key = DataKey::DriverDebt(driver.clone());
        let principal: i128 = env.storage().instance().get(&debt_key).unwrap_or_else(|| panic!("No active loan found"));

        // Calculate Fees (Integer math for Stroops/Decimals)
        // e.g., 15 XLM = 150_000_000 stroops. 150_000_000 * 3 / 1000 = 450_000 stroops (0.045 XLM)
        let coop_fee = (principal * 3) / 1000; 
        let platform_fee = (principal * 2) / 1000; 
        
        let token_address: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let platform_address: Address = env.storage().instance().get(&DataKey::PlatformWallet).unwrap();
        
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();

        let total_required = principal + coop_fee + platform_fee;
        if token_client.balance(&driver) < total_required {
            panic!("Driver has insufficient balance to settle principal and fees");
        }

        // 1. Transfer Principal + Coop Fee back to the Treasury Contract
        token_client.transfer(&driver, &contract_address, &(principal + coop_fee));
        
        // 2. Transfer Platform Fee directly to the Mobilis platform wallet
        token_client.transfer(&driver, &platform_address, &platform_fee);

        // Clear debt state
        env.storage().instance().remove(&debt_key);

        // Emit settlement event
        env.events().publish((symbol_short!("settle"), driver.clone()), (principal, coop_fee, platform_fee));
    }

    /// Helper to check a driver's active debt on the frontend.
    pub fn get_debt(env: Env, driver: Address) -> i128 {
        let debt_key = DataKey::DriverDebt(driver);
        env.storage().instance().get(&debt_key).unwrap_or(0)
    }
}   