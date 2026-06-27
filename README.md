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
- [x] **README with complete documentation:** You are reading it.
- [x] **Minimum 10+ meaningful commits:** Maintained throughout the project timeline.
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

### Mobile Responsive UI
<img src="YOUR_FRONTEND_SCREENSHOT_URL_HERE" width="400" alt="Mobile Responsive App View" />

### CI/CD Deployment Pipeline & Test Suite Performance
<img src="<img width="967" height="167" alt="image" src="https://github.com/user-attachments/assets/a65b1369-f8bd-44f2-b1f6-18d20e5b8921" />
" width="700" alt="CI/CD Pipeline Run" />

---

## 🏗️ Architecture & Tech Stack

Mobilis uses a reliable Web2.5 hybrid system designed to bring low-latency structural integrity to traditional transport workflows.

* **Frontend:** React 18, Vite, Tailwind CSS, Framer Motion (for immersive 3D Global Earth WebGL interactions via Three.js).
* **State Management & Web3 Connections:** `@stellar/stellar-sdk`, integrated directly with `@stellar/freighter-api` and extension hooks for automated node configurations.
* **Database & Directory Ledger:** Firebase Auth and Firestore to track fleet structural metadata (plate profiles, TODA cooperative nodes, names) without exposing unnecessary PII on the ledger.
* **On-Chain Settlement Protocol:** WebAssembly Rust binary deployed under the Soroban SDK smart contract environment running on the Stellar Testnet.

---

## 💻 Local Development & Testing Instructions

### Prerequisites
* [Node.js & npm](https://nodejs.org/)
* [Rust toolchain](https://www.rust-lang.org/) (`rustup target add wasm32-unknown-unknown`)
* [Soroban CLI](https://soroban.stellar.org/) (`cargo install --locked soroban-cli`)

### 1. Smart Contract Compilation & Verification
Navigate to your localized contract directory to compile logic structures and pass system-defined test variants:

```bash
cd contracts/Mobilis
# Run unit assertions verifying contract actions (3+ passing tests)
cargo test

