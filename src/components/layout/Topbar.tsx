import { Bell, Search } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

export function Topbar({ userEmail }: { userEmail: string }) {
  const initials = userEmail.slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <form action="/licitaciones" method="get" role="search" className="w-full max-w-sm">
        <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
          <Search size={16} />
          <input
            name="q"
            type="search"
            placeholder="Buscar licitaciones…"
            className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-500"
          />
        </label>
      </form>
      <div className="flex items-center gap-4">
        <button className="text-slate-500 hover:text-slate-700" aria-label="Notificaciones">
          <Bell size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {initials}
          </div>
          <span className="hidden max-w-[160px] truncate text-sm font-medium text-slate-700 sm:inline">
            {userEmail}
          </span>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
