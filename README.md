# Mobilis
A Soroban-powered automated micro-credit treasury for unbanked transport drivers in the Philippines.

## Problem and Solution
**Problem:** Unbanked tricycle and modernized jeepney drivers in the Philippines cannot afford upfront daily fuel costs and are forced to borrow from predatory local loan sharks charging excessive daily interest just to start their routes.
**Solution:** Local TODAs pool a USDC treasury on Stellar to provide drivers with instant, zero-interest fuel advances that are spent via QR code at partner stations and repaid end-of-shift with a 0.5% protocol fee automatically split via Soroban smart contracts.

## Timeline
* Day 1: Smart contract development and unit testing in Soroban.
* Day 2: Firebase backend setup and Stellar testnet deployment. React frontend integration, abstracting wallet keypairs


## Stellar Features Used
* XLM/USDC token transfers.
* Soroban Smart Contracts for trustless fee-splitting and escrow.

## Vision and Purpose
To eradicate predatory micro-lending in the Philippine informal gig economy by leveraging the low cost, high speed, and programmability of the Stellar network, returning economic agency to local driver cooperatives.

## Prerequisites
* Rust toolchain (`rustup target add wasm32-unknown-unknown`)
* Soroban CLI (`cargo install --locked soroban-cli`)

## References and Examples
* For comprehensive deployment instructions, please refer to the HOW TO DEPLOY GUIDE found in the file Copy-Paste Board.pdf[cite: 1].
* For an architecture mapping to a frontend application, see the EXAMPLE SMART CONTRACT + FRONTEND repository found in the file Copy-Paste Board.pdf[cite: 1].
<img width="1907" height="907" alt="image" src="https://github.com/user-attachments/assets/416d63f4-1e34-46ae-a734-9e5a59976146" />

## Build and Test Instructions
**How to build:**
```bash
soroban contract build
