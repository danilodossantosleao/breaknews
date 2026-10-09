// Espelho manual dos modelos Pydantic do backend — manter em sincronia na mesma edição.

export interface UserOut {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  theme: string;
  locale: string;
  notification_frequency: string;
  favorite_platforms: string[];
  favorite_genres: string[];
  onboarding_done: boolean;
  created_at: string | null;
}

export interface GameOut {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
  background_url: string | null;
  release_date: string | null;
  release_date_status: string;
  developer: string | null;
  publisher: string | null;
  platforms: string[];
  genres: string[];
  franchise: string | null;
  popularity: number;
  is_free: boolean;
}

export interface SimilarOut {
  game: GameOut;
  shared_genres: string[];
}

export interface GameDetailOut extends GameOut {
  similar: SimilarOut[];
}

export interface LibraryItem {
  id: string;
  status: string;
  platform: string | null;
  personal_rating: number | null;
  personal_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  hours_played: number | null;
  is_favorite: boolean;
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
  last_news_at: string | null;
  game: GameOut;
}

export interface AISummaryContent {
  resumo_curto: string;
  resumo_detalhado: string;
  pontos_principais: string[];
  impacto_jogadores: string;
  gerado_em: string | null;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  image_url: string | null;
  category: string;
  source_name: string;
  source_url: string;
  published_at: string | null;
  is_official: boolean;
  is_demo: boolean;
  game_id: string | null;
  game_title: string | null;
  game_cover: string | null;
  read: boolean;
  saved: boolean;
  ai_summary: AISummaryContent | null;
}

export interface NewsPage {
  items: NewsItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface NewsFacets {
  sources: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  unread: number;
  saved: number;
}

export interface UpdateItem {
  id: string;
  game_id: string;
  game_title: string | null;
  game_cover: string | null;
  version: string | null;
  title: string;
  summary: string;
  highlights: string[];
  patch_notes_url: string | null;
  category: string;
  published_at: string | null;
  is_read: boolean;
  is_recent: boolean;
}

export interface UpdatePage {
  items: UpdateItem[];
  total: number;
}

export interface EventItem {
  id: string;
  game_id: string | null;
  game_title: string | null;
  game_cover: string | null;
  title: string;
  description: string;
  event_type: string;
  starts_at: string | null;
  ends_at: string | null;
  timezone_label: string;
  date_status: string;
  source_url: string | null;
  is_saved: boolean;
  reminder: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  game_id: string | null;
  news_id: string | null;
  is_read: boolean;
  created_at: string | null;
}

export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}

export interface PrefItem {
  category: string;
  enabled: boolean;
  frequency: string;
}

export interface SearchResults {
  games: GameOut[];
  news: NewsItem[];
  updates: UpdateItem[];
  events: EventItem[];
}

export interface SyncLogOut {
  id: string;
  trigger: string;
  status: string;
  sources_ok: number;
  sources_failed: number;
  items_fetched: number;
  items_inserted: number;
  demo_fallback: boolean;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface DashboardSummary {
  games_tracked: number;
  unread_news: number;
  recent_updates: number;
  upcoming_releases: number;
  games_with_news: number;
  last_sync_at: string | null;
}

export interface SavedNewsEntry {
  collection_name: string;
  personal_note: string | null;
  saved_at: string | null;
  news: NewsItem | null;
}

export interface SavedEventEntry {
  personal_note: string | null;
  reminder: boolean;
  event: EventItem | null;
}

export interface SavedOut {
  news: SavedNewsEntry[];
  events: SavedEventEntry[];
  collections: { name: string; count: number }[];
}

export interface ExploreOut {
  popular: GameOut[];
  recent: GameOut[];
  upcoming: GameOut[];
  recommended: GameOut[];
  free: GameOut[];
  franchises: { name: string; count: number; cover_url: string | null }[];
  genres: string[];
  platforms: string[];
}
