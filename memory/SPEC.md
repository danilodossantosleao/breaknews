# NEXUS Gaming Hub — Especificação viva

## O que é
Central gamer pessoal (pt-BR). O usuário cadastra jogos e acompanha notícias, patches, DLCs,
lançamentos, eventos e descobertas relacionados a eles. Stack: FastAPI + MongoDB (motor) +
React 19/Vite/TS/Tailwind v4 (template farm-ts). Tema escuro padrão, sidebar desktop + nav mobile.

## Autenticação
- E-mail + senha (bcrypt via passlib), sessão em **cookie httpOnly JWT** (`nexus_session`, 30 dias).
- Rotas: `POST /api/auth/register|login|logout`, `GET /api/auth/me`, `PATCH /api/auth/profile`,
  `POST /api/auth/onboarding`.
- Todos os dados pessoais são filtrados por `user_id` no servidor; o cliente nunca manipula tokens.
- Conta demo semeada: **demo@nexus.gg / nexus123** (ver `memory/test_credentials.md`).

## Coleções (MongoDB, ids string uuid4)
| Coleção | Conteúdo |
|---|---|
| `users` | perfil, tema, locale, frequência de alertas, plataformas/gêneros favoritos, `onboarding_done` |
| `games` | catálogo público (43 títulos demo): slug, título, descrição, capas, datas + `release_date_status`, dev/pub, plataformas, gêneros, franquia, popularidade, `is_free`, `aliases` |
| `user_games` | biblioteca pessoal: status, plataforma, nota, notas privadas, datas, horas (manual), favorito, tags |
| `news` | notícias: fonte, URLs (canônica), título, resumo, imagem, categoria, `published_at`, `is_official`, `is_demo`, `content_hash` (dedupe), `game_id`, `ai_summary` |
| `user_news` | estado por usuário: lida, salva, coleção, nota privada |
| `game_updates` | patches/DLCs: versão, título, resumo, destaques, categoria, `published_at` |
| `user_updates` | leitura de patches por usuário |
| `events` | calendário: tipo, `starts_at`, fuso, `date_status` (confirmado/estimado/tba) |
| `user_events` | datas salvas, lembretes internos, notas |
| `notifications` | alertas internos gerados na sincronização |
| `notification_preferences` | por categoria: habilitado + frequência |
| `sync_logs` | histórico de sincronização (status, fontes ok/falha, itens, fallback demo) |

Índices declarados em `backend/lib/db.py` (`INDEXES`), aplicados no startup.

## Status pessoais
`quero_jogar`, `jogando`, `pausado`, `zerado`, `abandonado`, `completado_100`.

## Categorias de notícia
`noticias`, `atualizacao`, `dlc`, `lancamento`, `evento`, `trailer`, `analise`, `promocao`,
`manutencao`, `alerta`.

## Páginas / rotas
`/login`, `/register`, `/onboarding` (5 etapas, puláveis), `/` (dashboard), `/library`,
`/game/:gameId`, `/news`, `/updates`, `/calendar`, `/explore`, `/saved`, `/notifications`,
`/settings`, `*` (404). Paleta de comandos global com **Ctrl/Cmd+K**.

## Fluxos principais
1. **Login** → dashboard com indicadores reais (jogos, não lidas, patches 7 dias, lançamentos, salvas).
2. **Adicionar jogo**: busca com autocomplete (nome/franquia/dev/publicadora/plataforma/gênero) →
   `POST /api/library` com proteção contra duplicata (409) → toast + biblioteca persistida.
3. **Página do jogo**: miniportal com painel pessoal (status, plataforma, datas, horas manuais, nota 0–10,
   tags, notas privadas), abas de notícias/patches/DLCs/eventos/salvas e jogos semelhantes.
4. **News Center**: filtros (jogo, categoria, fonte, período, plataforma, lidas/salvas/oficiais), card/lista,
   paginação, marcar todas como lidas, resumo por IA.
5. **Calendário**: visão mensal + lista, filtros por tipo e jogos seguidos, salvar data e lembrete interno.

## Integrações
- **Notícias reais**: feeds RSS/Atom públicos (PlayStation Blog, Xbox Wire, RPS, PC Gamer, Polygon, IGN) em
  `backend/lib/ingest.py` — normalização, dedupe por `content_hash` (URL canônica + título), categorização por
  regra, match com o catálogo por tokens/aliases, backoff com 2 retentativas, timeout de 10s, limite por fonte,
  retenção configurável (`NEWS_RETENTION_DAYS`) e log em `sync_logs`.
- Sincronização automática no servidor: task `_sync_loop` em `server.py` (intervalo `SYNC_INTERVAL_MINUTES`,
  padrão 240 min) + `POST /api/sync` manual (rate limit 2/min).
- **Catálogo**: MODO DEMONSTRAÇÃO (43 jogos reais semeados, arte temática do Unsplash). Sem chave RAWG —
  rotulado na UI em Configurações e no seletor de jogos.
- **Resumos por IA**: `POST /api/news/{id}/ai-summary` via `emergentintegrations` (gpt-5.4) com
  `EMERGENT_LLM_KEY`; responde 501 quando a chave não existe e a UI degrada sem quebrar.

## Segurança
Senhas com bcrypt; sessão httpOnly; validação Pydantic v2; `safe_text`/`safe_url` sanitizam texto livre e
bloqueiam URLs não-http(s); rate limit em login/registro/sync/IA; nenhuma rota pessoal sem
`Depends(get_current_user)`; erros sem vazar segredos.

## Limitações declaradas
- Horas jogadas são **manuais** — não há sincronização com Steam/PSN/Xbox.
- Notificações são internas do site; push/e-mail não configurados.
- Sincronização é periódica (não tempo real) — a UI informa isso explicitamente.
- Datas estimadas/TBA são marcadas como tais; nunca apresentadas como oficiais.
