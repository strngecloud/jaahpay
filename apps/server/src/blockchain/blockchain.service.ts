import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    createPublicClient,
    createWalletClient,
    http,
    parseAbiItem,
    WatchContractEventReturnType,
    celo,
    celoAlfajores,
    base,
    baseSepolia,
    parseEther,
    formatEther,
} from '../common/types/viem-wrapper';
import { privateKeyToAccount } from 'viem/accounts';
import { Chain, SpendInitiatedEvent } from '../common/types/spend.types';
import { SpendProcessorService } from '../spend/services/spend-processor.service';
import { SPEND_ROUTER_ABI } from '../common/abis/spend-router.abi';

@Injectable()
export class BlockchainService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BlockchainService.name);
    private celoClient: any;
    private baseClient: any;
    private celoWalletClient: any;
    private baseWalletClient: any;
    private processorAccount: any;
    private unwatchCelo: WatchContractEventReturnType | null = null;
    private unwatchBase: WatchContractEventReturnType | null = null;

    private readonly SPEND_INITIATED_EVENT = parseAbiItem(
        'event SpendInitiated(uint256 indexed spendId, address indexed user, uint256 usdcAmount, uint256 ngnAmount, uint256 timestamp)',
    );

    private readonly SPEND_COMPLETED_EVENT = parseAbiItem(
        'event SpendCompleted(uint256 indexed spendId, string bankTransactionRef)',
    );

    private readonly SPEND_REFUNDED_EVENT = parseAbiItem(
        'event SpendRefunded(uint256 indexed spendId, string reason)',
    );

    constructor(
        private readonly configService: ConfigService,
        private readonly spendProcessor: SpendProcessorService,
    ) {
        const celoRpcUrl = this.configService.get<string>('CELO_RPC_URL');
        const baseRpcUrl = this.configService.get<string>('BASE_RPC_URL');
        const nodeEnv = this.configService.get<string>('NODE_ENV');
        const processorKey = this.configService.get<string>('PROCESSOR_WALLET_PRIVATE_KEY');

        if (!processorKey || processorKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            this.logger.error('PROCESSOR_WALLET_PRIVATE_KEY not configured - blockchain transactions will fail!');
        } else {
            this.processorAccount = privateKeyToAccount(processorKey as `0x${string}`);
            this.logger.log(`Processor wallet: ${this.processorAccount.address}`);
        }

        const celoChain = nodeEnv === 'production' ? celo : celoAlfajores;
        const baseChain = nodeEnv === 'production' ? base : baseSepolia;

        // Setup Celo clients
        this.celoClient = createPublicClient({
            chain: celoChain,
            transport: http(celoRpcUrl),
        });

        if (this.processorAccount) {
            this.celoWalletClient = createWalletClient({
                account: this.processorAccount,
                chain: celoChain,
                transport: http(celoRpcUrl),
            });
        }

        // Setup Base clients
        this.baseClient = createPublicClient({
            chain: baseChain,
            transport: http(baseRpcUrl),
        });

        if (this.processorAccount) {
            this.baseWalletClient = createWalletClient({
                account: this.processorAccount,
                chain: baseChain,
                transport: http(baseRpcUrl),
            });
        }
    }

    async onModuleInit() {
        this.logger.log('Initializing blockchain event listeners...');
        await this.startEventListeners();
    }

    private async startEventListeners() {
        const celoContractAddress = this.configService.get<string>(
            'SPEND_ROUTER_ADDRESS_CELO',
        );
        const baseContractAddress = this.configService.get<string>(
            'SPEND_ROUTER_ADDRESS_BASE',
        );

        if (celoContractAddress && celoContractAddress !== '0x0000000000000000000000000000000000000000') {
            this.startCeloListener(celoContractAddress as `0x${string}`);
        }

        if (baseContractAddress && baseContractAddress !== '0x0000000000000000000000000000000000000000') {
            this.startBaseListener(baseContractAddress as `0x${string}`);
        }
    }

    private startCeloListener(contractAddress: `0x${string}`) {
        this.logger.log(`Starting Celo event listener at ${contractAddress}`);

        this.unwatchCelo = this.celoClient.watchContractEvent({
            address: contractAddress,
            abi: [this.SPEND_INITIATED_EVENT],
            eventName: 'SpendInitiated',
            onLogs: async (logs: any[]) => {
                for (const log of logs) {
                    await this.handleSpendInitiated(log, Chain.CELO);
                }
            },
            onError: (error: Error) => {
                this.logger.error('Celo event listener error:', error);
            },
        });
    }

    private startBaseListener(contractAddress: `0x${string}`) {
        this.logger.log(`Starting Base event listener at ${contractAddress}`);

        this.unwatchBase = this.baseClient.watchContractEvent({
            address: contractAddress,
            abi: [this.SPEND_INITIATED_EVENT],
            eventName: 'SpendInitiated',
            onLogs: async (logs: any[]) => {
                for (const log of logs) {
                    await this.handleSpendInitiated(log, Chain.BASE);
                }
            },
            onError: (error: Error) => {
                this.logger.error('Base event listener error:', error);
            },
        });
    }

    private async handleSpendInitiated(log: any, chain: Chain) {
        try {
            const { args, blockNumber, transactionHash } = log;

            const event: SpendInitiatedEvent = {
                spendId: args.spendId.toString(),
                user: args.user as string,
                usdcAmount: args.usdcAmount.toString(),
                ngnAmount: args.ngnAmount.toString(),
                timestamp: Number(args.timestamp),
                blockNumber: Number(blockNumber),
                transactionHash: transactionHash as string,
                chain,
            };

            this.logger.log(
                `SpendInitiated event detected on ${chain}: ${event.spendId}`,
            );

            // Process the spend through the processor service
            await this.spendProcessor.processSpendInitiated(event);
        } catch (error) {
            this.logger.error('Error handling SpendInitiated event:', error);
        }
    }

    async getClient(chain: Chain): Promise<any> {
        return chain === Chain.CELO ? this.celoClient : this.baseClient;
    }

    async getBlockNumber(chain: Chain): Promise<bigint> {
        const client = await this.getClient(chain);
        return await client.getBlockNumber();
    }

    async getTransaction(chain: Chain, hash: `0x${string}`) {
        const client = await this.getClient(chain);
        return await client.getTransaction({ hash });
    }

    /**
     * Complete a spend on the blockchain after successful bank transfer
     */
    async completeSpend(
        spendId: string,
        bankTransactionRef: string,
        chain: Chain,
    ): Promise<string> {
        try {
            const walletClient = chain === Chain.CELO ? this.celoWalletClient : this.baseWalletClient;
            const contractAddress = chain === Chain.CELO
                ? this.configService.get<string>('SPEND_ROUTER_ADDRESS_CELO')
                : this.configService.get<string>('SPEND_ROUTER_ADDRESS_BASE');

            if (!walletClient) {
                throw new Error('Wallet client not initialized - check PROCESSOR_WALLET_PRIVATE_KEY');
            }

            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                throw new Error(`SpendRouter address not configured for ${chain}`);
            }

            this.logger.log(
                `Completing spend ${spendId} on ${chain} with ref: ${bankTransactionRef}`,
            );

            // Call completeSpend on smart contract
            const hash = await walletClient.writeContract({
                address: contractAddress as `0x${string}`,
                abi: SPEND_ROUTER_ABI,
                functionName: 'completeSpend',
                args: [BigInt(spendId), bankTransactionRef],
            });

            this.logger.log(`Completion transaction sent: ${hash}`);

            // Wait for confirmation
            const publicClient = chain === Chain.CELO ? this.celoClient : this.baseClient;
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 2,
            });

            if (receipt.status === 'success') {
                this.logger.log(
                    `Spend ${spendId} completed successfully on-chain: ${hash}`,
                );
                return hash;
            } else {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        } catch (error: any) {
            this.logger.error(
                `Failed to complete spend ${spendId} on blockchain:`,
                error.message,
            );
            throw error;
        }
    }

    /**
     * Refund a spend on the blockchain after failed bank transfer
     */
    async refundSpend(
        spendId: string,
        reason: string,
        chain: Chain,
    ): Promise<string> {
        try {
            const walletClient = chain === Chain.CELO ? this.celoWalletClient : this.baseWalletClient;
            const contractAddress = chain === Chain.CELO
                ? this.configService.get<string>('SPEND_ROUTER_ADDRESS_CELO')
                : this.configService.get<string>('SPEND_ROUTER_ADDRESS_BASE');

            if (!walletClient) {
                throw new Error('Wallet client not initialized - check PROCESSOR_WALLET_PRIVATE_KEY');
            }

            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                throw new Error(`SpendRouter address not configured for ${chain}`);
            }

            this.logger.log(
                `Refunding spend ${spendId} on ${chain}, reason: ${reason}`,
            );

            // Call refundSpend on smart contract
            const hash = await walletClient.writeContract({
                address: contractAddress as `0x${string}`,
                abi: SPEND_ROUTER_ABI,
                functionName: 'refundSpend',
                args: [BigInt(spendId), reason],
            });

            this.logger.log(`Refund transaction sent: ${hash}`);

            // Wait for confirmation
            const publicClient = chain === Chain.CELO ? this.celoClient : this.baseClient;
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 2,
            });

            if (receipt.status === 'success') {
                this.logger.log(
                    `Spend ${spendId} refunded successfully on-chain: ${hash}`,
                );
                return hash;
            } else {
                throw new Error(`Transaction reverted: ${hash}`);
            }
        } catch (error: any) {
            this.logger.error(
                `Failed to refund spend ${spendId} on blockchain:`,
                error.message,
            );
            throw error;
        }
    }

    /**
     * Handle timed out spends (emergency refund after 15 minutes)
     */
    async handleTimedOutSpend(spendId: string, chain: Chain): Promise<string> {
        try {
            const walletClient = chain === Chain.CELO ? this.celoWalletClient : this.baseWalletClient;
            const contractAddress = chain === Chain.CELO
                ? this.configService.get<string>('SPEND_ROUTER_ADDRESS_CELO')
                : this.configService.get<string>('SPEND_ROUTER_ADDRESS_BASE');

            if (!walletClient || !contractAddress) {
                throw new Error('Wallet or contract not configured');
            }

            this.logger.log(`Handling timed out spend ${spendId} on ${chain}`);

            const hash = await walletClient.writeContract({
                address: contractAddress as `0x${string}`,
                abi: SPEND_ROUTER_ABI,
                functionName: 'emergencyRefund',
                args: [BigInt(spendId)],
            });

            const publicClient = chain === Chain.CELO ? this.celoClient : this.baseClient;
            await publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 2,
            });

            this.logger.log(`Emergency refund completed: ${hash}`);
            return hash;
        } catch (error: any) {
            this.logger.error(`Failed to handle timeout for ${spendId}:`, error.message);
            throw error;
        }
    }

    onModuleDestroy() {
        this.logger.log('Stopping blockchain event listeners...');
        if (this.unwatchCelo) {
            this.unwatchCelo();
        }
        if (this.unwatchBase) {
            this.unwatchBase();
        }
    }
}
