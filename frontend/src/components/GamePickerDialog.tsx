import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, Check, Loader2 } from "lucide-react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { GameOut, LibraryItem } from "@/lib/types";
import { useDebounce } from "@/hooks/useDebounce";
import { fmtDate } from "@/lib/format";
import { SafeImage } from "@/components/common";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Busca com autocomplete + adicionar à biblioteca com proteção contra duplicatas. */
export default function GamePickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const results = useQuery({
    queryKey: ["games-search", debounced],
    queryFn: () => apiGet<GameOut[]>(`/games/search?q=${encodeURIComponent(debounced.trim())}`),
    enabled: open,
    retry: false,
  });

  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet<LibraryItem[]>("/library"),
    enabled: open,
    retry: false,
  });

  const ownedIds = new Set((library.data ?? []).map((i) => i.game.id));

  const addMutation = useMutation({
    mutationFn: (game: GameOut) => apiPost<LibraryItem>("/library", { game_id: game.id, status: "quero_jogar" }),
    onSuccess: (item) => {
      toast.success(`${item.game.title} entrou na sua biblioteca`, {
        description: "Status inicial: Quero jogar. Ajuste na página do jogo.",
      });
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["news"] });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError && typeof (err.body as { detail?: string })?.detail === "string"
          ? (err.body as { detail: string }).detail
          : "Não foi possível adicionar agora.";
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-[#28324D] bg-[#10131D]" data-testid="game-picker-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Adicionar jogo à biblioteca</DialogTitle>
          <DialogDescription>
            Busque por nome, franquia, desenvolvedora, publicadora, plataforma ou gênero.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border border-[#1A2033] bg-[#0B0E17] px-3">
          <Search size={15} className="shrink-0 text-[#9AA3B5]" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ex.: Elden Ring, FromSoftware, PS5, RPG…"
            data-testid="game-picker-input"
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          {results.isFetching && <Loader2 size={15} className="animate-spin text-[#8B5CF6]" />}
        </div>

        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {results.isError && (
            <p className="py-6 text-center text-sm text-[#FCA5A5]" data-testid="game-picker-error">
              Catálogo indisponível no momento. Tente novamente em instantes.
            </p>
          )}
          {!results.isError && (results.data?.length ?? 0) === 0 && !results.isFetching && (
            <p className="py-6 text-center text-sm text-[#9AA3B5]" data-testid="game-picker-no-results">
              {debounced.trim() ? `Nenhum jogo encontrado para “${debounced}”.` : "Comece digitando o nome de um jogo."}
            </p>
          )}
          {(results.data ?? []).map((game) => {
            const owned = ownedIds.has(game.id);
            const pending = addMutation.isPending && addMutation.variables?.id === game.id;
            return (
              <div
                key={game.id}
                data-testid={`game-result-${game.slug}`}
                className="flex gap-3 rounded-lg border border-[#1A2033] bg-[#0B0E17] p-3 transition-colors hover:border-[#8B5CF6]/40"
              >
                <SafeImage
                  src={game.cover_url}
                  alt={game.title}
                  fallbackLabel={game.title.slice(0, 2)}
                  className="h-20 w-14 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate font-heading text-sm font-semibold text-[#F4F5FA]">{game.title}</h4>
                      <p className="mt-0.5 font-mono text-[11px] text-[#9AA3B5]">
                        {game.release_date ? new Date(`${game.release_date}T12:00:00`).getFullYear() : "Data não informada"}
                        {" · "}
                        {game.developer ?? "Dev não informado"}
                      </p>
                    </div>
                    {owned ? (
                      <Badge variant="outline" className="shrink-0 border-[#10B981]/40 text-[#6EE7B7]" data-testid={`owned-badge-${game.slug}`}>
                        <Check size={12} className="mr-1" /> Na biblioteca
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pending}
                        data-testid={`add-game-${game.slug}`}
                        onClick={() => addMutation.mutate(game)}
                        className="shrink-0 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
                      >
                        {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Adicionar
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[#9AA3B5]">{game.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {game.genres.slice(0, 3).map((g) => (
                      <span key={g} className="rounded border border-[#28324D] bg-[#171B29] px-1.5 py-0.5 text-[10px] text-[#C7D2FE]">
                        {g}
                      </span>
                    ))}
                    {game.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="rounded border border-[#22D3EE]/25 bg-[#0E7490]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#67E8F9]">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#9AA3B5]">
          Catálogo em modo demonstração · {fmtDate(new Date().toISOString())}
        </p>
      </DialogContent>
    </Dialog>
  );
}
