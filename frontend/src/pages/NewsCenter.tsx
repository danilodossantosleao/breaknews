import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, LayoutGrid, List, CheckCheck, Loader2, RefreshCw, Newspaper } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { LibraryItem, NewsFacets, NewsPage, SyncLogOut } from "@/lib/types";
import { useDebounce } from "@/hooks/useDebounce";
import { CATEGORY_LABELS, PLATFORM_OPTIONS, timeAgo } from "@/lib/format";
import { CardSkeleton, EmptyState } from "@/components/common";
import { NewsCard, NewsRow } from "@/components/NewsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PERIODS: Record<string, string> = {
  todos: "Qualquer data",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

export default function NewsCenterPage() {
  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 350);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [scope, setScope] = useState<"tracked" | "all">("tracked");
  const [category, setCategory] = useState("todas");
  const [source, setSource] = useState("todas");
  const [game, setGame] = useState("todos");
  const [period, setPeriod] = useState("todos");
  const [platform, setPlatform] = useState("todas");
  const [readFilter, setReadFilter] = useState(searchParams.get("read") === "false" ? "nao_lidas" : "todas");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

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

  const params = new URLSearchParams({ page: String(page), page_size: "12" });
  if (scope === "tracked") params.set("tracked", "true");
  if (debounced.trim()) params.set("q", debounced.trim());
  if (category !== "todas") params.set("category", category);
  if (source !== "todas") params.set("source", source);
  if (game !== "todos") params.set("game_id", game);
  if (period !== "todos") params.set("period", period);
  if (readFilter === "nao_lidas") params.set("read", "false");
  if (readFilter === "lidas") params.set("read", "true");
  if (readFilter === "salvas") params.set("saved", "true");
  if (readFilter === "oficiais") params.set("official", "true");

  const news = useQuery({
    queryKey: ["news", "center", params.toString()],
    queryFn: () => apiGet<NewsPage>(`/news?${params.toString()}`),
    retry: false,
  });

  // Filtro de plataforma aplicado no cliente (metadados do jogo relacionado)
  const libByGame = new Map((library.data ?? []).map((i) => [i.game.id, i.game]));
  const items = (news.data?.items ?? []).filter((n) => {
    if (platform === "todas") return true;
    const g = n.game_id ? libByGame.get(n.game_id) : undefined;
    return g ? g.platforms.includes(platform) : false;
  });

  const readAll = useMutation({
    mutationFn: () => apiPost<{ updated: number }>("/news/read-all", { game_id: null }),
    onSuccess: (res) => {
      toast.success(`${res.updated} notícia(s) marcada(s) como lida(s)`);
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível marcar todas como lidas."),
  });

  const sync = useMutation({
    mutationFn: () => apiPost<SyncLogOut>("/sync"),
    onSuccess: (log) => {
      if (log.demo_fallback) toast.warning("Nenhuma fonte externa respondeu agora.");
      else toast.success(`${log.items_inserted} novo(s) item(ns) de ${log.sources_ok} fonte(s)`);
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Sincronização indisponível agora."),
  });

  const totalPages = Math.max(1, Math.ceil((news.data?.total ?? 0) / 12));
  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">News Center</h1>
          <p className="mt-1 text-sm text-[#9AA3B5]">
            Notícias consolidadas de fontes oficiais e imprensa especializada, com deduplicação por URL canônica e
            similaridade de títulos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="news-sync-button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="gap-1.5 border-[#28324D] text-xs"
          >
            {sync.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Sincronizar
          </Button>
          <Button
            size="sm"
            data-testid="news-read-all-button"
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending}
            className="gap-1.5 bg-[#8B5CF6] text-xs text-white hover:bg-[#7C4DF4]"
          >
            {readAll.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
            Marcar todas como lidas
          </Button>
        </div>
      </header>

      <Tabs value={scope} onValueChange={(v) => { setScope(v as "tracked" | "all"); setPage(1); }}>
        <TabsList variant="line">
          <TabsTrigger value="tracked" data-testid="news-scope-tracked">Meus jogos</TabsTrigger>
          <TabsTrigger value="all" data-testid="news-scope-all">Todas as fontes</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtros avançados */}
      <div className="space-y-3 rounded-xl border border-[#1A2033] bg-[#10131D] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-[#1A2033] bg-[#0B0E17] px-3">
            <Search size={14} className="text-[#9AA3B5]" />
            <Input
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPage(1); }}
              placeholder="Buscar em títulos e resumos…"
              data-testid="news-search-input"
              className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cards"
            data-testid="news-view-cards"
            onClick={() => setView("cards")}
            className={view === "cards" ? "text-[#22D3EE]" : "text-[#9AA3B5]"}
          >
            <LayoutGrid size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Lista compacta"
            data-testid="news-view-list"
            onClick={() => setView("list")}
            className={view === "list" ? "text-[#22D3EE]" : "text-[#9AA3B5]"}
          >
            <List size={15} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={game} onValueChange={resetPage(setGame)}>
            <SelectTrigger size="sm" data-testid="news-filter-game" className="w-40 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>
                {(v) => (v === "todos" ? "Todos os jogos" : libByGame.get(v as string)?.title ?? "Jogo")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os jogos</SelectItem>
              {(library.data ?? []).map((i) => (
                <SelectItem key={i.game.id} value={i.game.id}>{i.game.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={resetPage(setCategory)}>
            <SelectTrigger size="sm" data-testid="news-filter-category" className="w-44 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => (v === "todas" ? "Todas as categorias" : CATEGORY_LABELS[v as string])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={resetPage(setSource)}>
            <SelectTrigger size="sm" data-testid="news-filter-source" className="w-40 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => (v === "todas" ? "Todas as fontes" : (v as string))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as fontes</SelectItem>
              {(facets.data?.sources ?? []).map((s) => (
                <SelectItem key={s.name} value={s.name}>{s.name} ({s.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={resetPage(setPeriod)}>
            <SelectTrigger size="sm" data-testid="news-filter-period" className="w-36 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => PERIODS[v as string] ?? "Período"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={platform} onValueChange={resetPage(setPlatform)}>
            <SelectTrigger size="sm" data-testid="news-filter-platform" className="w-36 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => (v === "todas" ? "Plataformas" : (v as string))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Plataformas</SelectItem>
              {PLATFORM_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={readFilter} onValueChange={resetPage(setReadFilter)}>
            <SelectTrigger size="sm" data-testid="news-filter-state" className="w-40 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>
                {(v) =>
                  ({ todas: "Todas", nao_lidas: "Não lidas", lidas: "Lidas", salvas: "Salvas", oficiais: "Anúncios oficiais" })[
                    v as string
                  ] ?? "Estado"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="nao_lidas">Não lidas</SelectItem>
              <SelectItem value="lidas">Lidas</SelectItem>
              <SelectItem value="salvas">Salvas</SelectItem>
              <SelectItem value="oficiais">Anúncios oficiais</SelectItem>
            </SelectContent>
          </Select>

          {facets.data && (
            <div className="ml-auto flex gap-1.5">
              <Badge variant="outline" className="border-[#8B5CF6]/40 text-[10px] text-[#C7D2FE]">
                {facets.data.unread} não lidas
              </Badge>
              <Badge variant="outline" className="border-[#22D3EE]/40 text-[10px] text-[#67E8F9]">
                {facets.data.saved} salvas
              </Badge>
            </div>
          )}
        </div>
      </div>

      {news.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {news.isError && (
        <EmptyState title="Não foi possível carregar as notícias" description="A consulta falhou. O restante do app segue disponível." />
      )}

      {!news.isLoading && !news.isError && items.length === 0 && (
        <EmptyState
          icon={<Newspaper size={30} />}
          title="Nenhuma notícia encontrada"
          description="Ajuste os filtros, mude para 'Todas as fontes' ou sincronize para buscar novidades."
        />
      )}

      {items.length > 0 && (
        <>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#9AA3B5]" data-testid="news-result-count">
            {news.data?.total ?? 0} resultado(s) · página {page} de {totalPages}
            {news.data?.items[0]?.published_at && ` · mais recente ${timeAgo(news.data.items[0].published_at)}`}
          </p>
          {view === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="news-grid">
              {items.map((item) => <NewsCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="news-list">
              {items.map((item) => <NewsRow key={item.id} item={item} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                data-testid="news-prev-page"
                onClick={() => setPage(page - 1)}
                className="border-[#28324D] text-xs"
              >
                Anterior
              </Button>
              <span className="font-mono text-xs text-[#9AA3B5]">{page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                data-testid="news-next-page"
                onClick={() => setPage(page + 1)}
                className="border-[#28324D] text-xs"
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
