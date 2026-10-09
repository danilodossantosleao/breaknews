// Helpers de formatação pt-BR + rótulos de categoria/status compartilhados.

export const CATEGORY_LABELS: Record<string, string> = {
  noticias: "Notícias",
  atualizacao: "Atualizações e patches",
  dlc: "DLCs e expansões",
  lancamento: "Lançamentos",
  evento: "Eventos",
  trailer: "Trailers",
  analise: "Análises",
  promocao: "Promoções",
  manutencao: "Manutenção e servidores",
  alerta: "Alertas oficiais",
};

export const CATEGORY_STYLES: Record<string, string> = {
  noticias: "bg-[#171B29] text-[#9AA3B5] border-[#28324D]",
  atualizacao: "bg-[#064E3B]/60 text-[#6EE7B7] border-[#10B981]/30",
  dlc: "bg-[#581C87]/50 text-[#F0ABFC] border-[#8B5CF6]/40",
  lancamento: "bg-[#1E1B4B]/70 text-[#C7D2FE] border-[#8B5CF6]/40",
  evento: "bg-[#0E7490]/30 text-[#67E8F9] border-[#22D3EE]/40",
  trailer: "bg-[#7C2D12]/40 text-[#FDBA74] border-[#F59E0B]/30",
  analise: "bg-[#1E3A8A]/40 text-[#93C5FD] border-[#3B82F6]/30",
  promocao: "bg-[#064E3B]/60 text-[#6EE7B7] border-[#10B981]/40",
  manutencao: "bg-[#451A03]/50 text-[#FCD34D] border-[#F59E0B]/40",
  alerta: "bg-[#450A0A]/60 text-[#FCA5A5] border-[#EF4444]/40",
};

export const STATUS_LABELS: Record<string, string> = {
  quero_jogar: "Quero jogar",
  jogando: "Jogando",
  pausado: "Pausado",
  zerado: "Zerado",
  abandonado: "Abandonado",
  completado_100: "Completado 100%",
};

export const STATUS_STYLES: Record<string, string> = {
  quero_jogar: "bg-[#1E1B4B] text-[#C7D2FE] border-[#8B5CF6]/40",
  jogando: "bg-[#064E3B] text-[#6EE7B7] border-[#10B981]/40",
  pausado: "bg-[#451A03] text-[#FCD34D] border-[#F59E0B]/40",
  zerado: "bg-[#0E7490]/30 text-[#67E8F9] border-[#22D3EE]/40",
  abandonado: "bg-[#450A0A] text-[#FCA5A5] border-[#EF4444]/40",
  completado_100: "bg-[#581C87] text-[#F0ABFC] border-[#8B5CF6]/40",
};

export const RELEASE_STATUS_LABELS: Record<string, string> = {
  confirmado: "Data confirmada",
  estimado: "Data estimada",
  tba: "A anunciar",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  lancamento: "Lançamento",
  dlc: "DLC",
  beta: "Beta",
  evento: "Evento",
  showcase: "Showcase",
};

export const UPDATE_CATEGORY_LABELS: Record<string, string> = {
  patch: "Patch",
  dlc: "DLC",
  expansao: "Expansão",
  evento: "Evento",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  imediato: "Imediatamente",
  diario: "Resumo diário",
  semanal: "Resumo semanal",
  desativado: "Desativado",
};

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Não informado";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const future = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  const fmt = (n: number, unit: string) => (future ? `em ${n} ${unit}` : `há ${n} ${unit}`);
  if (mins < 1) return "agora";
  if (mins < 60) return fmt(mins, "min");
  const hours = Math.round(mins / 60);
  if (hours < 24) return fmt(hours, hours === 1 ? "hora" : "horas");
  const days = Math.round(hours / 24);
  if (days < 30) return fmt(days, days === 1 ? "dia" : "dias");
  const months = Math.round(days / 30);
  return fmt(months, months === 1 ? "mês" : "meses");
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return diff;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "NX";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export const PLATFORM_OPTIONS = ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch", "Switch 2", "Mobile"];

export const GENRE_OPTIONS = [
  "RPG", "Ação", "Aventura", "FPS", "Soulslike", "Roguelike", "Indie", "Mundo Aberto",
  "Esportes", "Corrida", "Luta", "Estratégia", "Simulação", "Terror", "Battle Royale",
  "MOBA", "Metroidvania", "Plataforma", "Sandbox", "Sci-Fi", "Fantasia", "Sobrevivência", "Competitivo",
];
