// Quick sanity verification script
const fs = require('fs');
const path = require('path');

const solContent = fs.readFileSync(path.join(__dirname, 'contracts/EduFund.sol'), 'utf8');
const jsonArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts/EduFund.json'), 'utf8'));
const contractConfig = fs.readFileSync(path.join(__dirname, 'js/contractConfig.js'), 'utf8');

console.log('--- Verification Checks ---');
console.log('1. Solidity contract size:', solContent.length, 'bytes');

const expectedFunctions = [
  'createCampaign',
  'pledge',
  'voteMilestone',
  'withdrawMilestone',
  'claimRefund',
  'getMilestones',
  'hasUserVoted',
  'getCampaign',
  'getCampaignsCount'
];

let allPassed = true;
expectedFunctions.forEach(fn => {
  const inSol = solContent.includes(`function ${fn}`);
  const inAbi = jsonArtifact.abi.some(item => item.name === fn);
  const inConfig = contractConfig.includes(`function ${fn}`);

  if (inSol && inAbi && inConfig) {
    console.log(`✓ Function ${fn}: verified in Solidity, ABI JSON, and js/contractConfig.js`);
  } else {
    console.error(`✗ Function ${fn}: mismatch (Sol: ${inSol}, ABI: ${inAbi}, Config: ${inConfig})`);
    allPassed = false;
  }
});

const expectedEvents = [
  'CampaignCreated',
  'PledgeReceived',
  'MilestoneVoteCast',
  'MilestoneApproved',
  'MilestoneFundsWithdrawn',
  'RefundClaimed'
];

expectedEvents.forEach(evt => {
  const inSol = solContent.includes(`event ${evt}`);
  const inAbi = jsonArtifact.abi.some(item => item.name === evt);
  const inConfig = contractConfig.includes(`event ${evt}`);

  if (inSol && inAbi && inConfig) {
    console.log(`✓ Event ${evt}: verified in Solidity, ABI JSON, and js/contractConfig.js`);
  } else {
    console.error(`✗ Event ${evt}: mismatch (Sol: ${inSol}, ABI: ${inAbi}, Config: ${inConfig})`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log('\n🎉 ALL CONTRACT INTERFACE CHECKS PASSED!');
} else {
  process.exit(1);
}
