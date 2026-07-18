# 🌿 Grădina Mea

Aplicația de **îngrijire a grădinii pentru proprietari (homeowners / PF)**.

Este ediția homeowner desprinsă din platforma comună LandscapeOS/Scapeflow. Cele două aplicații
au fost separate în proiecte independente ca să poată evolua fiecare în direcția sa:

- **LandscapeOS** (`~/dev/LandscapeOS`) — ediția pentru firme de peisagistică (B2B / PJ).
- **Grădina Mea** (`~/dev/GradinaMea`) — această aplicație, pentru proprietari de grădini (PF).

## Ce include (păstrat din codul comun)
- Ghid de gazon lunar (CareCalendar)
- Calculatoare de tratamente și îngrășăminte (dozaj + cost)
- Prognoză meteo inteligentă și reguli de udare
- Jurnalul grădinii și galeria foto
- **Scanare AI a plantelor** (diagnoză boli/dăunători cu Claude Vision)

## Rulare locală

**Prerechizite:** Node.js

1. Instalează dependențele:
   `npm install`
2. Creează `.env` din `.env.example` și completează cheile (inclusiv `ANTHROPIC_API_KEY` pentru scanarea AI).
3. Pornește aplicația:
   `npm run dev`

## Configurare variantă

Fișierul [`src/config/appVariant.ts`](src/config/appVariant.ts) conține comutatorul central:
`APP_VARIANT = 'PF'`. Cât timp e `'PF'`, aplicația este homeowner-first — conturile noi sunt
automat de tip PF, iar suprafețele de business (PJ) rămân ascunse.

## Backend Firebase

Momentan folosește aceeași configurare Firebase ca proiectul comun (`firebase-applet-config.json`).
Pe viitor, pentru separare completă a datelor, se poate crea un proiect Firebase dedicat pentru Grădina Mea.
