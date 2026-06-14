import {
    BankTransferRequest,
    BankTransferResponse,
    BankAccountValidation,
} from '../../common/types/spend.types';

export interface IBankProvider {
    /**
     * Get the provider name
     */
    getProviderName(): string;

    /**
     * Initialize the provider (setup auth, credentials, etc.)
     */
    initialize(): Promise<void>;

    /**
     * Validate a bank account
     */
    validateAccount(
        accountNumber: string,
        bankCode: string,
    ): Promise<BankAccountValidation>;

    /**
     * Initiate a bank transfer
     */
    transfer(request: BankTransferRequest): Promise<BankTransferResponse>;

    /**
     * Check the status of a transfer
     */
    getTransferStatus(reference: string): Promise<BankTransferResponse>;

    /**
     * Check if the provider is available
     */
    isAvailable(): Promise<boolean>;
}
