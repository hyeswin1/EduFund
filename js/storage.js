/**
 * EduFund Local Storage & Data Persistence Layer
 * Persists campaigns, milestones, contributions, and contract settings across refreshes.
 */

const STORAGE_KEYS = {
  CAMPAIGNS: 'edufund_campaigns_v1',
  USER_PLEDGES: 'edufund_user_pledges_v1',
  USER_VOTES: 'edufund_user_votes_v1',
  CONTRACT_ADDR: 'edufund_contract_address_v1',
  TX_HISTORY: 'edufund_tx_history_v1'
};

const SEED_CAMPAIGNS = [
  {
    id: 1,
    creator: '0x84f1837b794B0e2b46C9E8720B2F2A562D6Bcf39',
    title: 'OpenWeb3 Academy: Free Solidity Auditing Bootcamp for Undergraduates',
    category: 'STEM & Web3',
    description: 'A 12-week intensive, hands-on training program designed to teach university computer science students how to write secure EVM smart contracts, audit zero-day vulnerabilities, and land security analyst roles in the decentralized ecosystem.',
    imageURI: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    goal: 3.5, // ETH
    deadline: Math.floor(Date.now() / 1000) + 14 * 86400, // 14 days from now
    totalRaised: 3.5,
    totalWithdrawn: 1.0,
    backerCount: 28,
    isCompleted: false,
    milestones: [
      {
        id: 0,
        title: 'Curriculum & Live Lab Environment',
        description: 'Complete hands-on curriculum, develop CTF vulnerable contract testbeds, and onboard 3 guest auditing mentors.',
        targetAmount: 1.0,
        isApproved: true,
        isWithdrawn: true,
        votesInFavor: 2.8,
        proofLink: 'https://github.com/example/openweb3-curriculum'
      },
      {
        id: 1,
        title: 'Cohort 1 Bootcamps & Gas Grants',
        description: 'Train 60 accepted students, cover testnet gas allowances and provide student workstation hardware grants.',
        targetAmount: 1.5,
        isApproved: true,
        isWithdrawn: false,
        votesInFavor: 2.2,
        proofLink: 'https://example.com/cohort-1-progress'
      },
      {
        id: 2,
        title: 'Capstone Audit Competition & Placement',
        description: 'Host real-world audit contest with community bounties and connect top graduates with security firms.',
        targetAmount: 1.0,
        isApproved: false,
        isWithdrawn: false,
        votesInFavor: 0.8,
        proofLink: ''
      }
    ]
  },
  {
    id: 2,
    creator: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    title: 'BioVR: Open Source 3D Cellular Biology Labs for Underfunded High Schools',
    category: 'Virtual Reality',
    description: 'Equipping public classrooms with browser-based WebXR cellular simulations. Students can walk inside living cells, interact with mitochondria, and visualize DNA transcription in immersive 3D without expensive lab equipment.',
    imageURI: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80',
    goal: 4.0,
    deadline: Math.floor(Date.now() / 1000) + 22 * 86400,
    totalRaised: 4.25,
    totalWithdrawn: 1.5,
    backerCount: 39,
    isCompleted: false,
    milestones: [
      {
        id: 0,
        title: 'WebXR 3D Cell Engine Prototype',
        description: 'Publish complete 60fps WebGL/WebXR cellular exploration engine compatible with low-spec chromebooks and VR headsets.',
        targetAmount: 1.5,
        isApproved: true,
        isWithdrawn: true,
        votesInFavor: 3.4,
        proofLink: 'https://github.com/example/biovr-engine'
      },
      {
        id: 1,
        title: 'Classroom Pilot with 20 Schools',
        description: 'Roll out pilot curriculum to 20 partner schools, gathering teacher feedback and standardized test impact metrics.',
        targetAmount: 1.5,
        isApproved: false,
        isWithdrawn: false,
        votesInFavor: 1.9,
        proofLink: 'https://example.com/pilot-report-draft'
      },
      {
        id: 2,
        title: 'Open Curriculum & Multilingual Localization',
        description: 'Translate all module voiceovers and documentation into Spanish, French, and Hindi with CC-BY open license.',
        targetAmount: 1.0,
        isApproved: false,
        isWithdrawn: false,
        votesInFavor: 0.0,
        proofLink: ''
      }
    ]
  },
  {
    id: 4,
    creator: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    title: 'Zero-Knowledge Cryptography Research Fellowship for Young Scholars',
    category: 'Research',
    description: 'Providing non-dilutive living stipends and research compute grants for graduate students publishing open-source research on recursive SNARKs and private voting protocols.',
    imageURI: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    goal: 2.0,
    deadline: Math.floor(Date.now() / 1000) - 86400, // Ended yesterday for refund testing!
    totalRaised: 1.1, // Goal was 2.0 ETH, so this is refundable!
    totalWithdrawn: 0.0,
    backerCount: 8,
    isCompleted: false,
    milestones: [
      {
        id: 0,
        title: 'Research Fellowship Selection',
        description: 'Grant allocation for 2 selected cryptographic fellows.',
        targetAmount: 1.0,
        isApproved: false,
        isWithdrawn: false,
        votesInFavor: 0.0,
        proofLink: ''
      },
      {
        id: 1,
        title: 'Open Monograph Publication',
        description: 'Public peer-reviewed paper and Circom library release.',
        targetAmount: 1.0,
        isApproved: false,
        isWithdrawn: false,
        votesInFavor: 0.0,
        proofLink: ''
      }
    ]
  }
];

