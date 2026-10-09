import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Check, Loader2, ArrowRight, SkipForward, Search } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { GameOut, UserOut } from "@/lib/types";
import { useMe } from "@/hooks/useMe";
import { useDebounce } from "@/hooks/useDebounce";
import { FREQUENCY_LABELS, GENRE_OPTIONS, PLATFORM_OPTIONS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

const STEPS = ["Boas-vindas", "Plataformas", "Gêneros", "Jogos", "Alertas"];

export default function OnboardingPage() {
  const { data: me, isLoading } = useMe();
  const [step, setStep] = useState(0);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("diario");
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const catalog = useQuery({
    queryKey: ["games-search", debounced],
    queryFn: () => apiGet<GameOut[]>(`/games/search?q=${encodeURIComponent(debounced.trim())}&limit=18`),
    enabled: step === 3,
    retry: false,
  });

  const finish = useMutation({
    mutationFn: () =>
      apiPost<UserOut>("/auth/onboarding", {
        platforms,
        genres,
        game_ids: gameIds,
        notification_frequency: frequency,
      }),
    onSuccess: () => {
      toast.success("Central configurada! Bem-vindo ao NEXUS.");
      queryClient.invalidateQueries();
      navigate("/", { replace: true });
    },
    onError: () => toast.error("Não foi possível concluir a configuração."),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#080A10]">
        <Loader2 className="animate-spin text-[#8B5CF6]" />
      </div>
    );
  }
  if (!me) return <Navigate to="/login" replace />;
  if (me.onboarding_done) return <Navigate to="/" replace />;

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="min-h-svh bg-[#080A10] px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-[#8B5CF6] to-[#22D3EE]">
            <Zap size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="neon-text font-heading text-xl font-bold">NEXUS</span>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#9AA3B5]">Configuração inicial</p>
          </div>
        </div>

        {/* Progresso */}
        <div className="mb-7 flex items-center gap-1.5" data-testid="onboarding-progress">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  i <= step ? "bg-linear-to-r from-[#8B5CF6] to-[#22D3EE]" : "bg-[#1A2033]",
                )}
              />
              <p className={cn("mt-1.5 hidden font-mono text-[10px] sm:block", i <= step ? "text-[#22D3EE]" : "text-[#9AA3B5]")}>
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#1A2033] bg-[#10131D] p-6 md:p-8">
          {step === 0 && (
            <div className="space-y-4" data-testid="onboarding-step-welcome">
              <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">
                Seu universo gamer. <span className="neon-text">Em um só lugar.</span>
              </h1>
              <p className="text-sm leading-relaxed text-[#9AA3B5]">
                O NEXUS reúne notícias, patches, DLCs, lançamentos e eventos dos jogos que você acompanha. Vamos
                configurar sua central em quatro passos rápidos — você pode pular qualquer etapa e ajustar depois em
                Configurações.
              </p>
              <ul className="space-y-2 text-sm text-[#C8CEDC]">
                <li>• Escolha suas plataformas e gêneros favoritos</li>
                <li>• Adicione os primeiros jogos à biblioteca</li>
                <li>• Defina como quer receber alertas internos</li>
              </ul>
            </div>
          )}

          {step === 1 && (
            <div data-testid="onboarding-step-platforms">
              <h2 className="font-heading text-xl font-bold text-[#F4F5FA]">Em quais plataformas você joga?</h2>
              <p className="mt-1 mb-5 text-sm text-[#9AA3B5]">Usamos isso para priorizar novidades relevantes.</p>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    active={platforms.includes(p)}
                    testid={`onboarding-platform-${p}`}
                    onClick={() => toggle(platforms, setPlatforms, p)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div data-testid="onboarding-step-genres">
              <h2 className="font-heading text-xl font-bold text-[#F4F5FA]">Quais gêneros te interessam?</h2>
              <p className="mt-1 mb-5 text-sm text-[#9AA3B5]">Isso alimenta as recomendações da página Explorar.</p>
              <div className="flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((g) => (
                  <Chip
                    key={g}
                    label={g}
                    active={genres.includes(g)}
                    testid={`onboarding-genre-${g}`}
                    onClick={() => toggle(genres, setGenres, g)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div data-testid="onboarding-step-games">
              <h2 className="font-heading text-xl font-bold text-[#F4F5FA]">Escolha seus primeiros jogos</h2>
              <p className="mt-1 mb-4 text-sm text-[#9AA3B5]">
                Selecionados: <span className="font-mono text-[#22D3EE]">{gameIds.length}</span>
              </p>
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#1A2033] bg-[#0B0E17] px-3">
                <Search size={15} className="text-[#9AA3B5]" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Buscar no catálogo…"
                  data-testid="onboarding-game-search"
                  className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="grid max-h-80 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3">
                {(catalog.data ?? []).map((game) => {
                  const picked = gameIds.includes(game.id);
                  return (
                    <button
                      key={game.id}
                      type="button"
                      data-testid={`onboarding-game-${game.slug}`}
                      onClick={() =>
                        setGameIds(picked ? gameIds.filter((id) => id !== game.id) : [...gameIds, game.id])
                      }
                      className={cn(
                        "relative overflow-hidden rounded-lg border text-left transition-colors",
                        picked ? "border-[#8B5CF6] shadow-[0_0_18px_rgba(139,92,246,0.3)]" : "border-[#1A2033] hover:border-[#28324D]",
                      )}
                    >
                      <SafeImage
                        src={game.cover_url}
                        alt={game.title}
                        fallbackLabel={game.title.slice(0, 2)}
                        className="aspect-[3/4] w-full object-cover"
                      />
                      {picked && (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-[#8B5CF6] p-1">
                          <Check size={11} className="text-white" />
                        </span>
                      )}
                      <p className="truncate bg-[#0B0E17] px-2 py-1.5 text-[11px] font-medium text-[#F4F5FA]">
                        {game.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div data-testid="onboarding-step-alerts">
              <h2 className="font-heading text-xl font-bold text-[#F4F5FA]">Como quer receber alertas?</h2>
              <p className="mt-1 mb-5 text-sm text-[#9AA3B5]">
                As notificações são internas do site. A sincronização de fontes roda periodicamente no servidor — não
                em tempo real.
              </p>
              <div className="space-y-2">
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`onboarding-frequency-${value}`}
                    onClick={() => setFrequency(value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      frequency === value
                        ? "border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#F4F5FA]"
                        : "border-[#1A2033] bg-[#0B0E17] text-[#9AA3B5] hover:border-[#28324D]",
                    )}
                  >
                    {label}
                    {frequency === value && <Check size={15} className="text-[#8B5CF6]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              data-testid="onboarding-skip-button"
              onClick={() => finish.mutate()}
              disabled={finish.isPending}
              className="gap-1.5 text-xs text-[#9AA3B5]"
            >
              <SkipForward size={13} /> Pular e configurar depois
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  data-testid="onboarding-back-button"
                  onClick={() => setStep(step - 1)}
                  className="border-[#28324D]"
                >
                  Voltar
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  data-testid="onboarding-next-button"
                  onClick={() => setStep(step + 1)}
                  className="gap-1.5 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
                >
                  Continuar <ArrowRight size={14} />
                </Button>
              ) : (
                <Button
                  data-testid="onboarding-finish-button"
                  onClick={() => finish.mutate()}
                  disabled={finish.isPending}
                  className="gap-1.5 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
                >
                  {finish.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Concluir configuração
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  testid,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F4F5FA]"
          : "border-[#28324D] bg-[#0B0E17] text-[#9AA3B5] hover:border-[#8B5CF6]/50 hover:text-[#F4F5FA]",
      )}
    >
      {label}
    </button>
  );
}
