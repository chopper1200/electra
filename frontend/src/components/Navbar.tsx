import { NavLink } from "react-router-dom";
import { FileSpreadsheet, LayoutDashboard, Package, Wrench, Zap } from "lucide-react";

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard-link", end: true },
  { to: "/lavori", label: "Lavori", icon: Wrench, testId: "nav-lavori-link", end: false },
  { to: "/materiali", label: "Materiali", icon: Package, testId: "nav-materiali-link", end: false },
  { to: "/preventivi", label: "Preventivi", icon: FileSpreadsheet, testId: "nav-preventivi-link", end: false },
];

export default function Navbar() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-800/80 bg-[#06090E]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <NavLink to="/" data-testid="navbar-brand" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.35)]">
            <Zap size={20} strokeWidth={2.5} />
          </span>
          <span className="leading-tight">
            <span className="block font-heading text-base font-bold tracking-tight text-slate-100">
              VoltCraft Elettrica
            </span>
            <span className="block text-[11px] font-medium text-slate-500">
              Lavori · Materiali · Preventivi
            </span>
          </span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ to, label, icon: Icon, testId, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={testId}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#1E293B] text-amber-400"
                    : "text-slate-300 hover:bg-[#1E293B]/60 hover:text-slate-100"
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
