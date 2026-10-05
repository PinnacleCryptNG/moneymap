import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const control =
  "w-full min-h-12 rounded-[10px] border border-mist bg-white px-3.5 text-navy placeholder:text-navy-500/70 focus:border-blue focus:outline-none focus:ring-3 focus:ring-blue/20";

function Wrap({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-navy">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-caption !font-normal text-navy-500">{hint}</p>}
    </div>
  );
}

export function Input({ label, hint, prefix, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; prefix?: string }) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-500">{prefix}</span>}
        <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={`${control} ${prefix ? "pl-8" : ""}`} {...rest} />
      </div>
    </Wrap>
  );
}

export function Select({ label, hint, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint}>
      <select id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={control} {...rest}>
        {children}
      </select>
    </Wrap>
  );
}

export function TextArea({ label, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint}>
      <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={`${control} min-h-24 py-3`} {...rest} />
    </Wrap>
  );
}
