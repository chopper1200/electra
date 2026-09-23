import { NavLink } from "react-router-dom";
import { FileSpreadsheet, LayoutDashboard, Package, Wrench } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "mobile-nav-dashboard" },
  { to: "/lavori", label: "Lavori", icon: Wrench, testId: "mobile-nav-lavori" },
  { to: "/materiali", label: "Materiali", icon: Package, testId: "mobile-nav-materiali" },
  { to: "/preventivi", label: "Preventivi", icon: FileSpreadsheet, testId: "mobile-nav-preventivi" },
];

export default function MobileNav() {
  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-800 bg-[#06090E] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {ITEMS.map(({ to, label, icon: Icon, testId }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-testid={testId}
          className={({ isActive }) =>
            `flex min-h-[48px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
              isActive ? "text-amber-400" : "text-slate-400"
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
