# EduFund | Milestone-Based Decentralized Crowdfunding dApp

EduFund is a modern decentralized application (dApp) that enables creators to launch educational, scientific, and community impact campaigns with **milestone-verified funding tranches**. Backers securely pledge ETH on the Ethereum Sepolia Testnet, and creators can only withdraw funds as predefined deliverables are approved by backer consensus voting. If a campaign fails to hit its overall funding goal before the deadline, contributors can claim a **100% automatic refund**.

Built with **Solidity ^0.8.20**, **HTML5**, **Tailwind CSS (via CDN)**, **Vanilla JavaScript**, and **Ethers.js v6**.

---

## 🌟 Key Features

### 1. Smart Contract Layer (`contracts/EduFund.sol`)
- **Campaign Creation**: Any user can initialize an educational fundraising campaign with a title, description, cover image, deadline, and a granular breakdown of project milestones.
- **Pledge Mechanism**: Backers contribute ETH into a non-custodial smart contract escrow on the Ethereum Sepolia testnet.
- **Milestone Verification & Safe Withdrawal Pattern**:
  - Creators define milestones with individual target funding amounts (e.g., Phase 1: 1.0 ETH, Phase 2: 1.5 ETH).
  - Backers vote on milestone deliverables with voting power weighted by their pledged ETH.
  - When **> 50% majority consensus** is reached, the milestone is marked as approved.
  - The creator can then safely withdraw that specific milestone tranche using the `withdrawMilestone()` function with `nonReentrant` protection.
- **100% Automatic Refund Guarantee**:
  - If a campaign fails to reach its total funding goal by the deadline, any backer can call `claimRefund()` to reclaim their contributed ETH immediately.

### 2. Frontend & dApp Layer
- **Modern Dashboard UX**: Clean dark-slate glassmorphism aesthetic, responsive Tailwind CSS grid, animated progress bars, status badges, and milestone roadmap visualizers.
- **MetaMask Integration**:
  - Seamless 1-click wallet connection and account switching.
  - Automatic detection and switching to the **Ethereum Sepolia Testnet** (`0xaa36a7` / `11155111`).
  - Real-time ETH and estimated USD conversions.
- **LocalStorage Data Persistence**:
  - All campaigns, user pledges, milestone votes, and custom deployed contract addresses persist in browser `localStorage`.
  - Works out of the box with realistic seed campaigns and simulated Web3 demo mode even before deploying a contract!

---

## 📁 Project Architecture

```
EduFund/
├── index.html                   # Modern responsive dApp dashboard
├── css/
│   └── styles.css               # Glassmorphism, glow effects, progress animations
├── js/
│   ├── contractConfig.js        # Sepolia network parameters & contract ABI
│   ├── storage.js               # LocalStorage persistence & seed campaigns
│   ├── web3Handler.js           # MetaMask & Ethers.js v6 transaction integration
│   └── app.js                   # Application state, modal flows, and UI rendering
├── contracts/
│   ├── EduFund.sol              # Full Solidity smart contract with reentrancy guard
│   └── EduFund.json             # Contract ABI artifact
├── scripts/
│   └── deploy.js                # Node.js Sepolia deployment script
├── hardhat.config.js            # Hardhat developer configuration
├── server.js                    # Lightweight local HTTP server (Zero dependencies)
├── package.json                 # Project configuration
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start (Running Locally)

### Option 1: Using the Built-In Zero-Dependency Server
Run with Node.js:
```bash
node server.js
```
Then open your browser at **`http://localhost:3000`**.

### Option 2: Open Directly
Because EduFund uses CDN-hosted Tailwind CSS and Ethers.js, you can also double-click **`index.html`** or open it in any web browser!

---

## 🦊 Connecting MetaMask to Sepolia Testnet

