/**
 * Minimal ABI for SpendRouter (apps/contracts/src/SpendRouter.sol) —
 * the escrow contract the backend watches, completes and refunds.
 * Must stay in sync with the server's copy in
 * apps/server/src/common/abis/spend-router.abi.ts.
 */
export const SpendRouterABI = [
  {
    type: "function",
    name: "initiateSpend",
    stateMutability: "nonpayable",
    inputs: [
      { name: "usdcAmount", type: "uint256" },
      { name: "ngnAmount", type: "uint256" },
      { name: "recipientHash", type: "bytes32" },
    ],
    outputs: [{ name: "spendId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelSpend",
    stateMutability: "nonpayable",
    inputs: [{ name: "spendId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "SpendInitiated",
    inputs: [
      { name: "spendId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "usdcAmount", type: "uint256", indexed: false },
      { name: "ngnAmount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "recipientHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
