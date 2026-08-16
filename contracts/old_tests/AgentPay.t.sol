// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/AgentWallet.sol";
import "../src/Reputation.sol";
import "../src/AgentMarketplace.sol";

contract AgentPayTest is Test {
    AgentRegistry registry;
    AgentWallet wallet;
    Reputation reputation;
    AgentMarketplace marketplace;

    address owner1 = makeAddr("owner1");
    address owner2 = makeAddr("owner2");
    address recipient = makeAddr("recipient");

    function setUp() public {
        // Deploy contracts (test contract = deployer/owner)
        registry = new AgentRegistry();
        wallet = new AgentWallet(address(registry));
        reputation = new Reputation(address(registry));
        marketplace = new AgentMarketplace(
            address(registry),
            address(wallet),
            address(reputation)
        );

        // Wire cross-contract references
        registry.setReputationContract(address(reputation));
        reputation.setMarketplace(address(marketplace));
        wallet.setMarketplace(address(marketplace));

        // Fund test accounts
        vm.deal(owner1, 100 ether);
        vm.deal(owner2, 100 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  1. Agent Registration
    // ═══════════════════════════════════════════════════════════════════

    function test_registerAgent() public {
        string[] memory caps = new string[](2);
        caps[0] = "data-analysis";
        caps[1] = "code-review";

        vm.prank(owner1);
        uint256 agentId = registry.registerAgent("ipfs://agent1", caps);
        assertEq(agentId, 1);

        (
            address agentOwner,
            string memory uri,
            string[] memory capabilities,
            uint256 score,
            bool active
        ) = registry.getAgent(agentId);

        assertEq(agentOwner, owner1);
        assertEq(uri, "ipfs://agent1");
        assertEq(capabilities.length, 2);
        assertEq(capabilities[0], "data-analysis");
        assertEq(score, 50); // default
        assertTrue(active);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  2. Deposit
    // ═══════════════════════════════════════════════════════════════════

    function test_deposit() public {
        uint256 agentId = _registerAgent(owner1, "ipfs://a1");

        vm.prank(owner1);
        wallet.deposit{value: 5 ether}(agentId);

        assertEq(wallet.getBalance(agentId), 5 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  3. Payment under per-tx limit succeeds
    // ═══════════════════════════════════════════════════════════════════

    function test_paymentUnderPerTxLimit() public {
        uint256 agentId = _registerAgent(owner1, "ipfs://a1");
        _fundAndSetLimits(agentId, owner1, 10 ether, 5 ether, 2 ether);

        uint256 recipientBefore = recipient.balance;

        vm.prank(owner1);
        wallet.requestPayment(agentId, recipient, 0.5 ether, "test payment");

        assertEq(recipient.balance - recipientBefore, 0.5 ether);
        assertEq(wallet.getBalance(agentId), 9.5 ether);
        assertEq(wallet.spentToday(agentId), 0.5 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  4. Payment over per-tx limit reverts
    // ═══════════════════════════════════════════════════════════════════

    function test_paymentOverPerTxLimit_reverts() public {
        uint256 agentId = _registerAgent(owner1, "ipfs://a1");
        // perTxLimit = 1 ether
        _fundAndSetLimits(agentId, owner1, 10 ether, 1 ether, 5 ether);

        vm.prank(owner1);
        vm.expectRevert("AgentWallet: exceeds per-tx limit");
        wallet.requestPayment(agentId, recipient, 2 ether, "too large");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  5. Payment over daily limit reverts
    // ═══════════════════════════════════════════════════════════════════

    function test_paymentOverDailyLimit_reverts() public {
        uint256 agentId = _registerAgent(owner1, "ipfs://a1");
        // dailyLimit = 2 ether, perTxLimit = 5 ether
        _fundAndSetLimits(agentId, owner1, 2 ether, 5 ether, 10 ether);

        // First payment — 1.5 ether (OK)
        vm.prank(owner1);
        wallet.requestPayment(agentId, recipient, 1.5 ether, "first");

        // Second payment — 1 ether (1.5 + 1 = 2.5 > dailyLimit of 2)
        vm.prank(owner1);
        vm.expectRevert("AgentWallet: exceeds daily limit");
        wallet.requestPayment(agentId, recipient, 1 ether, "second");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  6. Payment over approval threshold → pending → approveAndSend
    // ═══════════════════════════════════════════════════════════════════

    function test_paymentOverApprovalThreshold_requiresApproval() public {
        uint256 agentId = _registerAgent(owner1, "ipfs://a1");
        // approvalThreshold = 0.5 ether, perTxLimit = 5 ether, dailyLimit = 10 ether
        _fundAndSetLimits(agentId, owner1, 10 ether, 5 ether, 0.5 ether);

        uint256 recipientBefore = recipient.balance;

        // 1 ether > 0.5 ether threshold → should NOT transfer
        vm.prank(owner1);
        wallet.requestPayment(agentId, recipient, 1 ether, "needs approval");

        // Funds not yet sent
        assertEq(recipient.balance, recipientBefore);
        // Balance still held in wallet
        assertEq(wallet.getBalance(agentId), 10 ether);

        // Now owner approves request #1
        vm.prank(owner1);
        wallet.approveAndSend(1);

        // Funds sent
        assertEq(recipient.balance - recipientBefore, 1 ether);
        assertEq(wallet.getBalance(agentId), 9 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  7. Frozen agent cannot requestPayment
    // ═══════════════════════════════════════════════════════════════════

    function test_frozenAgent_reverts() public {
        uint256 agentId = _registerAgent(owner1, "ipfs://a1");
        _fundAndSetLimits(agentId, owner1, 10 ether, 5 ether, 10 ether);

        vm.prank(owner1);
        wallet.emergencyFreeze(agentId);

        vm.prank(owner1);
        vm.expectRevert("AgentWallet: agent is frozen");
        wallet.requestPayment(agentId, recipient, 0.1 ether, "frozen");

        // Unfreeze restores functionality
        vm.prank(owner1);
        wallet.unfreeze(agentId);

        vm.prank(owner1);
        wallet.requestPayment(agentId, recipient, 0.1 ether, "unfrozen");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  8. Full hireAgent → completeJob → reputation update
    // ═══════════════════════════════════════════════════════════════════

    function test_fullHireCompleteReputationFlow() public {
        // ── Setup agents ────────────────────────────────────────────
        uint256 requesterAgent = _registerAgent(owner1, "ipfs://requester");
        uint256 workerAgent = _registerAgent(owner2, "ipfs://worker");

        // Fund requester wallet and set limits
        _fundAndSetLimits(requesterAgent, owner1, 10 ether, 5 ether, 10 ether);

        // Worker lists a service for 1 ETH
        vm.prank(owner2);
        uint256 serviceId = marketplace.listService(
            workerAgent,
            "Code Review",
            1 ether,
            "https://api.worker.com/review"
        );
        assertEq(serviceId, 1);

        // ── Hire ────────────────────────────────────────────────────
        uint256 owner2BalBefore = owner2.balance;

        vm.prank(owner1);
        marketplace.hireAgent(requesterAgent, serviceId);

        // Payment should have gone to owner2 (worker's owner)
        assertEq(owner2.balance - owner2BalBefore, 1 ether);
        assertEq(wallet.getBalance(requesterAgent), 9 ether);

        // Job recorded
        assertEq(marketplace.jobCount(), 1);

        // ── Complete job (success) ──────────────────────────────────
        vm.prank(owner2);
        marketplace.completeJob(1, true);

        // Reputation updated: 1 success, 0 failures → score = 100
        assertEq(reputation.jobsCompleted(workerAgent), 1);
        assertEq(reputation.computeScore(workerAgent), 100);

        // Registry score also updated
        (, , , uint256 regScore, ) = registry.getAgent(workerAgent);
        assertEq(regScore, 100);

        // ── Second hire + failure ───────────────────────────────────
        vm.prank(owner1);
        marketplace.hireAgent(requesterAgent, serviceId);

        vm.prank(owner2);
        marketplace.completeJob(2, false);

        // 1 success + 1 failure → score = 50
        assertEq(reputation.computeScore(workerAgent), 50);
        (, , , uint256 regScore2, ) = registry.getAgent(workerAgent);
        assertEq(regScore2, 50);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  9. Withdraw
    // ═══════════════════════════════════════════════════════════════════

    function test_withdraw() public {
        uint256 agentId = _registerAgent(owner1, "ipfs://a1");

        vm.prank(owner1);
        wallet.deposit{value: 5 ether}(agentId);

        uint256 ownerBalBefore = owner1.balance;

        vm.prank(owner1);
        wallet.withdraw(agentId, 3 ether);

        assertEq(owner1.balance - ownerBalBefore, 3 ether);
        assertEq(wallet.getBalance(agentId), 2 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════════════

    function _registerAgent(address agentOwner, string memory uri)
        internal
        returns (uint256)
    {
        string[] memory caps = new string[](1);
        caps[0] = "general";
        vm.prank(agentOwner);
        return registry.registerAgent(uri, caps);
    }

    /// @dev Deposits `deposit` ETH and sets limits (dailyLimit, perTxLimit,
    ///      approvalThreshold) for the given agent.
    function _fundAndSetLimits(
        uint256 agentId,
        address agentOwner,
        uint256 dailyLimit,
        uint256 perTxLimit,
        uint256 approvalThreshold
    ) internal {
        vm.prank(agentOwner);
        wallet.deposit{value: 10 ether}(agentId);

        vm.prank(agentOwner);
        wallet.setLimits(agentId, dailyLimit, perTxLimit, approvalThreshold);
    }
}
