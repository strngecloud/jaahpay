"use client";

import { useState, useEffect } from "react";
import { Activity, ChevronRight } from "lucide-react";
import { useReadContract } from "wagmi";
import { useBanks } from "@/lib/hooks/use-banks";
import { useSpendRecipient } from "@/lib/hooks/use-spend-recipient";
import { useSpendRecipients } from "@/lib/hooks/use-spend-recipients";
import { useSpendFlow } from "@/lib/hooks/use-spend-flow";
import { RecipientForm } from "./recipient-form";
import { RecipientConfirm } from "./recipient-confirm";
import { RecipientList } from "./recipient-list";
import { AmountEntry } from "./amount-entry";
import { SpendReview } from "./spend-review";
import { SpendProcessing } from "./spend-processing";
import { SWAP_TOKENS } from "@/lib/minipay/constants";

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function SpendPanel() {
  const [mounted, setMounted] = useState(false);
  const { banks, isLoading: banksLoading } = useBanks();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-64" />;
  }

  return <SpendPanelContent banks={banks} banksLoading={banksLoading} />;
}

function SpendPanelContent({
  banks,
  banksLoading,
}: {
  banks: ReturnType<typeof useBanks>["banks"];
  banksLoading: boolean;
}) {
  const recipient = useSpendRecipient({ banks });
  const recipients = useSpendRecipients(banks);
  const flow = useSpendFlow();

  // Get USDC balance for review screen
  const usdcToken = SWAP_TOKENS.find((t) => t.symbol === "USDC");
  const { data: usdcBalanceRaw, isLoading: isLoadingBalance } = useReadContract(
    {
      address: usdcToken?.address as `0x${string}`,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: flow.address ? [flow.address] : undefined,
      query: {
        enabled: !!flow.address && !!usdcToken && flow.step === "review",
      },
    },
  );

  const usdcBalance = usdcBalanceRaw
    ? parseFloat((Number(usdcBalanceRaw) / 1e6).toFixed(6))
    : null;

  const handleConfirm = () => {
    if (!recipient.recipient) return;
    flow.handleRecipientConfirmed(recipient.recipient);
  };

  return (
    <div className="space-y-4">
      {/* Recipient Step */}
      {flow.step === "recipient" && recipient.step === "recipient" && (
        <>
          <RecipientForm
            accountNumber={recipient.accountNumber}
            onAccountNumberChange={recipient.setAccountNumber}
            selectedBank={recipient.selectedBank}
            onBankSelect={(bank) => recipient.selectBank(bank.code)}
            accountName={recipient.accountName}
            isVerifying={recipient.isVerifying}
            verificationError={recipient.verificationError}
            canProceed={recipient.canProceed}
            onNext={recipient.goToConfirm}
            banks={banks}
            banksLoading={banksLoading}
            suggestions={recipients.bankSuggestions}
            onSuggestionSelect={recipient.fillRecipient}
          />

          {/* Success rate monitor banner */}
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors group">
            <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-brand-green" />
            </div>
            <span className="flex-1 text-left text-xs font-medium text-white/60">
              Bank Transfer Success Rate Monitor
            </span>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-brand-green transition-colors" />
          </button>

          <RecipientList
            activeTab={recipients.activeTab}
            onTabChange={recipients.setActiveTab}
            recipients={recipients.filteredList}
            onSelect={recipient.fillRecipient}
            onToggleFavourite={recipients.toggleFavourite}
            isFavourite={recipients.isFavourite}
            searchQuery={recipients.searchQuery}
            onSearchChange={recipients.setSearchQuery}
            isLoading={recipients.isLoading}
          />
        </>
      )}

      {/* Confirm Step */}
      {flow.step === "recipient" &&
        recipient.step === "confirm" &&
        recipient.recipient && (
          <RecipientConfirm
            recipient={recipient.recipient}
            onConfirm={handleConfirm}
            onBack={recipient.goBack}
          />
        )}

      {/* Amount Step */}
      {flow.step === "amount" && flow.recipient && (
        <AmountEntry
          recipient={flow.recipient}
          ngnAmount={flow.ngnAmount}
          onNgnAmountChange={flow.setNgnAmount}
          narration={flow.narration}
          onNarrationChange={flow.setNarration}
          onNext={flow.goToReview}
          onBack={flow.goBackToRecipient}
          canProceed={flow.canProceedToReview}
          amountError={flow.amountError}
          usdcEquivalent={flow.currentQuote?.usdcAmount ?? null}
          exchangeRate={flow.exchangeRate.rate}
          isRateLoading={flow.exchangeRate.isLoading}
          confidence={flow.exchangeRate.confidence}
        />
      )}

      {/* Review Step */}
      {flow.step === "review" && flow.recipient && flow.quote && (
        <SpendReview
          recipient={flow.recipient}
          quote={flow.quote}
          usdcBalance={usdcBalance}
          isLoadingBalance={isLoadingBalance}
          onConfirm={flow.executeSpend}
          onBack={flow.goBackToAmount}
          isSubmitting={flow.isSubmitting}
        />
      )}

      {/* Processing Step */}
      {(flow.step === "processing" ||
        flow.step === "complete" ||
        flow.step === "error") && (
        <SpendProcessing
          processingStep={flow.processingStep}
          txHash={flow.txHash}
          spendStatus={flow.spendStatus}
          error={flow.flowError}
          onDone={flow.resetFlow}
          onRetry={flow.retryFromReview}
        />
      )}
    </div>
  );
}
