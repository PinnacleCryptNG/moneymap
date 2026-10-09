import { X } from "../icons";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** "sheet" renders as a bottom sheet on small screens. */
  variant?: "dialog" | "sheet";
}

export function Modal({ open, onClose, title, children, variant = "dialog" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const sheet = variant === "sheet";
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-0 max-h-[90vh] w-full max-w-none bg-transparent p-0 backdrop:bg-night/50 backdrop:backdrop-blur-sm ${
        sheet ? "mt-auto sm:m-auto sm:max-w-lg" : "m-auto max-w-lg px-4"
      }`}
    >
      <div className={`fade-up border border-line bg-surface p-6 shadow-xl ${sheet ? "rounded-t-[24px] sm:rounded-[24px]" : "rounded-[24px]"}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="!text-[20px] !leading-7">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-2">
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function BottomSheet(props: Omit<ModalProps, "variant">) {
  return <Modal {...props} variant="sheet" />;
}
