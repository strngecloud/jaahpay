// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {JahpaySwapRouter} from "../src/JahpaySwapRouter.sol";

// ============ Mocks ============

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockDEX {
    address public tokenIn;
    address public tokenOut;
    uint256 public rate; // Out per In

    constructor(address _tokenIn, address _tokenOut, uint256 _rate) {
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
        rate = _rate;
    }

    // Mock swap function for ERC20 -> ERC20
    function swap(address from, address to, uint256 amountIn, address recipient) external {
        IERC20(from).transferFrom(msg.sender, address(this), amountIn);
        uint256 amountOut = amountIn * rate;
        MockERC20(to).mint(recipient, amountOut);
    }

    // Mock swap function for CELO -> ERC20
    function swapCeloToErc20(address to, address recipient) external payable {
        uint256 amountOut = msg.value * rate;
        MockERC20(to).mint(recipient, amountOut);
    }

    // Mock swap function for ERC20 -> CELO
    function swapErc20ToCelo(address from, uint256 amountIn, address payable recipient) external {
        IERC20(from).transferFrom(msg.sender, address(this), amountIn);
        uint256 amountOut = amountIn * rate;
        recipient.transfer(amountOut);
    }

    receive() external payable {}
}

contract ReentrantTarget {
    JahpaySwapRouter public router;

    constructor(address payable _router) {
        router = JahpaySwapRouter(_router);
    }

    function swap(address tokenIn, uint256 amountIn, address tokenOut, address target, bytes calldata data)
        external
        payable
    {
        // Reenter
        router.swap(tokenIn, amountIn, tokenOut, target, data);
    }
}

// ============ Test Suite ============

