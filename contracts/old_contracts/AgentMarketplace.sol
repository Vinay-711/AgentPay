// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";
import "./AgentWallet.sol";
import "./Reputation.sol";

/// @title AgentMarketplace — service listing, hiring, and job lifecycle
/// @notice Agents list services; other agents hire them, creating jobs that
///         flow through AgentWallet for payment and Reputation for scoring.
contract AgentMarketplace {
    struct Service {
        uint256 agentId;
        string name;
        uint256 price;
        string endpointURI;
        bool active;
    }

    struct Job {
        uint256 requester;
        uint256 worker;
        uint256 serviceId;
        uint256 amount;
        uint8 status; // 0 = pending, 1 = completed, 2 = failed
    }

    AgentRegistry public registry;
    AgentWallet public wallet;
    Reputation public reputation;

    uint256 private _nextServiceId = 1;
    uint256 private _nextJobId = 1;

    mapping(uint256 => Service) public services;
    mapping(uint256 => Job) public jobs;
    uint256 public serviceCount;
    uint256 public jobCount;

    event ServiceListed(
        uint256 indexed serviceId,
        uint256 indexed agentId,
        string name,
        uint256 price
    );
    event JobCreated(
        uint256 indexed jobId,
        uint256 indexed requester,
        uint256 indexed worker,
        uint256 serviceId,
        uint256 amount
    );
    event JobCompleted(uint256 indexed jobId, bool success);

    constructor(
        address _registry,
        address _wallet,
        address _reputation
    ) {
        registry = AgentRegistry(_registry);
        wallet = AgentWallet(_wallet);
        reputation = Reputation(_reputation);
    }

    // ── Service listing ─────────────────────────────────────────────────

    function listService(
        uint256 agentId,
        string memory name,
        uint256 price,
        string memory endpointURI
    ) external returns (uint256) {
        require(
            registry.getAgentOwner(agentId) == msg.sender,
            "Marketplace: not agent owner"
        );
        uint256 serviceId = _nextServiceId++;
        services[serviceId] = Service({
            agentId: agentId,
            name: name,
            price: price,
            endpointURI: endpointURI,
            active: true
        });
        serviceCount++;

        emit ServiceListed(serviceId, agentId, name, price);
        return serviceId;
    }

    // ── Views ───────────────────────────────────────────────────────────

    function getService(uint256 serviceId)
        external
        view
        returns (
            uint256 agentId,
            string memory name,
            uint256 price,
            string memory endpointURI,
            bool active
        )
    {
        Service storage s = services[serviceId];
        require(s.agentId != 0, "Marketplace: service does not exist");
        return (s.agentId, s.name, s.price, s.endpointURI, s.active);
    }

    function getAllServices() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](serviceCount);
        uint256 idx;
        for (uint256 i = 1; i < _nextServiceId; i++) {
            if (services[i].active) {
                ids[idx++] = i;
            }
        }
        // Trim array to actual length
        assembly {
            mstore(ids, idx)
        }
        return ids;
    }

    // ── Hiring ──────────────────────────────────────────────────────────

    /// @notice Hire an agent's service. Creates a Job and triggers payment
    ///         from the requester's wallet to the worker's owner.
    function hireAgent(uint256 requesterAgentId, uint256 serviceId) external {
        require(
            registry.getAgentOwner(requesterAgentId) == msg.sender,
            "Marketplace: not requester agent owner"
        );
        Service storage service = services[serviceId];
        require(service.agentId != 0, "Marketplace: service does not exist");
        require(service.active, "Marketplace: service not active");

        address workerOwner = registry.getAgentOwner(service.agentId);

        uint256 jobId = _nextJobId++;
        jobs[jobId] = Job({
            requester: requesterAgentId,
            worker: service.agentId,
            serviceId: serviceId,
            amount: service.price,
            status: 0
        });
        jobCount++;

        // Pay via AgentWallet (marketplace is authorized caller)
        wallet.requestPayment(
            requesterAgentId,
            workerOwner,
            service.price,
            "Marketplace hire"
        );

        emit JobCreated(
            jobId,
            requesterAgentId,
            service.agentId,
            serviceId,
            service.price
        );
    }

    // ── Job completion ──────────────────────────────────────────────────

    /// @notice Mark a job as completed or failed. Only the worker agent's
    ///         owner may call. Updates reputation accordingly.
    function completeJob(uint256 jobId, bool success) external {
        Job storage job = jobs[jobId];
        require(job.worker != 0, "Marketplace: job does not exist");
        require(job.status == 0, "Marketplace: job already resolved");
        require(
            registry.getAgentOwner(job.worker) == msg.sender,
            "Marketplace: not worker owner"
        );

        if (success) {
            job.status = 1;
            reputation.recordSuccess(job.worker);
        } else {
            job.status = 2;
            reputation.recordFailure(job.worker);
        }

        emit JobCompleted(jobId, success);
    }
}
