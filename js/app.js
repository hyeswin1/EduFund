/**
 * EduFund Main Application Controller
 * Handles UI interactions, state management, modals, and contracts.
 */

class EduFundApp {
  constructor() {
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.categoryQuery = 'all';
    this.selectedCampaignId = null;
    this.pledgeAmount = 0.1;
    this.userPledges = {};
    this.userVotes = {};
    this.campaigns = [];
  }

  async init() {
    this.checkFileProtocol();
    this.loadState();
    this.setupEventListeners();
    await window.web3Handler.init();
    this.updateWalletUI();
    this.renderStats();
    this.renderCampaigns();
    this.refreshIcons();
  }

  checkFileProtocol() {
    if (window.location.protocol === 'file:') {
      const banner = document.getElementById('fileProtocolBanner');
      if (banner) banner.classList.remove('hidden');
    }
  }

  loadState() {
    this.campaigns = EduStorage.getCampaigns();
    this.userPledges = EduStorage.getUserPledges();
    this.userVotes = EduStorage.getUserVotes();
  }

  setupEventListeners() {
    // Wallet events
    window.addEventListener('walletConnected', (e) => {
      this.updateWalletUI();
      this.renderCampaigns();
      this.showToast('Wallet Connected', `Connected as ${this.truncateAddress(e.detail.address)}`, 'success');
      if (this.selectedCampaignId) {
        this.openDetailModal(this.selectedCampaignId);
      }
    });

    window.addEventListener('walletDisconnected', () => {
      this.updateWalletUI();
      this.renderCampaigns();
      this.showToast('Wallet Disconnected', 'Logged out of Web3 provider', 'info');
    });

    window.addEventListener('chainChanged', (e) => {
      this.updateWalletUI();
      if (!e.detail.isSepolia) {
        this.showToast('Wrong Network', 'Please switch to Ethereum Sepolia Testnet', 'warning');
      }
    });

    // Wallet connect button
    const connectBtn = document.getElementById('connectWalletBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        try {
          await window.web3Handler.connectWallet();
        } catch (err) {
          console.warn('Wallet connection failed:', err);
          this.showToast('Connection Failed', err.message || 'Could not connect MetaMask', 'error');
          this.openTroubleshootModal();
        }
      });
    }

    // Disconnect button
    const disconnectBtn = document.getElementById('disconnectWalletBtn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        window.web3Handler.disconnect();
        this.toggleUserMenu(false);
      });
    }

    // User menu toggle
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (userMenuBtn) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleUserMenu();
      });
    }
    document.addEventListener('click', () => this.toggleUserMenu(false));

    // Network switch button
    const switchBtn = document.getElementById('switchNetworkBtn');
    if (switchBtn) {
      switchBtn.addEventListener('click', async () => {
        try {
          await window.web3Handler.switchToSepolia();
        } catch (err) {
          this.showToast('Switch Failed', 'Could not switch to Sepolia testnet', 'error');
        }
      });
    }

    // Search and category filters
    const searchInput = document.getElementById('campaignSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCampaigns();
      });
    }

    const catSelect = document.getElementById('categorySelect');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.categoryQuery = e.target.value;
        this.renderCampaigns();
      });
    }

    // Modal triggers
    const openCreateBtn = document.getElementById('openCreateModalBtn');
    if (openCreateBtn) {
      openCreateBtn.addEventListener('click', () => this.openCreateModal());
    }

    const openConfigBtn = document.getElementById('openConfigModalBtn');
    if (openConfigBtn) {
      openConfigBtn.addEventListener('click', () => this.openConfigModal());
    }

    // Custom pledge input listener
    const customPledge = document.getElementById('customPledgeInput');
    if (customPledge) {
      customPledge.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        this.pledgeAmount = val;
        this.updatePledgeUsdDisplay(val);
      });
    }
  }

  toggleUserMenu(forceState) {
    const dropdown = document.getElementById('userMenuDropdown');
    if (!dropdown) return;
    if (typeof forceState === 'boolean') {
      dropdown.classList.toggle('hidden', !forceState);
    } else {
      dropdown.classList.toggle('hidden');
    }
  }

  async updateWalletUI() {
    const connectBtn = document.getElementById('connectWalletBtn');
    const userDropdown = document.getElementById('connectedUserDropdown');
    const userAddressLabel = document.getElementById('userAddressLabel');
    const userBalanceLabel = document.getElementById('userBalanceLabel');
    const networkStatusDot = document.getElementById('networkStatusDot');
    const networkStatusText = document.getElementById('networkStatusText');
    const switchNetworkBtn = document.getElementById('switchNetworkBtn');
    const userMenuNetwork = document.getElementById('userMenuNetwork');

    const address = window.web3Handler.userAddress;
    const isSepolia = window.web3Handler.isSepolia;
    const isSimulated = window.web3Handler.isSimulated;

    if (address) {
      connectBtn.classList.add('hidden');
      userDropdown.classList.remove('hidden');
      userAddressLabel.textContent = this.truncateAddress(address) + (isSimulated ? ' (Demo)' : '');
      const balance = await window.web3Handler.getBalance();
      userBalanceLabel.textContent = balance;

      if (userMenuNetwork) {
        userMenuNetwork.textContent = isSepolia ? 'Sepolia Testnet' : `Chain ID: ${window.web3Handler.chainId}`;
      }
    } else {
      connectBtn.classList.remove('hidden');
      userDropdown.classList.add('hidden');
    }

    // Network status dot & button
    if (isSepolia) {
      networkStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 pulse-indicator';
      networkStatusText.textContent = isSimulated ? 'Sepolia (Simulated)' : 'Sepolia Testnet';
      switchNetworkBtn.classList.add('hidden');
    } else if (address) {
      networkStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
      networkStatusText.textContent = 'Wrong Network';
      switchNetworkBtn.classList.remove('hidden');
    } else {
      networkStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
      networkStatusText.textContent = 'Sepolia Testnet';
      switchNetworkBtn.classList.add('hidden');
    }

    this.refreshIcons();
  }

  renderStats() {
    const campaigns = this.campaigns;
    const totalRaised = campaigns.reduce((acc, c) => acc + (c.totalRaised || 0), 0);
    const activeCount = campaigns.filter(c => Math.floor(Date.now() / 1000) < c.deadline && !c.isCompleted).length;
    
    let verifiedMilestones = 0;
    campaigns.forEach(c => {
      if (c.milestones) {
        c.milestones.forEach(m => {
          if (m.isApproved || m.isWithdrawn) verifiedMilestones++;
        });
      }
    });

    const totalBackers = campaigns.reduce((acc, c) => acc + (c.backerCount || 0), 0);

    const statTotalRaised = document.getElementById('statTotalRaised');
    const statActiveCampaigns = document.getElementById('statActiveCampaigns');
    const statMilestonesApproved = document.getElementById('statMilestonesApproved');
    const statTotalBackers = document.getElementById('statTotalBackers');

    if (statTotalRaised) statTotalRaised.textContent = `${totalRaised.toFixed(2)} ETH`;
    if (statActiveCampaigns) statActiveCampaigns.textContent = activeCount;
    if (statMilestonesApproved) statMilestonesApproved.textContent = verifiedMilestones;
    if (statTotalBackers) statTotalBackers.textContent = totalBackers;
  }

  setFilter(filterKey) {
    this.currentFilter = filterKey;
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.remove('bg-brand-600', 'text-white', 'shadow-sm');
      tab.classList.add('text-slate-400');
    });

    const activeTab = document.getElementById(`filterTab-${filterKey}`);
    if (activeTab) {
      activeTab.classList.remove('text-slate-400');
      activeTab.classList.add('bg-brand-600', 'text-white', 'shadow-sm');
    }

    this.renderCampaigns();
  }

  getFilteredCampaigns() {
    const now = Math.floor(Date.now() / 1000);
    const userAddr = (window.web3Handler.userAddress || '').toLowerCase();
    const pledges = EduStorage.getUserPledges();

    return this.campaigns.filter(c => {
      // Category filter
      if (this.categoryQuery !== 'all' && c.category !== this.categoryQuery) {
        return false;
      }

      // Search filter
      if (this.searchQuery) {
        const titleMatch = (c.title || '').toLowerCase().includes(this.searchQuery);
        const descMatch = (c.description || '').toLowerCase().includes(this.searchQuery);
        const catMatch = (c.category || '').toLowerCase().includes(this.searchQuery);
        if (!titleMatch && !descMatch && !catMatch) return false;
      }

      // Tab filter
      if (this.currentFilter === 'active') {
        return now < c.deadline && c.totalRaised < c.goal && !c.isCompleted;
      } else if (this.currentFilter === 'funded') {
        return c.totalRaised >= c.goal;
      } else if (this.currentFilter === 'backed') {
        return !!pledges[String(c.id)];
      } else if (this.currentFilter === 'my-campaigns') {
        if (!userAddr) return false;
        return (c.creator || '').toLowerCase() === userAddr;
      }

      return true; // 'all'
    });
  }

  renderCampaigns() {
    const grid = document.getElementById('campaignsGrid');
    const emptyState = document.getElementById('emptyCampaignsState');
    if (!grid) return;

    const list = this.getFilteredCampaigns();
    if (list.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    const now = Math.floor(Date.now() / 1000);
    const userPledges = EduStorage.getUserPledges();

    grid.innerHTML = list.map(c => {
      const isExpired = now >= c.deadline;
      const isFunded = c.totalRaised >= c.goal;
      const percentFunded = Math.min(Math.round((c.totalRaised / c.goal) * 100), 100);
      const userPledgedAmount = userPledges[String(c.id)] ? userPledges[String(c.id)].amount : 0;
      
      // Calculate milestone progress
      const totalMilestones = c.milestones ? c.milestones.length : 0;
      const approvedMilestones = c.milestones ? c.milestones.filter(m => m.isApproved || m.isWithdrawn).length : 0;

      // Time remaining
      const timeLeftText = this.formatTimeLeft(c.deadline);

      // Status badge
      let statusBadge = '';
      if (c.isCompleted) {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Completed</span>`;
      } else if (isFunded) {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Goal Reached</span>`;
      } else if (isExpired) {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">Ended (Refundable)</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">Active</span>`;
      }

      // Refund button condition: deadline passed, goal not reached, and user contributed
      const canRefund = isExpired && !isFunded && userPledgedAmount > 0;

      return `
        <div class="glassmorphism-card rounded-3xl overflow-hidden flex flex-col group">
          <!-- Card Image & Category -->
          <div class="relative h-48 w-full overflow-hidden bg-slate-800">
            <img src="${c.imageURI || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80'}" 
                 alt="${this.escapeHtml(c.title)}" 
                 class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
            
            <div class="absolute top-3.5 left-3.5 flex items-center space-x-2">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-700/80">
                ${c.category || 'Education'}
              </span>
            </div>

            <div class="absolute top-3.5 right-3.5">
              ${statusBadge}
            </div>

            <div class="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs text-slate-300">
              <div class="flex items-center space-x-1.5 font-mono">
                <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
                <span title="${c.creator}">${this.truncateAddress(c.creator)}</span>
              </div>
              <div class="flex items-center space-x-1 font-mono text-[11px] bg-slate-900/70 px-2 py-0.5 rounded-md">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-400"></i>
                <span>${timeLeftText}</span>
              </div>
            </div>
          </div>

          <!-- Card Content Body -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <h3 class="text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-brand-300 transition">
                ${this.escapeHtml(c.title)}
              </h3>
              <p class="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                ${this.escapeHtml(c.description)}
              </p>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-white font-mono">${c.totalRaised.toFixed(2)} ETH <span class="text-slate-400 font-normal">raised</span></span>
                <span class="font-bold text-brand-300 font-mono">${percentFunded}%</span>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 transition-all duration-500" 
                     style="width: ${percentFunded}%"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>Goal: <strong class="text-slate-200 font-mono">${c.goal.toFixed(2)} ETH</strong></span>
                <span>${c.backerCount || 0} Backers</span>
              </div>
            </div>

            <!-- Milestone Tracker Pill -->
            <div class="p-2.5 rounded-xl bg-surface-900/80 border border-slate-800/80 flex items-center justify-between text-xs">
              <div class="flex items-center space-x-2">
                <i data-lucide="flag" class="w-4 h-4 text-brand-400"></i>
                <span class="text-slate-300 font-medium">Milestones</span>
              </div>
              <span class="font-mono text-[11px] px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-300 font-bold border border-brand-500/20">
                ${approvedMilestones} / ${totalMilestones} Verified
              </span>
            </div>

            ${userPledgedAmount > 0 ? `
              <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                <span>You backed: <strong class="font-mono">${userPledgedAmount} ETH</strong></span>
                <span class="text-[10px] uppercase font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">Voter</span>
              </div>
            ` : ''}

            <!-- Action Buttons -->
            <div class="pt-2 flex items-center gap-2">
              <button onclick="app.openDetailModal(${c.id})" class="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition">
                View Milestones
              </button>

              ${canRefund ? `
                <button onclick="app.executeRefund(${c.id})" class="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition flex items-center space-x-1">
                  <i data-lucide="undo" class="w-3.5 h-3.5"></i>
                  <span>Refund</span>
                </button>
              ` : `
                <button onclick="app.openPledgeModal(${c.id})" 
                        ${isExpired || c.isCompleted ? 'disabled class="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-500 text-xs font-semibold cursor-not-allowed"' : 'class="py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white transition shadow-sm active:scale-95"'}>
                  Back Project
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.refreshIcons();
  }

  // --- Campaign Detail & Milestone Modal ---

  openDetailModal(campaignId) {
    this.selectedCampaignId = campaignId;
    const campaign = EduStorage.getCampaign(campaignId);
    if (!campaign) return;

    const modal = document.getElementById('campaignDetailModal');
    const container = document.getElementById('campaignDetailContent');
    const now = Math.floor(Date.now() / 1000);
    const isExpired = now >= campaign.deadline;
    const isFunded = campaign.totalRaised >= campaign.goal;
    const percent = Math.min(Math.round((campaign.totalRaised / campaign.goal) * 100), 100);

    const userAddr = (window.web3Handler.userAddress || '').toLowerCase();
    const isCreator = userAddr && (campaign.creator || '').toLowerCase() === userAddr;
    const userPledges = EduStorage.getUserPledges();
    const userPledgeAmount = userPledges[String(campaign.id)] ? userPledges[String(campaign.id)].amount : 0;
    const userVotes = EduStorage.getUserVotes();

    container.innerHTML = `
      <!-- Modal Header -->
      <div class="space-y-4">
        <div class="flex items-center space-x-2 text-xs font-semibold text-brand-400 uppercase tracking-wider">
          <span>${campaign.category || 'Education'}</span>
          <span>•</span>
          <span>Campaign #${campaign.id}</span>
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
          ${this.escapeHtml(campaign.title)}
        </h2>
        
        <!-- Creator & Meta Row -->
        <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <div class="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1 rounded-xl">
            <span>Creator:</span>
            <span class="font-mono text-slate-200 font-semibold">${this.truncateAddress(campaign.creator)}</span>
            ${isCreator ? '<span class="bg-brand-500/20 text-brand-300 font-bold px-1.5 py-0.5 rounded text-[10px]">YOU</span>' : ''}
          </div>
          <div class="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1 rounded-xl">
            <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-400"></i>
            <span>${this.formatTimeLeft(campaign.deadline)}</span>
          </div>
          <div class="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1 rounded-xl">
            <i data-lucide="users" class="w-3.5 h-3.5 text-purple-400"></i>
            <span>${campaign.backerCount || 0} Backers</span>
          </div>
        </div>
      </div>

      <!-- Cover Image & Progress -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div class="md:col-span-2 rounded-2xl overflow-hidden bg-slate-800 max-h-72">
          <img src="${campaign.imageURI}" alt="" class="w-full h-full object-cover">
        </div>

        <!-- Funding Summary Box -->
        <div class="p-6 rounded-2xl bg-surface-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div class="space-y-3">
            <div>
              <span class="text-xs text-slate-400">Total Raised</span>
              <div class="text-3xl font-extrabold text-white font-mono mt-0.5">${campaign.totalRaised.toFixed(2)} ETH</div>
              <div class="text-xs text-slate-400">of ${campaign.goal.toFixed(2)} ETH goal (${percent}%)</div>
            </div>

            <div class="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500" style="width: ${percent}%"></div>
            </div>

            <div class="text-xs text-slate-400 space-y-1 pt-1">
              <div class="flex justify-between">
                <span>Withdrawn by Creator:</span>
                <span class="font-mono text-slate-300">${(campaign.totalWithdrawn || 0).toFixed(2)} ETH</span>
              </div>
              <div class="flex justify-between">
                <span>Remaining in Escrow:</span>
                <span class="font-mono text-emerald-400">${Math.max(0, campaign.totalRaised - (campaign.totalWithdrawn || 0)).toFixed(2)} ETH</span>
              </div>
            </div>
          </div>

          <div class="pt-2">
            ${userPledgeAmount > 0 ? `
              <div class="mb-3 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300">
                You backed this project with <strong class="font-mono">${userPledgeAmount} ETH</strong>. You are eligible to vote on milestones below!
              </div>
            ` : ''}

            <button onclick="app.closeDetailModal(); app.openPledgeModal(${campaign.id})" 
                    ${isExpired || campaign.isCompleted ? 'disabled class="w-full py-3 rounded-xl bg-slate-800 text-slate-500 text-xs font-bold cursor-not-allowed"' : 'class="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:opacity-90 text-white font-bold text-xs shadow-md transition"'}>
              Back This Campaign
            </button>
          </div>
        </div>
      </div>

      <!-- Description Section -->
      <div class="space-y-2 border-t border-slate-800 pt-5">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider">About The Project</h3>
        <p class="text-sm text-slate-300 leading-relaxed whitespace-pre-line">${this.escapeHtml(campaign.description)}</p>
      </div>

      <!-- Milestones Timeline & Voting Section -->
      <div class="space-y-4 border-t border-slate-800 pt-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-white">Milestone Roadmap & Payouts</h3>
            <p class="text-xs text-slate-400">Backers vote to verify completion. Only approved tranches can be withdrawn.</p>
          </div>
          <span class="text-xs font-mono text-brand-300 font-bold bg-brand-500/10 px-3 py-1 rounded-lg border border-brand-500/20">
            ${campaign.milestones ? campaign.milestones.length : 0} Total Phases
          </span>
        </div>

        <!-- Milestone Cards List -->
        <div class="space-y-4">
          ${(campaign.milestones || []).map((m, idx) => {
            const hasVoted = userVotes[`${campaign.id}_${idx}`] && userVotes[`${campaign.id}_${idx}`].voted;
            const threshold = campaign.totalRaised > 0 ? (campaign.totalRaised / 2) : 0;
            const votesInFavor = m.votesInFavor || 0;
            const votePercent = threshold > 0 ? Math.min(Math.round((votesInFavor / threshold) * 100), 100) : 0;

            let badgeHtml = '';
            let actionBtnHtml = '';

            if (m.isWithdrawn) {
              badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center space-x-1">
                <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
                <span>Paid Out to Creator</span>
              </span>`;
            } else if (m.isApproved) {
              badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Approved by Backers</span>
              </span>`;
              if (isCreator && isFunded) {
                actionBtnHtml = `
                  <button onclick="app.executeWithdrawal(${campaign.id}, ${idx})" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-md">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    <span>Withdraw ${m.targetAmount} ETH</span>
                  </button>
                `;
              }
            } else {
              badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                <i data-lucide="hourglass" class="w-3.5 h-3.5"></i>
                <span>Voting in Progress</span>
              </span>`;

              if (userPledgeAmount > 0 && !hasVoted) {
                actionBtnHtml = `
                  <button onclick="app.executeVote(${campaign.id}, ${idx})" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-md">
                    <i data-lucide="thumbs-up" class="w-3.5 h-3.5"></i>
                    <span>Vote to Approve</span>
                  </button>
                `;
              } else if (hasVoted) {
                actionBtnHtml = `
                  <span class="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                    <span>You Voted Yes</span>
                  </span>
                `;
              } else {
                actionBtnHtml = `
                  <span class="text-xs text-slate-500">Backers only</span>
                `;
              }
            }

            return `
              <div class="p-5 rounded-2xl bg-surface-900 border border-slate-800 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center text-xs">
                      #${idx + 1}
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-white">${this.escapeHtml(m.title || `Milestone Phase ${idx + 1}`)}</h4>
                      <div class="text-xs text-brand-300 font-mono font-semibold">${m.targetAmount} ETH tranche</div>
                    </div>
                  </div>
                  <div>
                    ${badgeHtml}
                  </div>
                </div>

                <p class="text-xs text-slate-300 leading-relaxed">${this.escapeHtml(m.description)}</p>

                <!-- Voting Progress Bar -->
                ${!m.isApproved && !m.isWithdrawn ? `
                  <div class="space-y-1 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                    <div class="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Approval Consensus: <strong class="text-white font-mono">${votesInFavor.toFixed(2)} ETH</strong> of ${threshold.toFixed(2)} ETH required</span>
                      <span class="font-mono font-bold text-brand-400">${votePercent}%</span>
                    </div>
                    <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div class="h-full rounded-full bg-brand-500" style="width: ${votePercent}%"></div>
                    </div>
                  </div>
                ` : ''}

                <div class="flex items-center justify-between pt-1">
                  ${m.proofLink ? `
                    <a href="${m.proofLink}" target="_blank" class="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1 underline">
                      <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                      <span>View Milestone Deliverable Proof</span>
                    </a>
                  ` : '<span></span>'}
                  <div>
                    ${actionBtnHtml}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  closeDetailModal() {
    const modal = document.getElementById('campaignDetailModal');
    if (modal) modal.classList.add('hidden');
    this.selectedCampaignId = null;
  }

  // --- Campaign Creation Modal & Logic ---

  openCreateModal() {
    const modal = document.getElementById('createCampaignModal');
    if (!modal) return;
    
    // Set default deadline 14 days ahead
    const deadlineInput = document.getElementById('campDeadline');
    if (deadlineInput) {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      deadlineInput.value = d.toISOString().slice(0, 16);
    }

    // Initialize with 2 default milestones
    const container = document.getElementById('milestonesInputContainer');
    if (container && container.children.length === 0) {
      this.addMilestoneInput('Phase 1: Architecture & Prototype', 'Complete technical core prototype and smart contract testing', 1.0);
      this.addMilestoneInput('Phase 2: Public Release & Student Grants', 'Deploy production build and distribute educational workstation grants', 1.5);
    }

    this.recalculateGoal();
    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  closeCreateModal() {
    const modal = document.getElementById('createCampaignModal');
    if (modal) modal.classList.add('hidden');
  }

  addMilestoneInput(defaultTitle = '', defaultDesc = '', defaultAmt = 1.0) {
    const container = document.getElementById('milestonesInputContainer');
    if (!container) return;

    const count = container.children.length + 1;
    const item = document.createElement('div');
    item.className = 'milestone-input-row p-4 rounded-2xl bg-surface-900 border border-slate-800 space-y-2.5 relative';
    item.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-brand-400 font-mono">Milestone #${count}</span>
        ${count > 1 ? `
          <button type="button" onclick="this.closest('.milestone-input-row').remove(); app.recalculateGoal();" class="text-xs text-red-400 hover:text-red-300">
            Remove
          </button>
        ` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="sm:col-span-2">
          <input type="text" placeholder="Milestone Title (e.g. Prototype)" value="${defaultTitle}" required
                 class="milestone-title-input w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500">
        </div>
        <div>
          <div class="relative">
            <input type="number" step="0.01" min="0.01" placeholder="Amount" value="${defaultAmt}" required oninput="app.recalculateGoal()"
                   class="milestone-amount-input w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-brand-500">
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 font-bold">ETH</span>
          </div>
        </div>
      </div>
      <div>
        <textarea rows="2" placeholder="Specific deliverables to unlock this tranche..." required
                  class="milestone-desc-input w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500">${defaultDesc}</textarea>
      </div>
    `;

    container.appendChild(item);
    this.recalculateGoal();
    this.refreshIcons();
  }

  recalculateGoal() {
    const amountInputs = document.querySelectorAll('.milestone-amount-input');
    let sum = 0;
    amountInputs.forEach(input => {
      const val = parseFloat(input.value) || 0;
      sum += val;
    });

    const display = document.getElementById('calculatedGoalDisplay');
    if (display) {
      display.textContent = `${sum.toFixed(2)} ETH`;
    }
    return sum;
  }

  setSampleImage(index) {
    const urls = [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80'
    ];
    const input = document.getElementById('campImageURI');
    if (input && urls[index - 1]) {
      input.value = urls[index - 1];
    }
  }

  async handleCreateCampaign(e) {
    e.preventDefault();
    const title = document.getElementById('campTitle').value.trim();
    const category = document.getElementById('campCategory').value;
    const description = document.getElementById('campDescription').value.trim();
    const imageURI = document.getElementById('campImageURI').value.trim();
    const deadlineVal = document.getElementById('campDeadline').value;

    if (!title || !description || !deadlineVal) {
      this.showToast('Validation Error', 'Please complete all required fields', 'error');
      return;
    }

    const deadlineTimestamp = Math.floor(new Date(deadlineVal).getTime() / 1000);
    if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
      this.showToast('Invalid Deadline', 'Deadline must be in the future', 'error');
      return;
    }

    // Collect milestones
    const rows = document.querySelectorAll('.milestone-input-row');
    const milestoneTitles = [];
    const milestoneDescriptions = [];
    const milestoneAmounts = [];

    rows.forEach(row => {
      const t = row.querySelector('.milestone-title-input').value.trim();
      const d = row.querySelector('.milestone-desc-input').value.trim();
      const a = parseFloat(row.querySelector('.milestone-amount-input').value) || 0;
      if (t && a > 0) {
        milestoneTitles.push(t);
        milestoneDescriptions.push(d || t);
        milestoneAmounts.push(a);
      }
    });

    if (milestoneAmounts.length === 0) {
      this.showToast('Milestones Required', 'Add at least one valid project milestone', 'error');
      return;
    }

    const totalGoal = milestoneAmounts.reduce((a, b) => a + b, 0);

    const submitBtn = document.getElementById('submitCampaignBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="animate-spin inline-block mr-2">⚙</span> Deploying...`;

    try {
      // Execute via Web3 Handler (MetaMask or simulated)
      const result = await window.web3Handler.createCampaign(
        title,
        description,
        imageURI,
        deadlineTimestamp,
        milestoneDescriptions,
        milestoneAmounts
      );

      // Save to local storage for persistence across refreshes
      const newCampaign = {
        id: Date.now(),
        creator: window.web3Handler.userAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        title,
        category,
        description,
        imageURI: imageURI || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        goal: totalGoal,
        deadline: deadlineTimestamp,
        totalRaised: 0,
        totalWithdrawn: 0,
        backerCount: 0,
        isCompleted: false,
        milestones: milestoneDescriptions.map((desc, i) => ({
          id: i,
          title: milestoneTitles[i] || `Phase ${i + 1}`,
          description: desc,
          targetAmount: milestoneAmounts[i],
          isApproved: false,
          isWithdrawn: false,
          votesInFavor: 0,
          proofLink: ''
        }))
      };

      EduStorage.saveCampaign(newCampaign);
      this.loadState();
      this.renderStats();
      this.renderCampaigns();
      this.closeCreateModal();

      this.showToast('Campaign Deployed!', `Created "${title}" successfully. Tx: ${this.truncateAddress(result.txHash)}`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast('Deployment Failed', err.message || 'Transaction was rejected', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="upload" class="w-4 h-4"></i><span>Deploy Campaign</span>`;
      this.refreshIcons();
    }
  }

  // --- Pledge Flow ---

  openPledgeModal(campaignId) {
    this.selectedCampaignId = campaignId;
    const campaign = EduStorage.getCampaign(campaignId);
    if (!campaign) return;

    document.getElementById('pledgeTargetTitle').textContent = campaign.title;
    document.getElementById('pledgeTargetGoal').textContent = `${campaign.goal.toFixed(2)} ETH`;
    document.getElementById('pledgeTargetImage').src = campaign.imageURI;

    this.setPledgeAmount(0.1);

    const modal = document.getElementById('pledgeModal');
    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  closePledgeModal() {
    const modal = document.getElementById('pledgeModal');
    if (modal) modal.classList.add('hidden');
  }

  setPledgeAmount(amount) {
    this.pledgeAmount = amount;
    const input = document.getElementById('customPledgeInput');
    if (input) input.value = amount;
    this.updatePledgeUsdDisplay(amount);

    document.querySelectorAll('.pledge-chip').forEach(btn => {
      if (parseFloat(btn.textContent) === amount) {
        btn.classList.add('bg-brand-600', 'text-white', 'border-brand-500');
        btn.classList.remove('bg-slate-800', 'text-slate-200');
      } else {
        btn.classList.remove('bg-brand-600', 'text-white', 'border-brand-500');
        btn.classList.add('bg-slate-800', 'text-slate-200');
      }
    });
  }

  updatePledgeUsdDisplay(ethAmount) {
    const span = document.getElementById('pledgeUsdEstimate');
    if (span) {
      const usd = (ethAmount * window.web3Handler.ethPriceUsd).toFixed(2);
      span.textContent = usd;
    }
  }

  async executePledge() {
    if (!this.selectedCampaignId) return;
    const amount = parseFloat(document.getElementById('customPledgeInput').value);
    if (!amount || amount <= 0) {
      this.showToast('Invalid Amount', 'Please specify a valid ETH pledge', 'error');
      return;
    }

    // Auto connect wallet if not yet connected
    if (!window.web3Handler.userAddress) {
      try {
        await window.web3Handler.connectWallet();
      } catch (err) {
        // Fall back to simulation
        window.web3Handler.enableSimulatedWallet();
      }
    }

    const btn = document.getElementById('confirmPledgeBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-2">⚙</span> Confirming on Blockchain...`;

    try {
      const result = await window.web3Handler.pledge(this.selectedCampaignId, amount);

      // Persist in localStorage
      EduStorage.recordPledge(
        this.selectedCampaignId,
        window.web3Handler.userAddress,
        amount,
        result.txHash
      );

      this.loadState();
      this.renderStats();
      this.renderCampaigns();
      this.closePledgeModal();

      this.showToast('Pledge Confirmed!', `Successfully pledged ${amount} ETH. Tx: ${this.truncateAddress(result.txHash)}`, 'success');

      if (this.selectedCampaignId) {
        this.openDetailModal(this.selectedCampaignId);
      }
    } catch (err) {
      console.error(err);
      this.showToast('Pledge Failed', err.message || 'Transaction was canceled', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Confirm Pledge</span>`;
      this.refreshIcons();
    }
  }

  // --- Voting & Withdrawal Actions ---

  async executeVote(campaignId, milestoneIndex) {
    if (!window.web3Handler.userAddress) {
      try {
        await window.web3Handler.connectWallet();
      } catch (e) {
        window.web3Handler.enableSimulatedWallet();
      }
    }

    try {
      this.showToast('Signing Vote...', 'Submitting milestone verification vote to Ethereum network', 'info');
      const result = await window.web3Handler.voteMilestone(campaignId, milestoneIndex);

      // Record in storage
      const userPledges = EduStorage.getUserPledges();
      const weight = userPledges[String(campaignId)] ? userPledges[String(campaignId)].amount : 0.5;

      EduStorage.recordVote(campaignId, milestoneIndex, window.web3Handler.userAddress, weight, result.txHash);
      this.loadState();
      this.renderStats();
      this.renderCampaigns();
      this.openDetailModal(campaignId);

      this.showToast('Vote Recorded!', `Milestone #${milestoneIndex + 1} vote registered on-chain`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast('Vote Failed', err.message || 'Failed to submit vote', 'error');
    }
  }

  async executeWithdrawal(campaignId, milestoneIndex) {
    if (!window.web3Handler.userAddress) {
      this.showToast('Wallet Required', 'Connect creator wallet to withdraw funds', 'error');
      return;
    }

    try {
      this.showToast('Processing Payout...', 'Submitting safe milestone withdrawal transaction', 'info');
      const result = await window.web3Handler.withdrawMilestone(campaignId, milestoneIndex);

      EduStorage.recordWithdrawal(campaignId, milestoneIndex, window.web3Handler.userAddress, result.txHash);
      this.loadState();
      this.renderStats();
      this.renderCampaigns();
      this.openDetailModal(campaignId);

      this.showToast('Funds Released!', `Milestone payout transferred to creator wallet. Tx: ${this.truncateAddress(result.txHash)}`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast('Withdrawal Failed', err.message || 'Could not withdraw milestone', 'error');
    }
  }

  async executeRefund(campaignId) {
    if (!window.web3Handler.userAddress) {
      try {
        await window.web3Handler.connectWallet();
      } catch (e) {
        window.web3Handler.enableSimulatedWallet();
      }
    }

    try {
      this.showToast('Processing Refund...', 'Claiming 100% refund from contract escrow', 'info');
      const result = await window.web3Handler.claimRefund(campaignId);

      const refundAmount = EduStorage.recordRefund(campaignId, window.web3Handler.userAddress, result.txHash);
      this.loadState();
      this.renderStats();
      this.renderCampaigns();

      this.showToast('Refund Claimed!', `Refund of ${refundAmount} ETH returned to your wallet. Tx: ${this.truncateAddress(result.txHash)}`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast('Refund Failed', err.message || 'Could not claim refund', 'error');
    }
  }

  // --- Contract Settings Modal ---

  openConfigModal() {
    const modal = document.getElementById('configModal');
    const input = document.getElementById('configContractAddress');
    if (input) {
      input.value = EduStorage.getContractAddress();
    }
    const btn = document.getElementById('toggleSimulatedBtn');
    if (btn) {
      btn.textContent = window.web3Handler.isSimulated ? 'Disable' : 'Enable';
    }
    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  closeConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) modal.classList.add('hidden');
  }

  saveContractConfig() {
    const input = document.getElementById('configContractAddress');
    if (input) {
      EduStorage.setContractAddress(input.value.trim());
      window.web3Handler.initContract();
      this.showToast('Settings Saved', 'Updated contract configuration', 'success');
      this.closeConfigModal();
    }
  }

  toggleSimulatedWallet() {
    if (window.web3Handler.isSimulated) {
      window.web3Handler.disconnect();
    } else {
      window.web3Handler.enableSimulatedWallet();
    }
    this.closeConfigModal();
  }

  // --- MetaMask Troubleshooting Modal ---

  openTroubleshootModal() {
    const modal = document.getElementById('troubleshootModal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  closeTroubleshootModal() {
    const modal = document.getElementById('troubleshootModal');
    if (modal) modal.classList.add('hidden');
  }

  async retryConnectWallet() {
    try {
      await window.web3Handler.connectWallet();
      this.closeTroubleshootModal();
    } catch (err) {
      this.showToast('Connection Failed', err.message || 'MetaMask still not detected', 'error');
    }
  }

  resetDemoData() {
    if (confirm('Are you sure you want to reset all stored campaigns and pledge history to default?')) {
      EduStorage.resetToDefaults();
      this.loadState();
      this.renderStats();
      this.renderCampaigns();
      this.closeConfigModal();
      this.showToast('Reset Complete', 'Local storage data restored to demo defaults', 'info');
    }
  }

  // --- Utilities ---

  scrollToCampaigns() {
    const el = document.getElementById('campaignsSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  truncateAddress(addr) {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  }

  formatTimeLeft(deadlineTimestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = deadlineTimestamp - now;
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h left`;
    const mins = Math.floor((diff % 3600) / 60);
    return `${hours}h ${mins}m left`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const colors = {
      success: 'border-emerald-500/50 bg-slate-900/95 text-emerald-400',
      error: 'border-red-500/50 bg-slate-900/95 text-red-400',
      warning: 'border-amber-500/50 bg-slate-900/95 text-amber-400',
      info: 'border-brand-500/50 bg-slate-900/95 text-brand-400'
    };

    const icons = {
      success: 'check-circle-2',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-start space-x-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md max-w-sm transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || icons.info}" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
      <div class="flex-1 overflow-hidden">
        <h4 class="text-xs font-bold text-white">${this.escapeHtml(title)}</h4>
        <p class="text-[11px] text-slate-300 mt-0.5 leading-snug">${this.escapeHtml(message)}</p>
      </div>
      <button onclick="this.closest('div').remove()" class="text-slate-400 hover:text-white">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;

    container.appendChild(toast);
    this.refreshIcons();

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
}

// Instantiate and initialize globally
window.app = new EduFundApp();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
