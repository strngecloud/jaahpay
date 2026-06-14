# Jahpay Spending Contracts

Smart contracts for the Jahpay spending feature, enabling users to spend crypto (USDC) as naira through Nigerian bank transfers.

## Contracts

### SpendRouter.sol

Main contract that handles the spending lifecycle:

- **Escrow Management**: Holds USDC in escrow during pending spends
- **Event Emission**: Emits events for backend processing
- **Completion/Refund**: Allows authorized processors to complete or refund spends
- **Upgradeable**: UUPS proxy pattern for future updates

#### Key Features

- ✅ UUPS Upgradeable pattern
- ✅ Pausable for emergencies
- ✅ Reentrancy protection
- ✅ Authorized processor management
- ✅ User cancellation (after grace period)
- ✅ Emergency refund for timeouts
- ✅ Platform fee collection
- ✅ Daily spending tracking

## Architecture

```
User
  ↓ initiateSpend()
SpendRouter (Escrow USDC)
  ↓ emit SpendInitiated
Backend Listener
  ↓ processSpendInitiated()
Bank API Transfer
  ↓ Success/Failure
Backend
  ↓ completeSpend() or refundSpend()
SpendRouter
  ↓ Transfer fees to collector or refund to user
```

## Deployment

### Prerequisites

1. USDC token address for your chain
2. Fee collector address (treasury)
3. Backend processor wallet address

### Environment Setup

Create `.env` in `apps/contracts/`:

```env
# Deployer
PRIVATE_KEY=your_private_key

# Contract Addresses
USDC_TOKEN_ADDRESS=0x... # USDC on your chain
FEE_COLLECTOR_ADDRESS=0x... # Your fee collector/treasury

# Backend
BACKEND_PROCESSOR_ADDRESS=0x... # Backend wallet that processes spends
```

### Testnet Deployment

#### Celo Alfajores

```bash
# Set USDC token for Alfajores
export USDC_TOKEN_ADDRESS=0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B

# Deploy
forge script script/DeploySpendRouter.s.sol \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --broadcast \
  --verify
```

#### Base Sepolia

```bash
# Set USDC token for Base Sepolia
export USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Deploy
forge script script/DeploySpendRouter.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify
```

### Mainnet Deployment

#### Celo Mainnet

```bash
# Set USDC token for Celo Mainnet
export USDC_TOKEN_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C

# Deploy
forge script script/DeploySpendRouter.s.sol \
  --rpc-url https://forno.celo.org \
  --broadcast \
  --verify
```

#### Base Mainnet

```bash
# Set USDC token for Base Mainnet
export USDC_TOKEN_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Deploy
forge script script/DeploySpendRouter.s.sol \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify
```

## Post-Deployment Setup

### 1. Authorize Backend Processor

```bash
# Using cast
cast send <PROXY_ADDRESS> \
  "authorizeProcessor(address)" \
  <BACKEND_WALLET_ADDRESS> \
  --rpc-url <RPC_URL> \
  --private-key <PRIVATE_KEY>
```

### 2. Update Backend `.env`

```env
SPEND_ROUTER_ADDRESS_CELO=<CELO_PROXY_ADDRESS>
SPEND_ROUTER_ADDRESS_BASE=<BASE_PROXY_ADDRESS>
BACKEND_PRIVATE_KEY=<BACKEND_WALLET_PRIVATE_KEY>
```

### 3. Update Frontend

Add the contract address to your frontend configuration.

## Testing

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testInitiateSpend

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

### Test Coverage

- ✅ Spend initiation
- ✅ Spend completion
- ✅ Spend refund
- ✅ User cancellation
- ✅ Emergency refund
- ✅ Authorization checks
- ✅ Pause/unpause
- ✅ Fee calculation
- ✅ Daily spending tracking
- ✅ Upgrade functionality

## Upgrading Contracts

When you need to make changes:

### 1. Deploy New Implementation

```bash
# Set proxy address
export SPEND_ROUTER_PROXY_ADDRESS=<YOUR_PROXY_ADDRESS>

# Run upgrade script
forge script script/UpgradeSpendRouter.s.sol \
  --rpc-url <RPC_URL> \
  --broadcast \
  --verify
```

