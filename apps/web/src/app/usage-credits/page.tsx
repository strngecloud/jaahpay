import { Clock } from "lucide-react";

export default function UsageCreditsPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="flex-1 jahpay-bg jahpay-grid flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6 px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-blue/20 to-brand-green/20 border border-white/[0.08] flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-brand-blue" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Coming Soon</h1>
            <p className="text-white/50 max-w-sm mx-auto">
              Usage credits are on their way. We&apos;ll notify you when this
              feature launches.
            </p>
          </div>
          <span className="inline-block px-4 py-1.5 rounded-full border border-brand-blue/25 bg-brand-blue/8 text-xs font-semibold text-brand-blue uppercase tracking-wider">
            In development
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 jahpay-bg jahpay-grid min-h-screen pt-24 pb-20">
      <div className="container px-4 mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">Usage Credits</h1>
        <p className="text-white/50">Manage and track your usage credits.</p>
      </div>
    </main>
  );
}
