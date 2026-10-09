"""Seed idempotente do NEXUS — catálogo de demonstração, usuário demo, notícias, patches e eventos.

Executar: cd /app/backend && python seed.py
O catálogo usa dados reais de jogos populares (títulos, desenvolvedoras, datas) com arte
temática do Unsplash — MODO DEMONSTRAÇÃO até que uma chave RAWG seja configurada.
Notícias demo são rotuladas com `is_demo=True` e exibidas com selo "Demo" na interface.
"""

import asyncio
import uuid
from datetime import timedelta

from lib.db import db, ensure_indexes
from lib.dates import utc_now
from lib.security import hash_password

# ---- pool de arte temática (Unsplash, verificadas) ----
POOL = [
    "https://images.unsplash.com/photo-1519608487953-e999c86e7455",
    "https://images.unsplash.com/photo-1573767291321-c0af2eaf5266",
    "https://images.unsplash.com/photo-1557515126-1bf9ada5cb93",
    "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16",
    "https://images.unsplash.com/photo-1477346611705-65d1883cee1e",
    "https://images.unsplash.com/photo-1552072804-3ba9555a8a74",
    "https://images.unsplash.com/photo-1590142035743-0ffa020065e6",
    "https://images.unsplash.com/photo-1597407068889-782ba11fb621",
    "https://images.unsplash.com/photo-1677357623576-7c8aab08da22",
    "https://images.unsplash.com/photo-1502134249126-9f3755a50d78",
    "https://images.unsplash.com/photo-1462332420958-a05d1e002413",
    "https://images.unsplash.com/photo-1677926405168-fa86268b7295",
    "https://images.unsplash.com/photo-1626218174358-7769486c4b79",
    "https://images.unsplash.com/photo-1603481588273-2f908a9a7a1b",
    "https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2",
    "https://images.unsplash.com/photo-1593305841991-05c297ba4575",
    "https://images.unsplash.com/photo-1630695230041-8909e3204778",
    "https://images.unsplash.com/photo-1612703508477-00e02a9b170c",
    "https://images.unsplash.com/photo-1494376877685-d3d2559d4f82",
    "https://images.unsplash.com/photo-1641667838410-b257ca266e38",
    "https://images.unsplash.com/photo-1762921006421-8b6ae0c17e44",
    "https://images.unsplash.com/photo-1787350371693-9e3230700c6f",
    "https://images.unsplash.com/photo-1788631910831-2e15ddf426f3",
    "https://images.unsplash.com/photo-1784654682177-e312b0ed52fa",
    "https://images.unsplash.com/photo-1672872476232-da16b45c9001",
    "https://images.unsplash.com/photo-1785708361382-107601e165fa",
    "https://images.unsplash.com/photo-1759692788195-b95da1f4a04c",
    "https://images.unsplash.com/photo-1763198216883-7473e2c7eabb",
    "https://images.unsplash.com/photo-1762268861745-c3e879d1c2b8",
    "https://images.unsplash.com/photo-1761743979227-16da705af328",
    "https://images.unsplash.com/photo-1607896426171-99097eb60cb6",
]


def img(idx: int, w: int) -> str:
    return f"{POOL[idx % len(POOL)]}?auto=format&fit=crop&w={w}&q=80"


