# Mobilis
A Soroban-powered automated micro-credit treasury for unbanked transport drivers in the Philippines.

![Mobilis Cover Image](https://github.com/user-attachments/assets/416d63f4-1e34-46ae-a734-9e5a59976146)

## 🚀 Live Links & Proof of Deployment
* **Live Demo:** [Insert your Vercel/Netlify Link Here]
* **Testnet Contract Address:** `CAVFLXBG4MXGTGECI6WAZXMDNX2H3UWFTMNY4DHK2MR4YUYEEU5STBID`
* **Sample Transaction Hash:** [Insert a successful Tx Hash from your history tab here]
<img width="1255" height="328" alt="image" src="https://github.com/user-attachments/assets/23435bd2-cf4a-4ac4-b4fb-c73b6af21429" />
https://stellar.expert/explorer/testnet/tx/64d87c59f1d037475199dfd8e56425cf7a9dc0b183ab6da6838b961eb1dcd481
## 📖 Problem and Solution
**Problem:** Unbanked tricycle and modernized jeepney drivers in the Philippines cannot afford upfront daily fuel costs and are forced to borrow from predatory local loan sharks charging excessive daily interest just to start their routes.

**Solution:** Local TODAs pool a USDC treasury on Stellar to provide drivers with instant, zero-interest fuel advances that are spent via QR code at partner stations and repaid end-of-shift with a 0.5% protocol fee automatically split via Soroban smart contracts.

## ⚙️ Stellar & Soroban Features Used
* **Native Token Transfers:** Handling XLM/USDC token transfers between Admin vaults and Driver wallets.
* **Soroban Smart Contracts:** Immutable ledger to prevent double-borrowing, handle trustless fee-splitting (0.3% to Coop Admin, 0.2% to Platform), and track active debt states.
* **Freighter / LOBSTR Integration:** Fully abstracted non-custodial wallet connections via `@stellar/freighter-api`.

## 🏗️ Architecture & Tech Stack
* **Frontend:** React, Vite, Tailwind CSS, Framer Motion
* **Backend Integration:** Firebase (Authentication & Metadata Storage)
* **Smart Contract:** Rust (Soroban SDK)

## 💻 Build and Test Instructions

### Prerequisites
* Rust toolchain (`rustup target add wasm32-unknown-unknown`)
* Soroban CLI (`cargo install --locked soroban-cli`)
* Node.js & npm

### Running the Smart Contract Tests
Navigate to the contracts directory and run the test suite to execute our 3+ passing unit tests:
```bash
cd contracts/Mobilis
cargo test
