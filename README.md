# NBA Predictor

Análisis de partidos NBA con stats reales + Groq AI.  
Stack: React + Vite · Vercel serverless · balldontlie / stats.nba.com · Groq.

## Setup local

```bash
npm install
npm run dev
```

## Variables de entorno (Vercel)

| Variable | Descripción |
|----------|-------------|
| `GROQ_API_KEY` | Tu API key de Groq (obligatoria para analizar) |
| `BALLDONTLIE_API_KEY` | API key de [balldontlie.io](https://app.balldontlie.io) (recomendada) |

Sin `BALLDONTLIE_API_KEY` la app puede usar endpoints públicos limitados o fallar en algunos fetches.

## Deploy

1. Conecta este repo a Vercel.
2. Añade las env vars anteriores.
3. Deploy.

## Temporada

Temporada regular 2026-27 ≈ 20 octubre 2026.

## Estructura

- `api/` — serverless functions (today-games, analyze, game-result, h2h, standings, expert-picks, book-lines)
- `src/` — React UI (tabs: Predictor, Hoy, Historial, Track Record, Top Picks, Posiciones, H2H)
- `public/` — PWA icons + splash

## Mercados

ML · Spread · Total · Team totals · 1H (y más adelante player props)