### 2. Verify State Preserved

```bash
# Check USDC token
cast call <PROXY_ADDRESS> "usdcToken()" --rpc-url <RPC_URL>

# Check fee collector
cast call <PROXY_ADDRESS> "feeCollector()" --rpc-url <RPC_URL>

# Check platform fee
cast call <PROXY_ADDRESS> "platformFeeBps()" --rpc-url <RPC_URL>
```

## Contract Interactions

### Initiate Spend (User)

```solidity
// 1. Approve USDC
IERC20(usdcToken).approve(spendRouter, usdcAmount);

// 2. Initiate spend
uint256 spendId = spendRouter.initiateSpend(
    usdcAmount,
    ngnAmount,
    recipientHash
);
```

### Complete Spend (Backend)

```solidity
spendRouter.completeSpend(
    spendId,
    "BANK_REF_123"
);
```

### Refund Spend (Backend)

```solidity
spendRouter.refundSpend(
    spendId,
    "Bank transfer failed"
);
```

### Cancel Spend (User)

```solidity
// After 5 minute grace period
spendRouter.cancelSpend(spendId);
```

## Events

### SpendInitiated

```solidity
event SpendInitiated(
    uint256 indexed spendId,
    address indexed user,
    uint256 usdcAmount,
    uint256 ngnAmount,
    uint256 timestamp,
    bytes32 recipientHash
);
```

### SpendCompleted

```solidity
event SpendCompleted(
    uint256 indexed spendId,
    string bankTransactionRef,
    uint256 timestamp
);
```

### SpendRefunded

```solidity
event SpendRefunded(
    uint256 indexed spendId,
    string reason,
    uint256 timestamp
);
```

## Security

### Auditing

Before mainnet launch:

- [ ] Get professional smart contract audit
- [ ] Run Slither static analysis
- [ ] Run Mythril security scanner
- [ ] Check with Certora formal verification
- [ ] Bug bounty program

### Security Features

- ✅ Reentrancy guards on all state-changing functions
- ✅ Pausable for emergency stops
- ✅ UUPS upgrade pattern (owner-only)
- ✅ SafeERC20 for token transfers
- ✅ Authorized processor pattern
- ✅ Grace period for cancellations
- ✅ Timeout mechanism

### Best Practices

1. **Multi-sig for Owner**: Use a multi-sig wallet as contract owner
2. **Processor Security**: Keep backend processor key secure
3. **Monitor Events**: Watch for suspicious activity
4. **Rate Limiting**: Backend should implement rate limiting
5. **Pause Mechanism**: Be ready to pause in emergencies

## Gas Optimization

Average gas costs (estimated):

| Operation     | Gas Cost |
| ------------- | -------- |
| initiateSpend | ~100,000 |
| completeSpend | ~80,000  |
| refundSpend   | ~70,000  |
| cancelSpend   | ~60,000  |

## Mainnet Addresses

### Celo Mainnet

- **SpendRouter Proxy**: `TBD`
- **SpendRouter Implementation**: `TBD`

### Base Mainnet

- **SpendRouter Proxy**: `TBD`
- **SpendRouter Implementation**: `TBD`

## USDC Token Addresses

### Testnets

- **Celo Alfajores**: `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`
- **Base Sepolia**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### Mainnets

- **Celo Mainnet**: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Troubleshooting

### Contract Verification Failed

```bash
# Manual verification
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/SpendRouter.sol:SpendRouter \
  --chain <CHAIN_ID> \
  --constructor-args $(cast abi-encode "constructor()")
```

### Upgrade Failed

Check that you're the owner:

```bash
cast call <PROXY_ADDRESS> "owner()" --rpc-url <RPC_URL>
```

### Transaction Reverted

Check contract is not paused:

```bash
cast call <PROXY_ADDRESS> "paused()" --rpc-url <RPC_URL>
```

## Support

- Review the [implementation plan](../../SPENDING_FEATURE.md)
- Check the [backend README](../server/README.md)
- Open an issue on GitHub

---

Built with Foundry and OpenZeppelin
