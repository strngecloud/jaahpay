"use client";

import { motion } from "framer-motion";
import { SwapInterface } from "@/components/swap/swap-interface-loader";

export function UnifiedInterface() {
  return (
    <div className="min-h-screen pt-24 pb-16 relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.12] animate-float"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--brand-blue)) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-15%] right-[-8%] w-[600px] h-[600px] rounded-full opacity-[0.08] animate-float-delayed"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--brand-green)) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="container relative z-10 max-w-lg mx-auto px-4 mt-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-center mb-6"
        >
          <p className="text-xs font-medium text-white/30 uppercase tracking-[0.2em]">
            Powered by Celo · DeFi Made Simple
          </p>
        </motion.div>

        <SwapInterface />
      </div>
    </div>
  );
}
