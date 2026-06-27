# 🚙⚡ Mobilis

> A Soroban-powered automated micro-credit treasury for unbanked transport drivers in the Philippines.

<p align="center">
  <img width="100%" alt="Mobilis Dashboard" src="https://github.com/user-attachments/assets/a722e22f-fa77-4339-8dd6-945c1a89ad2a" />
</p>

## 📖 Problem & Solution

**The Problem:** Unbanked tricycle and modernized jeepney drivers in the Philippines operate on razor-thin margins. Many cannot afford upfront daily fuel costs and are forced to borrow from predatory local loan sharks charging excessive daily interest rates just to start their routes.

**The Solution:** Mobilis allows local TODAs (Tricycle Operators and Drivers' Associations) to pool a stable crypto treasury on the Stellar network. Drivers receive instant, zero-interest fuel advances via app-generated custodial accounts. The loan is repaid at the end of the shift with a minimal 0.5% protocol fee, automatically split and settled atomically via Soroban smart contracts.

---

## ✅ Submission Checklist & Requirements Met

- [x] **Public GitHub repository:** Complete open-source code availability.
- [x] **README with complete documentation:** Detailed configuration structure finalized.
- [x] **Minimum 10+ meaningful commits:** Maintained consistently throughout development.
- [x] **Live demo link:** [Mobilis Web App](https://mobilis-10f9a.web.app/)
- [x] **Contract deployment address:** `CAVFLXBG4MXGTGECI6WAZXMDNX2H3UWFTMNY4DHK2MR4YUYEEU5STBID`
- [x] **Advanced smart contract development:** Rust-based Soroban contracts managing immutable debt states and trustless fee-splitting.
- [x] **Inter-contract communication / Token Transfers:** Direct interactions handling native Stellar core asset operations and programmatic fee dispersion.
- [x] **Event streaming & real-time updates:** High-performance RPC and Horizon balance state fetches coupled with live updates via Firebase Firestore listeners.
- [x] **Mobile responsive frontend:** Tailwind CSS implementation with an app-like bottom navigation container designed for transport operators on mobile units.
- [x] **Error handling & loading states:** Transaction validation rules, balance safety checks, and deterministic transaction signing blocks.
- [x] **Production-ready architecture practices:** Clear separation of off-chain metadata (Firebase) and on-chain transactional proofs (Stellar Ledger).

---

## 🚀 Live Links & Proof of Deployment

* **Live Platform Demo:** [https://mobilis-10f9a.web.app/](https://mobilis-10f9a.web.app/)
* **Testnet Contract Address:** `CAVFLXBG4MXGTGECI6WAZXMDNX2H3UWFTMNY4DHK2MR4YUYEEU5STBID`

### On-Chain Transaction Verification

| Action Log | Transaction Hash / Explorer Link | Ledger Verification |
| :--- | :--- | :--- |
| **Initial Funding** | [64d87c59f1d0...](https://stellar.expert/explorer/testnet/tx/64d87c59f1d037475199dfd8e56425cf7a9dc0b183ab6da6838b961eb1dcd481) | <img width="280" alt="Tx 1" src="https://github.com/user-attachments/assets/23435bd2-cf4a-4ac4-b4fb-c73b6af21429" /> |
| **Loan Advance** | [fc0766df376f...](https://stellar.expert/explorer/testnet/tx/fc0766df376f13ca3b1e5e4583fe7c01738a244206d30269dd8912bb0ccd1d5a) | <img width="280" alt="Tx 2" src="https://github.com/user-attachments/assets/23bff5da-6fd0-4251-80b4-6b6d295ce10d" /> |
| **Debt Settlement** | [1ab1a0a09207...](https://stellar.expert/explorer/testnet/tx/1ab1a0a09207bbaefda4f8f696866c43eed23995904303d063cb52c0e13994d3) | <img width="280" alt="Tx 3" src="https://github.com/user-attachments/assets/465a469d-54c2-4b6d-9b2a-0a849e90192a" /> |
| **Fee Routing** | [702d83033adc...](https://stellar.expert/explorer/testnet/tx/702d83033adcdc63375368ab6292b9e5e44a24fba01a8b206e542cf516faf331) | <img width="280" alt="Tx 4" src="https://github.com/user-attachments/assets/06300370-ddeb-41c8-8813-0ad82b9238d2" /> |

---

## 📸 System Evidence & UI Presentation

### Mobile Responsive UI Ecosystem

| Landing View | Security Gateway / Login | Driver Registration Node |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/b4a66160-d9cf-4511-907c-dc3e33b8840d" width="240" alt="Landing Page" /> | <img src="https://github.com/user-attachments/assets/43663700-7b09-4995-9740-88567ceeb380" width="240" alt="Login View" /> | <img src="https://github.com/user-attachments/assets/6451a60d-cd51-47ae-aecd-08b0a668c414" width="240" alt="Signup Driver" /> |

| Cooperative Admin Registration | Driver Core Control Hub | Cooperative Command Center |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/96cdfb03-5956-441d-ae6d-b53c5f6c708b" width="240" alt="Signup Cooperative" /> | <img src="https://github.com/user-attachments/assets/6a40a33d-526f-4bfb-8eae-bde37091d232" width="240" alt="Driver Profile Control Hub" /> | <img src="https://github.com/user-attachments/assets/7cf9e3f6-6b6e-44d6-85e4-672e742193cb" width="240" alt="Cooperative Dashboard Driver" /> |

| Integrated Digital Wallet | Real-Time Activity History Ledger | Profile Management Configuration |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/7d07e90b-49c0-457f-b895-aec8198599d7" width="240" alt="Wallet Tab" /> | <img src="https://github.com/user-attachments/assets/2aed4705-c6c9-4a9d-ac26-b66f620bd727" width="240" alt="Transactions Ledger" /> | <img src="https://github.com/user-attachments/assets/3f610c97-2766-403d-bfdc-0e317da8b47b" /> |

---

### CI/CD Deployment Pipeline & Test Suite Performance

```text
running 1 test
test test::test::test_end_to_end_borrow_and_settle ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
🏗️ Architecture & Tech Stack
Mobilis uses a reliable Web2.5 hybrid system designed to bring low-latency structural integrity to traditional transport workflows.

Frontend: React 18, Vite, Tailwind CSS, Framer Motion (for immersive 3D Global Earth WebGL interactions via Three.js).

State Management & Web3 Connections: @stellar/stellar-sdk, integrated directly with @stellar/freighter-api and extension hooks for automated node configurations.

Database & Directory Ledger: Firebase Auth and Firestore to track fleet structural metadata (plate profiles, TODA cooperative nodes, names) without exposing unnecessary PII on the ledger.

On-Chain Settlement Protocol: WebAssembly Rust binary deployed under the Soroban SDK smart contract environment running on the Stellar Testnet.

💻 Local Development & Testing Instructions
Prerequisites
Node.js & npm

Rust toolchain (rustup target add wasm32-unknown-unknown)

Soroban CLI (cargo install --locked soroban-cli)

1. Smart Contract Compilation & Verification
Navigate to your localized contract directory to compile logic structures and pass system-defined test variants:

Bash
cd contracts/Mobilis
# Run unit assertions verifying contract actions (3+ passing tests)
cargo test
2. Frontend Workspace System Initialization
Open a parallel command context window to configure your environment flags and execute the local user interface:

Bash
cd ../../mobilis-frontend
npm install

# Initialize your application context values
cp .env.example .env
# Populate production environment strings inside the .env wrapper

# Fire up the lightweight development engine server
npm run dev
🔒 Security, Loading States & Architectural Guardrails
Pre-flight Asset Assurances: The UI prevents double-borrowing by reading the immutable smart contract ledger debt mapping via pre-flight simulations before unlocking operational buttons.

Dynamic Fee Allocation: Upon repayment, fees are programmatically routed across structural accounts (0.3% to Coop Admins for risk mitigation, 0.2% to Platform core infrastructure maintenance).

Fail-Safe Cryptography: Wallet actions utilize loading state overlays, intercepting user mistakes and handling runtime ledger rejections cleanly.
