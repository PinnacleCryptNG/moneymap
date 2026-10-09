import { Compass } from "../../components/icons";
import { ButtonLink } from "../../components/shared/Button";
import { PublicPage } from "./LegalLayout";

export function NotFoundPage() {
  return (
    <PublicPage>
      <div className="flex flex-col items-center py-16 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue" aria-hidden><Compass size={32} /></span>
        <p className="eyebrow mb-2">Page not found</p>
        <h1 className="mb-3">This page isn't on the map.</h1>
        <p className="mb-8 max-w-md text-ink-3">The link may be old or mistyped. Your MoneyMap is safe — let's get you back.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink to="/">Go to the home page</ButtonLink>
          <ButtonLink to="/app" variant="secondary">Open my MoneyMap</ButtonLink>
        </div>
      </div>
    </PublicPage>
  );
}
