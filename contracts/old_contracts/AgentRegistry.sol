// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentRegistry — on-chain registry of AI agents
/// @notice Stores agent metadata, capabilities, and reputation scores.
contract AgentRegistry {
    struct Agent {
        address owner;
        string metadataURI;
        string[] capabilities;
        uint256 reputationScore;
        bool active;
    }

    uint256 private _nextAgentId = 1;
    mapping(uint256 => Agent) private _agents;
    mapping(address => uint256[]) private _ownerToAgents;

    address public owner;
    address public reputationContract;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
    event ReputationUpdated(uint256 indexed agentId, uint256 newScore);

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentRegistry: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── Registration ────────────────────────────────────────────────────

    /// @notice Register a new agent.
    /// @return agentId The newly assigned agent ID.
    function registerAgent(
        string memory metadataURI,
        string[] memory capabilities
    ) external returns (uint256) {
        uint256 agentId = _nextAgentId++;
        Agent storage agent = _agents[agentId];
        agent.owner = msg.sender;
        agent.metadataURI = metadataURI;
        agent.capabilities = capabilities;
        agent.reputationScore = 50; // default score for new agents
        agent.active = true;

        _ownerToAgents[msg.sender].push(agentId);

        emit AgentRegistered(agentId, msg.sender, metadataURI);
        return agentId;
    }

    // ── Views ───────────────────────────────────────────────────────────

    function getAgent(uint256 agentId)
        external
        view
        returns (
            address agentOwner,
            string memory metadataURI,
            string[] memory capabilities,
            uint256 reputationScore,
            bool active
        )
    {
        Agent storage a = _agents[agentId];
        require(a.owner != address(0), "AgentRegistry: agent does not exist");
        return (a.owner, a.metadataURI, a.capabilities, a.reputationScore, a.active);
    }

    function getAgentOwner(uint256 agentId) external view returns (address) {
        require(_agents[agentId].owner != address(0), "AgentRegistry: agent does not exist");
        return _agents[agentId].owner;
    }

    function getAgentsByOwner(address agentOwner) external view returns (uint256[] memory) {
        return _ownerToAgents[agentOwner];
    }

    // ── Reputation (only callable by Reputation contract) ───────────────

    function updateReputation(uint256 agentId, uint256 newScore) external {
        require(msg.sender == reputationContract, "AgentRegistry: only reputation contract");
        require(_agents[agentId].owner != address(0), "AgentRegistry: agent does not exist");
        _agents[agentId].reputationScore = newScore;
        emit ReputationUpdated(agentId, newScore);
    }

    function setReputationContract(address _reputationContract) external onlyOwner {
        reputationContract = _reputationContract;
    }
}
