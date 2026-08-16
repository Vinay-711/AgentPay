// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentWallet
 * @notice Minimal AI Agent Wallet on Monad testnet.
 * Stores balances in USD cents (1000 = $10.00) and sends real Monad value transfers on pay().
 */
contract AgentWallet {
    struct Agent {
        uint256 balance;     // Stored in USD-cents (1000 = $10.00)
        uint256 spent;       // Stored in USD-cents
        uint8 reputation;    // Starting at 94
        bool exists;
    }

    mapping(address => Agent) public agents;

    event AgentCreated(address indexed owner, uint256 balance, uint8 reputation);
    event PaymentExecuted(address indexed from, address indexed to, uint256 amountCents, uint256 valueWei, string label);
    event ReputationBumped(address indexed owner, uint8 oldScore, uint8 newScore);

    // Allow contract to receive funds for autonomous agent payouts
    receive() external payable {}

    /**
     * @notice Register msg.sender as an agent with $10.00 starting balance and 94 reputation.
     */
    function createAgent() external payable {
        agents[msg.sender] = Agent({
            balance: 1000,   // $10.00 (1000 cents)
            spent: 0,
            reputation: 94,
            exists: true
        });

        emit AgentCreated(msg.sender, 1000, 94);
    }

    /**
     * @notice Autonomous payment from agent to service provider.
     * Decrements USD balance and sends a real on-chain Monad native transfer.
     */
    function pay(address payable to, uint256 amountCents, string memory label) external returns (bool) {
        Agent storage agent = agents[msg.sender];
        require(agent.exists, "Agent does not exist");
        require(agent.balance >= amountCents, "Insufficient balance");

        agent.balance -= amountCents;
        agent.spent += amountCents;

        // Real Monad testnet native transfer: 1 cent = 0.0001 MON (1e14 wei)
        uint256 weiToSend = amountCents * 1e14;
        if (address(this).balance >= weiToSend && weiToSend > 0) {
            (bool success, ) = to.call{value: weiToSend}("");
            require(success, "Native transfer failed");
        }

        emit PaymentExecuted(msg.sender, to, amountCents, weiToSend, label);
        return true;
    }

    /**
     * @notice Get agent wallet data (balance, spent, reputation).
     */
    function getAgent(address owner) external view returns (uint256 balance, uint256 spent, uint8 reputation, bool exists) {
        Agent memory agent = agents[owner];
        return (agent.balance, agent.spent, agent.reputation, agent.exists);
    }

    /**
     * @notice Bump agent reputation score upon successful multi-step task execution.
     */
    function bumpReputation(address owner, uint8 newScore) external {
        Agent storage agent = agents[owner];
        require(agent.exists, "Agent does not exist");
        uint8 oldScore = agent.reputation;
        agent.reputation = newScore;
        emit ReputationBumped(owner, oldScore, newScore);
    }
}
