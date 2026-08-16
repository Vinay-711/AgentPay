// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/AgentWallet.sol";
import "../src/Reputation.sol";
import "../src/AgentMarketplace.sol";

/// @notice Deploys all four AgentPay contracts and wires cross-contract refs.
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy AgentRegistry (no deps)
        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry:", address(registry));

        // 2. Deploy AgentWallet (needs registry)
        AgentWallet wallet = new AgentWallet(address(registry));
        console.log("AgentWallet:", address(wallet));

        // 3. Deploy Reputation (needs registry)
        Reputation reputation = new Reputation(address(registry));
        console.log("Reputation:", address(reputation));

        // 4. Deploy AgentMarketplace (needs registry, wallet, reputation)
        AgentMarketplace marketplace = new AgentMarketplace(
            address(registry),
            address(wallet),
            address(reputation)
        );
        console.log("AgentMarketplace:", address(marketplace));

        // 5. Wire cross-contract references
        registry.setReputationContract(address(reputation));
        reputation.setMarketplace(address(marketplace));
        wallet.setMarketplace(address(marketplace));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment complete ===");
        console.log("AgentRegistry:     ", address(registry));
        console.log("AgentWallet:       ", address(wallet));
        console.log("Reputation:        ", address(reputation));
        console.log("AgentMarketplace:  ", address(marketplace));
    }
}
