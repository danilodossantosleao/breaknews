import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, LibraryBig, Newspaper, History, CalendarDays, Compass,
  Bookmark, Bell, Settings, LogOut, Search, Zap, Plus,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import type { NotificationList, UserOut } from "@/lib/types";
import { useMe } from "@/hooks/useMe";
import { endSession } from "@/lib/session";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CommandPalette from "@/components/CommandPalette";
import GamePickerDialog from "@/components/GamePickerDialog";
import { queryClient } from "@/lib/queryClient";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/library", label: "Minha Biblioteca", icon: LibraryBig, testid: "nav-library" },
  { to: "/news", label: "News Center", icon: Newspaper, testid: "nav-news" },
  { to: "/updates", label: "Atualizações", icon: History, testid: "nav-updates" },
  { to: "/calendar", label: "Calendário Gamer", icon: CalendarDays, testid: "nav-calendar" },
  { to: "/explore", label: "Explorar Jogos", icon: Compass, testid: "nav-explore" },
  { to: "/saved", label: "Minha Coleção", icon: Bookmark, testid: "nav-saved" },
  { to: "/notifications", label: "Notificações", icon: Bell, testid: "nav-notifications" },
  { to: "/settings", label: "Configurações", icon: Settings, testid: "nav-settings" },
];

const MOBILE_ITEMS = NAV_ITEMS.filter((i) => ["/", "/library", "/news", "/explore", "/saved"].includes(i.to));

function NexusLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex size-9 items-center justify-center rounded-lg bg-linear-to-br from-[#8B5CF6] to-[#22D3EE] shadow-[0_0_18px_rgba(139,92,246,0.45)]">
        <Zap size={18} className="text-white" strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="leading-none">
          <span className="neon-text font-heading text-xl font-bold tracking-tight">NEXUS</span>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#9AA3B5]">Gaming Hub</p>
        </div>
      )}
    </div>
  );
}

function AppSplash() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#080A10]">
      <NexusLogo />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-[#171B29]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-linear-to-r from-[#8B5CF6] to-[#22D3EE]" />
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { data: me, isLoading, isError } = useMe();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const notif = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationList>("/notifications"),
    enabled: !!me,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (isLoading) return <AppSplash />;
  if (isError || !me) return <NavigateToLogin />;
  if (!me.onboarding_done) return <NavigateToOnboarding />;

  const unread = notif.data?.unread ?? 0;
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex h-svh overflow-hidden bg-[#080A10] text-[#F4F5FA] antialiased">
      {/* Sidebar desktop */}
      <aside
        data-testid="sidebar"
        className="hidden w-64 shrink-0 flex-col justify-between border-r border-[#161B2B] bg-[#0B0E17] md:flex xl:w-72"
      >
        <div>
          <div className="px-5 py-5">
            <NexusLogo />
          </div>
          <nav className="flex flex-col gap-1 px-3" aria-label="Navegação principal">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                data-testid={item.testid}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#8B5CF6]/12 text-[#F4F5FA] shadow-[inset_2px_0_0_#8B5CF6]"
                      : "text-[#9AA3B5] hover:bg-[#171B29] hover:text-[#F4F5FA]",
                  )
                }
              >
                <item.icon size={17} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.to === "/notifications" && unread > 0 && (
                  <span
                    data-testid="sidebar-unread-badge"
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8B5CF6] px-1.5 font-mono text-[10px] font-bold text-white"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="space-y-3 p-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-[#28324D] text-[#9AA3B5]"
            data-testid="sidebar-add-game-button"
            onClick={() => setPickerOpen(true)}
          >
            <Plus size={16} />
            Adicionar jogo
          </Button>
          <div className="flex items-center gap-3 rounded-lg border border-[#161B2B] bg-[#10131D] p-3">
            <Avatar user={me} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#F4F5FA]" data-testid="sidebar-user-name">
                {me.display_name}
              </p>
              <p className="truncate text-xs text-[#9AA3B5]">{me.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              data-testid="sidebar-logout-button"
              onClick={() => endSession()}
            >
              <LogOut size={15} className="text-[#9AA3B5]" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-[#1A2033] bg-[#080A10]/90 px-4 backdrop-blur-xl md:px-6">
          <div className="md:hidden">
            <NexusLogo compact />
          </div>
          <button
            data-testid="header-search-button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-[#1A2033] bg-[#10131D] px-3 text-sm text-[#9AA3B5] transition-colors hover:border-[#8B5CF6]/50 md:w-72"
          >
            <Search size={15} />
            <span className="flex-1 truncate text-left">Buscar jogos, notícias, patches…</span>
            <kbd className="hidden rounded border border-[#28324D] bg-[#171B29] px-1.5 font-mono text-[10px] text-[#9AA3B5] md:inline">
              Ctrl K
            </kbd>
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden font-mono text-xs capitalize text-[#9AA3B5] lg:block" data-testid="header-date">
              {today}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="relative border-[#28324D]"
              aria-label="Notificações"
              data-testid="header-bell-button"
              onClick={() => navigate("/notifications")}
            >
              <Bell size={16} />
              {unread > 0 && (
                <span
                  data-testid="header-unread-badge"
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8B5CF6] px-1 font-mono text-[9px] font-bold text-white animate-pulse-glow"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="header-avatar-button"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
              >
                <Avatar user={me} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#171B29] border-[#28324D]">
                <DropdownMenuItem data-testid="menu-settings" onClick={() => navigate("/settings")}>
                  <Settings size={15} className="mr-2" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="menu-logout"
                  variant="destructive"
                  onClick={() => endSession()}
                >
                  <LogOut size={15} className="mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Navegação mobile */}
      <nav
        data-testid="mobile-nav"
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-[#161B2B] bg-[#0B0E17]/95 px-2 backdrop-blur-xl md:hidden"
        aria-label="Navegação mobile"
      >
        {MOBILE_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            data-testid={`mobile-${item.testid}`}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium",
                isActive ? "text-[#22D3EE]" : "text-[#9AA3B5]",
              )
            }
          >
            <item.icon size={20} />
            {item.label.split(" ")[0]}
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onClose={() => setPaletteOpen(false)} />
      <GamePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function Avatar({ user }: { user: UserOut }) {
  return (
    <div
      data-testid="user-avatar"
      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#8B5CF6]/50 bg-[#171B29] font-heading text-xs font-bold text-[#C7D2FE]"
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.display_name} className="size-full object-cover" />
      ) : (
        initials(user.display_name)
      )}
    </div>
  );
}

function NavigateToLogin() {
  useEffect(() => {
    queryClient.clear();
  }, []);
  return <Navigate to="/login" replace />;
}

function NavigateToOnboarding() {
  return <Navigate to="/onboarding" replace />;
}
