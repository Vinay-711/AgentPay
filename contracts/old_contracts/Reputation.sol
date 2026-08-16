// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";

/// @title Reputation — tracks agent job outcomes and computes scores
/// @notice Maintains per-agent success/failure counts and pushes a 0–100
///         score to AgentRegistry after every update.
contract Reputation {
    AgentRegistry public registry;
    address public owner;
    address public marketplaceContract;

    mapping(uint256 => uint256) public jobsCompleted;
    mapping(uint256 => uint256) public jobsFailed;

    event SuccessRecorded(uint256 indexed agentId, uint256 newScore);
    event FailureRecorded(uint256 indexed agentId, uint256 newScore);

    modifier onlyOwner() {
        require(msg.sender == owner, "Reputation: not owner");
        _;
    }

    modifier onlyMarketplace() {
        require(msg.sender == marketplaceContract, "Reputation: only marketplace");
        _;
    }

    constructor(address _registry) {
        registry = AgentRegistry(_registry);
        owner = msg.sender;
    }

    function setMarketplace(address _marketplace) external onlyOwner {
        marketplaceContract = _marketplace;
    }

    // ── Record outcomes (only callable by Marketplace) ──────────────────

    function recordSuccess(uint256 agentId) external onlyMarketplace {
        jobsCompleted[agentId]++;
        uint256 score = computeScore(agentId);
        registry.updateReputation(agentId, score);
        emit SuccessRecorded(agentId, score);
    }

    function recordFailure(uint256 agentId) external onlyMarketplace {
        jobsFailed[agentId]++;
        uint256 score = computeScore(agentId);
        registry.updateReputation(agentId, score);
        emit FailureRecorded(agentId, score);
    }

    // ── Score computation ───────────────────────────────────────────────

    /// @notice Compute a 0–100 reputation score for an agent.
    /// @dev Returns 50 for agents with zero jobs (default).
    function computeScore(uint256 agentId) public view returns (uint256) {
        uint256 completed = jobsCompleted[agentId];
        uint256 failed = jobsFailed[agentId];
        uint256 total = completed + failed;
        if (total == 0) return 50;
        return (completed * 100) / total;
    }
}