1. Install the [MetaMask browser extension](https://metamask.io/).
2. In the EduFund header, click **"Connect Wallet"**.
3. If MetaMask is on another network (e.g. Ethereum Mainnet), click the **"Switch"** button on the network pill to automatically add and switch to **Ethereum Sepolia Testnet**:
   - **Network Name**: Sepolia Testnet
   - **Chain ID**: `11155111` (`0xaa36a7`)
   - **Currency**: `ETH`
   - **Explorer**: `https://sepolia.etherscan.io`

### Getting Free Sepolia Testnet ETH
To pledge or create campaigns on-chain, get free Sepolia test ETH from any of these faucets:
- [Google Cloud Web3 Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (Instant, no captcha)
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com)
- [Sepolia PoW Faucet](https://sepolia-faucet.pk910.de)

> 💡 **Demo / Simulation Mode**: Don't have MetaMask or testnet ETH right now? Click the **Settings (gear icon)** at the top right and click **"Enable"** under *Simulated Web3 Demo Wallet*. This lets you test every pledge, milestone vote, creator withdrawal, and refund flow instantly!

---

## 📜 Deploying the Smart Contract (`contracts/EduFund.sol`)

You can deploy `EduFund.sol` to Sepolia in two easy ways:

### Method A: Via Remix Ethereum IDE (Recommended - Fast & No Setup)
1. Open [Remix IDE](https://remix.ethereum.org).
2. Create a new file in the `contracts` folder named `EduFund.sol` and paste the contents of `contracts/EduFund.sol`.
3. In the left sidebar, click the **Solidity Compiler** tab:
   - Select compiler version `0.8.20` or higher.
   - Click **Compile EduFund.sol**.
4. Go to the **Deploy & Run Transactions** tab:
   - In the **Environment** dropdown, select **Injected Provider - MetaMask**.
   - Make sure your MetaMask is connected to **Sepolia**.
   - Click **Deploy** and confirm the transaction in MetaMask.
5. Once deployed, copy the deployed contract address from Remix.
6. Open the EduFund web app, click the **Settings icon** (top right), paste your new contract address into **Deployed Contract Address**, and click **Save Settings**!

### Method B: Via Node.js Script
```bash
# In PowerShell:
$env:PRIVATE_KEY="your_sepolia_wallet_private_key"
node scripts/deploy.js
```

---

## 🧪 Testing the Core Flows

1. **Creating a Campaign**:
   - Click **"Create Campaign"** in the top navbar.
   - Fill in Title, Description, and select a Funding Deadline.
   - Add Milestones with deliverables and ETH allocations (e.g., Phase 1: 1.0 ETH, Phase 2: 1.5 ETH).
   - Click **"Deploy Campaign"** to execute on-chain and sync to `localStorage`.

2. **Backing / Pledging**:
   - Select any active campaign and click **"Back Project"**.
   - Choose a preset (0.05, 0.1, 0.25 ETH) or enter a custom amount.
   - Click **"Confirm Pledge"** to sign the transaction.

3. **Voting to Release Milestones**:
   - Open **"View Milestones"** on a campaign you backed.
   - For an active milestone, click **"Vote to Approve"**.
   - Once votes exceed 50% of total pledged ETH, the milestone automatically unlocks.

4. **Creator Milestone Withdrawal**:
   - When viewing a campaign you created whose milestone was approved, click **"Withdraw X ETH"**.
   - Funds are transferred from the contract escrow directly to the creator's wallet.

5. **Claiming a Refund**:
   - If a campaign passes its deadline without reaching 100% of its funding goal, click **"Claim Refund"** to withdraw all deposited ETH back to your wallet.

---

## 🌐 Deploying to Hosting Services (Vercel, Netlify, GitHub Pages)

Because this dApp is built using static HTML5, Tailwind CSS CDN, and vanilla JavaScript:
- **Vercel**: Run `vercel` or connect your GitHub repository; framework preset is **Other** / Static.
- **Netlify**: Drag and drop the `EduFund` folder into Netlify Drop or run `netlify deploy --prod`.
- **GitHub Pages**: Go to repository **Settings > Pages > Branch: main / root** and click Save.

---

## 📄 License
MIT License. Open source for educational and public good crowdfunding.
