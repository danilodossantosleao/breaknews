import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Plus, Search, Gamepad2, Heart } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { LibraryItem } from "@/lib/types";
import { STATUS_LABELS, fmtDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardSkeleton, EmptyState, SafeImage, StatusBadge } from "@/components/common";
import { LibraryCard } from "@/components/GameCards";
import GamePickerDialog from "@/components/GamePickerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SORTS: Record<string, string> = {
  recentes: "Atualizados recentemente",
  alfabetica: "Ordem alfabética",
  lancamento: "Data de lançamento",
  novidade: "Última novidade",
  nota: "Nota pessoal",
};

export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(searchParams.get("add") === "1");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "todos");
  const [platform, setPlatform] = useState("todas");
  const [genre, setGenre] = useState("todos");
  const [tag, setTag] = useState("todas");
  const [onlyFav, setOnlyFav] = useState(searchParams.get("fav") === "1");
  const [sort, setSort] = useState("recentes");
  const [view, setView] = useState<"grid" | "list">("grid");

  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet<LibraryItem[]>("/library"),
    retry: false,
  });

  const items = library.data ?? [];

  const platforms = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.game.platforms))).sort(),
    [items],
  );
  const genres = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.game.genres))).sort(),
    [items],
  );
  const tags = useMemo(() => Array.from(new Set(items.flatMap((i) => i.tags))).sort(), [items]);

  const filtered = useMemo(() => {
    let list = items;
    const q = term.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.game.title.toLowerCase().includes(q) ||
          (i.game.developer ?? "").toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (status !== "todos") list = list.filter((i) => i.status === status);
    if (platform !== "todas") list = list.filter((i) => i.game.platforms.includes(platform) || i.platform === platform);
    if (genre !== "todos") list = list.filter((i) => i.game.genres.includes(genre));
    if (tag !== "todas") list = list.filter((i) => i.tags.includes(tag));
    if (onlyFav) list = list.filter((i) => i.is_favorite);

    const sorted = [...list];
    switch (sort) {
      case "alfabetica":
        sorted.sort((a, b) => a.game.title.localeCompare(b.game.title, "pt-BR"));
        break;
      case "lancamento":
        sorted.sort((a, b) => (b.game.release_date ?? "").localeCompare(a.game.release_date ?? ""));
        break;
      case "novidade":
        sorted.sort((a, b) => (b.last_news_at ?? "").localeCompare(a.last_news_at ?? ""));
        break;
      case "nota":
        sorted.sort((a, b) => (b.personal_rating ?? -1) - (a.personal_rating ?? -1));
        break;
      default:
        sorted.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    }
    return sorted;
  }, [items, term, status, platform, genre, tag, onlyFav, sort]);

  const openPicker = (open: boolean) => {
    setPickerOpen(open);
    if (!open) {
      searchParams.delete("add");
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">Minha Biblioteca</h1>
          <p className="mt-1 text-sm text-[#9AA3B5]">
            {items.length} jogo{items.length === 1 ? "" : "s"} acompanhado{items.length === 1 ? "" : "s"}
            {filtered.length !== items.length && ` · ${filtered.length} com os filtros atuais`}
          </p>
        </div>
        <Button
          data-testid="library-add-game-button"
          onClick={() => setPickerOpen(true)}
          className="gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
        >
          <Plus size={16} /> Adicionar jogo
        </Button>
      </header>

      {/* Toolbar de filtros */}
      <div className="space-y-3 rounded-xl border border-[#1A2033] bg-[#10131D] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-[#1A2033] bg-[#0B0E17] px-3">
            <Search size={14} className="text-[#9AA3B5]" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Pesquisa instantânea na biblioteca…"
              data-testid="library-search-input"
              className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Visualização em grade"
            data-testid="library-view-grid"
            onClick={() => setView("grid")}
            className={view === "grid" ? "text-[#22D3EE]" : "text-[#9AA3B5]"}
          >
            <LayoutGrid size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Visualização em lista"
            data-testid="library-view-list"
            onClick={() => setView("list")}
            className={view === "list" ? "text-[#22D3EE]" : "text-[#9AA3B5]"}
          >
            <List size={15} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" data-testid="library-filter-status" className="w-40 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => (v === "todos" ? "Todos os status" : STATUS_LABELS[v as string])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger size="sm" data-testid="library-filter-platform" className="w-36 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => (v === "todas" ? "Plataformas" : (v as string))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Plataformas</SelectItem>
              {platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger size="sm" data-testid="library-filter-genre" className="w-32 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => (v === "todos" ? "Gêneros" : (v as string))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Gêneros</SelectItem>
              {genres.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>

          {tags.length > 0 && (
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger size="sm" data-testid="library-filter-tag" className="w-32 border-[#28324D] bg-[#0B0E17] text-xs">
                <SelectValue>{(v) => (v === "todas" ? "Tags" : `#${v}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Tags</SelectItem>
                {tags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger size="sm" data-testid="library-sort" className="w-48 border-[#28324D] bg-[#0B0E17] text-xs">
              <SelectValue>{(v) => SORTS[v as string] ?? "Ordenar"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={onlyFav ? "default" : "outline"}
            size="sm"
            data-testid="library-filter-favorites"
            onClick={() => setOnlyFav(!onlyFav)}
            className={cn("gap-1.5 text-xs", onlyFav ? "bg-[#8B5CF6] text-white" : "border-[#28324D] text-[#9AA3B5]")}
          >
            <Heart size={13} className={onlyFav ? "fill-current" : ""} /> Favoritos
          </Button>

          {(status !== "todos" || platform !== "todas" || genre !== "todos" || tag !== "todas" || onlyFav || term) && (
            <Button
              variant="ghost"
              size="sm"
              data-testid="library-clear-filters"
              onClick={() => {
                setStatus("todos"); setPlatform("todas"); setGenre("todos"); setTag("todas");
                setOnlyFav(false); setTerm("");
              }}
              className="text-xs text-[#9AA3B5]"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {library.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {library.isError && (
        <EmptyState title="Biblioteca indisponível" description="Não foi possível carregar seus jogos agora. Tente recarregar em instantes." />
      )}

      {!library.isLoading && !library.isError && items.length === 0 && (
        <EmptyState
          icon={<Gamepad2 size={34} />}
          title="Nenhum jogo na biblioteca"
          description="Busque no catálogo e adicione seus favoritos para montar sua central personalizada."
          action={
            <Button
              data-testid="library-empty-add-button"
              onClick={() => setPickerOpen(true)}
              className="mt-2 gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
            >
              <Plus size={15} /> Adicionar meu primeiro jogo
            </Button>
          }
        />
      )}

      {!library.isLoading && items.length > 0 && filtered.length === 0 && (
        <EmptyState title="Nenhum resultado" description="Nenhum jogo corresponde aos filtros selecionados." />
      )}

      {filtered.length > 0 &&
        (view === "grid" ? (
          <div
            data-testid="library-grid"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
          >
            {filtered.map((item) => <LibraryCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="space-y-2" data-testid="library-list">
            {filtered.map((item) => (
              <Link
                key={item.id}
                to={`/game/${item.game.id}`}
                data-testid={`library-row-${item.game.slug}`}
                className="flex items-center gap-3 rounded-lg border border-[#1A2033] bg-[#10131D] p-3 transition-colors hover:border-[#8B5CF6]/40"
              >
                <SafeImage
                  src={item.game.cover_url}
                  alt={item.game.title}
                  fallbackLabel={item.game.title.slice(0, 2)}
                  className="h-16 w-11 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-heading text-sm font-semibold text-[#F4F5FA]">{item.game.title}</p>
                    {item.is_favorite && <Heart size={12} className="fill-[#8B5CF6] text-[#8B5CF6]" />}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-[#9AA3B5]">
                    {item.platform ?? item.game.platforms.join(", ")} · {fmtDate(item.game.release_date)}
                    {item.hours_played != null && ` · ${item.hours_played}h`}
                  </p>
                  {item.last_news_at && (
                    <p className="font-mono text-[10px] text-[#67E8F9]">Novidade {timeAgo(item.last_news_at)}</p>
                  )}
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                  <StatusBadge status={item.status} />
                  {item.personal_rating != null && (
                    <Badge variant="outline" className="border-[#F59E0B]/40 text-[10px] text-[#FCD34D]">
                      Nota {item.personal_rating}/10
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ))}

      <GamePickerDialog open={pickerOpen} onOpenChange={openPicker} />
    </div>
  );
}
