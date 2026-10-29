/**
 * EduFund Web3 & MetaMask Integration Layer
 * Integrates ethers.js v6, handles Sepolia network switching, EIP-6963 provider discovery,
 * multi-wallet conflict resolution, and file:// protocol warnings.
 */

class Web3Handler {
  constructor() {
    this.rawProvider = null; // The underlying window.ethereum or EIP-6963 provider
    this.provider = null;    // ethers.BrowserProvider
    this.signer = null;
    this.contract = null;
    this.userAddress = null;
    this.chainId = null;
    this.isSepolia = false;
    this.isSimulated = false; // Fallback demo wallet mode
    this.ethPriceUsd = 2650;  // Approximated USD price for ETH conversion
    this.eip6963Providers = [];
  }

  async init() {
    this.setupEIP6963();
    this.setupListeners();

    // Give injected wallets up to 1000ms to announce or inject
    const detected = await this.detectProvider(1000);
    if (detected) {
      try {
        const accounts = await detected.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          await this.connectWallet();
        }
      } catch (err) {
        console.warn('Silent connect failed:', err);
      }
    }
  }

  setupEIP6963() {
    // Modern Ethereum standard (EIP-6963) for multi-wallet discovery
    window.addEventListener('eip6963:announceProvider', (event) => {
      if (event.detail && event.detail.provider) {
        this.eip6963Providers.push(event.detail);
        if (event.detail.info && event.detail.info.rdns === 'io.metamask') {
          this.rawProvider = event.detail.provider;
        }
      }
    });
    // Request providers to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  /**
   * Robustly detects MetaMask or compatible Ethereum provider
   * Handles EIP-6963, window.ethereum, window.ethereum.providers, and async injection delays
   */
  async detectProvider(timeoutMs = 1200) {
    // 1. Check if already found via EIP-6963
    const metamaskAnnounced = this.eip6963Providers.find(p => p.info && (p.info.rdns === 'io.metamask' || p.info.name.toLowerCase().includes('metamask')));
    if (metamaskAnnounced) {
      this.rawProvider = metamaskAnnounced.provider;
      return this.rawProvider;
    }

    // 2. Check window.ethereum
    if (typeof window.ethereum !== 'undefined') {
      if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
        // Multi-wallet extension installed
        const mm = window.ethereum.providers.find(p => p.isMetaMask);
        this.rawProvider = mm || window.ethereum.providers[0];
        return this.rawProvider;
      }
      this.rawProvider = window.ethereum;
      return this.rawProvider;
    }

    // 3. Wait for injection if page just loaded
    return new Promise((resolve) => {
      let resolved = false;

      const onInitialized = () => {
        if (!resolved && typeof window.ethereum !== 'undefined') {
          resolved = true;
          this.rawProvider = window.ethereum;
          resolve(this.rawProvider);
        }
      };

      window.addEventListener('ethereum#initialized', onInitialized, { once: true });

      // Polling fallback
      const start = Date.now();
      const interval = setInterval(() => {
        if (typeof window.ethereum !== 'undefined') {
          clearInterval(interval);
          if (!resolved) {
            resolved = true;
            this.rawProvider = window.ethereum;
            resolve(this.rawProvider);
          }
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }
      }, 100);
    });
  }

  setupListeners() {
    const p = this.rawProvider || (typeof window.ethereum !== 'undefined' ? window.ethereum : null);
    if (p && typeof p.on === 'function') {
      p.on('accountsChanged', (accounts) => {
        if (!accounts || accounts.length === 0) {
          this.disconnect();
        } else {
          this.userAddress = accounts[0];
          window.dispatchEvent(new CustomEvent('walletChanged', { detail: { address: this.userAddress } }));
        }
      });

      p.on('chainChanged', (chainIdHex) => {
        const chainId = parseInt(chainIdHex, 16);
        this.chainId = chainId;
        this.isSepolia = (chainId === CONTRACT_CONFIG.NETWORK.chainId);
        window.dispatchEvent(new CustomEvent('chainChanged', { detail: { chainId, isSepolia: this.isSepolia } }));
      });
    }
  }

  async connectWallet() {
    const raw = await this.detectProvider(1000);
    
    if (!raw) {
      const isFileProtocol = window.location.protocol === 'file:';
      let errMessage = '';
      if (isFileProtocol) {
        errMessage = 'Chrome & Brave block MetaMask on local file:// pages by default. Please run via http://localhost:3000 or enable "Allow access to file URLs" in Chrome Extensions > MetaMask > Details.';
      } else {
        errMessage = 'MetaMask was not detected. Please unlock MetaMask, reload the page, or use Simulated Demo Wallet.';
      }
      const error = new Error(errMessage);
      error.isFileProtocol = isFileProtocol;
      throw error;
    }

    this.rawProvider = raw;
    this.setupListeners();

    try {
      // Initialize ethers BrowserProvider (v6)
      this.provider = new ethers.BrowserProvider(this.rawProvider);
      
      // Request accounts
      const accounts = await this.rawProvider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected in MetaMask');
      }

      this.userAddress = accounts[0];
      this.signer = await this.provider.getSigner();

      // Check Network
      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);
      this.isSepolia = (this.chainId === CONTRACT_CONFIG.NETWORK.chainId);

      if (!this.isSepolia) {
        // Prompt to switch
        try {
          await this.switchToSepolia();
        } catch (switchErr) {
          console.warn('Network switch rejected or pending:', switchErr);
        }
      }

      this.initContract();
      this.isSimulated = false;

      window.dispatchEvent(new CustomEvent('walletConnected', {
        detail: {
          address: this.userAddress,
          chainId: this.chainId,
          isSepolia: this.isSepolia
        }
      }));

      return this.userAddress;
    } catch (err) {
      console.error('Wallet connection error:', err);
      throw err;
    }
  }

  enableSimulatedWallet() {
    this.isSimulated = true;
    this.userAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
    this.chainId = CONTRACT_CONFIG.NETWORK.chainId;
    this.isSepolia = true;
    window.dispatchEvent(new CustomEvent('walletConnected', {
      detail: {
        address: this.userAddress,
        chainId: this.chainId,
        isSepolia: true,
        simulated: true
      }
    }));
    return this.userAddress;
  }

  disconnect() {
    this.userAddress = null;
    this.signer = null;
    this.contract = null;
    this.isSimulated = false;
    window.dispatchEvent(new CustomEvent('walletDisconnected'));
  }

  async switchToSepolia() {
    const raw = this.rawProvider || window.ethereum;
    if (!raw) return false;
    const target = CONTRACT_CONFIG.NETWORK;

    try {
      await raw.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: target.chainIdHex }],
      });
      this.isSepolia = true;
      return true;
    } catch (switchError) {
      // 4902 error code means the chain hasn't been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await raw.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: target.chainIdHex,
                chainName: target.chainName,
                rpcUrls: target.rpcUrls,
                nativeCurrency: target.nativeCurrency,
                blockExplorerUrls: target.blockExplorerUrls,
              },
            ],
          });
          this.isSepolia = true;
          return true;
        } catch (addError) {
          console.error('Failed to add Sepolia testnet to MetaMask:', addError);
          throw addError;
        }
      }
      throw switchError;
    }
  }

  initContract() {
    const address = EduStorage.getContractAddress();
    if (!address || !ethers.isAddress(address)) return;

    if (this.signer) {
      this.contract = new ethers.Contract(address, CONTRACT_CONFIG.ABI, this.signer);
    } else if (this.provider) {
      this.contract = new ethers.Contract(address, CONTRACT_CONFIG.ABI, this.provider);
    }
  }

  async getBalance() {
    if (this.isSimulated) return '3.428';
    if (!this.provider || !this.userAddress) return '0';
    try {
      const balanceWei = await this.provider.getBalance(this.userAddress);
      return parseFloat(ethers.formatEther(balanceWei)).toFixed(4);
    } catch (e) {
      console.warn('Failed to fetch balance', e);
      return '0';
    }
  }

  // --- Blockchain Operations ---

  async createCampaign(title, description, imageURI, deadlineTimestamp, milestoneDescriptions, milestoneAmountsEth) {
    if (this.isSimulated || !this.contract || !this.signer) {
      const mockTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      return { txHash: mockTxHash, simulated: true };
    }

    const milestoneAmountsWei = milestoneAmountsEth.map(amt => ethers.parseEther(amt.toString()));
    const tx = await this.contract.createCampaign(
      title,
      description,
      imageURI,
      deadlineTimestamp,
      milestoneDescriptions,
      milestoneAmountsWei
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash, receipt };
  }

  async pledge(campaignId, amountEth) {
    if (this.isSimulated || !this.contract || !this.signer) {
      const mockTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      return { txHash: mockTxHash, simulated: true };
    }

    const valueWei = ethers.parseEther(amountEth.toString());
    const tx = await this.contract.pledge(campaignId, { value: valueWei });
    const receipt = await tx.wait();
    return { txHash: receipt.hash, receipt };
  }

  async voteMilestone(campaignId, milestoneIndex) {
    if (this.isSimulated || !this.contract || !this.signer) {
      const mockTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      return { txHash: mockTxHash, simulated: true };
    }

    const tx = await this.contract.voteMilestone(campaignId, milestoneIndex);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, receipt };
  }

  async withdrawMilestone(campaignId, milestoneIndex) {
    if (this.isSimulated || !this.contract || !this.signer) {
      const mockTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      return { txHash: mockTxHash, simulated: true };
    }

    const tx = await this.contract.withdrawMilestone(campaignId, milestoneIndex);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, receipt };
  }

  async claimRefund(campaignId) {
    if (this.isSimulated || !this.contract || !this.signer) {
      const mockTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      return { txHash: mockTxHash, simulated: true };
    }

    const tx = await this.contract.claimRefund(campaignId);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, receipt };
  }
}

window.web3Handler = new Web3Handler();
