// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title JahpaySwapRouter
 * @notice Router for executing single-transaction swaps with automated platform fee collection.
 */
contract JahpaySwapRouter is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    address public feeCollector;
    uint256 public platformFeeBps; // e.g., 30 for 0.3%

    // Whitelisted addresses allowed to be called by the router (e.g., Mento Broker, Uniswap Router)
    mapping(address => bool) public trustedTargets;

    // The Celo native token address (ERC20 equivalent for Celo)
    address public constant CELO_TOKEN = 0x471EcE3750Da237f93B8E339c536989b8978a438;

    // ============ Events ============

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOutNet,
        uint256 fee
    );
    event FeeCollectorUpdated(address indexed newFeeCollector);
    event PlatformFeeUpdated(uint256 newFeeBps);
    event TrustedTargetUpdated(address indexed target, bool isTrusted);

    // ============ Errors ============

    error UntrustedTarget();
    error InvalidAddress();
    error InvalidAmount();
    error SwapFailed();

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the proxy contract
     * @param initialOwner Owner address
     * @param _feeCollector Fee collector address
     * @param _platformFeeBps Platform fee in basis points (e.g., 30 for 0.3%)
     */
    function initialize(address initialOwner, address _feeCollector, uint256 _platformFeeBps) public initializer {
        __Ownable_init(initialOwner);
        feeCollector = _feeCollector;
        platformFeeBps = _platformFeeBps;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Admin Functions ============

    /**
     * @notice Set the fee collector address
     * @param _feeCollector New fee collector address
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidAddress();
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    /**
     * @notice Set the platform fee
     * @param _feeBps New fee in basis points (max 1000 = 10%)
     */
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high");
        platformFeeBps = _feeBps;
        emit PlatformFeeUpdated(_feeBps);
    }

    /**
     * @notice Add or remove a trusted swap target
     * @param target Address of the target (e.g. Mento Broker)
     * @param isTrusted Boolean indicating trust status
     */
    function setTrustedTarget(address target, bool isTrusted) external onlyOwner {
        if (target == address(0)) revert InvalidAddress();
        trustedTargets[target] = isTrusted;
        emit TrustedTargetUpdated(target, isTrusted);
    }

    // ============ Core Functions ============

    /**
     * @notice Execute a swap through a trusted target, deducting the platform fee automatically
     * @param tokenIn Address of the input token (use address(0) or CELO_TOKEN for native CELO)
     * @param amountIn Amount of input token to swap
     * @param tokenOut Address of the output token
     * @param target Address of the DEX router/broker
     * @param data Encoded function call data to execute on the target
     */
    function swap(address tokenIn, uint256 amountIn, address tokenOut, address target, bytes calldata data)
        external
        payable
        nonReentrant
    {
        if (!trustedTargets[target]) revert UntrustedTarget();
        if (amountIn == 0) revert InvalidAmount();

        bool isNativeIn = tokenIn == address(0) || tokenIn == CELO_TOKEN;
        bool isNativeOut = tokenOut == address(0) || tokenOut == CELO_TOKEN;

        // 1. Receive input tokens
        if (isNativeIn) {
            require(msg.value >= amountIn, "Insufficient msg.value");
        } else {
            // Transfer input tokens from user to this router
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

            // For Mento swaps: approve self so Mento can pull tokens from router's balance
            // For other targets: approve the target to spend our tokens
            // Both approaches work since we're either:
            // - Router.call{} -> Mento.call{} (needs router to approve self, then Mento pulls)
            // - Direct external call where target pulls from router
            IERC20(tokenIn).safeIncreaseAllowance(address(this), amountIn);
            if (target != address(this)) {
                IERC20(tokenIn).safeIncreaseAllowance(target, amountIn);
            }
        }

        // 2. Record output token balance before swap
        uint256 balanceBefore = isNativeOut ? address(this).balance : IERC20(tokenOut).balanceOf(address(this));

        // 3. Execute swap on target
        // We pass along the msg.value if the input is native CELO
        (bool success,) = target.call{value: isNativeIn ? msg.value : 0}(data);
        if (!success) revert SwapFailed();

        // 4. Calculate amount received
        uint256 balanceAfter = isNativeOut ? address(this).balance : IERC20(tokenOut).balanceOf(address(this));

        uint256 amountOut = balanceAfter - balanceBefore;
        if (amountOut == 0) revert SwapFailed();

        // 5. Calculate fees
        uint256 fee = (amountOut * platformFeeBps) / 10000;
        uint256 amountOutNet = amountOut - fee;

        // 6. Transfer fee to collector
        if (fee > 0) {
            if (isNativeOut) {
                (bool feeSuccess,) = feeCollector.call{value: fee}("");
                require(feeSuccess, "Fee transfer failed");
            } else {
                IERC20(tokenOut).safeTransfer(feeCollector, fee);
            }
        }

        // 7. Transfer net amount to user
        if (isNativeOut) {
            (bool outSuccess,) = msg.sender.call{value: amountOutNet}("");
            require(outSuccess, "User transfer failed");
        } else {
            IERC20(tokenOut).safeTransfer(msg.sender, amountOutNet);
        }

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOutNet, fee);
    }

    // Receive native CELO tokens
    receive() external payable {}
}
