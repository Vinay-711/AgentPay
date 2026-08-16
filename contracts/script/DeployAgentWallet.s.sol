// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentWallet.sol";

contract DeployAgentWalletScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AgentWallet wallet = new AgentWallet();

        // Optionally fund the contract with 0.1 MON so it can process payouts
        (bool sent, ) = address(wallet).call{value: 0.1 ether}("");
        require(sent, "Initial funding failed");

        vm.stopBroadcast();

        console.log("AgentWallet deployed to:", address(wallet));
    }
}