contract JahpaySwapRouterTest is Test {
    JahpaySwapRouter public router;
    JahpaySwapRouter public implementation;
    ERC1967Proxy public proxy;

    MockERC20 public usdc;
    MockERC20 public usdt;
    MockDEX public dex;

    address public owner = address(0x1);
    address public feeCollector = address(0x2);
    address public user = address(0x3);

    uint256 public constant PLATFORM_FEE_BPS = 30; // 0.3%

    function setUp() public {
        vm.startPrank(owner);

        // Deploy implementation
        implementation = new JahpaySwapRouter();

        // Encode initializer call
        bytes memory initData =
            abi.encodeWithSelector(JahpaySwapRouter.initialize.selector, owner, feeCollector, PLATFORM_FEE_BPS);

        // Deploy proxy
        proxy = new ERC1967Proxy(address(implementation), initData);
        router = JahpaySwapRouter(payable(address(proxy)));

        // Deploy Mock Tokens
        usdc = new MockERC20("USD Coin", "USDC");
        usdt = new MockERC20("Tether", "USDT");

        // Deploy Mock DEX with a 1:1 rate
        dex = new MockDEX(address(usdc), address(usdt), 1);
        vm.deal(address(dex), 100 ether); // fund DEX with CELO

        // Whitelist DEX target
        router.setTrustedTarget(address(dex), true);

        vm.stopPrank();
    }

    // ============ Initialization Tests ============

    function test_Initialize() public view {
        assertEq(router.owner(), owner);
        assertEq(router.feeCollector(), feeCollector);
        assertEq(router.platformFeeBps(), PLATFORM_FEE_BPS);
    }

    function test_Initialize_CannotReinitialize() public {
        vm.expectRevert();
        router.initialize(owner, feeCollector, PLATFORM_FEE_BPS);
    }

    // ============ Admin Settings Tests ============

    function test_SetFeeCollector() public {
        address newCollector = address(0x4);
        vm.prank(owner);
        router.setFeeCollector(newCollector);
        assertEq(router.feeCollector(), newCollector);
    }

    function test_SetFeeCollector_OnlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.setFeeCollector(address(0x4));
    }

    function test_SetFeeCollector_InvalidAddress() public {
        vm.prank(owner);
        vm.expectRevert(JahpaySwapRouter.InvalidAddress.selector);
        router.setFeeCollector(address(0));
    }

    function test_SetPlatformFee() public {
        vm.prank(owner);
        router.setPlatformFee(100); // 1%
        assertEq(router.platformFeeBps(), 100);
    }

    function test_SetPlatformFee_OnlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.setPlatformFee(100);
    }

    function test_SetPlatformFee_TooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        router.setPlatformFee(1001); // > 10%
    }

    function test_SetTrustedTarget() public {
        address newTarget = address(0x5);
        vm.prank(owner);
        router.setTrustedTarget(newTarget, true);
        assertTrue(router.trustedTargets(newTarget));

        vm.prank(owner);
        router.setTrustedTarget(newTarget, false);
        assertFalse(router.trustedTargets(newTarget));
    }

    // ============ Swap Execution Tests ============

    function test_Swap_ERC20_to_ERC20() public {
        uint256 amountIn = 1000 * 10 ** 6; // 1000 USDC
        usdc.mint(user, amountIn);

        vm.startPrank(user);
        usdc.approve(address(router), amountIn);

        bytes memory dexCalldata =
            abi.encodeWithSelector(MockDEX.swap.selector, address(usdc), address(usdt), amountIn, address(router));

        router.swap(address(usdc), amountIn, address(usdt), address(dex), dexCalldata);

        vm.stopPrank();

        uint256 expectedFee = (amountIn * PLATFORM_FEE_BPS) / 10000;
        uint256 expectedNet = amountIn - expectedFee;

        assertEq(usdt.balanceOf(user), expectedNet);
        assertEq(usdt.balanceOf(feeCollector), expectedFee);
        assertEq(usdc.balanceOf(user), 0);
    }

    function test_Swap_CELO_to_ERC20() public {
        uint256 amountIn = 10 ether;
        vm.deal(user, amountIn);

        vm.startPrank(user);
        bytes memory dexCalldata =
            abi.encodeWithSelector(MockDEX.swapCeloToErc20.selector, address(usdt), address(router));

        router.swap{value: amountIn}(address(0), amountIn, address(usdt), address(dex), dexCalldata);
        vm.stopPrank();

        uint256 expectedGross = amountIn; // 1:1 rate
        uint256 expectedFee = (expectedGross * PLATFORM_FEE_BPS) / 10000;
        uint256 expectedNet = expectedGross - expectedFee;

        assertEq(usdt.balanceOf(user), expectedNet);
        assertEq(usdt.balanceOf(feeCollector), expectedFee);
    }

    function test_Swap_ERC20_to_CELO() public {
        uint256 amountIn = 1000 * 10 ** 6; // 1000 USDC
        usdc.mint(user, amountIn);

        vm.startPrank(user);
        usdc.approve(address(router), amountIn);

        bytes memory dexCalldata =
            abi.encodeWithSelector(MockDEX.swapErc20ToCelo.selector, address(usdc), amountIn, payable(address(router)));

        uint256 userBalanceBefore = user.balance;
        uint256 collectorBalanceBefore = feeCollector.balance;

        router.swap(address(usdc), amountIn, address(0), address(dex), dexCalldata);
        vm.stopPrank();

        uint256 expectedGross = amountIn; // 1:1 rate
        uint256 expectedFee = (expectedGross * PLATFORM_FEE_BPS) / 10000;
        uint256 expectedNet = expectedGross - expectedFee;

        assertEq(user.balance, userBalanceBefore + expectedNet);
        assertEq(feeCollector.balance, collectorBalanceBefore + expectedFee);
    }

    // ============ Swap Revert Edge Cases ============

    function test_Swap_Revert_UntrustedTarget() public {
        uint256 amountIn = 1000 * 10 ** 6;
        usdc.mint(user, amountIn);

        vm.startPrank(user);
        usdc.approve(address(router), amountIn);

        bytes memory dexCalldata = "";
        vm.expectRevert(JahpaySwapRouter.UntrustedTarget.selector);
        router.swap(
            address(usdc),
            amountIn,
            address(usdt),
            address(0x999), // untrusted target
            dexCalldata
        );
        vm.stopPrank();
    }

    function test_Swap_Revert_ZeroAmount() public {
        vm.startPrank(user);
        bytes memory dexCalldata = "";
        vm.expectRevert(JahpaySwapRouter.InvalidAmount.selector);
        router.swap(address(usdc), 0, address(usdt), address(dex), dexCalldata);
        vm.stopPrank();
    }

    function test_Swap_Revert_InsufficientMsgValue() public {
        uint256 amountIn = 10 ether;
        vm.deal(user, amountIn);

        vm.startPrank(user);
        bytes memory dexCalldata = "";
        vm.expectRevert("Insufficient msg.value");
        router.swap{value: 5 ether}( // Send less than amountIn
            address(0), amountIn, address(usdt), address(dex), dexCalldata
        );
        vm.stopPrank();
    }

    function test_Swap_Revert_SwapFailed() public {
        uint256 amountIn = 1000 * 10 ** 6;
        usdc.mint(user, amountIn);

        vm.startPrank(user);
        usdc.approve(address(router), amountIn);

        // Construct invalid/reverting call
        bytes memory dexCalldata = abi.encodeWithSelector(
            MockDEX.swap.selector,
            address(usdc),
            address(usdt),
            amountIn * 2, // will revert/fail because user didn't transfer enough
            address(router)
        );

        vm.expectRevert();
        router.swap(address(usdc), amountIn, address(usdt), address(dex), dexCalldata);
        vm.stopPrank();
    }

    // ============ Reentrancy Protection Test ============

    function test_Swap_Revert_Reentrancy() public {
        ReentrantTarget badTarget = new ReentrantTarget(payable(address(router)));

        vm.prank(owner);
        router.setTrustedTarget(address(badTarget), true);

        uint256 amountIn = 100;
        usdc.mint(user, amountIn);

        vm.startPrank(user);
        usdc.approve(address(router), amountIn);

        bytes memory badCalldata = abi.encodeWithSelector(
            ReentrantTarget.swap.selector, address(usdc), amountIn, address(usdt), address(badTarget), ""
        );

        vm.expectRevert(); // Reentrancy Guard will trigger a revert on the nested call
        router.swap(address(usdc), amountIn, address(usdt), address(badTarget), badCalldata);
        vm.stopPrank();
    }
}
