import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Gamepad2, Newspaper, History, CalendarDays, Loader2, AlertCircle, Plus, Compass } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { SearchResults } from "@/lib/types";
import { useDebounce } from "@/hooks/useDebounce";
import { CATEGORY_LABELS, fmtDate, timeAgo } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const QUICK_ACTIONS = [
  { label: "Adicionar jogo à biblioteca", to: "/library?add=1", icon: Plus, testid: "palette-action-add-game" },
  { label: "Explorar novidades", to: "/explore", icon: Compass, testid: "palette-action-explore" },
  { label: "Abrir News Center", to: "/news", icon: Newspaper, testid: "palette-action-news" },
  { label: "Ver calendário gamer", to: "/calendar", icon: CalendarDays, testid: "palette-action-calendar" },
];

export default function CommandPalette({
  open,
  onOpenChange,
  onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const enabled = debounced.trim().length >= 2;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => apiGet<SearchResults>(`/search?q=${encodeURIComponent(debounced.trim())}`),
    enabled,
    retry: false,
  });

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const totalResults =
    (data?.games.length ?? 0) + (data?.news.length ?? 0) + (data?.updates.length ?? 0) + (data?.events.length ?? 0);

  const filteredActions = QUICK_ACTIONS.filter(
    (a) => !term.trim() || a.label.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden border-[#28324D] bg-[#10131D] p-0"
        data-testid="command-palette"
      >
        <DialogTitle className="sr-only">Busca global do NEXUS</DialogTitle>
        <DialogDescription className="sr-only">
          Pesquise jogos, notícias, atualizações e eventos
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-[#1A2033] px-4">
          <Search size={16} className="shrink-0 text-[#9AA3B5]" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar jogos, notícias, patches, eventos…"
            data-testid="palette-input"
            className="h-12 border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0"
          />
          {isLoading && enabled && <Loader2 size={15} className="animate-spin text-[#8B5CF6]" />}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredActions.length > 0 && (
            <Group title="Ações rápidas">
              {filteredActions.map((action) => (
                <Row
                  key={action.to}
                  testid={action.testid}
                  icon={<action.icon size={15} className="text-[#8B5CF6]" />}
                  title={action.label}
                  onClick={() => go(action.to)}
                />
              ))}
            </Group>
          )}

          {!enabled && (
            <p className="px-3 py-6 text-center text-sm text-[#9AA3B5]" data-testid="palette-hint">
              Digite ao menos 2 caracteres para buscar no seu universo gamer.
            </p>
          )}

          {enabled && isError && (
            <div
              className="flex items-center gap-2 rounded-lg border border-[#EF4444]/30 bg-[#450A0A]/40 px-3 py-3 text-sm text-[#FCA5A5]"
              data-testid="palette-error"
            >
              <AlertCircle size={15} /> Não foi possível consultar agora. Tente novamente.
            </div>
          )}

          {enabled && !isLoading && !isError && totalResults === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[#9AA3B5]" data-testid="palette-no-results">
              Nenhum resultado para “{debounced}”.
            </p>
          )}

          {!!data?.games.length && (
            <Group title="Jogos">
              {data.games.map((g) => (
                <Row
                  key={g.id}
                  testid={`palette-game-${g.slug}`}
                  icon={<Gamepad2 size={15} className="text-[#22D3EE]" />}
                  title={g.title}
                  subtitle={`${g.developer ?? "Dev não informado"} · ${fmtDate(g.release_date)}`}
                  onClick={() => go(`/game/${g.id}`)}
                />
              ))}
            </Group>
          )}

          {!!data?.news.length && (
            <Group title="Notícias">
              {data.news.map((n) => (
                <Row
                  key={n.id}
                  testid={`palette-news-${n.id}`}
                  icon={<Newspaper size={15} className="text-[#A78BFA]" />}
                  title={n.title}
                  subtitle={`${CATEGORY_LABELS[n.category] ?? n.category} · ${n.source_name} · ${timeAgo(n.published_at)}`}
                  onClick={() => go(`/news?focus=${n.id}`)}
                />
              ))}
            </Group>
          )}

          {!!data?.updates.length && (
            <Group title="Atualizações">
              {data.updates.map((u) => (
                <Row
                  key={u.id}
                  testid={`palette-update-${u.id}`}
                  icon={<History size={15} className="text-[#6EE7B7]" />}
                  title={`${u.version ? `${u.version} — ` : ""}${u.title}`}
                  subtitle={`${u.game_title ?? "Jogo não informado"} · ${timeAgo(u.published_at)}`}
                  onClick={() => go(`/updates?focus=${u.id}`)}
                />
              ))}
            </Group>
          )}

          {!!data?.events.length && (
            <Group title="Eventos e lançamentos">
              {data.events.map((e) => (
                <Row
                  key={e.id}
                  testid={`palette-event-${e.id}`}
                  icon={<CalendarDays size={15} className="text-[#FCD34D]" />}
                  title={e.title}
                  subtitle={`${fmtDate(e.starts_at)} · ${e.date_status}`}
                  onClick={() => go("/calendar")}
                />
              ))}
            </Group>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#1A2033] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[#9AA3B5]">
          <span>Busca global NEXUS</span>
          <span>Esc para fechar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
  testid,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#171B29] focus-visible:bg-[#171B29] focus-visible:outline-none"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[#F4F5FA]">{title}</span>
        {subtitle && <span className="block truncate text-xs text-[#9AA3B5]">{subtitle}</span>}
      </span>
    </button>
  );
}
