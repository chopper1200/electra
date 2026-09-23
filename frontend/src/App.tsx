import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import Dashboard from "@/pages/Dashboard";
import Lavori from "@/pages/Lavori";
import Materiali from "@/pages/Materiali";
import Preventivi from "@/pages/Preventivi";
import PreventivoEditor from "@/pages/PreventivoEditor";
import PreventivoDetail from "@/pages/PreventivoDetail";
import Clienti from "@/pages/Clienti";
import Spesa from "@/pages/Spesa";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lavori" element={<Lavori />} />
          <Route path="/materiali" element={<Materiali />} />
          <Route path="/spesa" element={<Spesa />} />
          <Route path="/preventivi" element={<Preventivi />} />
          <Route path="/preventivi/nuovo" element={<PreventivoEditor />} />
          <Route path="/preventivi/:id" element={<PreventivoDetail />} />
          <Route path="/preventivi/:id/modifica" element={<PreventivoEditor />} />
          <Route path="/clienti" element={<Clienti />} />
        </Routes>
      </main>
      <MobileNav />
      <Toaster />
    </div>
  );
}
