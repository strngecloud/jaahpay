// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {FeeCollector} from "../src/FeeCollector.sol";

contract TransferOwnershipScript is Script {
    // New owner address
    address public newOwner = 0x3E192d109d1dd323375Ac1Ed040f817918E82d63;

    // Existing contract addresses (update these with your deployed addresses)
    address payable public feeCollectorAddress =
        payable(0x5c043e1D09495F04a9f33551c49CE244c8226C46);

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("Transferring ownership to new admin...");
        console.log("New Owner: ", newOwner);
        console.log("FeeCollector: ", feeCollectorAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Transfer FeeCollector ownership
        console.log("Transferring FeeCollector ownership...");
        FeeCollector feeCollector = FeeCollector(feeCollectorAddress);
        feeCollector.transferOwnership(newOwner);
        console.log("FeeCollector ownership transferred to:", newOwner);

        vm.stopBroadcast();

        console.log("Ownership transfer complete!");
    }
}
