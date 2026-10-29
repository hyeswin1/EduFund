// EduFund Contract & Network Configuration
// Ethereum Sepolia Testnet details and ABI definition

const CONTRACT_CONFIG = {
  // Target Network: Sepolia Testnet
  NETWORK: {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    chainName: 'Sepolia Testnet',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://rpc.sepolia.org',
      'https://1rpc.io/sepolia'
    ],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  },

  // Default contract address (can be updated via UI settings modal and stored in localStorage)
  DEFAULT_ADDRESS: '0x356f913d81b954df6686ce88e897a9f99335a109',

  // ABI for EduFund Contract
  ABI: [
    "function campaignCounter() view returns (uint256)",
    "function campaigns(uint256) view returns (uint256 id, address creator, string title, string description, string imageURI, uint256 goal, uint256 deadline, uint256 totalRaised, uint256 totalWithdrawn, uint256 milestoneCount, bool isCompleted, uint256 backerCount)",
    "function pledges(uint256, address) view returns (uint256)",
    "function createCampaign(string calldata _title, string calldata _description, string calldata _imageURI, uint256 _deadline, string[] calldata _milestoneDescriptions, uint256[] calldata _milestoneAmounts) returns (uint256)",
    "function pledge(uint256 _campaignId) payable",
    "function voteMilestone(uint256 _campaignId, uint256 _milestoneIndex)",
    "function withdrawMilestone(uint256 _campaignId, uint256 _milestoneIndex)",
    "function claimRefund(uint256 _campaignId)",
    "function getMilestones(uint256 _campaignId) view returns (tuple(string description, uint256 targetAmount, bool isApproved, bool isWithdrawn, uint256 votesInFavor)[])",
    "function hasUserVoted(uint256 _campaignId, uint256 _milestoneIndex, address _backer) view returns (bool)",
    "function getCampaign(uint256 _campaignId) view returns (uint256 id, address creator, string title, string description, string imageURI, uint256 goal, uint256 deadline, uint256 totalRaised, uint256 totalWithdrawn, uint256 milestoneCount, bool isCompleted, uint256 backerCount)",
    "function getCampaignsCount() view returns (uint256)",
    "event CampaignCreated(uint256 indexed campaignId, address indexed creator, string title, uint256 goal, uint256 deadline, uint256 milestoneCount)",
    "event PledgeReceived(uint256 indexed campaignId, address indexed backer, uint256 amount, uint256 totalRaised)",
    "event MilestoneVoteCast(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed backer, uint256 votingPower, uint256 totalVotesInFavor)",
    "event MilestoneApproved(uint256 indexed campaignId, uint256 indexed milestoneIndex, uint256 totalVotesInFavor)",
    "event MilestoneFundsWithdrawn(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed creator, uint256 amount)",
    "event RefundClaimed(uint256 indexed campaignId, address indexed backer, uint256 amount)"
  ]
};

// Expose globally
window.CONTRACT_CONFIG = CONTRACT_CONFIG;
