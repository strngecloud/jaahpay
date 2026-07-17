// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {FeeCollector} from "../src/FeeCollector.sol";
import "../src/SpendRouter.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployCeloSepoliaScript is Script {
    // Circle's official USDC on Celo Sepolia (6 decimals)
    address private constant USDC_CELO_SEPOLIA =
        0x01C5C0122039549AD1493B8220cABEdD739BC44E;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address usdcToken = vm.envOr("USDC_TOKEN_ADDRESS_SEPOLIA", USDC_CELO_SEPOLIA);
        address backendProcessor = vm.envOr("BACKEND_PROCESSOR_ADDRESS", deployer);

        console.log("Network: Celo Sepolia Testnet");
        console.log("Deployer:", deployer);
        console.log("USDC Token:", usdcToken);

        vm.startBroadcast(deployerPrivateKey);

        // 1. FeeCollector (deployer stays owner on testnet)
        FeeCollector feeCollector = new FeeCollector();
        console.log("FeeCollector deployed at:", address(feeCollector));

        // 2. SpendRouter implementation + ERC1967 proxy (30 bps platform fee)
        SpendRouter implementation = new SpendRouter();
        console.log("SpendRouter Implementation:", address(implementation));

        bytes memory initData = abi.encodeCall(
            SpendRouter.initialize,
            (deployer, usdcToken, address(feeCollector), 30)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("SpendRouter Proxy:", address(proxy));

        // 3. Authorize the backend processor wallet
        SpendRouter router = SpendRouter(payable(address(proxy)));
        router.authorizeProcessor(backendProcessor);
        console.log("Authorized processor:", backendProcessor);

        vm.stopBroadcast();

        console.log("\n=== Update your envs ===");
        console.log("apps/server/.env -> SPEND_ROUTER_ADDRESS_CELO =", address(proxy));
        console.log("FeeCollector (Celo Sepolia)                   =", address(feeCollector));
    }
}
