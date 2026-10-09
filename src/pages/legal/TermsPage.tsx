import { LegalSection, PublicPage } from "./LegalLayout";

export function TermsPage() {
  return (
    <PublicPage>
      <p className="eyebrow mb-2">Terms of use</p>
      <h1 className="mb-3">Using MoneyMap</h1>
      <p className="mb-8 text-navy-500">Last updated 9 October 2026</p>

      <div className="mb-8 rounded-[16px] border border-mist bg-cloud p-4 text-small text-navy-700">
        This MoneyMap is a prototype built for the Zenith Bank Zecathon, running on synthetic customers. It is not a live banking service.
      </div>

      <LegalSection title="What MoneyMap is">
        <p>MoneyMap helps you understand your finances and suggests Zenith Bank products that may fit your situation, with the reasons. It is guidance, not financial advice, and it does not know everything about your circumstances.</p>
      </LegalSection>

      <LegalSection title="What MoneyMap doesn't do">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>It never moves your money, opens accounts or applies for credit on its own.</li>
          <li>It never guarantees approval, returns or any financial outcome.</li>
          <li>A suggestion is not an offer. Eligibility and approval are decided by Zenith Bank's own processes.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Product information">
        <p>MoneyMap shows only product facts Zenith Bank has published, with their sources. Interest rates, fees, limits, eligibility and processing times are subject to Zenith Bank's current requirements; always confirm them with the bank before you decide.</p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>You decide what MoneyMap can use, and can change it at any time. You can turn down any suggestion, and MoneyMap will respect it: “Not relevant” stops that product being suggested again for a while, and “I don't want this” stops it for good.</p>
      </LegalSection>

      <LegalSection title="Using it fairly">
        <p>Don't try to access other people's information, interfere with the service, or use automated tools against it. Requests are rate limited and protected against bots.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>These terms may change as the service develops; the date above shows the latest version. [Contact details for a live service: to be added.]</p>
      </LegalSection>
    </PublicPage>
  );
}