const EduStorage = {
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.CAMPAIGNS)) {
      this.resetToDefaults();
    } else {
      // Automatically purge SolarCode if previously cached in browser storage
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CAMPAIGNS));
        if (Array.isArray(stored) && stored.some(c => c.id === 3 || (c.title && c.title.toLowerCase().includes('solar')))) {
          const filtered = stored.filter(c => c.id !== 3 && (!c.title || !c.title.toLowerCase().includes('solar')));
          localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(filtered));
        }
      } catch (e) {
        this.resetToDefaults();
      }
    }
  },

  resetToDefaults() {
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(SEED_CAMPAIGNS));
    if (!localStorage.getItem(STORAGE_KEYS.USER_PLEDGES)) {
      // Seed initial dummy pledge so user can immediately test voting & refund
      const initialPledges = {
        "4": { amount: 0.25, timestamp: Date.now() - 172800000, txHash: "0x4a9b...72e1" },
        "1": { amount: 0.5, timestamp: Date.now() - 86400000, txHash: "0x89e2...c31b" }
      };
      localStorage.setItem(STORAGE_KEYS.USER_PLEDGES, JSON.stringify(initialPledges));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USER_VOTES)) {
      localStorage.setItem(STORAGE_KEYS.USER_VOTES, JSON.stringify({}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TX_HISTORY)) {
      localStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify([]));
    }
  },

  getCampaigns() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
      return data ? JSON.parse(data) : SEED_CAMPAIGNS;
    } catch (e) {
      console.error('Error loading campaigns from storage', e);
      return SEED_CAMPAIGNS;
    }
  },

  getCampaign(id) {
    const list = this.getCampaigns();
    return list.find(c => String(c.id) === String(id));
  },

  saveCampaign(campaign) {
    const list = this.getCampaigns();
    const existingIndex = list.findIndex(c => String(c.id) === String(campaign.id));
    if (existingIndex >= 0) {
      list[existingIndex] = campaign;
    } else {
      list.unshift(campaign);
    }
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(list));
    return campaign;
  },

  recordPledge(campaignId, backerAddress, amountEth, txHash = null) {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) return null;

    campaign.totalRaised = parseFloat((campaign.totalRaised + amountEth).toFixed(4));
    campaign.backerCount = (campaign.backerCount || 0) + 1;
    this.saveCampaign(campaign);

    // Record user's personal pledge
    const pledges = this.getUserPledges();
    const cId = String(campaignId);
    if (pledges[cId]) {
      pledges[cId].amount = parseFloat((pledges[cId].amount + amountEth).toFixed(4));
    } else {
      pledges[cId] = {
        amount: amountEth,
        timestamp: Date.now(),
        txHash: txHash || '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('')
      };
    }
    localStorage.setItem(STORAGE_KEYS.USER_PLEDGES, JSON.stringify(pledges));

    // Record transaction log
    this.addTxHistory({
      type: 'Pledge',
      campaignId,
      campaignTitle: campaign.title,
      amount: amountEth,
      txHash: pledges[cId].txHash,
      timestamp: Date.now()
    });

    return campaign;
  },

  recordVote(campaignId, milestoneIndex, backerAddress, votingWeight = 0.5, txHash = null) {
    const campaign = this.getCampaign(campaignId);
    if (!campaign || !campaign.milestones[milestoneIndex]) return null;

    const milestone = campaign.milestones[milestoneIndex];
    milestone.votesInFavor = parseFloat(((milestone.votesInFavor || 0) + votingWeight).toFixed(4));

    // If votes surpass 50% of total raised, milestone is approved!
    if (milestone.votesInFavor > (campaign.totalRaised / 2)) {
      milestone.isApproved = true;
    }

    this.saveCampaign(campaign);

    // Save user's voted state
    const votes = this.getUserVotes();
    const key = `${campaignId}_${milestoneIndex}`;
    votes[key] = {
      voted: true,
      timestamp: Date.now(),
      txHash: txHash || '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('')
    };
    localStorage.setItem(STORAGE_KEYS.USER_VOTES, JSON.stringify(votes));

    this.addTxHistory({
      type: 'Vote Milestone',
      campaignId,
      milestoneIndex,
      campaignTitle: campaign.title,
      txHash: votes[key].txHash,
      timestamp: Date.now()
    });

    return campaign;
  },

  recordWithdrawal(campaignId, milestoneIndex, creatorAddress, txHash = null) {
    const campaign = this.getCampaign(campaignId);
    if (!campaign || !campaign.milestones[milestoneIndex]) return null;

    const milestone = campaign.milestones[milestoneIndex];
    milestone.isWithdrawn = true;
    campaign.totalWithdrawn = parseFloat(((campaign.totalWithdrawn || 0) + milestone.targetAmount).toFixed(4));

    // Check if all milestones are withdrawn
    const allWithdrawn = campaign.milestones.every(m => m.isWithdrawn);
    if (allWithdrawn) {
      campaign.isCompleted = true;
    }

    this.saveCampaign(campaign);

    this.addTxHistory({
      type: 'Milestone Withdrawal',
      campaignId,
      milestoneIndex,
      campaignTitle: campaign.title,
      amount: milestone.targetAmount,
      txHash: txHash || '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(''),
      timestamp: Date.now()
    });

    return campaign;
  },

  recordRefund(campaignId, backerAddress, txHash = null) {
    const pledges = this.getUserPledges();
    const cId = String(campaignId);
    const amount = pledges[cId] ? pledges[cId].amount : 0;
    
    delete pledges[cId];
    localStorage.setItem(STORAGE_KEYS.USER_PLEDGES, JSON.stringify(pledges));

    this.addTxHistory({
      type: 'Refund Claimed',
      campaignId,
      amount,
      txHash: txHash || '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(''),
      timestamp: Date.now()
    });

    return amount;
  },

  getUserPledges() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PLEDGES);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },

  getUserVotes() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_VOTES);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },

  hasUserVoted(campaignId, milestoneIndex) {
    const votes = this.getUserVotes();
    return !!votes[`${campaignId}_${milestoneIndex}`];
  },

  getContractAddress() {
    return localStorage.getItem(STORAGE_KEYS.CONTRACT_ADDR) || window.CONTRACT_CONFIG.DEFAULT_ADDRESS;
  },

  setContractAddress(addr) {
    if (addr && addr.trim()) {
      localStorage.setItem(STORAGE_KEYS.CONTRACT_ADDR, addr.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.CONTRACT_ADDR);
    }
  },

  getTxHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TX_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  addTxHistory(tx) {
    const history = this.getTxHistory();
    history.unshift(tx);
    if (history.length > 50) history.pop();
    localStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify(history));
  }
};

EduStorage.init();
window.EduStorage = EduStorage;
