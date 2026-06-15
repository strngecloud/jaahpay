export const SPEND_ROUTER_ABI = [
  {
    type: 'function',
    name: 'initiateSpend',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'ngnAmount', type: 'uint256' },
      { name: 'recipientHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'spendId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'completeSpend',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spendId', type: 'uint256' },
      { name: 'bankTransactionRef', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundSpend',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spendId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelSpend',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spendId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'emergencyRefund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spendId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getSpend',
    stateMutability: 'view',
    inputs: [{ name: 'spendId', type: 'uint256' }],
    outputs: [
      {
        name: 'spend',
        type: 'tuple',
        components: [
          { name: 'user', type: 'address' },
          { name: 'usdcAmount', type: 'uint256' },
          { name: 'ngnAmount', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'recipientHash', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'SpendInitiated',
    inputs: [
      { name: 'spendId', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'usdcAmount', type: 'uint256', indexed: false },
      { name: 'ngnAmount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'recipientHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SpendCompleted',
    inputs: [
      { name: 'spendId', type: 'uint256', indexed: true },
      { name: 'bankTransactionRef', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SpendRefunded',
    inputs: [
      { name: 'spendId', type: 'uint256', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SpendCancelled',
    inputs: [
      { name: 'spendId', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;
