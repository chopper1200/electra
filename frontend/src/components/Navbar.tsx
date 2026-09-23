import { NavLink } from "react-router-dom";
import {
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  ShoppingCart,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard-link", end: true },
  { to: "/lavori", label: "Lavori", icon: Wrench, testId: "nav-lavori-link", end: false },
  { to: "/materiali", label: "Materiali", icon: Package, testId: "nav-materiali-link", end: false },
  { to: "/spesa", label: "Spesa", icon: ShoppingCart, testId: "nav-spesa-link", end: false },
  {
    to: "/preventivi",
    label: "Preventivi",
    icon: FileSpreadsheet,
    testId: "nav-preventivi-link",
    end: false,
  },
  { to: "/clienti", label: "Clienti", icon: UserRound, testId: "nav-clienti-link", end: false },
];

export default function Navbar() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-[#1E293B] bg-[#080C14]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NavLink to="/" data-testid="navbar-brand" className="group flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-black transition-transform duration-200 group-hover:scale-105">
            <Zap size={19} strokeWidth={2.5} />
            <span className="absolute inset-0 rounded-xl bg-amber-500/40 blur-md" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block font-heading text-[15px] font-bold tracking-tight text-slate-50">
              VoltCraft Elettrica
            </span>
            <span className="hidden text-[11px] font-medium tracking-wide text-slate-500 sm:block">
              Lavori · Materiali · Preventivi
            </span>
          </span>
        </NavLink>

        <nav className="hidden items-center gap-0.5 md:flex">
          {LINKS.map(({ to, label, icon: Icon, testId, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={testId}
              className={({ isActive }) =>
                `relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-[#162032] text-amber-400"
                    : "text-slate-400 hover:bg-[#162032]/60 hover:text-slate-100"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
