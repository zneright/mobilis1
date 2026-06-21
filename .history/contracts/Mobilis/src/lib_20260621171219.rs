#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    DriverDebt(Address),
}

#[contract]
pub struct MobilisLedger;

#[contractimpl]
impl MobilisLedger {
    /// Records the debt on-chain when a driver borrows funds
    pub fn request_advance(env: Env, driver: Address, amount: i128) {
        driver.require_auth();
        let debt_key = DataKey::DriverDebt(driver.clone());
        if env.storage().instance().has(&debt_key) {
            panic!("Driver already has an active advance.");
        }
        env.storage().instance().set(&debt_key, &amount);
    }

    /// Clears the debt on-chain after the driver repays the cooperative
    pub fn settle_loan(env: Env, driver: Address) {
        driver.require_auth();
        let debt_key = DataKey::DriverDebt(driver.clone());
        env.storage().instance().remove(&debt_key);
    }

    /// Helper to check a driver's active debt on the frontend
    pub fn get_debt(env: Env, driver: Address) -> i128 {
        let debt_key = DataKey::DriverDebt(driver);
        env.storage().instance().get(&debt_key).unwrap_or(0)
    }
}