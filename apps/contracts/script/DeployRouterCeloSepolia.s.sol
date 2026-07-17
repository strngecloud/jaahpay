// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/JahpaySwapRouter.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * Celo Sepolia deployment of JahpaySwapRouter.
 *
 * Unlike DeployRouter.s.sol (which whitelists MAINNET Mento/Uniswap targets),
 * this whitelists the Celo Sepolia Mento contracts. The critical one is the
 * address the Mento SDK actually sets as the swap tx `to` on Sepolia
 * (0xcf6c...): the router reverts with UntrustedTarget() for anything else.
 */
contract DeployRouterCeloSepoliaScript is Script {
    // Mento swap target returned by @mento-protocol/mento-sdk on Celo Sepolia
    // (verified via buildSwapTransaction — this is what JahpaySwapRouter.swap
    // receives as `target`).
    address private constant MENTO_SDK_TARGET =
        0xcf6cD45210b3ffE3cA28379C4683F1e60D0C2CCd;
    address private constant MENTO_ROUTER =
        0x8e4Fb12D86D5DF911086a9153e79CA27e0c96156;
    address private constant MENTO_BROKER =
        0xB9Ae2065142EB79b6c5EB1E8778F883fad6B07Ba;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envAddress("FEE_COLLECTOR_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Network: Celo Sepolia Testnet");
        console.log("Deployer:", deployer);
        console.log("FeeCollector:", feeCollector);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Implementation
        JahpaySwapRouter implementation = new JahpaySwapRouter();
        console.log("JahpaySwapRouter Implementation:", address(implementation));

        // 2. Proxy (30 bps platform fee)
        bytes memory initData =
            abi.encodeCall(JahpaySwapRouter.initialize, (deployer, feeCollector, 30));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("JahpaySwapRouter Proxy:", address(proxy));

        JahpaySwapRouter router = JahpaySwapRouter(payable(address(proxy)));

        // 3. Whitelist Celo Sepolia Mento targets
        router.setTrustedTarget(MENTO_SDK_TARGET, true);
        router.setTrustedTarget(MENTO_ROUTER, true);
        router.setTrustedTarget(MENTO_BROKER, true);
        console.log("Whitelisted Mento SDK target:", MENTO_SDK_TARGET);
        console.log("Whitelisted Mento Router:", MENTO_ROUTER);
        console.log("Whitelisted Mento Broker:", MENTO_BROKER);

        vm.stopBroadcast();

        console.log("=== Update your envs ===");
        console.log("web .env -> NEXT_PUBLIC_JAHPAY_ROUTER_ADDRESS =", address(proxy));
    }
}