# slug, título, dev, pub, release, status_data, plataformas, gêneros, franquia, popularidade, grátis, descrição
GAMES = [
    ("cyberpunk-2077", "Cyberpunk 2077", "CD PROJEKT RED", "CD PROJEKT", "2020-12-10", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["RPG", "Ação", "Sci-Fi", "Mundo Aberto"], "Cyberpunk", 98, False, "RPG de ação em mundo aberto na megalópole de Night City, onde você joga como mercenário cibernético V em busca de um implante imortal."),
    ("elden-ring", "Elden Ring", "FromSoftware", "Bandai Namco", "2022-02-25", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["RPG", "Ação", "Soulslike", "Mundo Aberto"], "Elden Ring", 99, False, "Um RPG de ação colossal nas Terras Intermédias, com world-building de Hidetaka Miyazaki e mitologia de George R. R. Martin."),
    ("gta-6", "Grand Theft Auto VI", "Rockstar Games", "Rockstar Games", "2026-11-19", "confirmado", ["PS5", "Xbox Series X|S"], ["Ação", "Mundo Aberto", "Aventura"], "Grand Theft Auto", 100, False, "O aguardado retorno a Vice City — o capítulo mais ambicioso da série GTA, com dupla protagonista e o mundo aberto mais vivo da Rockstar."),
    ("hades-2", "Hades II", "Supergiant Games", "Supergiant Games", "2025-09-25", "confirmado", ["PC", "PS5", "Xbox Series X|S", "Switch 2"], ["Roguelike", "Ação", "Indie"], "Hades", 95, False, "A filha de Hades encara o Titã do Tempo em um roguelike de ação mitológico, com magia, romance e trilha sonora impecável."),
    ("black-myth-wukong", "Black Myth: Wukong", "Game Science", "Game Science", "2024-08-20", "confirmado", ["PC", "PS5", "Xbox Series X|S"], ["Ação", "RPG", "Soulslike"], "Black Myth", 94, False, "Action RPG baseado em Jornada ao Oeste, com o Rei Maci Sun Wukong enfrentando lendas da mitologia chinesa em combates espetaculares."),
    ("zelda-totk", "The Legend of Zelda: Tears of the Kingdom", "Nintendo EPD", "Nintendo", "2023-05-12", "confirmado", ["Switch", "Switch 2"], ["Aventura", "Ação", "Mundo Aberto"], "The Legend of Zelda", 97, False, "Link explora o céu e as profundezas de Hyrule com a habilidade Ultramão, resolvendo quebra-cabeças com física criativa."),
    ("god-of-war-ragnarok", "God of War Ragnarök", "Santa Monica Studio", "Sony Interactive", "2022-11-09", "confirmado", ["PS5", "PS4", "PC"], ["Ação", "Aventura", "RPG"], "God of War", 96, False, "Kratos e Atreus enfrentam o fim dos tempos nórdico, com Fimbulwinter à porta e profecias ameaçando o futuro da família."),
    ("baldurs-gate-3", "Baldur's Gate 3", "Larian Studios", "Larian Studios", "2023-08-03", "confirmado", ["PC", "PS5", "Xbox Series X|S"], ["RPG", "Estratégia", "Fantasia"], "Baldur's Gate", 98, False, "O RPG baseado em Dungeons & Dragons que redefiniu o gênero: escolhas que importam, companheiros memoráveis e reatividade máxima."),
    ("rdr2", "Red Dead Redemption 2", "Rockstar Games", "Rockstar Games", "2018-10-26", "confirmado", ["PS5", "PS4", "Xbox Series X|S", "PC"], ["Ação", "Aventura", "Mundo Aberto"], "Red Dead", 97, False, "A épica história de Arthur Morgan e a gangue Van der Linde no crepúsculo do Velho Oeste americano."),
    ("witcher-3", "The Witcher 3: Wild Hunt", "CD PROJEKT RED", "CD PROJEKT", "2015-05-19", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch"], ["RPG", "Aventura", "Fantasia", "Mundo Aberto"], "The Witcher", 98, False, "Geralt de Rivia caça a Criança da Surpresa em um dos RPGs mais premiados de todos os tempos."),
    ("silksong", "Hollow Knight: Silksong", "Team Cherry", "Team Cherry", "2025-09-04", "confirmado", ["PC", "PS5", "Xbox Series X|S", "Switch", "Switch 2"], ["Metroidvania", "Plataforma", "Indie"], "Hollow Knight", 92, False, "Hornet protagoniza a aguardada sequência de Hollow Knight, com acrobacias afiadas e um reino de seda para explorar."),
    ("stardew-valley", "Stardew Valley", "ConcernedApe", "ConcernedApe", "2016-02-26", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch", "Mobile"], ["Simulação", "Indie", "RPG"], None, 90, False, "A fazenda, as minas e a vila de Pelican Town: a simulação de vida mais acolhedora já feita por uma única pessoa."),
    ("cs2", "Counter-Strike 2", "Valve", "Valve", "2023-09-27", "confirmado", ["PC"], ["FPS", "Competitivo", "Esportes"], "Counter-Strike", 93, True, "A evolução técnica do FPS competitivo mais jogado do mundo, com smoke volumétrico e sub-tick."),
    ("valorant", "VALORANT", "Riot Games", "Riot Games", "2020-06-02", "confirmado", ["PC", "PS5", "Xbox Series X|S"], ["FPS", "Competitivo", "Tático"], "VALORANT", 92, True, "FPS tático 5v5 de agentes com habilidades, onde precisão e estratégia decidem partidas."),
    ("league-of-legends", "League of Legends", "Riot Games", "Riot Games", "2009-10-27", "confirmado", ["PC"], ["MOBA", "Competitivo", "Estratégia"], "League of Legends", 91, True, "O MOBA mais influente do planeta, com mais de 160 campeões e o maior ecossistema de esports."),
    ("fortnite", "Fortnite", "Epic Games", "Epic Games", "2017-07-25", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch", "Mobile"], ["Battle Royale", "Ação", "Gratuito"], "Fortnite", 94, True, "O battle royale que virou plataforma cultural: modos criativos, colaborações e temporadas em constante mudança."),
    ("minecraft", "Minecraft", "Mojang Studios", "Microsoft", "2011-11-18", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch", "Mobile"], ["Sandbox", "Sobrevivência", "Aventura"], "Minecraft", 96, False, "Construa tudo o que imaginar no jogo mais vendido da história, agora com atualizações vivas anuais."),
    ("ea-fc-25", "EA Sports FC 25", "EA Vancouver", "EA Sports", "2024-09-27", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch"], ["Esportes", "Simulação"], "EA FC", 85, False, "O futebol virtual do modo Carreira ao Ultimate Team, com a tecnologia Frostbite e Rush 5v5."),
    ("monster-hunter-wilds", "Monster Hunter Wilds", "Capcom", "Capcom", "2025-02-28", "confirmado", ["PC", "PS5", "Xbox Series X|S"], ["Ação", "RPG", "Coop"], "Monster Hunter", 90, False, "Caçadas em manada em ecossistemas vivos que mudam com o clima — a nova geração de Monster Hunter."),
    ("ff7-rebirth", "Final Fantasy VII Rebirth", "Square Enix", "Square Enix", "2024-02-29", "confirmado", ["PS5", "PC"], ["RPG", "Aventura", "Fantasia"], "Final Fantasy", 89, False, "Cloud e companhia deixam Midgar e exploram um vasto mundo aberto na segunda parte do remake de FFVII."),
    ("helldivers-2", "Helldivers 2", "Arrowhead Game Studios", "Sony Interactive", "2024-02-08", "confirmado", ["PC", "PS5"], ["Ação", "Coop", "Sci-Fi"], "Helldivers", 88, False, "Coop de tiro democrático contra bugs e autômatos — liberdade gerenciada em sua melhor forma."),
    ("palworld", "Palworld", "Pocketpair", "Pocketpair", "2024-01-19", "estimado", ["PC", "PS5", "Xbox Series X|S"], ["Sobrevivência", "Aventura", "Coop"], "Palworld", 84, False, "Coleção de criaturas com armas em um survival cooperativo — polêmico, viciante e em constante atualização."),
    ("diablo-4", "Diablo IV", "Blizzard Entertainment", "Blizzard", "2023-06-06", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["RPG", "Ação", "Hack and Slash"], "Diablo", 87, False, "Sanctuário jamais esteja tão sombrio: seasons, endgame de loot e o retorno de Lilith."),
    ("sf6", "Street Fighter 6", "Capcom", "Capcom", "2023-06-02", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["Luta", "Competitivo", "Esportes"], "Street Fighter", 86, False, "O novo padrão dos jogos de luta: World Tour, Battle Hub e sistema de drive dinâmico."),
    ("re4-remake", "Resident Evil 4 (Remake)", "Capcom", "Capcom", "2023-03-24", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["Terror", "Ação", "Aventura"], "Resident Evil", 90, False, "O remake definitivo do clássico de survival horror, com Leon em resgate impossível na Espanha rural."),
    ("starfield", "Starfield", "Bethesda Game Studios", "Bethesda Softworks", "2023-09-06", "confirmado", ["PC", "Xbox Series X|S"], ["RPG", "Sci-Fi", "Exploração"], "Starfield", 80, False, "O RPG espacial da Bethesda: mil planetas, frotas personalizadas e facções à caça de artefatos."),
    ("doom-eternal", "DOOM Eternal", "id Software", "Bethesda Softworks", "2020-03-20", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch"], ["FPS", "Ação"], "DOOM", 87, False, "O Slayer em sua forma mais brutal — combate em rajadas, metal pesado e demônios sem chance."),
    ("doom-dark-ages", "DOOM: The Dark Ages", "id Software", "Bethesda Softworks", "2025-05-15", "confirmado", ["PC", "PS5", "Xbox Series X|S"], ["FPS", "Ação"], "DOOM", 88, False, "A prequela medieval do Slayer, com escudo-motosserra e um dragão para montar."),
    ("death-stranding-2", "Death Stranding 2: On the Beach", "Kojima Productions", "Sony Interactive", "2025-06-26", "confirmado", ["PS5"], ["Aventura", "Sci-Fi", "Mundo Aberto"], "Death Stranding", 85, False, "Sam volta às estradas quebradas do México e da Austrália na sequência singular de Hideo Kojima."),
    ("ghost-tsushima", "Ghost of Tsushima", "Sucker Punch", "Sony Interactive", "2020-07-17", "confirmado", ["PS5", "PS4", "PC"], ["Ação", "Aventura", "Mundo Aberto"], "Ghost", 89, False, "Jin Sakai vira o Fantasma para libertar Tsushima da invasão mongol — ventos que guiam e duelos de katana."),
    ("ghost-yotei", "Ghost of Yōtei", "Sucker Punch", "Sony Interactive", "2025-10-02", "confirmado", ["PS5"], ["Ação", "Aventura", "Mundo Aberto"], "Ghost", 87, False, "Atsu caça os Seis em Hokkaido de 1603, na próxima saga samurai da Sucker Punch."),
    ("metaphor-refantazio", "Metaphor: ReFantazio", "Atlus", "Atlus", "2024-10-11", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["RPG", "Fantasia", "Turnos"], "Metaphor", 86, False, "Dos criadores de Persona, um JRPG de fantasia sobre eleições reais, ansiedade e coragem."),
    ("persona-5-royal", "Persona 5 Royal", "Atlus", "Atlus", "2019-10-31", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch"], ["RPG", "Turnos", "Simulação"], "Persona", 90, False, "Os Corações Ladrões roubam corações distorcidos no JRPG mais estiloso da geração."),
    ("sekiro", "Sekiro: Shadows Die Twice", "FromSoftware", "Activision", "2019-03-22", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["Ação", "Soulslike", "Aventura"], "Sekiro", 89, False, "Postura, precisão e ressureição: o shinobi de FromSoftware em um Japão mítico."),
    ("bloodborne", "Bloodborne", "FromSoftware", "Sony Interactive", "2015-03-24", "confirmado", ["PS5", "PS4"], ["RPG", "Terror", "Soulslike"], "Bloodborne", 88, False, "Yharnam espera caçadores com agressividade e sangue — o gótico Lovecraftiano que definiu uma geração."),
    ("dark-souls-3", "Dark Souls III", "FromSoftware", "Bandai Namco", "2016-03-24", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["RPG", "Ação", "Soulslike"], "Dark Souls", 87, False, "O crepúsculo da Era do Fogo: Lord of Cinder em batalhas inesquecíveis."),
    ("apex-legends", "Apex Legends", "Respawn Entertainment", "EA", "2019-02-04", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch", "Mobile"], ["Battle Royale", "FPS", "Competitivo"], "Apex Legends", 85, True, "O battle royale de esquipes com movimento fluido e lendas marcantes."),
    ("overwatch-2", "Overwatch 2", "Blizzard Entertainment", "Blizzard", "2022-10-04", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch"], ["FPS", "Heroico", "Competitivo"], "Overwatch", 82, True, "O shooter de heróis com o elenco mais carismático dos esports."),
    ("rocket-league", "Rocket League", "Psyonix", "Epic Games", "2015-07-07", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch"], ["Esportes", "Ação", "Competitivo"], "Rocket League", 84, True, "Futebol com carros movidos a foguete — física arcade perfeita."),
    ("terraria", "Terraria", "Re-Logic", "Re-Logic", "2011-05-16", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch", "Mobile"], ["Sandbox", "Aventura", "Sobrevivência"], "Terraria", 86, False, "Cave, construa e enfrente chefes no sandbox 2D com infinitas possibilidades."),
    ("portal-2", "Portal 2", "Valve", "Valve", "2011-04-19", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S", "Switch"], ["Puzzle", "Aventura", "Sci-Fi"], "Portal", 91, False, "Quebra-cabeças com portais, humor britânico e uma das melhores campanhas co-op já criadas."),
    ("half-life-alyx", "Half-Life: Alyx", "Valve", "Valve", "2020-03-23", "confirmado", ["PC"], ["FPS", "Aventura", "Sci-Fi", "VR"], "Half-Life", 83, False, "O retorno de Half-Life em realidade virtual: City 17 como você nunca viu."),
    ("elden-ring-nightreign", "Elden Ring: Nightreign", "FromSoftware", "Bandai Namco", "2025-05-30", "confirmado", ["PC", "PS5", "PS4", "Xbox Series X|S"], ["Ação", "Coop", "Roguelike"], "Elden Ring", 84, False, "Coop de sobrevivência nas Terras Intermédias: três guerreiros, três noites, um Senhor da Noite."),
]

# (game_slug, versão, título, resumo, destaques, categoria, horas_atrás)
UPDATES = [
    ("cyberpunk-2077", "2.31", "Patch 2.31 — Estabilidade e desempenho", "Correções de travamentos em Night City e melhorias gerais de desempenho em todas as plataformas.", ["Corrigido crash ao concluir certas missões secundárias", "Melhorias de streaming de texturas no PS5", "Ajustes no comportamento da IA da polícia"], "patch", 30),
    ("elden-ring", "1.16", "Regulagem 1.16 — Balanceamento de PVP", "Ajustes de balanceamento de armas e correções nos duelos em Coliseus.", ["Rearmoramento da Moça-Donzela ajustado", "Corrigido bug da magia Estrela Relâmpago", "Estabilidade de conexão no PVP"], "patch", 74),
    ("gta-6", "Trailer 2", "Segundo trailer oficial revela novas áreas de Leonida", "A Rockstar publicou o segundo trailer com prévia das cidades, animais e sistemas de física do jogo.", ["Nova região costeira mostrada", "Confirmação de dupla protagonista", "Data de lançamento reafirmada"], "trailer", 8),
    ("hades-2", "1.0", "Lançamento da versão 1.0 — A saga completa", "A versão completa de Hades II estreou com o final da história de Melinoë, novos chefes e o verdadeiro fim do caminho do Olimpo.", ["Final alternativo desbloqueável", "Novo aspecto de arma: Foice de Thanatos", "Modo Hell para veteranos"], "dlc", 300),
    ("black-myth-wukong", "1.0.12", "Patch 1.0.12 — Otimização gráfica", "Melhorias de otimização e correções em batalhas de chefes específicas.", ["FSR 3.1 com Frame Generation", "Corrigido bug no chefe Tibia do Vento", "Suporte a mais periféricos no PC"], "patch", 200),
    ("helldivers-2", "01.002.3", "Update 01.002.3 — Equilíbrio de armas", "Rebalancing amplo após feedback da comunidade sobre metagame de escopos.", ["Escopos táticos revisados", "Chama do P-2 Player corrigida", "Novos termos de estratagema em orbite"], "patch", 12),
    ("diablo-4", "2.4.0", "Season 12 — Cofres do Abismo", "Nova temporada traz o sistema de Cofres do Abismo, recompensas de árvores de sonhos e ajustes de classes.", ["Nova mecânica de abismo", "Necromancer rebalanceado", "Battle pass com cosméticos de vampiro"], "patch", 52),
    ("monster-hunter-wilds", "3.0", "Update 3.0 — Novo monstro e coop expandido", "A Capcom adiciona um monstro Ancião inédito e expande as opções de lobby coop.", ["Ancião Apex inédito", "Sala de espera de até 16 caçadores", "Trajes de temporada"], "patch", 26),
    ("silksong", "1.0.4", "Patch 1.0.4 — Ajuste de dificuldade", "Ajustes pontuais de dificuldade relatados pela comunidade em zonas específicas.", ["Duelo do Trovão rebalanceado", "Bancos extras em Far Fields", "Correção de colisões"], "patch", 90),
    ("fortnite", "42.00", "Capítulo 7 Temporada 1 — Nova ilha", "Nova temporada com mapa revisado, colaborações e mudanças no loot pool.", ["Novo POI central", "Colaboração de anime confirmada", "Pistol meta revisada"], "patch", 5),
    ("doom-dark-ages", "1.1", "Patch 1.1 — Modo de acessibilidade e ajustes", "Melhorias de acessibilidade, ajustes de mira e correções de progressão.", ["Cores para daltonismo no escudo", "Escudo-motosserra rebalanceado", "Save quântico mais frequente"], "patch", 130),
    ("witcher-3", "4.05", "Update 4.05 — Cross-platform de saves", "Saves agora sincronizam entre plataformas e correções da versão next-gen.", ["Cross-save via conta", "Correção no modo fotográfico", "Melhorias no ray tracing"], "patch", 400),
    ("gta-6", "DLC-1", "Expansão 'Vice Nights' apontada por insiders", "Rumores apontam uma expansão focada na vida noturna de Vice City; a Rockstar não confirmou — trate como estimativa.", ["Sem confirmação oficial", "Mundo noturno expandido", "Veículos novos possíveis"], "dlc", 60),
]

# (título, desc, tipo, em N dias, status, game_slug ou None, source_url)
EVENTS_TEMPLATE = [
    ("Lançamento de Grand Theft Auto VI", "Chegada mundial de GTA VI às lojas físicas e digitais.", "lancamento", 260, "confirmado", "gta-6"),
    ("State of Play da Sony", "Apresentação com novidades de estúdios parceiros e lançamentos de PS5.", "showcase", 9, "confirmado", None),
    ("Nintendo Direct — Duplo especial", "Direct dedicado a jogos de Switch e Switch 2 para a reta final do ano.", "showcase", 16, "confirmado", None),
    ("Temporada 3 de Helldivers 2", "Nova temporada com guerra majoritária contra os Autômatos e recompensas inéditas.", "evento", 21, "estimado", "helldivers-2"),
    ("Gamescom 2026 — Abertura", "Maior feira de games do mundo transmite a cerimônia de abertura com trailers exclusivos.", "evento", 190, "confirmado", None),
    ("Beta aberto de novo modo de VALORANT", "Teste público do novo modo competitivo rotativo nos servidores da Riot.", "beta", 13, "estimado", "valorant"),
    ("DLC 'Olimpo Adormecido' de Hades II", "Janela estimada para a nova expansão anunciada pela Supergiant.", "dlc", 45, "estimado", "hades-2"),
    ("Torneio Capcom Cup de Street Fighter 6", "Final mundial do circuito competitivo de SF6.", "evento", 120, "confirmado", "sf6"),
    ("Lançamento de jogo não anunciado (TBA)", "Espaço reservado do calendário para anúncios futuros de 2027.", "lancamento", 300, "tba", None),
    ("The Game Awards 2026", "Cerimônia anual com premiações e revelações mundiais.", "showcase", 95, "confirmado", None),
]

# Notícias demo: (slug, título, resumo, categoria, horas_atrás)
NEWS_DEMO = [
    ("cyberpunk-2077", "CD PROJEKT RED detalha o futuro de Cyberpunk 2077 em carta aos jogadores", "O estúdio confirmou suporte contínuo à versão 2.x e teasers do ecossistema de sequências em desenvolvimento em Boston.", "noticias", 5),
    ("cyberpunk-2077", "Nova DLC gratuita adiciona veículos e apartamentos decoráveis em Night City", "Atualização bônus traz missões de corrida de rua e novas opções de decoração para o megabuilding de V.", "dlc", 29),
    ("cyberpunk-2077", "Análise: por que Cyberpunk 2077 virou o padrão de resgate de RPGs", "Retrospectiva sobre a transformação do jogo desde o lançamento e o que ensinou para a indústria.", "analise", 96),
    ("elden-ring", "FromSoftware sinaliza novos conteúdo para Elden Ring em atualização de fundações", "Patch de fundações promete ajustes de balanceamento e reforços no PVP antes do fim do semestre.", "atualizacao", 11),
    ("elden-ring", "Torneio comunitário de Elden Ring reúne melhores jogadores de duelo", "Transmissão com duelos ao vivo e arena de Coliseu lotada marca a final da temporada.", "evento", 72),
    ("elden-ring", "Guia: builds de fé em Shadow of the Erdtree que ainda dominam o endgame", "Seleção de builds sacramentais para manter a chama acesa na Sombra da Árvore.", "noticias", 130),
    ("gta-6", "GTA VI: novos detalhes de Leonida surgem em material promocional", "Materiais oficiais revelam biomas e atividades secundárias previstas no estado de Leonida.", "noticias", 7),
    ("gta-6", "Rockstar reforça data de novembro para GTA VI em comunicado", "Editora reafirma janela de lançamento e antecipa janela de pré-venda nas lojas digitais.", "lancamento", 20),
    ("gta-6", "GTA VI: o que esperar da trilha sonora com rádios recriadas", "Especulação baseada em anúncios oficiais de parcerias musicais para as rádios do jogo.", "noticias", 140),
    ("hades-2", "Supergiant anuncia expansão pós-1.0 de Hades II", "A expansão promete novos choques de destino e um região inédita abaixo do Caos.", "dlc", 15),
    ("hades-2", "Patch de Hades II equilibra aspectos de armas do Olimpo", "Ajustes de dano e tempo de recarga nas armas consagradas pela comunidade.", "atualizacao", 49),
    ("hades-2", "Trailer final de Hades II revela o destino de Melinoë", "Cinemática de encerramento mostra momentos da jornada completa da versão 1.0.", "trailer", 120),
    ("black-myth-wukong", "Game Science confirma DLC de Black Myth: Wukong para o próximo ano", "A expansão deve aprofundar a mitologia de Jornada ao Oeste com novas áreas e chefes.", "dlc", 22),
    ("black-myth-wukong", "Black Myth: Wukong chega a novas plataformas com suporte apropriado", "Porte planejado amplia o alcance do action RPG com otimizações específicas.", "lancamento", 80),
    ("black-myth-wukong", "Black Myth: Wukong bate novo marco de vendas acumuladas", "Números divulgados consolidam o título entre as maiores estreias de RPG de ação.", "noticias", 150),
    ("helldivers-2", "Helldivers 2 recebe warbond temático de ciências ocultas", "Novo warbond traz armaduras, armas e capas com estética arcanóide para a guerra galáctica.", "atualizacao", 9),
    ("helldivers-2", "Arrowhead corrige crise de servidores após mega-ataque", "Manutenção emergencial resolve instabilidade durante a ofensiva global da comunidade.", "manutencao", 36),
    ("helldivers-2", "Helldivers 2 estará em promoção relâmpago no fim de semana", "Desconto limitado acompanha o evento de mobilização da comunidade.", "promocao", 60),
    ("monster-hunter-wilds", "Monster Hunter Wilds recebe colaboração inédita de evento", "Missões temáticas recompensam caçadores com equipamentos exclusivos por tempo limitado.", "evento", 18),
    ("monster-hunter-wilds", "Patch de Monster Hunter Wilds corrige troca de armas no foco", "Ajuste resolve atraso de input crítico no combate com Seikret.", "atualizacao", 66),
    ("monster-hunter-wilds", "Alerta: exploits de safra de itens serão punidos em Wilds", "Capcom avisa sobre sanções para uso de duplicação de itens raros.", "alerta", 110),
    ("zelda-totk", "Nintendo publica trilha oficial de Tears of the Kingdom em streaming", "Trilha completa de Hyrule chega aos serviços de música com faixas remasterizadas.", "noticias", 40),
    ("baldurs-gate-3", "Larian publica patch final de conteúdo para Baldur's Gate 3", "O patch 8 formaliza o encerramento do ciclo de conteúdo com epílogos expandidos.", "atualizacao", 27),
    ("baldurs-gate-3", "Ferramenta oficial de mods de BG3 cruza a marca de 10 mil criações", "Marco mostra a força da comunidade de modding do RPG da Larian.", "noticias", 88),
    ("cs2", "CS2 recebe atualização de mapa Train e ajustes econômicos", "Revisão de rotas e economia do lado T busca equilibrar o mapa competitivo.", "atualizacao", 13),
    ("valorant", "Riot anuncia novo agente de VANGUARDA para VALORANT", "Teaser oficial mostra habilidades de controle de área para o próximo ato.", "trailer", 31),
    ("fortnite", "Fortnite confirma colaboração de anime para a próxima temporada", "Skins e itens cosméticos chegam ao passe de batalha em parceria oficial.", "noticias", 3),
    ("diablo-4", "Diablo IV ajusta drop de itens lendários na próxima temporada", "Mudanças na tabela de loot prometem endgame mais recompensador.", "atualizacao", 44),
    ("doom-dark-ages", "DOOM: The Dark Ages ganha modo horda cooperativo", "Atualização gratuita adiciona arena de ondas para três jogadores.", "dlc", 55),
    ("death-stranding-2", "Death Stranding 2 recebe atualização com modo foto expandido", "Novas ferramentas de fotografia e filtros chegam junto com missões de recontratação.", "atualizacao", 70),
    ("silksong", "Team Cherry comemora marco de vendas de Silksong em mensagem", "Estúdio agradece a recepção e sinaliza suporte com patches de qualidade de vida.", "noticias", 25),
    ("witcher-3", "Mod de The Witcher 3 recria missões cortadas do lançamento", "Restauração apoiada em dados do jogo original retorna conteúdo inédito.", "noticias", 58),
    ("league-of-legends", "Riot detalha mudanças de pré-temporada em League of Legends", "Atualizações de mapa e objetivos visam dinamizar o early game competitivo.", "atualizacao", 90),
    ("minecraft", "Minecraft anuncia drop de atualização com nova biome", "Conteúdo vivo traz criaturas, blocos e um evento limitado de construção.", "lancamento", 34),
    ("apex-legends", "Apex Legends revisa legendas de movimento na nova temporada", "Ajustes de slide e escalada buscam suavizar o gunplay defensivo.", "atualizacao", 48),
    ("stardew-valley", "Atualização 1.7 de Stardew Valley entra em testes públicos", "ConcernedApe libera beta com conteúdo inédito de fim de semana na fazenda.", "noticias", 63),
]

DEMO_EMAIL = "demo@nexus.gg"
DEMO_PASSWORD = "nexus123"


async def seed() -> None:
    now = utc_now()
    print("→ catálogo de jogos…")
    for idx, g in enumerate(GAMES):
        (slug, title, dev, pub, release, rel_status, platforms, genres, franchise, pop, free, desc) = g
        doc = {
            "external_id": slug,
            "source": "demo-catalog",
            "slug": slug,
            "title": title,
            "description": desc,
            "cover_url": img(idx, 600),
            "background_url": img(idx, 1600),
            "release_date": release,
            "release_date_status": rel_status,
            "developer": dev,
            "publisher": pub,
            "platforms": platforms,
            "genres": genres,
            "franchise": franchise,
            "official_url": None,
            "trailer_url": None,
            "popularity": float(pop),
            "is_free": free,
            "aliases": [],
            "updated_at": now,
            "created_at": now,
        }
        await db.games.update_one({"slug": slug}, {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4())}}, upsert=True)
        if slug == "gta-6":
            doc["aliases"] = ["GTA 6", "GTA VI", "Grand Theft Auto 6"]
        if slug == "cs2":
            doc["aliases"] = ["Counter-Strike", "CS:GO", "Counter Strike 2"]
        if slug == "zelda-totk":
            doc["aliases"] = ["Zelda", "Tears of the Kingdom"]
        if slug == "ea-fc-25":
            doc["aliases"] = ["FIFA", "EA FC", "EA Sports FC"]
        if slug == "rdr2":
            doc["aliases"] = ["Red Dead Redemption", "RDR 2"]
        if slug == "silksong":
            doc["aliases"] = ["Hollow Knight Silksong"]
        if slug == "valorant":
            doc["aliases"] = ["VALORANT"]
        if slug == "league-of-legends":
            doc["aliases"] = ["LoL", "League"]

    print("→ usuário demo…")
    demo = await db.users.find_one({"email": DEMO_EMAIL})
    if not demo:
        demo = {
            "id": str(uuid.uuid4()),
            "email": DEMO_EMAIL,
            "password_hash": hash_password(DEMO_PASSWORD),
            "display_name": "Player Demo",
            "avatar_url": None,
            "theme": "dark",
            "locale": "pt-BR",
            "notification_frequency": "diario",
            "favorite_platforms": ["PC", "PS5"],
            "favorite_genres": ["RPG", "Ação", "Soulslike"],
            "onboarding_done": True,
            "created_at": now,
        }
        await db.users.insert_one(demo)
    user_id = demo["id"]

    print("→ biblioteca do usuário demo…")
    lib = [
        ("cyberpunk-2077", "jogando", "PC", 9.5, True, ["night city", "build de espadas"], "11d", 47.5),
        ("elden-ring", "completado_100", "PS5", 10.0, True, ["platina"], None, 142.0),
        ("gta-6", "quero_jogar", "PS5", None, False, ["dia um"], None, None),
        ("hades-2", "jogando", "PC", 9.3, True, ["roguelike", "mitologia"], "5d", 22.0),
        ("black-myth-wukong", "zerado", "PC", 9.0, False, ["chefe difícil"], None, 58.0),
        ("baldurs-gate-3", "pausado", "PC", 8.5, False, ["co-op"], "30d", 64.0),
    ]
    started_base = now - timedelta(days=90)
    for slug, status, platform, rating, fav, tags, started_days, hours in lib:
        game = await db.games.find_one({"slug": slug})
        if not game:
            continue
        existing = await db.user_games.find_one({"user_id": user_id, "game_id": game["id"]})
        if existing:
            continue
        await db.user_games.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "game_id": game["id"],
            "status": status,
            "platform": platform,
            "personal_rating": rating,
            "personal_notes": "Notas privadas do jogador demo — visíveis só para mim." if slug == "cyberpunk-2077" else None,
            "started_at": (now - timedelta(days=int(started_days[:-1]))).strftime("%Y-%m-%d") if started_days else None,
            "completed_at": "2025-12-14" if status == "completado_100" else None,
            "hours_played": hours,
            "is_favorite": fav,
            "tags": tags,
            "created_at": now - timedelta(days=20),
            "updated_at": now - timedelta(days=2),
        })

    print("→ notícias de demonstração…")
    for i, (slug, title, summary, category, hours_ago) in enumerate(NEWS_DEMO):
        game = await db.games.find_one({"slug": slug})
        published = now - timedelta(hours=hours_ago)
        c_hash = f"demo-{slug}-{hours_ago}-{i}"
        doc = {
            "id": str(uuid.uuid4()),
            "external_id": None,
            "source_name": "NEXUS Demo",
            "source_url": "",
            "canonical_url": "",
            "title": title,
            "summary": summary,
            "image_url": img(i, 1200),
            "category": category,
            "published_at": published,
            "is_official": i % 5 == 0,
            "is_demo": True,
            "content_hash": c_hash,
            "game_id": game["id"] if game else None,
            "game_title": game["title"] if game else None,
            "ai_summary": None,
            "created_at": now,
        }
        doc_id = doc.pop("id")
        await db.news.update_one({"content_hash": c_hash}, {"$set": doc, "$setOnInsert": {"id": doc_id}}, upsert=True)

    print("→ atualizações e patches…")
    for slug, version, title, summary, highlights, category, hours_ago in UPDATES:
        game = await db.games.find_one({"slug": slug})
        if not game:
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "game_id": game["id"],
            "version": version,
            "title": title,
            "summary": summary,
            "highlights": highlights,
            "patch_notes_url": None,
            "category": category,
            "published_at": now - timedelta(hours=hours_ago),
            "source_name": "NEXUS Demo",
            "created_at": now,
        }
        doc_id = doc.pop("id")
        await db.game_updates.update_one({"game_id": game["id"], "version": version}, {"$set": doc, "$setOnInsert": {"id": doc_id}}, upsert=True)

    print("→ eventos e calendário…")
    for title, desc, etype, in_days, status, slug in EVENTS_TEMPLATE:
        game = await db.games.find_one({"slug": slug}) if slug else None
        doc = {
            "id": str(uuid.uuid4()),
            "game_id": game["id"] if game else None,
            "title": title,
            "description": desc,
            "event_type": etype,
            "starts_at": (now + timedelta(days=in_days)).replace(hour=18, minute=0, second=0, microsecond=0),
            "ends_at": None,
            "timezone_label": "America/Sao_Paulo",
            "date_status": status,
            "source_url": None,
            "created_at": now,
        }
        doc_id = doc.pop("id")
        await db.events.update_one({"title": title}, {"$set": doc, "$setOnInsert": {"id": doc_id}}, upsert=True)

    print("→ estado do usuário demo (lidas/salvas)…")
    tracked = [d["game_id"] for d in await db.user_games.find({"user_id": user_id}, {"game_id": 1}).to_list(100)]
    news_docs = await db.news.find({"game_id": {"$in": tracked}}).sort("published_at", -1).to_list(400)
    for j, nd in enumerate(news_docs):
        is_read = j >= 6
        is_saved = j in (8, 12)
        if is_read or is_saved:
            await db.user_news.update_one(
                {"user_id": user_id, "news_id": nd["id"]},
                {"$set": {"is_read": is_read, "read_at": now if is_read else None,
                          "is_saved": is_saved, "saved_at": now if is_saved else None,
                          "collection_name": "Ler depois" if is_saved else "Geral",
                          "personal_note": "Retomar o patch depois do trabalho." if j == 8 else None,
                          "created_at": now, "updated_at": now}},
                upsert=True,
            )

    print("→ notificações internas do usuário demo…")
    for j, nd in enumerate(news_docs[:6]):
        await db.notifications.update_one(
            {"user_id": user_id, "news_id": nd["id"]},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": f"Novidade: {nd['title'][:120]}",
                "body": nd.get("summary", "")[:180],
                "category": nd.get("category", "noticias"),
                "game_id": nd.get("game_id"),
                "news_id": nd["id"],
                "is_read": j >= 3,
                "created_at": nd.get("published_at") or now,
            }},
            upsert=True,
        )

    print("→ preferências de notificação do usuário demo…")
    from models.news import NEWS_CATEGORIES
    for cat in NEWS_CATEGORIES:
        freq = "imediato" if cat in ("alerta", "atualizacao") else "diario"
        await db.notification_preferences.update_one(
            {"user_id": user_id, "category": cat},
            {"$setOnInsert": {"id": str(uuid.uuid4()), "user_id": user_id, "game_id": None,
                              "category": cat, "frequency": freq, "enabled": True,
                              "created_at": now, "updated_at": now}},
            upsert=True,
        )

    await ensure_indexes()
    print("✓ seed concluído — conta demo: demo@nexus.gg / nexus123")


if __name__ == "__main__":
    asyncio.run(seed())
