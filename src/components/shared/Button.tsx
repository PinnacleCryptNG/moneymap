import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type Variant = "primary" | "secondary" | "tertiary" | "danger" | "ghost";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  // #0F63D6 keeps white text above 4.5:1 (#1677FF was 4.1:1).
  primary: "bg-blue-600 text-white hover:bg-[#0b51b3] active:bg-[#0b51b3]",
  secondary: "bg-blue-50 text-blue-600 hover:bg-[#dbe9ff]",
  tertiary: "bg-transparent text-blue-600 hover:bg-blue-50",
  danger: "bg-red-50 text-red hover:bg-[#f8dddd]",
  ghost: "bg-white text-navy border border-mist hover:bg-cloud",
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
      className={`inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-navy-500 hover:bg-cloud hover:text-navy ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
