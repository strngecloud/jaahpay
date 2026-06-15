// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/SpendRouter.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract UpgradeSpendRouterScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("SPEND_ROUTER_PROXY_ADDRESS");

        console.log("Upgrading SpendRouter at proxy:", proxyAddress);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new implementation
        SpendRouter newImplementation = new SpendRouter();
        console.log(
            "New implementation deployed at:",
            address(newImplementation)
        );

        // 2. Upgrade proxy to new implementation
        SpendRouter proxy = SpendRouter(payable(proxyAddress));
        proxy.upgradeToAndCall(address(newImplementation), "");

        console.log("Proxy upgraded successfully");

        // 3. Verify upgrade
        console.log("\n=== Verification ===");
        console.log("Proxy address:", proxyAddress);
        console.log("New implementation:", address(newImplementation));
        console.log("USDC Token:", proxy.usdcToken());
        console.log("Fee Collector:", proxy.feeCollector());
        console.log("Platform Fee:", proxy.platformFeeBps(), "bps");

        vm.stopBroadcast();
    }
}
