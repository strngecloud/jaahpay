import Link from "next/link";
import Image from "next/image";
import { SiteConfig } from "@/config/site";
import { Mail } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.35.77 1.05.77 2.12v3.15c0 .3.21.66.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

const PRODUCT_LINKS = [
  { label: "Launch App", href: "/app" },
  { label: "Transactions", href: "/transactions" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
];

const RESOURCE_LINKS = [
  {
    label: "ERC-8004 Docs",
    href: "https://docs.celo.org/build-on-celo/build-with-ai/8004",
  },
  { label: "Mento Protocol", href: "https://mento.org" },
  {
    label: "USDC on CeloScan",
    href: "https://celoscan.io/token/0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  },
  { label: "GitHub", href: SiteConfig.links.github },
];

export function Footer() {
  return (
    <footer className="bg-surface-0 border-t border-white/[0.05] text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-6">
            <Image
              src="/images/logo_name.png"
              alt="Jahpay"
              width={150}
              height={40}
              style={{ height: "auto" }}
            />
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Oracle-priced stablecoin swaps and bank payouts on Celo, powered
              by Mento Protocol.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a
                href={SiteConfig.links.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-brand-blue transition-colors"
                aria-label="Jahpay on X"
              >
                <XIcon className="h-5 w-5" />
              </a>
              <a
                href={SiteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-brand-blue transition-colors"
                aria-label="Jahpay on GitHub"
              >
                <GitHubIcon className="h-5 w-5" />
              </a>
              <a
                href="mailto:hello@jahpay.app"
                className="text-white/40 hover:text-brand-blue transition-colors"
                aria-label="Email Jahpay"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-2">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">
                Product
              </h3>
              <ul className="space-y-4">
                {PRODUCT_LINKS.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-white/50 hover:text-brand-blue text-sm transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">
                Resources
              </h3>
              <ul className="space-y-4">
                {RESOURCE_LINKS.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/50 hover:text-brand-blue text-sm transition-colors"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06]">
          <p className="text-center text-sm text-white/35">
            &copy; {new Date().getFullYear()} Jahpay. Non-custodial — your keys,
            your tokens.
          </p>
        </div>
      </div>
    </footer>
  );
}
