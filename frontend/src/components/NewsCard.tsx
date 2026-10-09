import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bookmark, BookmarkCheck, Check, ExternalLink, Sparkles, Loader2, ShieldCheck, FlaskConical, Eye,
} from "lucide-react";
import { apiPost } from "@/lib/api";
import type { AISummaryContent, NewsItem } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_STYLES, timeAgo, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const INVALIDATE = ["news", "news-facets", "saved", "dashboard-summary", "game-news"];

function useNewsState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { is_read?: boolean; is_saved?: boolean } }) =>
      apiPost<{ read: boolean; saved: boolean }>(`/news/${id}/state`, patch),
    onSuccess: () => INVALIDATE.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    onError: () => toast.error("Não foi possível salvar essa ação agora."),
  });
}

export function NewsActions({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  const state = useNewsState();
  const [aiOpen, setAiOpen] = useState(false);
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState<AISummaryContent | null>(item.ai_summary);

  const aiMutation = useMutation({
    mutationFn: () => apiPost<{ news_id: string; summary: AISummaryContent }>(`/news/${item.id}/ai-summary`),
    onSuccess: (data) => {
      setSummary(data.summary);
      setAiOpen(true);
      INVALIDATE.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: () => toast.error("Resumo por IA indisponível agora.", { description: "A notícia original continua acessível." }),
  });

  const toggleRead = () => {
    state.mutate({ id: item.id, patch: { is_read: !item.read } });
    toast.success(item.read ? "Marcada como não lida" : "Marcada como lida");
  };

  const toggleSaved = () => {
    state.mutate({ id: item.id, patch: { is_saved: !item.saved } });
    toast.success(item.saved ? "Removida da coleção" : "Salva em Minha Coleção");
  };

  const openAI = () => {
    if (summary) setAiOpen(true);
    else aiMutation.mutate();
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`news-read-${item.id}`}
          onClick={toggleRead}
          className={cn("gap-1.5 px-2 text-xs", item.read ? "text-[#6EE7B7]" : "text-[#9AA3B5]")}
        >
          {item.read ? <Check size={13} /> : <Eye size={13} />}
          {item.read ? "Lida" : "Marcar lida"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`news-save-${item.id}`}
          onClick={toggleSaved}
          className={cn("gap-1.5 px-2 text-xs", item.saved ? "text-[#A78BFA]" : "text-[#9AA3B5]")}
        >
          {item.saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
          {item.saved ? "Salva" : "Salvar"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`news-ai-${item.id}`}
          onClick={openAI}
          disabled={aiMutation.isPending}
          className="gap-1.5 px-2 text-xs text-[#22D3EE]"
        >
          {aiMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Resumo IA
        </Button>
        {item.source_url ? (
          <Button
            variant="ghost"
            size="sm"
            data-testid={`news-open-${item.id}`}
            className="gap-1.5 px-2 text-xs text-[#9AA3B5]"
            render={
              <a href={item.source_url} target="_blank" rel="noopener noreferrer nofollow">
                <ExternalLink size={13} /> Abrir fonte
              </a>
            }
          />
        ) : null}
      </div>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-xl border-[#28324D] bg-[#10131D]" data-testid="ai-summary-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Sparkles size={16} className="text-[#22D3EE]" /> Resumo gerado por IA
            </DialogTitle>
            <DialogDescription>
              Baseado apenas no conteúdo publicado por {item.source_name}. Abra a fonte original para o texto completo.
            </DialogDescription>
          </DialogHeader>
          {summary && (
            <div className="space-y-4 text-sm">
              <p className="rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-3 text-[#F4F5FA]" data-testid="ai-short-summary">
                {summary.resumo_curto}
              </p>
              {summary.resumo_detalhado && (
                <p className="whitespace-pre-line text-[#C8CEDC]">{summary.resumo_detalhado}</p>
              )}
              {summary.pontos_principais.length > 0 && (
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]">Principais novidades</p>
                  <ul className="space-y-1">
                    {summary.pontos_principais.map((point, i) => (
                      <li key={i} className="flex gap-2 text-[#C8CEDC]">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#8B5CF6]" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.impacto_jogadores && (
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]">Impacto para jogadores</p>
                  <p className="text-[#C8CEDC]">{summary.impacto_jogadores}</p>
                </div>
              )}
              <p className="font-mono text-[10px] text-[#9AA3B5]">
                Gerado em {fmtDateTime(summary.gerado_em)} · fonte: {item.source_name}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SourceBadges({ item }: { item: NewsItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn("border text-[10px]", CATEGORY_STYLES[item.category] ?? "border-[#28324D] text-[#9AA3B5]")}
        data-testid={`news-category-${item.id}`}
      >
        {CATEGORY_LABELS[item.category] ?? item.category}
      </Badge>
      {item.is_official ? (
        <Badge variant="outline" className="border-[#22D3EE]/40 text-[10px] text-[#67E8F9]" data-testid={`news-official-${item.id}`}>
          <ShieldCheck size={10} className="mr-1" /> Anúncio oficial
        </Badge>
      ) : (
        <Badge variant="outline" className="border-[#28324D] text-[10px] text-[#9AA3B5]">
          Veículo independente
        </Badge>
      )}
      {item.is_demo && (
        <Badge variant="outline" className="border-[#F59E0B]/40 text-[10px] text-[#FCD34D]" data-testid={`news-demo-${item.id}`}>
          <FlaskConical size={10} className="mr-1" /> Demo
        </Badge>
      )}
    </div>
  );
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article
      data-testid={`news-card-${item.id}`}
      className={cn(
        "card-hover group relative flex flex-col overflow-hidden rounded-xl border bg-[#10131D]",
        item.read ? "border-[#1A2033] opacity-85" : "border-[#28324D]",
      )}
    >
      <div className="relative aspect-video overflow-hidden">
        <SafeImage
          src={item.image_url}
          alt={item.title}
          fallbackLabel={(item.game_title ?? "NX").slice(0, 2)}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#080A10] via-transparent to-transparent" />
        {!item.read && (
          <span
            data-testid={`news-new-${item.id}`}
            className="absolute top-3 left-3 rounded-full bg-[#8B5CF6] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-white shadow-[0_0_14px_rgba(139,92,246,0.6)]"
          >
            Nova
          </span>
        )}
        {item.game_title && (
          <Link
            to={item.game_id ? `/game/${item.game_id}` : "/news"}
            data-testid={`news-game-link-${item.id}`}
            className="absolute bottom-3 left-3 max-w-[85%] truncate rounded-md border border-[#28324D] bg-[#080A10]/85 px-2 py-1 font-mono text-[10px] text-[#C7D2FE] backdrop-blur-sm hover:border-[#8B5CF6]"
          >
            {item.game_title}
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <SourceBadges item={item} />
        <h3 className="font-heading text-[15px] leading-snug font-semibold text-[#F4F5FA]">{item.title}</h3>
        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#9AA3B5]">{item.summary || "Resumo não informado pela fonte."}</p>
        <p className="font-mono text-[10px] text-[#9AA3B5]">
          {item.source_name} · {timeAgo(item.published_at)}
        </p>
        <NewsActions item={item} />
      </div>
    </article>
  );
}

export function NewsRow({ item }: { item: NewsItem }) {
  return (
    <article
      data-testid={`news-row-${item.id}`}
      className={cn(
        "flex gap-3 rounded-lg border bg-[#10131D] p-3 transition-colors hover:border-[#8B5CF6]/40",
        item.read ? "border-[#1A2033] opacity-85" : "border-[#28324D]",
      )}
    >
      <SafeImage
        src={item.image_url}
        alt={item.title}
        fallbackLabel={(item.game_title ?? "NX").slice(0, 2)}
        className="hidden h-16 w-24 shrink-0 rounded object-cover sm:block"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#8B5CF6]" aria-label="Não lida" />}
          <h3 className="min-w-0 flex-1 font-heading text-sm font-semibold text-[#F4F5FA]">{item.title}</h3>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-[#9AA3B5]">{item.summary}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <SourceBadges item={item} />
          <span className="font-mono text-[10px] text-[#9AA3B5]">
            {item.game_title ? `${item.game_title} · ` : ""}
            {item.source_name} · {timeAgo(item.published_at)}
          </span>
        </div>
        <NewsActions item={item} compact />
      </div>
    </article>
  );
}
