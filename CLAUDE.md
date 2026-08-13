# My Garden — Jurnal de decizii

> Se actualizează după **fiecare** prompt și **fiecare** decizie. Scopul: nicio direcție
> stabilită să nu fie re-discutată sau reconstruită din greșeală într-o sesiune viitoare.

---

## Stare curentă

- **Branch de lucru:** `redesign/dashboard-only`
- **Producție:** https://gradinamea.vercel.app (deploy manual prin `vercel --prod`, **fără** integrare Git automată)
- **Stack:** Vite + React + TS, Tailwind v4, Firebase, Capacitor (nativ plănuit pe Android/iOS)

### Branch-uri de siguranță (a nu se șterge)
| Branch / tag | Ce conține |
|---|---|
| `main` | varianta stabilă dinaintea redesign-ului |
| `backup/pre-redesign-ui` + tag `v1-pre-redesign` | snapshot suplimentar al aceleiași variante |
| `redesign/terra-rail-sidebar` | încercarea 1 — sidebar rail cu hover-expand (**respinsă**) |
| `redesign/top-nav` | încercarea 2 — meniu orizontal sus, stil website (**respinsă**) |

---

## Decizii de design

### ❌ Respinse explicit (a nu se propune din nou)
1. **Sidebar rail cu hover-expand** — „e același meniu tot în stânga”.
2. **Meniu orizontal sus (top-nav)** — testat, dar nu s-a mers pe el.
3. **Identificare boli cu AI** — nu se dorește. Doctorul Grădinii rămâne **determinist**.
4. **Modificarea componentelor UI partajate** când cererea vizează o singură pagină —
   `components/ui/primitives.tsx` și `components/ui/HeroHeader.tsx` sunt folosite de
   Academy / Explore / AccountSettings / SuperAdmin / GardenCollectionPage.
   Pentru schimbări izolate → componente dedicate (ex. `components/dashboard/DashboardUI.tsx`).

### ✅ Direcția agreată (2026-08-13): compactare mobile-first

**Problema măsurată** pe 375×812 — cât din primul ecran e chrome până la prima informație utilă:

| Pagină | Prima informație | % irosit |
|---|---|---|
| Academie | 742px | **91%** |
| Calendar | 709px | **87%** |
| Enciclopedie | ~700px | **86%** |
| Dashboard | 675px | **83%** |

**Cauza:** fiecare pagină începe cu un hero decorativ de 190–285px care doar repetă
numele paginii pe care utilizatorul tocmai a apăsat-o în dock.

**Cele 7 reguli de densitate:**

| # | Regulă |
|---|---|
| R1 | Zero hero decorativ pe mobil. Titlul stă într-un **app bar sticky de 52px**. |
| R2 | Filtrele → un rând orizontal + chip „Filtre” care deschide un **bottom sheet**. |
| R3 | Conținutul începe în primii **200px**. Buget: chrome ≤ 25% din primul ecran. |
| R4 | Zero paginare pe mobil → **scroll infinit**. |
| R5 | Antete de secțiune **32px**, nu 60px. |
| R6 | Padding **16px** pe mobil (nu 24–28), radius 20px. |
| R7 | **Progressive disclosure** — secundarul se deschide, nu se stivuiește. |

**Ținte:** Academie 742 → ~180px · Calendar 709 → ~150px · Enciclopedie → ~190px.

### App bar persistent — specificație
- Înălțime **52px**, sticky, se micșorează la scroll.
- Desenat **în stilul header-ului actual**: fundal colorat discret.
- **Rotunjit doar în partea de jos.**
- **Spațiu mort minim**, peste tot.
- Acțiuni contextuale per pagină:
  - Enciclopedie: `🔍 caută` · `⚙ filtre•n` · `♥ salvate`
  - Calendar: `◀ Aug ▶` · `+ activitate` · `⚡ azi`
  - Academie: `🔍` · `★ favorite` · `▣ categorii`

### Header Dashboard cu vremea în fundal
Fundalul header-ului devine **cerul real**: gradient după ora zilei + condițiile meteo,
cu straturi animate discret. Elimină cardul separat „Vremea” (−180px).
Temperatura intră inline în rândul de meta.

### Doctorul Grădinii → motor de diagnostic diferențial
Determinist (fără AI). Arhitectură: `symptoms[]` → `causes[]` (cu modificatori de
probabilitate după lună / temperatură / umiditate / sol / expunere / acțiuni recente din
jurnal) → `treatments[]` (doză, fereastră, bio vs chimic, PHI/REI).

Scor bayesian simplu → pune doar întrebările **discriminante** (tipic 2–3, nu 10).
Livrează **diagnostic diferențial** cu procent de încredere + **traseul dovezilor**, nu un verdict.
**Buclă de revenire:** programează verificare la 7 zile; dacă nu s-a rezolvat → re-diagnostic.

**Scop agreat: motorul + toate cele 6 domenii** — gazon, pomi fructiferi, legume, flori,
arbuști/conifere, plante de interior (~150 cauze, ~200 protocoale).

