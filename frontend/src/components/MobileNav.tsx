import { NavLink } from "react-router-dom";
import {
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  ShoppingCart,
  UserRound,
  Wrench,
} from "lucide-react";

const ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, testId: "mobile-nav-dashboard" },
  { to: "/lavori", label: "Lavori", icon: Wrench, testId: "mobile-nav-lavori" },
  { to: "/materiali", label: "Materiali", icon: Package, testId: "mobile-nav-materiali" },
  { to: "/spesa", label: "Spesa", icon: ShoppingCart, testId: "mobile-nav-spesa" },
  { to: "/preventivi", label: "Preventivi", icon: FileSpreadsheet, testId: "mobile-nav-preventivi" },
  { to: "/clienti", label: "Clienti", icon: UserRound, testId: "mobile-nav-clienti" },
];

export default function MobileNav() {
  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-[#1E293B] bg-[#080C14]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      {ITEMS.map(({ to, label, icon: Icon, testId }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-testid={testId}
          className={({ isActive }) =>
            `flex min-h-[52px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors duration-150 ${
              isActive ? "text-amber-400" : "text-slate-500"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`flex h-7 w-10 items-center justify-center rounded-lg transition-colors duration-150 ${
                  isActive ? "bg-amber-500/10" : ""
                }`}
              >
                <Icon size={18} />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
