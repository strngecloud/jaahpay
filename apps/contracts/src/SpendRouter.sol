// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title SpendRouter
 * @notice Router for spending crypto (USDC) as naira through bank transfers
 * @dev Manages escrow, emits events for backend processing, handles completion/refunds
 */
contract SpendRouter is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum SpendStatus {
        Pending,
        Processing,
        Completed,
        Refunded,
        Cancelled
    }

    // ============ Structs ============

    struct Spend {
        address user;
        uint256 usdcAmount;
        uint256 ngnAmount;
        uint256 timestamp;
        SpendStatus status;
        bytes32 recipientHash; // Keccak256 hash of recipient details (off-chain storage)
    }

    // ============ State Variables ============

    address public usdcToken;
    address public feeCollector;
    uint256 public platformFeeBps; // e.g., 30 for 0.3%
    uint256 public nextSpendId;
    uint256 public spendTimeout; // Timeout in seconds (default 15 minutes)

    // Authorized processors (backend wallets that can complete/refund spends)
    mapping(address => bool) public authorizedProcessors;

    // Spend tracking
    mapping(uint256 => Spend) public spends;

    // User spend tracking (for rate limiting)
    mapping(address => uint256) public userDailySpent;
    mapping(address => uint256) public userLastSpendDay;

    // ============ Events ============

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

    event SpendCancelled(uint256 indexed spendId, uint256 timestamp);

    event ProcessorAuthorized(address indexed processor);

    event ProcessorRevoked(address indexed processor);

    event FeeCollectorUpdated(address indexed newFeeCollector);

    event PlatformFeeUpdated(uint256 newFeeBps);

    event SpendTimeoutUpdated(uint256 newTimeout);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error SpendNotFound();
    error SpendAlreadyProcessed();
    error SpendTimedOut();
    error UnauthorizedProcessor();
    error OnlySpendOwner();

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the proxy contract
     * @param initialOwner Owner address
     * @param _usdcToken USDC token address
     * @param _feeCollector Fee collector address
     * @param _platformFeeBps Platform fee in basis points (e.g., 30 for 0.3%)
     */
    function initialize(
        address initialOwner,
        address _usdcToken,
        address _feeCollector,
        uint256 _platformFeeBps
    ) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();

        if (_usdcToken == address(0) || _feeCollector == address(0))
            revert InvalidAddress();

        usdcToken = _usdcToken;
        feeCollector = _feeCollector;
        platformFeeBps = _platformFeeBps;
        nextSpendId = 1;
        spendTimeout = 15 minutes; // Default timeout
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ============ Modifiers ============

    modifier onlyProcessor() {
        if (!authorizedProcessors[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedProcessor();
        }
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Initiate a spend transaction
     * @param usdcAmount Amount of USDC to spend (including platform fee)
     * @param ngnAmount Expected NGN amount to send to recipient
     * @param recipientHash Keccak256 hash of recipient details (for privacy)
     * @return spendId The unique ID for this spend transaction
     */
    function initiateSpend(
        uint256 usdcAmount,
        uint256 ngnAmount,
        bytes32 recipientHash
    ) external nonReentrant whenNotPaused returns (uint256 spendId) {
        if (usdcAmount == 0 || ngnAmount == 0) revert InvalidAmount();
        if (recipientHash == bytes32(0)) revert InvalidAddress();

        // Transfer USDC from user to this contract (escrow)
        IERC20(usdcToken).safeTransferFrom(
            msg.sender,
            address(this),
            usdcAmount
        );

        // Create spend record
        spendId = nextSpendId++;
        spends[spendId] = Spend({
            user: msg.sender,
            usdcAmount: usdcAmount,
            ngnAmount: ngnAmount,
            timestamp: block.timestamp,
            status: SpendStatus.Pending,
            recipientHash: recipientHash
        });

        // Track daily spending for rate limiting (optional, can be removed if backend handles this)
        uint256 currentDay = block.timestamp / 1 days;
        if (userLastSpendDay[msg.sender] != currentDay) {
            userDailySpent[msg.sender] = 0;
            userLastSpendDay[msg.sender] = currentDay;
        }
        userDailySpent[msg.sender] += usdcAmount;

        emit SpendInitiated(
            spendId,
            msg.sender,
            usdcAmount,
            ngnAmount,
            block.timestamp,
            recipientHash
        );

        return spendId;
    }

    /**
     * @notice Complete a spend transaction (called by backend after successful bank transfer)
     * @param spendId The spend ID to complete
     * @param bankTransactionRef Bank transaction reference for audit trail
     */
    function completeSpend(
        uint256 spendId,
        string calldata bankTransactionRef
    ) external onlyProcessor {
        Spend storage spend = spends[spendId];

        if (spend.user == address(0)) revert SpendNotFound();
        if (spend.status != SpendStatus.Pending) revert SpendAlreadyProcessed();

        // Calculate platform fee
        uint256 fee = (spend.usdcAmount * platformFeeBps) / 10000;
        uint256 amountAfterFee = spend.usdcAmount - fee;

        // Transfer fee to fee collector
        if (fee > 0) {
            IERC20(usdcToken).safeTransfer(feeCollector, fee);
        }

        // For completed spend, USDC stays in contract or is transferred to treasury
        // (You can decide to keep it here or transfer to another address)
        // For now, we'll transfer the remaining to fee collector (your treasury)
        if (amountAfterFee > 0) {
            IERC20(usdcToken).safeTransfer(feeCollector, amountAfterFee);
        }

        spend.status = SpendStatus.Completed;

        emit SpendCompleted(spendId, bankTransactionRef, block.timestamp);
    }

    /**
     * @notice Refund a spend transaction (called by backend if bank transfer fails)
     * @param spendId The spend ID to refund
     * @param reason Reason for refund (for audit trail)
     */
    function refundSpend(
        uint256 spendId,
        string calldata reason
    ) external onlyProcessor {
        Spend storage spend = spends[spendId];

        if (spend.user == address(0)) revert SpendNotFound();
        if (spend.status != SpendStatus.Pending) revert SpendAlreadyProcessed();

        // Refund full USDC amount to user
        IERC20(usdcToken).safeTransfer(spend.user, spend.usdcAmount);

        spend.status = SpendStatus.Refunded;

        // Adjust daily spending
        uint256 currentDay = block.timestamp / 1 days;
        if (userLastSpendDay[spend.user] == currentDay) {
            userDailySpent[spend.user] -= spend.usdcAmount;
        }

        emit SpendRefunded(spendId, reason, block.timestamp);
    }

    /**
     * @notice Cancel a pending spend (user can cancel if not yet processing)
     * @param spendId The spend ID to cancel
     */
    function cancelSpend(uint256 spendId) external nonReentrant {
        Spend storage spend = spends[spendId];

        if (spend.user == address(0)) revert SpendNotFound();
        if (spend.user != msg.sender) revert OnlySpendOwner();
        if (spend.status != SpendStatus.Pending) revert SpendAlreadyProcessed();

        // Check if spend has timed out (give grace period before user can cancel)
        if (block.timestamp < spend.timestamp + 5 minutes) {
            revert("Too early to cancel");
        }

        // Refund USDC to user
        IERC20(usdcToken).safeTransfer(spend.user, spend.usdcAmount);

        spend.status = SpendStatus.Cancelled;

        // Adjust daily spending
        uint256 currentDay = block.timestamp / 1 days;
        if (userLastSpendDay[spend.user] == currentDay) {
            userDailySpent[spend.user] -= spend.usdcAmount;
        }

        emit SpendCancelled(spendId, block.timestamp);
    }

    /**
     * @notice Emergency refund for timed out spends
     * @param spendId The spend ID that timed out
     */
    function emergencyRefund(uint256 spendId) external onlyProcessor {
        Spend storage spend = spends[spendId];

        if (spend.user == address(0)) revert SpendNotFound();
        if (spend.status != SpendStatus.Pending) revert SpendAlreadyProcessed();
        if (block.timestamp < spend.timestamp + spendTimeout)
            revert("Not timed out yet");

        // Refund USDC to user
        IERC20(usdcToken).safeTransfer(spend.user, spend.usdcAmount);

        spend.status = SpendStatus.Refunded;

        emit SpendRefunded(spendId, "Timeout", block.timestamp);
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize a processor address
     * @param processor Address to authorize
     */
    function authorizeProcessor(address processor) external onlyOwner {
        if (processor == address(0)) revert InvalidAddress();
        authorizedProcessors[processor] = true;
        emit ProcessorAuthorized(processor);
    }

    /**
     * @notice Revoke processor authorization
     * @param processor Address to revoke
     */
    function revokeProcessor(address processor) external onlyOwner {
        if (processor == address(0)) revert InvalidAddress();
        authorizedProcessors[processor] = false;
        emit ProcessorRevoked(processor);
    }

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
     * @notice Set spend timeout
     * @param _timeout New timeout in seconds
     */
    function setSpendTimeout(uint256 _timeout) external onlyOwner {
        require(
            _timeout >= 5 minutes && _timeout <= 1 hours,
            "Invalid timeout"
        );
        spendTimeout = _timeout;
        emit SpendTimeoutUpdated(_timeout);
    }

    /**
     * @notice Pause the contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Get spend details
     * @param spendId The spend ID
     * @return spend The spend struct
     */
    function getSpend(
        uint256 spendId
    ) external view returns (Spend memory spend) {
        return spends[spendId];
    }

    /**
     * @notice Get user's daily spent amount
     * @param user User address
     * @return amount Amount spent today
     */
    function getUserDailySpent(
        address user
    ) external view returns (uint256 amount) {
        uint256 currentDay = block.timestamp / 1 days;
        if (userLastSpendDay[user] == currentDay) {
            return userDailySpent[user];
        }
        return 0;
    }

    /**
     * @notice Check if a spend has timed out
     * @param spendId The spend ID
     * @return hasTimedOut Boolean indicating timeout status
     */
    function hasSpendTimedOut(
        uint256 spendId
    ) external view returns (bool hasTimedOut) {
        Spend memory spend = spends[spendId];
        return (spend.status == SpendStatus.Pending &&
            block.timestamp >= spend.timestamp + spendTimeout);
    }
}
