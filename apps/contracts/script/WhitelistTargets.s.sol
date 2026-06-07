// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {JahpaySwapRouter} from "../src/JahpaySwapRouter.sol";

contract WhitelistTargets is Script {
    function run() public {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        address routerAddress = vm.envAddress("JAHPAY_ROUTER_ADDRESS");
        JahpaySwapRouter router = JahpaySwapRouter(payable(routerAddress));

        // Mento Broker (Celo Mainnet) - legacy V2
        address mentoBroker = 0x51e2833f9A167E4eeFfCA26955e9484D1ddEa2aa;

        // Mento V3 Router (Celo Mainnet) - used by SDK v3 for FPMM pool swaps
        address mentoV3Router = 0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6;

        // Uniswap V3 SwapRouter (Celo Mainnet)
        address uniswapV3Router = 0x5615CDAb10dc425a742d643d949a7F474C01abc4;

        // Set as trusted
        if (!router.trustedTargets(mentoBroker)) {
            router.setTrustedTarget(mentoBroker, true);
            console.log("Whitelisted Mento Broker:", mentoBroker);
        }

        if (!router.trustedTargets(mentoV3Router)) {
            router.setTrustedTarget(mentoV3Router, true);
            console.log("Whitelisted Mento V3 Router:", mentoV3Router);
        }

        if (!router.trustedTargets(uniswapV3Router)) {
            router.setTrustedTarget(uniswapV3Router, true);
            console.log("Whitelisted Uniswap V3 Router:", uniswapV3Router);
        }

        vm.stopBroadcast();
    }
}
