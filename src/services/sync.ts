// API mode: mirror each store action to the MoneyMap API, then re-hydrate from the server,
// which is the system of record for consent, goals, recommendations, feedback and audit.
import type { Action, AppState } from "../app/providers/store";
import { http, type ServerSnapshot } from "./http";

/** Returns a fresh server snapshot, or null when there's nothing to re-hydrate. */
export async function syncAction(action: Action, prev: AppState): Promise<ServerSnapshot | null> {
  switch (action.type) {
    case "select_customer":
      await http.startSession(action.customerId, false);
      break;
    case "demo_load":
      await http.startSession(action.customerId, true);
      break;
    case "complete_onboarding":
      await http.setConsent(action.permissions);
      if (action.goal) await http.createGoal(action.goal);
      break;
    case "set_permission":
      await http.setConsent({ [action.key]: action.granted });
      break;
    case "withdraw_all":
      await http.setConsent({
        account_activity: false,
        income_patterns: false,
        spending_patterns: false,
        existing_products: false,
        financial_goals: false,
      });
      break;
    case "upsert_goal": {
      const existing = action.goal.id && prev.goals.find((g) => g.id === action.goal.id);
      if (existing) await http.updateGoal(existing.id, action.goal);
      else await http.createGoal(action.goal);
      break;
    }
    case "delete_goal":
      await http.deleteGoal(action.id);
      break;
    case "set_active_goal":
      await http.updateGoal(action.id, { active: true });
      break;
    case "contribute": {
      const g = prev.goals.find((x) => x.id === action.id);
      if (g) await http.updateGoal(g.id, { saved: Math.max(0, g.saved + action.amount) });
      break;
    }
    case "set_preferences":
      await http.setPreferences(action.preferences);
      break;
    case "feedback":
      await http.feedback(action.id, action.feedback);
      break;
    case "set_recommendation_status":
      if (action.status === "explored") await http.explored(action.id);
      break;
    case "apply":
      await http.apply(action.productId);
      break;
    case "set_product_status":
      await http.setProductStatus(action.productId, action.status);
      break;
    case "reset":
      await http.resetAll();
      http.clearSession();
      return null;
    default:
      return null;
  }
  return http.hasSession() ? http.snapshot() : null;
}
