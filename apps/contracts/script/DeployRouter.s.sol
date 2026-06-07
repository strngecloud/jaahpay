// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/JahpaySwapRouter.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployRouterScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envAddress("FEE_COLLECTOR_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Implementation
        JahpaySwapRouter implementation = new JahpaySwapRouter();
        console.log("Implementation deployed at:", address(implementation));

        // 2. Prepare Initialization Data
        // Platform fee is 30 bps (0.3%)
        bytes memory initData =
            abi.encodeCall(JahpaySwapRouter.initialize, (vm.addr(deployerPrivateKey), feeCollector, 30));

        // 3. Deploy Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("Proxy deployed at:", address(proxy));

        JahpaySwapRouter router = JahpaySwapRouter(payable(address(proxy)));

        // 4. Whitelist targets
        // Mento Broker (Mainnet)
        address mentoBroker = 0x51e2833f9A167E4eeFfCA26955e9484D1ddEa2aa; // Replace with actual Broker address if different, can be checked via SDK
        router.setTrustedTarget(mentoBroker, true);
        console.log("Whitelisted Mento Broker:", mentoBroker);

        // Mento V3 Router (Mainnet)
        address mentoV3Router = 0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6;
        router.setTrustedTarget(mentoV3Router, true);
        console.log("Whitelisted Mento V3 Router:", mentoV3Router);

        // Uniswap V3 SwapRouter (Mainnet)
        address uniswapV3Router = 0x5615CDAb10dc425a742d643d949a7F474C01abc4;
        router.setTrustedTarget(uniswapV3Router, true);
        console.log("Whitelisted Uniswap V3 Router:", uniswapV3Router);

        vm.stopBroadcast();
    }
}
