// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {FeeCollector} from "../src/FeeCollector.sol";

contract DeployScript is Script {
    // Contract addresses will be set during deployment
    address public feeCollector;

    // Roles
    address public defaultAdmin;

    // Environment variables
    string private constant RPC_URL = "https://forno.celo.org";

    function run() external {
        // Get deployer address from private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        defaultAdmin = vm.envAddress("DEFAULT_ADMIN");

        require(defaultAdmin != address(0), "DEFAULT_ADMIN not set");

        console.log("Deploying contracts with the following parameters:");
        console.log("Network: Celo Mainnet");
        console.log("Deployer: ", vm.addr(deployerPrivateKey));
        console.log("Default Admin: ", defaultAdmin);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy FeeCollector (takes no constructor parameters)
        console.log("Deploying FeeCollector...");
        FeeCollector feeCollectorContract = new FeeCollector();
        feeCollector = address(feeCollectorContract);
        console.log("FeeCollector deployed to:", feeCollector);

        // Transfer ownership of FeeCollector to default admin
        console.log("Setting default admin as fee collector owner...");
        feeCollectorContract.transferOwnership(defaultAdmin);

        vm.stopBroadcast();

        console.log("Deployment complete!");
        console.log("Contract Addresses:");
        console.log("FeeCollector:  ", feeCollector);
    }
}
