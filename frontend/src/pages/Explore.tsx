import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Compass, Sparkles, Flame, Clock, Gift, Layers, Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { ExploreOut, GameOut, LibraryItem } from "@/lib/types";
import { useDebounce } from "@/hooks/useDebounce";
import { CardSkeleton, EmptyState, SafeImage, SectionHeader } from "@/components/common";
import { CatalogCard } from "@/components/GameCards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ExplorePage() {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const [genre, setGenre] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);

  const explore = useQuery({
    queryKey: ["explore"],
    queryFn: () => apiGet<ExploreOut>("/explore"),
    retry: false,
  });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet<LibraryItem[]>("/library"),
    retry: false,
  });
  const search = useQuery({
    queryKey: ["games-search", debounced, "explore"],
    queryFn: () => apiGet<GameOut[]>(`/games/search?q=${encodeURIComponent(debounced.trim())}&limit=24`),
    enabled: debounced.trim().length > 0,
    retry: false,
  });

  const ownedIds = useMemo(() => new Set((library.data ?? []).map((i) => i.game.id)), [library.data]);
  const data = explore.data;

  const filterList = (list: GameOut[]) =>
    list.filter(
      (g) => (!genre || g.genres.includes(genre)) && (!platform || g.platforms.includes(platform)),
    );

  const searching = debounced.trim().length > 0;

  return (
    <div className="space-y-7 animate-fade-up">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">Explorar Jogos</h1>
        <p className="mt-1 text-sm text-[#9AA3B5]">
          Descubra títulos do catálogo e adicione direto à sua biblioteca. As recomendações usam seus gêneros
          favoritos — popularidade não é preferência pessoal.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-lg border border-[#1A2033] bg-[#10131D] px-3">
        <Search size={15} className="text-[#9AA3B5]" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nome, franquia, desenvolvedora, plataforma ou gênero…"
          data-testid="explore-search-input"
          className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Chips de gênero e plataforma */}
      {!!data && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {data.genres.slice(0, 14).map((g) => (
              <Chip
                key={g}
                label={g}
                active={genre === g}
                testid={`explore-genre-${g}`}
                onClick={() => setGenre(genre === g ? null : g)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.platforms.map((p) => (
              <Chip
                key={p}
                label={p}
                active={platform === p}
                testid={`explore-platform-${p}`}
                onClick={() => setPlatform(platform === p ? null : p)}
                tone="cyan"
              />
            ))}
            {(genre || platform) && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="explore-clear-filters"
                onClick={() => { setGenre(null); setPlatform(null); }}
                className="h-7 text-xs text-[#9AA3B5]"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      )}

      {explore.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {explore.isError && (
        <EmptyState title="Catálogo indisponível" description="Não foi possível carregar as descobertas agora." />
      )}

      {searching && (
        <section>
          <SectionHeader title={`Resultados para “${debounced}”`} />
          {search.isLoading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            </div>
          )}
          {!search.isLoading && (search.data?.length ?? 0) === 0 && (
            <EmptyState title="Nenhum jogo encontrado" description="Tente outro termo ou limpe os filtros." />
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {filterList(search.data ?? []).map((g) => (
              <CatalogCard key={g.id} game={g} owned={ownedIds.has(g.id)} />
            ))}
          </div>
        </section>
      )}

      {!searching && data && (
        <>
          <Shelf
            title="Recomendados para você"
            icon={<Sparkles size={15} className="text-[#A78BFA]" />}
            games={filterList(data.recommended)}
            ownedIds={ownedIds}
            emptyText="Defina gêneros favoritos em Configurações para receber recomendações."
          />
          <Shelf
            title="Populares agora"
            icon={<Flame size={15} className="text-[#FCA5A5]" />}
            games={filterList(data.popular)}
            ownedIds={ownedIds}
          />
          <Shelf
            title="Próximos lançamentos"
            icon={<Clock size={15} className="text-[#FCD34D]" />}
            games={filterList(data.upcoming)}
            ownedIds={ownedIds}
          />
          <Shelf
            title="Lançados recentemente"
            icon={<Compass size={15} className="text-[#67E8F9]" />}
            games={filterList(data.recent)}
            ownedIds={ownedIds}
          />
          <Shelf
            title="Jogos gratuitos"
            icon={<Gift size={15} className="text-[#6EE7B7]" />}
            games={filterList(data.free)}
            ownedIds={ownedIds}
            emptyText="Nenhum título gratuito marcado no catálogo."
          />

          {data.franchises.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Layers size={15} className="text-[#C7D2FE]" />
                <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Franquias</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {data.franchises.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    data-testid={`explore-franchise-${f.name}`}
                    onClick={() => setTerm(f.name)}
                    className="card-hover overflow-hidden rounded-lg border border-[#1A2033] bg-[#10131D] text-left"
                  >
                    <SafeImage
                      src={f.cover_url}
                      alt={f.name}
                      fallbackLabel={f.name.slice(0, 2)}
                      className="aspect-video w-full object-cover"
                    />
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-[#F4F5FA]">{f.name}</p>
                      <p className="font-mono text-[10px] text-[#9AA3B5]">{f.count} jogo(s)</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Shelf({
  title,
  icon,
  games,
  ownedIds,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  games: GameOut[];
  ownedIds: Set<string>;
  emptyText?: string;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">{title}</h2>
        <span className="font-mono text-[10px] text-[#9AA3B5]">{games.length}</span>
      </div>
      {games.length === 0 ? (
        <EmptyState title="Nada por aqui" description={emptyText ?? "Nenhum jogo corresponde aos filtros."} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {games.slice(0, 6).map((g) => (
            <CatalogCard key={g.id} game={g} owned={ownedIds.has(g.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function Chip({
  label,
  active,
  onClick,
  testid,
  tone = "purple",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testid: string;
  tone?: "purple" | "cyan";
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? tone === "purple"
            ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F4F5FA]"
            : "border-[#22D3EE] bg-[#22D3EE]/15 text-[#F4F5FA]"
          : "border-[#28324D] bg-[#10131D] text-[#9AA3B5] hover:border-[#8B5CF6]/50 hover:text-[#F4F5FA]",
      )}
    >
      {label}
    </button>
  );
}