### Utilitare pentru utilizare zilnică (retenție)
Temperatura solului · GDD · fereastra de stropit · calculator îngrășământ ·
calculator udare (ET0) · calendar fenologic pomi · pH & amendamente · „ce semăn săptămâna asta”.

---

## Constrângeri tehnice

- **Performanță pentru varianta nativă:** `backdrop-blur-xl` și blob-urile `blur(90px)`
  sunt scumpe pe GPU și vor da jank pe Android mid-range → de înlocuit cu gradienți pre-randați.
- **API routes = format Vercel** (`export default (req, res)`) + `firebase-admin` pe server.
  Vezi `api/user/update-level.ts` ca referință. **Nu** SDK-ul client, **nu** `@netlify/functions`.
- Conținutul din Academie și Enciclopedie **nu se pierde** — designul se poate schimba, datele nu.

---

## Erori cunoscute (identificate 2026-08-13)

| # | Fișier | Problemă | Stare |
|---|---|---|---|
| 1 | `api/weather/check-frost-alerts.ts` | Import `@netlify/functions` pe proiect Vercel + SDK client Firebase pe server → **endpoint mort**, alertele de îngheț nu funcționau | ✅ rescris pe semnătura Vercel + `firebase-admin` |
| 2 | `src/App.tsx:188` | `onSnapshot` cu `{ once: true }` (opțiune inexistentă) → listener nedezabonat + callback gol | ✅ șters (era cod mort) |
| 3 | `components/AdBanner.tsx:34` | `isActive` lipsea din tip **și** nimic nu scria câmpul → filtrul returna listă goală, **nicio reclamă nu se afișa vreodată** | ✅ `isActive?: boolean` + filtru `!== false` (opt-out) |
| 4 | `components/ScheduledActivitiesList.tsx` | `window.database \|\| require(...)` — ambele inexistente în bundle → finalizarea și ștergerea **crăpau la runtime** | ✅ import corect `db` |
| 5 | `index.css` + `src/App.tsx` | `overflow-x: hidden` crea scroll container și **rupea `position: sticky`** pentru orice descendent | ✅ `overflow-x: clip` |

---

## Progres compactare (măsurat, nu estimat)

| Pagină | Înainte | După | Recuperat | Stare |
|---|---|---|---|---|
| Academie | 742px / 91% | **220px / 27%** | −522px | ✅ |
| Enciclopedie | ~700px / 86% | **221px / 27%** | −479px | ✅ |
| Calendar | 709px / 87% | selector de lună în bară | ~−500px | ✅ |
| Contul meu | ~440px până la prima setare | rând compact 64px | ~−340px | ✅ |
| Dashboard | 675px / 83% | — | — | ⏳ header cu vremea |

## Tipografie (agreat 2026-08-13)

- **Manrope** — UI/body (a înlocuit Inter, care era neutru până la anonim).
- **Fraunces** cu axele `SOFT` + `WONK` — display editorial (salut Dashboard, nume de lună).
- `.font-ui-title` = Manrope 800 — titlurile din app bar. **Nu** serif:
  serif-ul e pentru *conținut* editorial, chrome-ul trebuie să se retragă.
  (Utilizatorul a respins explicit Fraunces pe titlul „Academie”.)
- `.appbar-gradient` — gradient dinamic pe 3 stopuri din culoarea temei,
  derivă lent (18s), sub pragul la care mișcarea devine distragere.

**Respins:** subtitlul cu numărul de ghiduri citite (vanitate, nu informație)
și iconița de search în app bar (search-ul e deja în butonul flotant dreapta-jos).

`components/ui/AppBar.tsx` — componenta reutilizabilă: 52px → 44px la scroll,
fundal `accent-subtle` discret, `rounded-b`, acțiuni contextuale cu badge,
`children` pentru rândul de filtre sticky.

## Jurnal

- **2026-08-13 (2)** — Reparate toate cele 5 erori. Construit `AppBar`. Aplicat pe
  Academie: 742px → 220px. Descoperit că `overflow-x: hidden` (body + root-container)
  rupea `position: sticky` — înlocuit cu `clip`.
- **2026-08-13** — Audit mobil cu măsurători; stabilite R1–R7 + specificația app bar
  (fundal discret, rotunjit jos, spațiu mort minim). Agreat: se începe cu **compactarea
  mobilă**; Doctorul Grădinii ulterior, cu **toate cele 6 domenii**. Adăugată regula de
  actualizare a acestui fișier după fiecare prompt/decizie.
- **2026-08-12** — Redesign doar pe Dashboard (`8f4a3c0`), izolat în
  `components/dashboard/DashboardUI.tsx`. Mărit gutter-ul lângă sidebar la 40px (`1910e68`).
  Reparat bug: secțiunea Sarcini rămânea la `opacity:0` (wrapper framer-motion → CSS `.animate-rise`).
