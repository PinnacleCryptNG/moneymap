/**
 * MoneyMap's own icon set.
 *
 * Drawn on a 24px grid with a 1.75 stroke and round ends. The signature: most icons carry one
 * "route" accent — a start dot, a goal dot or a single stroke — in the brand mint
 * (`--icon-accent`), echoing the logo and the route graph. Where an icon sits on a coloured
 * warning or a mint button, the accent falls back to the icon's own colour (see index.css).
 */
import type { ComponentType, ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  strokeWidth?: number | string;
}
export type IconType = ComponentType<IconProps>;

function make(name: string, body: ReactNode): IconType {
  const Icon = ({ size = 24, strokeWidth = 1.75, className, ...rest }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest["aria-label"] ? undefined : true}
      className={`mm-icon${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {body}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
}

/** Accent stroke and accent dot. */
const A = ({ d }: { d: string }) => <path className="mm-a" d={d} />;
const Dot = ({ x, y, r = 1.6 }: { x: number; y: number; r?: number }) => <circle className="mm-af" cx={x} cy={y} r={r} />;
const RING = <circle cx="12" cy="12" r="9" />;
const SHIELD = <path d="M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6z" />;
const FILE = (
  <>
    <path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
    <path d="M14 3.5V8h4.5" />
  </>
);
const BELL = (
  <>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </>
);
const MONITOR = (
  <>
    <rect x="3" y="4" width="18" height="12.5" rx="2.5" />
    <path d="M9 20.5h6M12 16.5v4" />
  </>
);
const THUMB = (
  <>
    <path d="M7 10.5V20H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1z" />
    <path d="M7 10.5l3.6-6.6a2.2 2.2 0 0 1 3.9 1.7L13.8 9H18a2 2 0 0 1 2 2.3l-1.2 6.9a2.2 2.2 0 0 1-2.1 1.8H7" />
  </>
);

// ---------- Arrows: every arrow sets off from a "you are here" dot. ----------
export const ArrowRight = make("ArrowRight", <><Dot x={4.5} y={12} /><path d="M8 12h11M14 7l5 5-5 5" /></>);
export const ArrowLeft = make("ArrowLeft", <><Dot x={19.5} y={12} /><path d="M16 12H5M10 7l-5 5 5 5" /></>);
export const ArrowUpRight = make("ArrowUpRight", <><Dot x={5.5} y={18.5} /><path d="M8 16L18 6M10 6h8v8" /></>);
export const ArrowDownLeft = make("ArrowDownLeft", <><Dot x={18.5} y={5.5} /><path d="M16 8L6 18M6 10v8h8" /></>);
export const ExternalLink = make("ExternalLink", <><path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5" /><A d="M14 4h6v6M20 4l-8.5 8.5" /></>);
export const Download = make("Download", <><A d="M12 4v10.5M7.5 10L12 14.5 16.5 10" /><path d="M4.5 19.5h15" /></>);
export const TrendingUp = make("TrendingUp", <><path d="M3 17l6-6 4 4 7.5-7.5" /><A d="M15 7.5h5.5V13" /></>);
export const TrendingDown = make("TrendingDown", <><path d="M3 7l6 6 4-4 7.5 7.5" /><A d="M20.5 11v5.5H15" /></>);
export const RotateCcw = make("RotateCcw", <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><A d="M4.5 3.5v4h4" /></>);
export const RefreshCw = make("RefreshCw", <><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1" /><A d="M18 3.5v4h-4M6 20.5v-4h4" /></>);
export const MousePointer2 = make("MousePointer2", <><path d="M5 4l13.5 6-5.8 2.2L10.5 18z" /><Dot x={18} y={18.5} /></>);

// ---------- Marks ----------
export const Check = make("Check", <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const X = make("X", <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />);
export const Plus = make("Plus", <path d="M12 5v14M5 12h14" />);
export const Minus = make("Minus", <path d="M5 12h14" />);
export const Circle = make("Circle", <circle cx="12" cy="12" r="8" />);
export const CheckCircle2 = make("CheckCircle2", <>{RING}<A d="M8 12.3l2.8 2.8L16 9.6" /></>);
export const CircleCheck = CheckCircle2;
export const XCircle = make("XCircle", <>{RING}<A d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" /></>);
export const CircleAlert = make("CircleAlert", <>{RING}<path d="M12 7.5v5.5" /><Dot x={12} y={16.3} r={1.2} /></>);
export const Info = make("Info", <>{RING}<path d="M12 11v5.5" /><Dot x={12} y={7.8} r={1.2} /></>);
export const CircleHelp = make("CircleHelp", <>{RING}<path d="M9.6 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.3" /><Dot x={12} y={16.8} r={1.2} /></>);
export const HelpCircle = CircleHelp;
export const CircleSlash = make("CircleSlash", <>{RING}<A d="M7.5 16.5l9-9" /></>);
export const PauseCircle = make("PauseCircle", <>{RING}<A d="M10 9v6M14 9v6" /></>);
export const Loader2 = make("Loader2", <><path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" /><Dot x={12} y={3.5} r={1.5} /></>);

// ---------- Route and map ----------
export const Flag = make("Flag", <><path d="M6 21V4" /><A d="M6 4.5h11l-2.6 4 2.6 4H6" /></>);
export const MapPin = make("MapPin", <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><Dot x={12} y={10} r={2.2} /></>);
export const Footprints = make("Footprints", <><circle cx="5" cy="18.5" r="1.8" /><path d="M7 18c3.5 0 3-5.5 6.5-5.5S16 8 18.5 7.5" /><Dot x={19} y={7.2} r={2} /></>);
export const Compass = make("Compass", <>{RING}<path className="mm-a" d="M15.5 8.5l-2 5-5 2 2-5z" /></>);
export const MapIcon = make("Map", <><path d="M3.5 6.5L9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" /><path d="M9 4v13.5M15 6.5V20" strokeOpacity=".55" /><Dot x={18} y={9} /></>);
export { MapIcon as Map };
export const Target = make("Target", <>{RING}<circle cx="12" cy="12" r="5" /><Dot x={12} y={12} r={1.8} /></>);
export const Radar = make("Radar", <>{RING}<circle cx="12" cy="12" r="4.5" strokeOpacity=".55" /><A d="M12 12l6.4-6.4" /><Dot x={15.6} y={9.2} r={1.4} /></>);
export const Gauge = make("Gauge", <><path d="M4 16.5a8 8 0 1 1 16 0" /><A d="M12 16.5l4-5" /><Dot x={12} y={16.5} r={1.6} /></>);
export const Activity = make("Activity", <><path d="M3 12h3.5L9 6l4 12 2.5-6H19" /><Dot x={20.5} y={12} /></>);
export const History = make("History", <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" /><A d="M12 8v4.2l2.8 1.8" /></>);
export const CalendarClock = make("CalendarClock", <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><Dot x={12} y={15} r={1.8} /></>);
export const BarChart3 = make("BarChart3", <><path d="M4 20.5h16M7.5 17v-5M12 17V7" /><A d="M16.5 17V9.5" /></>);
export const LayoutGrid = make("LayoutGrid", <><rect x="4" y="4" width="6.5" height="6.5" rx="2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="2" /><rect className="mm-a" x="13.5" y="13.5" width="6.5" height="6.5" rx="2" /></>);
export const SlidersHorizontal = make("SlidersHorizontal", <><path d="M4 7h16M4 17h16" /><Dot x={9} y={7} r={2.4} /><Dot x={15} y={17} r={2.4} /></>);

// ---------- Trust and safety ----------
export const ShieldCheck = make("ShieldCheck", <>{SHIELD}<A d="M9 12l2.2 2.2L15.3 10" /></>);
export const ShieldAlert = make("ShieldAlert", <>{SHIELD}<path d="M12 8v4.5" /><Dot x={12} y={15.6} r={1.2} /></>);
export const ShieldOff = make("ShieldOff", <>{SHIELD}<A d="M4 4l16 16" /></>);
export const Lock = make("Lock", <><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><Dot x={12} y={15.5} r={1.6} /></>);
export const LockKeyhole = make("LockKeyhole", <><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><Dot x={12} y={14.6} r={1.4} /><A d="M12 16v2" /></>);
export const KeyRound = make("KeyRound", <><circle cx="8" cy="15.5" r="4" /><path d="M11 12.5l8-8M16 7.5l2.5 2.5M13.8 9.7l2 2" /><Dot x={8} y={15.5} r={1.3} /></>);
export const EyeOff = make("EyeOff", <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /><A d="M4 4l16 16" /></>);
export const BadgeCheck = make("BadgeCheck", <><path d="M12 2.8l2.4 1.7 2.9-.1.9 2.8 2.3 1.8-.9 2.8.9 2.8-2.3 1.8-.9 2.8-2.9-.1L12 21.2l-2.4-1.7-2.9.1-.9-2.8-2.3-1.8.9-2.8-.9-2.8 2.3-1.8.9-2.8 2.9.1z" /><A d="M8.8 12.2l2.2 2.2 4.2-4.3" /></>);
export const CloudOff = make("CloudOff", <><path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1A4.5 4.5 0 0 0 7 18.5z" /><A d="M4 4l16 16" /></>);

// ---------- Money ----------
export const Wallet = make("Wallet", <><rect x="3.5" y="6" width="17" height="13.5" rx="3" /><path d="M6.5 6l8.5-2.5a1.5 1.5 0 0 1 1.9 1.4V6M20.5 11h-3.5a2 2 0 0 0 0 4h3.5" /><Dot x={17} y={13} r={1.2} /></>);
export const Banknote = make("Banknote", <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle className="mm-a" cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" strokeWidth="2.5" /></>);
export const CreditCard = make("CreditCard", <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /><A d="M6 14.8h4" /></>);
export const PiggyBank = make("PiggyBank", <><path d="M5 12a7 6 0 0 1 13.5-2.2H20v4.6h-1.7a7 6 0 0 1-2.8 2.7V20H13v-2a8 8 0 0 1-3 0v2H7.5v-3.2A6 6 0 0 1 5 12z" /><path d="M10.5 9h3" /><Dot x={12} y={4.6} r={1.8} /></>);
export const HandCoins = make("HandCoins", <><path d="M2.5 15h3l4 2h4.5a1.5 1.5 0 0 0 0-3H11M5.5 20h8.5l6.3-3.8a1.5 1.5 0 0 0-1.5-2.6L14 15.5" /><circle className="mm-a" cx="15.5" cy="7" r="2.8" /><circle cx="9" cy="8.5" r="2" /></>);
export const ReceiptText = make("ReceiptText", <><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" /><path d="M9 8h6M9 11.5h6" /><A d="M9 15h3" /></>);
export const Landmark = make("Landmark", <><path d="M3.5 9L12 4l8.5 5zM5.5 9v8M10 9v8M14 9v8M18.5 9v8" /><A d="M3.5 20h17" /></>);
export const Building2 = make("Building2", <><path d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v15.5M15 9.5h3.5A1.5 1.5 0 0 1 20 11v9.5M3 20.5h18M8.5 14.5h3" /><A d="M8.5 7.5h3M8.5 11h3" /></>);
export const Briefcase = make("Briefcase", <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" /><A d="M10.5 13h3" /></>);
export const Gift = make("Gift", <><rect x="4" y="9" width="16" height="4" rx="1" /><path d="M5.5 13v7.5h13V13M12 9c-1-3-5-4-5-1.5S10.5 9 12 9c1-3 5-4 5-1.5S13.5 9 12 9z" /><A d="M12 9v11.5" /></>);
export const Package = make("Package", <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /><A d="M8 5.3l8 4.5" /></>);
export const Car = make("Car", <><path d="M3.5 16v-3.5l2-5a2 2 0 0 1 1.9-1.3h9.2a2 2 0 0 1 1.9 1.3l2 5V16a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM3.5 12.5h17" /><circle className="mm-a" cx="7.5" cy="17" r="1.8" /><circle className="mm-a" cx="16.5" cy="17" r="1.8" /></>);
export const GraduationCap = make("GraduationCap", <><path d="M12 4.5l9.5 4.5-9.5 4.5L2.5 9zM6.5 11v4.5c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2V11" /><A d="M21.5 9v5" /></>);
export const Home = make("Home", <><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" /><A d="M10 20.5v-5h4v5" /></>);

// ---------- People, messages, devices ----------
export const User = make("User", <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>);
export const UserRound = User;
export const Bell = make("Bell", <>{BELL}</>);
export const BellRing = make("BellRing", <>{BELL}<Dot x={18.5} y={5} r={2.3} /></>);
export const MessageSquareText = make("MessageSquareText", <><path d="M4.5 5.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4.5 4v-4a1 1 0 0 1-1-1z" /><path d="M8.5 8.5h7" /><A d="M8.5 12h4" /></>);
export const ThumbsUp = make("ThumbsUp", <>{THUMB}</>);
export const ThumbsDown = make("ThumbsDown", <g transform="matrix(1 0 0 -1 0 24)">{THUMB}</g>);
export const Smartphone = make("Smartphone", <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><A d="M10.5 18.5h3" /></>);
export const Monitor = make("Monitor", <>{MONITOR}</>);
export const MonitorPlay = make("MonitorPlay", <>{MONITOR}<path className="mm-af" d="M10.5 7.8v4.9l4.2-2.45z" /></>);
export const Sun = make("Sun", <><circle cx="12" cy="12" r="4" /><A d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>);
export const Moon = make("Moon", <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /><Dot x={17} y={5.5} r={1.2} /></>);

// ---------- Files and tools ----------
export const FileText = make("FileText", <>{FILE}<path d="M8.5 12.5h7" /><A d="M8.5 16h4.5" /></>);
export const FileInput = make("FileInput", <>{FILE}<A d="M3 14h7M8 11.5l2.5 2.5L8 16.5" /></>);
export const FileSearch = make("FileSearch", <>{FILE}<circle className="mm-a" cx="11" cy="14" r="2.5" /><A d="M12.9 15.9l2.1 2.1" /></>);
export const Database = make("Database", <><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" /><A d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>);
export const Settings = make("Settings", <><path d="M12 2.8l2 2.1 2.9-.4.7 2.8 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.7 2.8-2.9-.4-2 2.1-2-2.1-2.9.4-.7-2.8-2.6-1.4 1-2.8-1-2.8 2.6-1.4.7-2.8 2.9.4z" /><circle className="mm-a" cx="12" cy="12" r="3" /></>);
export const Save = make("Save", <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 4v4.5h7V4" /><circle className="mm-a" cx="12" cy="14.5" r="2.2" /></>);
export const Pencil = make("Pencil", <><path d="M15 4.5L19.5 9 9 19.5 4 20l.5-5z" /><A d="M12.8 6.7l4.5 4.5" /></>);
export const Trash2 = make("Trash2", <><path d="M4.5 7h15M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6.5 7l.8 11.6a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" /><A d="M10.5 11v5.5M13.5 11v5.5" /></>);
export const Plug = make("Plug", <><path d="M9 3v4M15 3v4M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0z" /><A d="M12 16v5" /></>);
export const Webhook = make("Webhook", <><path d="M12 8.2L7.4 15.4M13.8 8.4l3.4 6.6M8.2 17h7.6" /><circle cx="6.2" cy="17" r="2.2" /><circle cx="17.8" cy="17" r="2.2" /><Dot x={12} y={6} r={2.4} /></>);
export const Zap = make("Zap", <><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></>);
export const Sparkles = make("Sparkles", <><path d="M11 3.5l1.8 4.7 4.7 1.8-4.7 1.8L11 16.5l-1.8-4.7L4.5 10l4.7-1.8z" /><path className="mm-af" d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>);
export const Lightbulb = make("Lightbulb", <><path d="M9 17.5v-1.2c0-1-.5-1.9-1.2-2.6a6 6 0 1 1 8.4 0c-.7.7-1.2 1.6-1.2 2.6v1.2z" /><A d="M9.5 20.5h5" /></>);
export const ScanSearch = make("ScanSearch", <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle className="mm-a" cx="11.5" cy="11.5" r="3" /><A d="M13.7 13.7l2.3 2.3" /></>);
