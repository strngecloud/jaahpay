// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/SpendRouter.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
    }

    function balanceOf(
        address account
    ) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(
        address to,
        uint256 amount
    ) external override returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function allowance(
        address owner,
        address spender
    ) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(
        address spender,
        uint256 amount
    ) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override returns (bool) {
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        return true;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }
}

contract SpendRouterTest is Test {
    SpendRouter public router;
    MockERC20 public usdc;
    address public owner;
    address public feeCollector;
    address public user;
    address public processor;

    uint256 constant PLATFORM_FEE_BPS = 30; // 0.3%
    uint256 constant USDC_AMOUNT = 1000 * 1e6; // 1000 USDC (6 decimals)
    uint256 constant NGN_AMOUNT = 1_500_000; // 1.5M NGN
    bytes32 constant RECIPIENT_HASH = keccak256("recipient_details");

    event SpendInitiated(
        uint256 indexed spendId,
        address indexed user,
        uint256 usdcAmount,
        uint256 ngnAmount,
        uint256 timestamp,
        bytes32 recipientHash
    );

    event SpendCompleted(
        uint256 indexed spendId,
        string bankTransactionRef,
        uint256 timestamp
    );

    event SpendRefunded(
        uint256 indexed spendId,
        string reason,
        uint256 timestamp
    );

    function setUp() public {
        owner = address(this);
        feeCollector = makeAddr("feeCollector");
        user = makeAddr("user");
        processor = makeAddr("processor");

        // Deploy mock USDC
        usdc = new MockERC20();

        // Deploy implementation
        SpendRouter implementation = new SpendRouter();

        // Deploy proxy
        bytes memory initData = abi.encodeCall(
            SpendRouter.initialize,
            (owner, address(usdc), feeCollector, PLATFORM_FEE_BPS)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        router = SpendRouter(payable(address(proxy)));

        // Authorize processor
        router.authorizeProcessor(processor);

        // Mint USDC to user
        usdc.mint(user, USDC_AMOUNT * 10); // Give user plenty of USDC
    }

    function testInitiateSpend() public {
        // Approve router to spend user's USDC
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);

        // Initiate spend
        vm.expectEmit(true, true, false, true);
        emit SpendInitiated(
            1,
            user,
            USDC_AMOUNT,
            NGN_AMOUNT,
            block.timestamp,
            RECIPIENT_HASH
        );

        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );

        vm.stopPrank();

        // Verify spend record
        SpendRouter.Spend memory spend = router.getSpend(spendId);
        assertEq(spend.user, user);
        assertEq(spend.usdcAmount, USDC_AMOUNT);
        assertEq(spend.ngnAmount, NGN_AMOUNT);
        assertEq(spend.recipientHash, RECIPIENT_HASH);
        assertEq(
            uint256(spend.status),
            uint256(SpendRouter.SpendStatus.Pending)
        );

        // Verify USDC transferred to router
        assertEq(usdc.balanceOf(address(router)), USDC_AMOUNT);
    }

    function testCompleteSpend() public {
        // Setup: Initiate spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );
        vm.stopPrank();

        uint256 feeCollectorBalanceBefore = usdc.balanceOf(feeCollector);

        // Complete spend as processor
        vm.startPrank(processor);
        vm.expectEmit(true, false, false, true);
        emit SpendCompleted(spendId, "BANK_REF_123", block.timestamp);

        router.completeSpend(spendId, "BANK_REF_123");
        vm.stopPrank();

        // Verify spend status
        SpendRouter.Spend memory spend = router.getSpend(spendId);
        assertEq(
            uint256(spend.status),
            uint256(SpendRouter.SpendStatus.Completed)
        );

        // Verify fees transferred to fee collector
        uint256 expectedFee = (USDC_AMOUNT * PLATFORM_FEE_BPS) / 10000;
        uint256 feeCollectorBalanceAfter = usdc.balanceOf(feeCollector);
        assertEq(
            feeCollectorBalanceAfter - feeCollectorBalanceBefore,
            USDC_AMOUNT
        ); // Full amount goes to treasury
    }

    function testRefundSpend() public {
        // Setup: Initiate spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );
        vm.stopPrank();

        uint256 userBalanceBefore = usdc.balanceOf(user);

        // Refund spend as processor
        vm.startPrank(processor);
        vm.expectEmit(true, false, false, true);
        emit SpendRefunded(spendId, "Bank transfer failed", block.timestamp);

        router.refundSpend(spendId, "Bank transfer failed");
        vm.stopPrank();

        // Verify spend status
        SpendRouter.Spend memory spend = router.getSpend(spendId);
        assertEq(
            uint256(spend.status),
            uint256(SpendRouter.SpendStatus.Refunded)
        );

        // Verify USDC refunded to user
        uint256 userBalanceAfter = usdc.balanceOf(user);
        assertEq(userBalanceAfter - userBalanceBefore, USDC_AMOUNT);
    }

    function testCancelSpend() public {
        // Setup: Initiate spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );
        vm.stopPrank();

        // Fast forward 6 minutes (past grace period)
        vm.warp(block.timestamp + 6 minutes);

        uint256 userBalanceBefore = usdc.balanceOf(user);

        // Cancel spend as user
        vm.startPrank(user);
        router.cancelSpend(spendId);
        vm.stopPrank();

        // Verify spend status
        SpendRouter.Spend memory spend = router.getSpend(spendId);
        assertEq(
            uint256(spend.status),
            uint256(SpendRouter.SpendStatus.Cancelled)
        );

        // Verify USDC refunded to user
        uint256 userBalanceAfter = usdc.balanceOf(user);
        assertEq(userBalanceAfter - userBalanceBefore, USDC_AMOUNT);
    }

    function testCannotCancelTooEarly() public {
        // Setup: Initiate spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );

        // Try to cancel immediately (should fail)
        vm.expectRevert("Too early to cancel");
        router.cancelSpend(spendId);
        vm.stopPrank();
    }

    function testEmergencyRefund() public {
        // Setup: Initiate spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );
        vm.stopPrank();

        // Fast forward past timeout (15 minutes)
        vm.warp(block.timestamp + 16 minutes);

        uint256 userBalanceBefore = usdc.balanceOf(user);

        // Emergency refund as processor
        vm.prank(processor);
        router.emergencyRefund(spendId);

        // Verify spend status
        SpendRouter.Spend memory spend = router.getSpend(spendId);
        assertEq(
            uint256(spend.status),
            uint256(SpendRouter.SpendStatus.Refunded)
        );

        // Verify USDC refunded to user
        uint256 userBalanceAfter = usdc.balanceOf(user);
        assertEq(userBalanceAfter - userBalanceBefore, USDC_AMOUNT);
    }

    function testUnauthorizedProcessorCannotComplete() public {
        // Setup: Initiate spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );
        vm.stopPrank();

        // Try to complete as unauthorized address
        address unauthorized = makeAddr("unauthorized");
        vm.prank(unauthorized);
        vm.expectRevert(SpendRouter.UnauthorizedProcessor.selector);
        router.completeSpend(spendId, "BANK_REF_123");
    }

    function testCannotCompleteAlreadyProcessedSpend() public {
        // Setup: Initiate and complete spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );
        vm.stopPrank();

        vm.prank(processor);
        router.completeSpend(spendId, "BANK_REF_123");

        // Try to complete again
        vm.prank(processor);
        vm.expectRevert(SpendRouter.SpendAlreadyProcessed.selector);
        router.completeSpend(spendId, "BANK_REF_456");
    }

    function testPauseUnpause() public {
        // Pause contract
        router.pause();

        // Try to initiate spend while paused
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT);
        vm.expectRevert();
        router.initiateSpend(USDC_AMOUNT, NGN_AMOUNT, RECIPIENT_HASH);
        vm.stopPrank();

        // Unpause
        router.unpause();

        // Should work now
        vm.startPrank(user);
        uint256 spendId = router.initiateSpend(
            USDC_AMOUNT,
            NGN_AMOUNT,
            RECIPIENT_HASH
        );
        vm.stopPrank();

        assertEq(spendId, 1);
    }

    function testSetFeeCollector() public {
        address newFeeCollector = makeAddr("newFeeCollector");
        router.setFeeCollector(newFeeCollector);
        assertEq(router.feeCollector(), newFeeCollector);
    }

    function testSetPlatformFee() public {
        uint256 newFee = 50; // 0.5%
        router.setPlatformFee(newFee);
        assertEq(router.platformFeeBps(), newFee);
    }

    function testGetUserDailySpent() public {
        // Initiate first spend
        vm.startPrank(user);
        usdc.approve(address(router), USDC_AMOUNT * 2);
        router.initiateSpend(USDC_AMOUNT, NGN_AMOUNT, RECIPIENT_HASH);

        // Check daily spent
        assertEq(router.getUserDailySpent(user), USDC_AMOUNT);

        // Initiate second spend
        router.initiateSpend(USDC_AMOUNT, NGN_AMOUNT, RECIPIENT_HASH);

        // Check updated daily spent
        assertEq(router.getUserDailySpent(user), USDC_AMOUNT * 2);
        vm.stopPrank();
    }

    function testUpgrade() public {
        // Deploy new implementation
        SpendRouter newImplementation = new SpendRouter();

        // Upgrade
        router.upgradeToAndCall(address(newImplementation), "");

        // Verify state is preserved
        assertEq(router.usdcToken(), address(usdc));
        assertEq(router.feeCollector(), feeCollector);
        assertEq(router.platformFeeBps(), PLATFORM_FEE_BPS);
    }
}
