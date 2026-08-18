"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="text-slate-400 hover:text-red-600 disabled:opacity-50"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
    >
      <LogOut size={18} />
    </button>
  );
}
