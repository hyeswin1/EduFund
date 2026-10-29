/**
 * Sepolia Deployment Script for EduFund Smart Contract
 * 
 * Usage:
 *   1. Set your PRIVATE_KEY and SEPOLIA_RPC_URL environment variables or update below.
 *   2. Run: node scripts/deploy.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error('❌ Please set your PRIVATE_KEY environment variable.');
    console.log('Example in PowerShell:');
    console.log('  $env:PRIVATE_KEY = "your_private_key_here"');
    console.log('  node scripts/deploy.js');
    console.log('\nAlternatively, deploy using Remix IDE (https://remix.ethereum.org) in 1 minute!');
    process.exit(1);
  }

  console.log('🚀 Connecting to Sepolia RPC:', rpcUrl);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('👤 Deployer Address:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Deployer Balance:', ethers.formatEther(balance), 'SepoliaETH');

  if (balance === 0n) {
    console.error('❌ Insufficient balance. Get free Sepolia ETH at: https://cloud.google.com/application/web3/faucet/ethereum/sepolia');
    process.exit(1);
  }

  const artifactPath = path.join(__dirname, '../contracts/EduFund.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  console.log('📦 Deploying EduFund contract...');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode || '0x', wallet);
  
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log('\n🎉 EduFund Contract Deployed Successfully!');
  console.log('==========================================');
  console.log('📍 Contract Address:', deployedAddress);
  console.log('🔗 Sepolia Etherscan: https://sepolia.etherscan.io/address/' + deployedAddress);
  console.log('==========================================');
  console.log('\n👉 Copy this address and paste it into the Settings modal in the EduFund web app!');
}

main().catch((error) => {
  console.error('Deployment error:', error);
  process.exit(1);
});
