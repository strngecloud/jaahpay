// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/SpendRouter.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeploySpendRouterScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Read from environment or use defaults
        address usdcToken = vm.envOr("USDC_TOKEN_ADDRESS", address(0));
        address feeCollector = vm.envOr("FEE_COLLECTOR_ADDRESS", address(0));

        // Validate required addresses
        require(usdcToken != address(0), "USDC_TOKEN_ADDRESS not set");
        require(feeCollector != address(0), "FEE_COLLECTOR_ADDRESS not set");

        console.log("Deployer:", deployer);
        console.log("USDC Token:", usdcToken);
        console.log("Fee Collector:", feeCollector);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Implementation
        SpendRouter implementation = new SpendRouter();
        console.log(
            "SpendRouter Implementation deployed at:",
            address(implementation)
        );

        // 2. Prepare Initialization Data
        // Platform fee is 30 bps (0.3%)
        bytes memory initData = abi.encodeCall(
            SpendRouter.initialize,
            (deployer, usdcToken, feeCollector, 30)
        );

        // 3. Deploy Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("SpendRouter Proxy deployed at:", address(proxy));

        SpendRouter router = SpendRouter(payable(address(proxy)));

        // 4. Authorize initial processor (can be backend wallet)
        // You can set this via environment variable or do it later
        address backendProcessor = vm.envOr(
            "BACKEND_PROCESSOR_ADDRESS",
            address(0)
        );
        if (backendProcessor != address(0)) {
            router.authorizeProcessor(backendProcessor);
            console.log("Authorized backend processor:", backendProcessor);
        } else {
            console.log(
                "No backend processor set. Remember to authorize one later."
            );
        }

        // 5. Log configuration
        console.log("\n=== Deployment Summary ===");
        console.log("Implementation:", address(implementation));
        console.log("Proxy:", address(proxy));
        console.log("USDC Token:", usdcToken);
        console.log("Fee Collector:", feeCollector);
        console.log("Platform Fee:", router.platformFeeBps(), "bps");
        console.log("Spend Timeout:", router.spendTimeout() / 60, "minutes");

        vm.stopBroadcast();

        console.log("\n=== Next Steps ===");
        console.log("1. Set SPEND_ROUTER_ADDRESS in your backend .env");
        console.log("2. Authorize backend wallet as processor:");
        console.log(
            "   cast send",
            address(proxy),
            '"authorizeProcessor(address)"',
            "<BACKEND_WALLET>"
        );
        console.log("3. Update frontend with contract address");
        console.log("4. Test with a small spend transaction");
    }
}
