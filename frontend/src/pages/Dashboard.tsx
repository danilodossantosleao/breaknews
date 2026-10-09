import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Gamepad2, Mail, History, CalendarDays, Flame, RefreshCw, Plus, Compass,
  LayoutGrid, List, Loader2, Sparkles, Bookmark, Activity, Filter,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type {
  DashboardSummary, EventItem, LibraryItem, NewsFacets, NewsPage, SavedOut, SyncLogOut, UpdatePage,
} from "@/lib/types";
import { useMe } from "@/hooks/useMe";
import {
  CATEGORY_LABELS, EVENT_TYPE_LABELS, RELEASE_STATUS_LABELS, fmtDate, greeting, timeAgo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardSkeleton, EmptyState, RowSkeleton, SafeImage, SectionHeader, StatusBadge } from "@/components/common";
import { NewsCard, NewsRow } from "@/components/NewsCard";
import GamePickerDialog from "@/components/GamePickerDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DashboardPage() {
  const { data: me } = useMe();
  const [view, setView] = useState<"cards" | "list">("cards");
  const [category, setCategory] = useState("todas");
  const [gameFilter, setGameFilter] = useState("todos");
  const [period, setPeriod] = useState("todos");
  const [pickerOpen, setPickerOpen] = useState(false);
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
    retry: false,
  });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet<LibraryItem[]>("/library"),
    retry: false,
  });
  const facets = useQuery({
    queryKey: ["news-facets"],
    queryFn: () => apiGet<NewsFacets>("/news/facets"),
    retry: false,
  });

  const feedParams = new URLSearchParams({ tracked: "true", page_size: "9" });
  if (category !== "todas") feedParams.set("category", category);
  if (gameFilter !== "todos") feedParams.set("game_id", gameFilter);
  if (period !== "todos") feedParams.set("period", period);

  const feed = useQuery({
    queryKey: ["news", "dashboard", category, gameFilter, period],
    queryFn: () => apiGet<NewsPage>(`/news?${feedParams.toString()}`),
    retry: false,
  });

  const updates = useQuery({
    queryKey: ["updates", "dashboard"],
    queryFn: () => apiGet<UpdatePage>("/updates?scope=tracked&page_size=5"),
    retry: false,
  });
  const events = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: () => apiGet<EventItem[]>("/events?upcoming=true"),
    retry: false,
  });
  const saved = useQuery({
    queryKey: ["saved"],
    queryFn: () => apiGet<SavedOut>("/saved"),
    retry: false,
  });
  const lastSync = useQuery({
    queryKey: ["sync-last"],
    queryFn: () => apiGet<SyncLogOut | null>("/sync/last"),
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiPost<SyncLogOut>("/sync"),
    onSuccess: (log) => {
      if (log.demo_fallback) {
        toast.warning("Nenhuma fonte externa respondeu", {
          description: "O conteúdo de demonstração continua disponível.",
        });
      } else {
        toast.success(`Sincronização concluída: ${log.items_inserted} novos itens`, {
          description: `${log.sources_ok} fonte(s) consultada(s)${log.sources_failed ? `, ${log.sources_failed} indisponível(is)` : ""}.`,
        });
      }
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Sincronização indisponível agora. Tente novamente em instantes."),
  });

  const libItems = library.data ?? [];
  const favorites = libItems.filter((i) => i.is_favorite).slice(0, 6);
  const highlights = (favorites.length ? favorites : libItems).slice(0, 6);
  const recentActivity = [...libItems]
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, 5);
  const savedNews = (saved.data?.news ?? []).slice(0, 3);

  const stats = [
    { label: "Jogos acompanhados", value: summary.data?.games_tracked ?? 0, icon: Gamepad2, color: "text-[#A78BFA]", to: "/library" },
    { label: "Notícias não lidas", value: summary.data?.unread_news ?? 0, icon: Mail, color: "text-[#67E8F9]", to: "/news?read=false" },
    { label: "Atualizações (7 dias)", value: summary.data?.recent_updates ?? 0, icon: History, color: "text-[#6EE7B7]", to: "/updates" },
    { label: "Próximos lançamentos", value: summary.data?.upcoming_releases ?? 0, icon: CalendarDays, color: "text-[#FCD34D]", to: "/calendar" },
    { label: "Jogos com novidades", value: summary.data?.games_with_news ?? 0, icon: Flame, color: "text-[#FCA5A5]", to: "/news" },
    { label: "Notícias salvas", value: saved.data?.news.length ?? 0, icon: Bookmark, color: "text-[#C7D2FE]", to: "/saved" },
  ];

  const syncLabel = (() => {
    const at = summary.data?.last_sync_at ?? lastSync.data?.finished_at;
    if (!at) return "Nenhuma sincronização registrada ainda";
    return `Última sincronização ${timeAgo(at)}`;
  })();

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Hero */}
      <section className="hero-radial relative overflow-hidden rounded-2xl border border-[#1A2033] p-6 md:p-9">
        <div className="relative z-10 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#22D3EE]">
            {greeting()}, {me?.display_name ?? "jogador"} — sua central gamer está atualizada
          </p>
          <h1 className="mt-3 font-heading text-3xl leading-tight font-bold text-[#F4F5FA] md:text-[2.6rem]">
            Seu universo gamer. <span className="neon-text">Em um só lugar.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9AA3B5] md:text-base">
            Notícias, atualizações e descobertas dos jogos que fazem parte da sua coleção.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Button
              data-testid="hero-add-game-button"
              onClick={() => setPickerOpen(true)}
              className="gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
            >
              <Plus size={16} /> Adicionar jogo
            </Button>
            <Button
              variant="outline"
              data-testid="hero-explore-button"
              className="gap-2 border-[#28324D] text-[#C8CEDC]"
              render={<Link to="/explore"><Compass size={16} /> Explorar novidades</Link>}
            />
            <Button
              variant="ghost"
              data-testid="hero-sync-button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="gap-2 text-xs text-[#9AA3B5]"
            >
              {syncMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Sincronizar fontes
            </Button>
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-[#9AA3B5]" data-testid="last-sync-label">
            {syncLabel}
            {lastSync.data?.demo_fallback && " · exibindo conteúdo de demonstração"}
          </p>
        </div>
      </section>

      {/* Indicadores */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              data-testid={`stat-card-${stat.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="card-hover rounded-xl border border-[#1A2033] bg-[#10131D] p-3.5"
            >
              <stat.icon size={16} className={stat.color} />
              <p className="mt-2.5 font-heading text-2xl font-bold text-[#F4F5FA]">
                {summary.isLoading ? "—" : stat.value}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-[#9AA3B5]">{stat.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Biblioteca vazia */}
      {!library.isLoading && libItems.length === 0 && (
        <EmptyState
          icon={<Gamepad2 size={34} />}
          title="Sua biblioteca está vazia"
          description="Adicione o primeiro jogo para que o NEXUS comece a reunir notícias, patches e lançamentos personalizados para você."
          action={
            <Button
              data-testid="empty-add-game-button"
              onClick={() => setPickerOpen(true)}
              className="mt-2 gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
            >
              <Plus size={15} /> Adicionar meu primeiro jogo
            </Button>
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Feed */}
        <section className="lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Novidades para você</h2>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Visualização em cards"
                data-testid="feed-view-cards"
                onClick={() => setView("cards")}
                className={view === "cards" ? "text-[#22D3EE]" : "text-[#9AA3B5]"}
              >
                <LayoutGrid size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Visualização em lista"
                data-testid="feed-view-list"
                onClick={() => setView("list")}
                className={view === "list" ? "text-[#22D3EE]" : "text-[#9AA3B5]"}
              >
                <List size={15} />
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Filter size={13} className="text-[#9AA3B5]" />
            <Select value={gameFilter} onValueChange={setGameFilter}>
              <SelectTrigger size="sm" data-testid="feed-filter-game" className="w-40 border-[#28324D] bg-[#10131D] text-xs">
                <SelectValue>
                  {(v) => (v === "todos" ? "Todos os jogos" : libItems.find((i) => i.game.id === v)?.game.title ?? "Jogo")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os jogos</SelectItem>
                {libItems.map((i) => (
                  <SelectItem key={i.game.id} value={i.game.id}>{i.game.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger size="sm" data-testid="feed-filter-category" className="w-44 border-[#28324D] bg-[#10131D] text-xs">
                <SelectValue>
                  {(v) => (v === "todas" ? "Todas as categorias" : CATEGORY_LABELS[v as string] ?? "Categoria")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger size="sm" data-testid="feed-filter-period" className="w-36 border-[#28324D] bg-[#10131D] text-xs">
                <SelectValue>
                  {(v) =>
                    ({ todos: "Qualquer data", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias" })[
                      v as string
                    ] ?? "Período"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Qualquer data</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            {facets.data && (
              <Badge variant="outline" className="border-[#28324D] text-[10px] text-[#9AA3B5]">
                {facets.data.unread} não lidas
              </Badge>
            )}
          </div>

          {feed.isLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
          )}

          {feed.isError && (
            <EmptyState
              title="Feed indisponível"
              description="Não foi possível carregar as novidades agora. A navegação do app continua funcionando."
            />
          )}

          {!feed.isLoading && !feed.isError && (feed.data?.items.length ?? 0) === 0 && (
            <EmptyState
              icon={<Sparkles size={30} />}
              title="Nenhuma novidade com esses filtros"
              description={
                libItems.length === 0
                  ? "Adicione jogos à biblioteca para receber um feed personalizado."
                  : "Ajuste os filtros ou sincronize as fontes para buscar novidades."
              }
            />
          )}

          {!feed.isError && (feed.data?.items.length ?? 0) > 0 && (
            view === "cards" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {feed.data!.items.map((item) => <NewsCard key={item.id} item={item} />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                {feed.data!.items.map((item) => <NewsRow key={item.id} item={item} />)}
              </div>
            )
          )}

          {(feed.data?.total ?? 0) > (feed.data?.items.length ?? 0) && (
            <Button
              variant="outline"
              className="mt-4 w-full border-[#28324D] text-[#C8CEDC]"
              data-testid="feed-see-all-button"
              render={<Link to="/news">Ver todas as {feed.data!.total} novidades no News Center</Link>}
            />
          )}

          {/* Atualizações recentes */}
          <div className="mt-8">
            <SectionHeader title="Últimas atualizações" linkTo="/updates" />
            {updates.isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</div>}
            {!updates.isLoading && (updates.data?.items.length ?? 0) === 0 && (
              <EmptyState title="Nenhum patch registrado" description="Os jogos acompanhados ainda não receberam atualizações catalogadas." />
            )}
            <div className="space-y-2">
              {(updates.data?.items ?? []).map((u) => (
                <Link
                  key={u.id}
                  to="/updates"
                  data-testid={`dashboard-update-${u.id}`}
                  className="flex items-start gap-3 rounded-lg border border-[#1A2033] bg-[#10131D] p-3 transition-colors hover:border-[#8B5CF6]/40"
                >
                  <SafeImage
                    src={u.game_cover}
                    alt={u.game_title ?? ""}
                    fallbackLabel={(u.game_title ?? "NX").slice(0, 2)}
                    className="size-11 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {u.version && (
                        <span className="rounded bg-[#171B29] px-1.5 py-0.5 font-mono text-[10px] text-[#67E8F9]">
                          {u.version}
                        </span>
                      )}
                      {u.is_recent && <Badge className="bg-[#10B981] text-[10px] text-white">Recente</Badge>}
                      {!u.is_read && <Badge variant="outline" className="border-[#8B5CF6]/40 text-[10px] text-[#C7D2FE]">Aguardando leitura</Badge>}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-[#F4F5FA]">{u.title}</p>
                    <p className="font-mono text-[10px] text-[#9AA3B5]">
                      {u.game_title ?? "Jogo não informado"} · {timeAgo(u.published_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Coluna lateral */}
        <aside className="space-y-7 lg:col-span-4">
          <div>
            <SectionHeader title="Próximos lançamentos" linkTo="/calendar" />
            {events.isLoading && <div className="space-y-2">{[0, 1].map((i) => <RowSkeleton key={i} />)}</div>}
            {!events.isLoading && (events.data?.length ?? 0) === 0 && (
              <EmptyState title="Agenda vazia" description="Nenhuma data futura catalogada." />
            )}
            <div className="space-y-2">
              {(events.data ?? []).slice(0, 4).map((e) => (
                <Link
                  key={e.id}
                  to="/calendar"
                  data-testid={`dashboard-event-${e.id}`}
                  className="block rounded-lg border border-[#1A2033] bg-[#10131D] p-3 transition-colors hover:border-[#22D3EE]/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-[#22D3EE]/30 text-[10px] text-[#67E8F9]">
                      {EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}
                    </Badge>
                    <span className="font-mono text-[10px] text-[#9AA3B5]">{fmtDate(e.starts_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-[#F4F5FA]">{e.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#9AA3B5]">
                    {RELEASE_STATUS_LABELS[e.date_status] ?? e.date_status} · {timeAgo(e.starts_at)}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader title="Jogos em destaque" linkTo="/library" />
            {library.isLoading && <div className="space-y-2">{[0, 1].map((i) => <RowSkeleton key={i} />)}</div>}
            <div className="space-y-2">
              {highlights.map((item) => (
                <Link
                  key={item.id}
                  to={`/game/${item.game.id}`}
                  data-testid={`dashboard-highlight-${item.game.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-[#1A2033] bg-[#10131D] p-2.5 transition-colors hover:border-[#8B5CF6]/40"
                >
                  <SafeImage
                    src={item.game.cover_url}
                    alt={item.game.title}
                    fallbackLabel={item.game.title.slice(0, 2)}
                    className="h-14 w-10 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#F4F5FA]">{item.game.title}</p>
                    <div className="mt-1"><StatusBadge status={item.status} /></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader title="Notícias salvas" linkTo="/saved" />
            {savedNews.length === 0 ? (
              <EmptyState title="Nada salvo ainda" description="Use o botão Salvar em qualquer notícia para guardá-la aqui." />
            ) : (
              <div className="space-y-2">
                {savedNews.map((entry) =>
                  entry.news ? (
                    <Link
                      key={entry.news.id}
                      to="/saved"
                      data-testid={`dashboard-saved-${entry.news.id}`}
                      className="block rounded-lg border border-[#1A2033] bg-[#10131D] p-3 transition-colors hover:border-[#8B5CF6]/40"
                    >
                      <p className="line-clamp-2 text-sm font-medium text-[#F4F5FA]">{entry.news.title}</p>
                      <p className="mt-1 font-mono text-[10px] text-[#9AA3B5]">
                        {entry.collection_name} · {timeAgo(entry.saved_at)}
                      </p>
                    </Link>
                  ) : null,
                )}
              </div>
            )}
          </div>

          <div>
            <SectionHeader title="Atividade recente" linkTo="/library" />
            {recentActivity.length === 0 ? (
              <EmptyState title="Sem atividade" description="Suas ações na biblioteca aparecem aqui." />
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((item) => (
                  <li
                    key={item.id}
                    data-testid={`dashboard-activity-${item.game.slug}`}
                    className="flex items-start gap-2.5 rounded-lg border border-[#1A2033] bg-[#10131D] p-3"
                  >
                    <Activity size={14} className="mt-0.5 shrink-0 text-[#22D3EE]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-[#C8CEDC]">
                        <span className="font-medium text-[#F4F5FA]">{item.game.title}</span> atualizado para{" "}
                        <span className="text-[#A78BFA]">{item.status.replace(/_/g, " ")}</span>
                      </p>
                      <p className="font-mono text-[10px] text-[#9AA3B5]">{timeAgo(item.updated_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <GamePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}
