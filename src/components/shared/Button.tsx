import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type Variant = "primary" | "secondary" | "tertiary" | "danger" | "ghost";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-[12px] transition-[background-color,box-shadow,transform,color] duration-150 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  // Mint with midnight text: the one bright action on a screen (contrast above 12:1 in both themes).
  primary: "bg-mint text-night shadow-[0_8px_24px_-10px_rgb(46_230_168/0.65)] hover:bg-mint-600 hover:shadow-[0_10px_28px_-10px_rgb(46_230_168/0.8)]",
  secondary: "bg-ink/[.06] text-ink hover:bg-ink/10",
  tertiary: "bg-transparent text-blue-600 hover:bg-blue-50",
  danger: "bg-red-50 text-red hover:bg-red/15",
  ghost: "bg-surface text-ink border border-line hover:bg-canvas",
};
const sizes: Record<Size, string> = {
  md: "min-h-12 px-5 text-[16px]",
  sm: "min-h-11 px-4 text-[14px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({ variant = "primary", size = "md", icon, iconRight, className = "", children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function ButtonLink({ variant = "primary", size = "md", icon, iconRight, className = "", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, String(className))} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = "", type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-3 hover:bg-canvas hover:text-ink ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
