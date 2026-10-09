import { Link } from "react-router-dom";
import { LegalSection, PublicPage } from "./LegalLayout";

export function PrivacyPage() {
  return (
    <PublicPage>
      <p className="eyebrow mb-2">Privacy policy</p>
      <h1 className="mb-3">How MoneyMap uses your information</h1>
      <p className="mb-8 text-ink-3">Last updated 9 October 2026 · Written to follow the Nigeria Data Protection Act 2023.</p>

      <div className="mb-8 rounded-[16px] border border-line bg-canvas p-4 text-small text-ink-2">
        This MoneyMap is a prototype built for the Zenith Bank Zecathon. It runs on <strong>made-up sample customers only</strong> — no real customer data is used.
        The policy below describes how MoneyMap would handle your information in a live service operated with Zenith Bank.
      </div>

      <LegalSection title="The short version">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>MoneyMap uses only the information you allow, and you can change that at any time.</li>
          <li>It uses your information for one purpose: suggesting Zenith products that could genuinely help you, and explaining why.</li>
          <li>It never sells your data, never shows you ads, never moves your money and never makes credit decisions.</li>
          <li>You can download everything MoneyMap holds about you, or delete it, from Settings.</li>
        </ul>
      </LegalSection>

      <LegalSection title="What MoneyMap uses">
        <p>Only what you choose to share, in five separate permissions:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li><strong>Account activity</strong> — balances and how you pay (card, transfer, cash).</li>
          <li><strong>Income patterns</strong> — money coming into your account, such as salary.</li>
          <li><strong>Spending patterns</strong> — money going out, grouped into categories like food or rent.</li>
          <li><strong>Existing products</strong> — the Zenith products you already have.</li>
          <li><strong>Financial goals</strong> — the goals you set in MoneyMap.</li>
        </ul>
        <p>
          If you answer the optional “Your money” questions, MoneyMap also uses those answers (account balances, income, expenses and savings goals) where you haven't shared that part of your account.
          MoneyMap never sees your PIN, passwords or full card details.
        </p>
      </LegalSection>

      <LegalSection title="Why it's used">
        <p>To build a picture of your finances, notice when a product might help (for example when your salary lands and you have a savings goal), and explain every suggestion. The lawful basis is your consent, which you can withdraw at any time.</p>
        <p>MoneyMap does not make automated decisions with legal or similar effects: it only suggests. Zenith Bank's own processes decide eligibility, account opening and credit.</p>
      </LegalSection>

      <LegalSection title="What's kept, and for how long">
        <p>MoneyMap keeps your permissions and their history, your goals and answers, the suggestions it made with their reasons, your feedback, and a tamper-evident log of decisions. The log records what was decided, never amounts or transaction details.</p>
        <p>Data is kept while you use MoneyMap. When you delete your data or stop using the service, it is removed; only the record that a deletion happened remains in the log. [Retention period to be confirmed with Zenith Bank's data protection officer.]</p>
      </LegalSection>

      <LegalSection title="How it's protected">
        <p>Encrypted connections (HTTPS) everywhere; sensitive fields encrypted in storage; strict access checks so only you can see your information; and rate limits and bot protection on sign-in. Details are in the project's security documentation.</p>
      </LegalSection>

      <LegalSection title="Cookies and analytics">
        <p>MoneyMap sets no cookies and uses no advertising or third-party trackers. Your browser stores only what the app needs to work. Public pages count visits anonymously — no cookies, no IP addresses, no identifiers — and never on your financial screens. If your browser sends “Do Not Track”, nothing is counted.</p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under the Nigeria Data Protection Act you can access, correct, port and erase your data, withdraw consent, and object to processing. In MoneyMap:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li><strong>Download my data</strong> and <strong>Delete my MoneyMap data</strong> are in <Link to="/app/settings" className="font-semibold text-blue-600 hover:underline">Settings</Link>.</li>
          <li>Each permission can be switched off there too, with immediate effect.</li>
          <li>You can also complain to the Nigeria Data Protection Commission.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who to contact">
        <p>[Data controller: Zenith Bank Plc, for a live service.] [Data protection officer contact: to be added.]</p>
      </LegalSection>
    </PublicPage>
  );
}
