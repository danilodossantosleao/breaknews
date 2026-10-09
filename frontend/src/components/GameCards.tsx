import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Plus, Check, Loader2, Clock } from "lucide-react";
import { ApiError, apiPatch, apiPost } from "@/lib/api";
import type { GameOut, LibraryItem } from "@/lib/types";
import { fmtDate, timeAgo, RELEASE_STATUS_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SafeImage, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LIB_KEYS = ["library", "dashboard-summary", "explore", "news"];

/** Card da biblioteca — capa grande, status pessoal, favorito e última novidade. */
export function LibraryCard({ item }: { item: LibraryItem }) {
  const queryClient = useQueryClient();
  const favMutation = useMutation({
    mutationFn: () => apiPatch<LibraryItem>(`/library/${item.id}`, { is_favorite: !item.is_favorite }),
    onSuccess: (updated) => {
      toast.success(updated.is_favorite ? "Adicionado aos favoritos" : "Removido dos favoritos");
      LIB_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
    onError: () => toast.error("Não foi possível atualizar o favorito."),
  });

  return (
    <div
      data-testid={`library-card-${item.game.slug}`}
      className="card-hover group relative overflow-hidden rounded-xl border border-[#1A2033] bg-[#10131D]"
    >
      <Link to={`/game/${item.game.id}`} data-testid={`library-card-link-${item.game.slug}`} className="block">
        <div className="scanline relative aspect-[3/4] overflow-hidden">
          <SafeImage
            src={item.game.cover_url}
            alt={item.game.title}
            fallbackLabel={item.game.title.slice(0, 2)}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 p-3">
            <h3 className="font-heading text-sm leading-tight font-bold text-white drop-shadow-lg">{item.game.title}</h3>
            <p className="mt-0.5 font-mono text-[10px] text-[#C7D2FE]">
              {item.platform ?? item.game.platforms[0] ?? "Plataforma não informada"}
            </p>
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={item.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        data-testid={`library-favorite-${item.game.slug}`}
        onClick={() => favMutation.mutate()}
        className="absolute top-2.5 right-2.5 z-20 rounded-full border border-[#28324D] bg-[#080A10]/80 p-1.5 backdrop-blur-sm transition-colors hover:border-[#8B5CF6]"
      >
        {favMutation.isPending ? (
          <Loader2 size={13} className="animate-spin text-[#9AA3B5]" />
        ) : (
          <Heart size={13} className={item.is_favorite ? "fill-[#8B5CF6] text-[#8B5CF6]" : "text-[#9AA3B5]"} />
        )}
      </button>
      <div className="space-y-2 p-3">
        <StatusBadge status={item.status} />
        <div className="flex items-center justify-between font-mono text-[10px] text-[#9AA3B5]">
          <span>{item.personal_rating != null ? `Nota ${item.personal_rating}/10` : "Sem nota"}</span>
          {item.hours_played != null && <span>{item.hours_played}h</span>}
        </div>
        {item.last_news_at && (
          <p className="flex items-center gap-1 font-mono text-[10px] text-[#67E8F9]">
            <Clock size={10} /> Novidade {timeAgo(item.last_news_at)}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded border border-[#28324D] bg-[#171B29] px-1.5 py-0.5 text-[10px] text-[#C7D2FE]">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Card do catálogo (explorar / recomendações) com ação de adicionar. */
export function CatalogCard({
  game,
  owned,
  onAdded,
}: {
  game: GameOut;
  owned: boolean;
  onAdded?: () => void;
}) {
  const queryClient = useQueryClient();
  const addMutation = useMutation({
    mutationFn: () => apiPost<LibraryItem>("/library", { game_id: game.id, status: "quero_jogar" }),
    onSuccess: () => {
      toast.success(`${game.title} entrou na sua biblioteca`);
      LIB_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      onAdded?.();
    },
    onError: (err) => {
      const detail =
        err instanceof ApiError && typeof (err.body as { detail?: string })?.detail === "string"
          ? (err.body as { detail: string }).detail
          : "Não foi possível adicionar agora.";
      toast.error(detail);
    },
  });

  return (
    <div
      data-testid={`catalog-card-${game.slug}`}
      className="card-hover group flex flex-col overflow-hidden rounded-xl border border-[#1A2033] bg-[#10131D]"
    >
      <Link to={`/game/${game.id}`} data-testid={`catalog-card-link-${game.slug}`}>
        <div className="scanline relative aspect-[3/4] overflow-hidden">
          <SafeImage
            src={game.cover_url}
            alt={game.title}
            fallbackLabel={game.title.slice(0, 2)}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {game.is_free && (
            <Badge className="absolute top-2 left-2 z-10 bg-[#10B981] text-[10px] text-white">Gratuito</Badge>
          )}
          <div className="absolute inset-x-0 bottom-0 z-10 p-3">
            <h3 className="font-heading text-sm leading-tight font-bold text-white drop-shadow-lg">{game.title}</h3>
            <p className="mt-0.5 font-mono text-[10px] text-[#C7D2FE]">
              {fmtDate(game.release_date)}
              {game.release_date_status !== "confirmado" && ` · ${RELEASE_STATUS_LABELS[game.release_date_status]}`}
            </p>
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-[11px] text-[#9AA3B5]">{game.description}</p>
        <div className="flex flex-wrap gap-1">
          {game.genres.slice(0, 2).map((g) => (
            <span key={g} className="rounded border border-[#28324D] bg-[#171B29] px-1.5 py-0.5 text-[10px] text-[#C7D2FE]">
              {g}
            </span>
          ))}
        </div>
        <div className="mt-auto">
          {owned ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              data-testid={`catalog-owned-${game.slug}`}
              className={cn("w-full gap-1.5 border-[#10B981]/40 text-xs text-[#6EE7B7]")}
            >
              <Check size={13} /> Na biblioteca
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={addMutation.isPending}
              data-testid={`catalog-add-${game.slug}`}
              onClick={() => addMutation.mutate()}
              className="w-full gap-1.5 bg-[#8B5CF6] text-xs text-white hover:bg-[#7C4DF4]"
            >
              {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
