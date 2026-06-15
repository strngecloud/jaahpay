"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { validateAccount } from "@/lib/spend/api";
import {
  isValidAccountNumber,
  sanitizeAccountInput,
} from "@/lib/spend/constants";
import type { Bank, SpendRecipient, SpendStep } from "@/lib/spend/types";

interface UseSpendRecipientOptions {
  banks: Bank[];
}

export function useSpendRecipient({ banks }: UseSpendRecipientOptions) {
  const [step, setStep] = useState<SpendStep>("recipient");
  const [accountNumber, setAccountNumberRaw] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const verifyRequestId = useRef(0);

  const setAccountNumber = useCallback((value: string) => {
    setAccountNumberRaw(sanitizeAccountInput(value));
    setAccountName("");
    setVerificationError(null);
  }, []);

  const selectBank = useCallback((code: string) => {
    setBankCode(code);
    setAccountName("");
    setVerificationError(null);
  }, []);

  const selectedBank = banks.find((b) => b.code === bankCode);

  const canVerify =
    isValidAccountNumber(accountNumber) && bankCode.length > 0;

  const canProceed =
    canVerify && accountName.length > 0 && !isVerifying && !verificationError;

  // Auto-verify when bank is selected and account number is complete
  useEffect(() => {
    if (!canVerify) {
      setAccountName("");
      setVerificationError(null);
      return;
    }

    const requestId = ++verifyRequestId.current;
    const timer = setTimeout(async () => {
      setIsVerifying(true);
      setVerificationError(null);

      try {
        const result = await validateAccount(accountNumber, bankCode);
        if (requestId !== verifyRequestId.current) return;

        if (result.valid && result.accountName) {
          setAccountName(result.accountName);
          setVerificationError(null);
        } else {
          setAccountName("");
          setVerificationError("Could not verify this account. Check details.");
        }
      } catch {
        if (requestId !== verifyRequestId.current) return;
        setAccountName("");
        setVerificationError("Verification failed. Please try again.");
      } finally {
        if (requestId === verifyRequestId.current) {
          setIsVerifying(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [accountNumber, bankCode, canVerify]);

  const fillRecipient = useCallback((recipient: SpendRecipient) => {
    setAccountNumber(recipient.accountNumber);
    setBankCode(recipient.bankCode);
    setAccountName(recipient.accountName);
    setVerificationError(null);
    setStep("recipient");
  }, [setAccountNumber]);

  const goToConfirm = useCallback(() => {
    if (!canProceed || !selectedBank) return;
    setStep("confirm");
  }, [canProceed, selectedBank]);

  const goBack = useCallback(() => {
    setStep("recipient");
  }, []);

  const reset = useCallback(() => {
    setStep("recipient");
    setAccountNumber("");
    setBankCode("");
    setAccountName("");
    setVerificationError(null);
  }, [setAccountNumber]);

  const recipient: SpendRecipient | null =
    canProceed && selectedBank
      ? {
          accountNumber,
          bankCode,
          bankName: selectedBank.name,
          accountName,
        }
      : null;

  return {
    step,
    accountNumber,
    bankCode,
    accountName,
    selectedBank,
    isVerifying,
    verificationError,
    canProceed,
    recipient,
    setAccountNumber,
    selectBank,
    fillRecipient,
    goToConfirm,
    goBack,
    reset,
  };
}
