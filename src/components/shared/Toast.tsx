import { CheckCircle2, Info } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ToastItem { id: number; message: string; tone: "success" | "info" }
const ToastContext = createContext<(message: string, tone?: ToastItem["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8">
        {items.map((t) => (
          <div key={t.id} role="status" className="fade-up pointer-events-auto flex max-w-md items-center gap-2 rounded-[12px] bg-navy px-4 py-3 text-small text-white shadow-lg">
            {t.tone === "success" ? <CheckCircle2 size={20} className="shrink-0 text-green" aria-hidden /> : <Info size={20} className="shrink-0 text-[#7fb2ff]" aria-hidden />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
