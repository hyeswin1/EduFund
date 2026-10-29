// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EduFund - Decentralized Milestone-Based Crowdfunding Platform
 * @notice Allows creators to launch educational & impact fundraising campaigns with milestone releases
 *         Backers pledge ETH securely; creators can only withdraw funds after milestone approval.
 *         Includes a 100% automatic refund guarantee if the campaign goal is not met by the deadline.
 */
contract EduFund {
    // --- Custom Errors for Gas Efficiency ---
    error InvalidDeadline();
    error InvalidMilestones();
    error ZeroPledge();
    error CampaignEnded();
    error CampaignStillActive();
    error CampaignNotFound();
    error MilestoneNotFound();
    error MilestoneAlreadyApproved();
    error MilestoneAlreadyWithdrawn();
    error MilestoneNotApproved();
    error GoalNotMet();
    error OnlyCreator();
    error OnlyBacker();
    error AlreadyVoted();
    error TransferFailed();
    error NoPledgeToRefund();

    // --- Events ---
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        string title,
        uint256 goal,
        uint256 deadline,
        uint256 milestoneCount
    );

    event PledgeReceived(
        uint256 indexed campaignId,
        address indexed backer,
        uint256 amount,
        uint256 totalRaised
    );

    event MilestoneVoteCast(
        uint256 indexed campaignId,
        uint256 indexed milestoneIndex,
        address indexed backer,
        uint256 votingPower,
        uint256 totalVotesInFavor
    );

    event MilestoneApproved(
        uint256 indexed campaignId,
        uint256 indexed milestoneIndex,
        uint256 totalVotesInFavor
    );

    event MilestoneFundsWithdrawn(
        uint256 indexed campaignId,
        uint256 indexed milestoneIndex,
        address indexed creator,
        uint256 amount
    );

    event RefundClaimed(
        uint256 indexed campaignId,
        address indexed backer,
        uint256 amount
    );

    // --- Structs ---
    struct Milestone {
        string description;
        uint256 targetAmount; // Amount in Wei allocated to this milestone
        bool isApproved;      // Approved by backer consensus (> 50% of pledged ETH)
        bool isWithdrawn;     // Funds withdrawn by creator
        uint256 votesInFavor; // Total pledged Wei voting in favor of milestone release
    }

    struct Campaign {
        uint256 id;
        address payable creator;
        string title;
        string description;
        string imageURI;
        uint256 goal;            // Total goal in Wei (sum of milestone target amounts)
        uint256 deadline;        // Unix timestamp
        uint256 totalRaised;     // Total Wei pledged by backers
        uint256 totalWithdrawn;  // Total Wei withdrawn by creator so far
        uint256 milestoneCount;  // Total number of milestones
        bool isCompleted;        // Marked completed when all milestones withdrawn
        uint256 backerCount;     // Total number of unique contributors
    }

    // --- State Variables ---
    uint256 public campaignCounter;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone[]) private _campaignMilestones;
    mapping(uint256 => mapping(address => uint256)) public pledges;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVotedMilestone;
    mapping(uint256 => mapping(address => bool)) private _isBacker;

    // --- Reentrancy Guard ---
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @notice Create a new fundraising campaign with milestone-based payout schedule
     * @param _title Title of the campaign
     * @param _description Detailed summary or IPFS URI
     * @param _imageURI Cover image or logo URL
     * @param _deadline Unix timestamp when campaign pledges close
     * @param _milestoneDescriptions Array of descriptions for each project milestone
     * @param _milestoneAmounts Array of Wei amounts for each milestone (sum equals total goal)
     */
    function createCampaign(
        string calldata _title,
        string calldata _description,
        string calldata _imageURI,
        uint256 _deadline,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestoneAmounts
    ) external returns (uint256) {
        if (_deadline <= block.timestamp) revert InvalidDeadline();
        uint256 count = _milestoneDescriptions.length;
        if (count == 0 || count != _milestoneAmounts.length) revert InvalidMilestones();

        uint256 totalGoal = 0;
        for (uint256 i = 0; i < count; i++) {
            if (_milestoneAmounts[i] == 0) revert InvalidMilestones();
            totalGoal += _milestoneAmounts[i];
        }

        uint256 campaignId = ++campaignCounter;

        Campaign storage newCampaign = campaigns[campaignId];
        newCampaign.id = campaignId;
        newCampaign.creator = payable(msg.sender);
        newCampaign.title = _title;
        newCampaign.description = _description;
        newCampaign.imageURI = _imageURI;
        newCampaign.goal = totalGoal;
        newCampaign.deadline = _deadline;
        newCampaign.totalRaised = 0;
        newCampaign.totalWithdrawn = 0;
        newCampaign.milestoneCount = count;
        newCampaign.isCompleted = false;
        newCampaign.backerCount = 0;

        for (uint256 i = 0; i < count; i++) {
            _campaignMilestones[campaignId].push(Milestone({
                description: _milestoneDescriptions[i],
                targetAmount: _milestoneAmounts[i],
                isApproved: false,
                isWithdrawn: false,
                votesInFavor: 0
            }));
        }

        emit CampaignCreated(
            campaignId,
            msg.sender,
            _title,
            totalGoal,
            _deadline,
            count
        );

        return campaignId;
    }

    /**
     * @notice Pledge ETH towards a specific campaign
     * @param _campaignId ID of the campaign to back
     */
    function pledge(uint256 _campaignId) external payable nonReentrant {
        if (msg.value == 0) revert ZeroPledge();
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.id == 0) revert CampaignNotFound();
        if (block.timestamp >= campaign.deadline) revert CampaignEnded();

        if (!_isBacker[_campaignId][msg.sender]) {
            _isBacker[_campaignId][msg.sender] = true;
            campaign.backerCount++;
        }

        pledges[_campaignId][msg.sender] += msg.value;
        campaign.totalRaised += msg.value;

        emit PledgeReceived(_campaignId, msg.sender, msg.value, campaign.totalRaised);
    }

    /**
     * @notice Backers vote to approve the completion of a milestone
     *         Voting power is weighted by the amount of ETH the backer pledged.
     *         When votes exceed 50% of total pledged ETH, the milestone is approved.
     * @param _campaignId ID of the campaign
     * @param _milestoneIndex Index of the milestone (0-indexed)
     */
    function voteMilestone(uint256 _campaignId, uint256 _milestoneIndex) external {
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.id == 0) revert CampaignNotFound();
        if (_milestoneIndex >= campaign.milestoneCount) revert MilestoneNotFound();

        uint256 backerPledge = pledges[_campaignId][msg.sender];
        if (backerPledge == 0) revert OnlyBacker();

        if (hasVotedMilestone[_campaignId][_milestoneIndex][msg.sender]) revert AlreadyVoted();

        Milestone storage milestone = _campaignMilestones[_campaignId][_milestoneIndex];
        if (milestone.isApproved) revert MilestoneAlreadyApproved();

        hasVotedMilestone[_campaignId][_milestoneIndex][msg.sender] = true;
        milestone.votesInFavor += backerPledge;

        emit MilestoneVoteCast(
            _campaignId,
            _milestoneIndex,
            msg.sender,
            backerPledge,
            milestone.votesInFavor
        );

        // Check if consensus (> 50% of total pledged ETH) is reached
        if (milestone.votesInFavor * 2 > campaign.totalRaised) {
            milestone.isApproved = true;
            emit MilestoneApproved(_campaignId, _milestoneIndex, milestone.votesInFavor);
        }
    }

    /**
     * @notice Creator withdraws funds allocated to an approved milestone
     *         Requires campaign goal to be achieved and milestone to be approved by backers.
     * @param _campaignId ID of the campaign
     * @param _milestoneIndex Index of the milestone to withdraw
     */
    function withdrawMilestone(uint256 _campaignId, uint256 _milestoneIndex) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.id == 0) revert CampaignNotFound();
        if (msg.sender != campaign.creator) revert OnlyCreator();
        if (campaign.totalRaised < campaign.goal) revert GoalNotMet();
        if (_milestoneIndex >= campaign.milestoneCount) revert MilestoneNotFound();

        Milestone storage milestone = _campaignMilestones[_campaignId][_milestoneIndex];
        if (!milestone.isApproved) revert MilestoneNotApproved();
        if (milestone.isWithdrawn) revert MilestoneAlreadyWithdrawn();

        uint256 amount = milestone.targetAmount;
        milestone.isWithdrawn = true;
        campaign.totalWithdrawn += amount;

        // Check if all milestones have been withdrawn
        if (campaign.totalWithdrawn >= campaign.goal) {
            campaign.isCompleted = true;
        }

        // Safe external transfer
        (bool success, ) = campaign.creator.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit MilestoneFundsWithdrawn(_campaignId, _milestoneIndex, campaign.creator, amount);
    }

    /**
     * @notice Claim a 100% refund if the campaign deadline has passed and the goal was NOT reached
     * @param _campaignId ID of the campaign to claim refund from
     */
    function claimRefund(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.id == 0) revert CampaignNotFound();
        if (block.timestamp < campaign.deadline) revert CampaignStillActive();
        if (campaign.totalRaised >= campaign.goal) revert GoalNotMet(); // Goal met, no refund

        uint256 pledgedAmount = pledges[_campaignId][msg.sender];
        if (pledgedAmount == 0) revert NoPledgeToRefund();

        // Check-effects-interactions
        pledges[_campaignId][msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: pledgedAmount}("");
        if (!success) revert TransferFailed();

        emit RefundClaimed(_campaignId, msg.sender, pledgedAmount);
    }

    // --- View Functions ---

    /**
     * @notice Get all milestones for a campaign
     * @param _campaignId ID of the campaign
     */
    function getMilestones(uint256 _campaignId) external view returns (Milestone[] memory) {
        return _campaignMilestones[_campaignId];
    }

    /**
     * @notice Check if backer has voted for a specific milestone
     */
    function hasUserVoted(
        uint256 _campaignId,
        uint256 _milestoneIndex,
        address _backer
    ) external view returns (bool) {
        return hasVotedMilestone[_campaignId][_milestoneIndex][_backer];
    }

    /**
     * @notice Get campaign summary details
     */
    function getCampaign(uint256 _campaignId) external view returns (
        uint256 id,
        address creator,
        string memory title,
        string memory description,
        string memory imageURI,
        uint256 goal,
        uint256 deadline,
        uint256 totalRaised,
        uint256 totalWithdrawn,
        uint256 milestoneCount,
        bool isCompleted,
        uint256 backerCount
    ) {
        Campaign storage c = campaigns[_campaignId];
        return (
            c.id,
            c.creator,
            c.title,
            c.description,
            c.imageURI,
            c.goal,
            c.deadline,
            c.totalRaised,
            c.totalWithdrawn,
            c.milestoneCount,
            c.isCompleted,
            c.backerCount
        );
    }

    /**
     * @notice Total number of campaigns created
     */
    function getCampaignsCount() external view returns (uint256) {
        return campaignCounter;
    }
}
