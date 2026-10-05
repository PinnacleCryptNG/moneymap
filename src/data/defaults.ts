import type { Preferences } from "../types";

export const DEFAULT_PREFERENCES: Preferences = {
  categories: { savings: true, investments: true, financing: true, business: true, cards: true, other: true },
  frequency: "highly_relevant",
};
