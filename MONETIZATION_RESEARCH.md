# Notițe Research — Monetizare (draft, neimplementat)

> Status: **research only**, nimic din acest document nu e implementat în cod.
> Sursă: analiză a 20 creatori de conținut lawn care/DIY grădină (TikTok/YouTube/Instagram,
> 11K–1.9M+ audiență). Scop: adaptare la piața RO pentru aplicația noastră, de revenit
> peste el când ajungem la etapa de monetizare/reclame.

---

## 0. Context aplicație (pentru referință rapidă la revenire)

- B2C, consumator final — proprietar de grădină/gazon, nu profesionist din domeniu.
- Are deja: tier `PRO` (subscriptionTier), paywall parțial în Academie (freemium →
  articole PRO), sistem de cod cadou ("Cod Cadou"), referral cu recompensă
  ("Recomandă & Câștigă" — +7 zile PRO gratuit per prieten invitat).
- Are deja infrastructură latentă multi-tenant: `organization.accentColors`,
  tier `ENTERPRISE` vizibil pe cont, panou `SuperAdmin` — neexploatată încă
  comercial, dar gata pentru un unghi B2B2C (vezi secțiunea 2).
- Instrumentele din app (calculator NPK, calculator tratamente, irigare,
  GDD tracker) generează recomandări concrete de produs — teren perfect
  pentru affiliate contextual (vezi idee #2).

---

## 1. Adaptarea tiparelor la piața românească

### Produse digitale — TVA & facturare
- **RO e-Factura** e obligatorie (B2B din 2024, extindere treptată spre B2C) —
  orice vânzare de ghid digital de la o firmă înregistrată în RO trebuie
  facturată prin sistemul e-Factura, nu doar cu o chitanță/bon simplu.
- TVA 19% pentru vânzări domestice; dacă la un moment dat se vinde și în
  restul UE, intră în discuție regimul OSS (One-Stop-Shop) — probabil
  irelevant pe termen scurt cât timp targetul rămâne RO.
- Dacă monetizarea trece prin App Store/Play Store (IAP), Apple/Google
  rețin 15-30% și gestionează ei TVA-ul — schimbă calculul de preț și
  elimină nevoia de Netopia/Stripe *pentru acel canal specific*. De
  clarificat explicit, la momentul implementării, ce procent din venit
  trece prin IAP vs. checkout web.

### Plăți — ce e relevant local
- **Netopia Payments** (fost mobilPay) — procesator de plăți RO cel mai
  „de încredere" pentru consumatorul local, integrare directă cu băncile RO.
- **Stripe** — funcționează în România (RON, card, Apple/Google Pay),
  mai simplu de folosit pentru abonamente recurente (Stripe Billing)
  decât Netopia; alegere tipică pentru un startup tech.
- **Revolut Business** — *nu* e un checkout pentru clienți, e un tool de
  banking operațional (încasare comisioane affiliate, plăți către
  colaboratori). Nu se confundă cu Netopia/Stripe.

### Programe de afiliere — RO vs. internațional
- **2Performant** — rețeaua de affiliate dominantă în RO; acoperă eMAG,
  Leroy Merlin RO, Dedeman și alți retaileri relevanți pentru
  unelte/îngrășăminte/irigație. Echivalentul local direct al "Amazon
  Associates" din research-ul original.
- **eMAG Affiliate** — eMAG e marketplace-ul dominant în RO, cu încredere
  ridicată și opțiune ramburs (cash-on-delivery) — factor important de
  conversie pentru consumatorul RO (vezi mai jos).
- **Amazon Associates** — fără magazin .ro dedicat; unii cumpărători RO
  comandă de pe Amazon.de/.it pentru produse de nișă indisponibile local,
  dar conversia va fi mai mică decât pe eMAG din cauza fricțiunii de
  checkout cross-border și lipsei rambursului.
- De verificat separat: programe de affiliate/parteneriat directe (în
  afara 2Performant) la retaileri de grădină — Hornbach RO, pepiniere
  locale, producători locali de îngrășăminte/semințe.

### Comportament de cumpărare RO vs. US
- **Sensibilitate la preț**: portarea directă 1:1 a prețurilor US
  ($15-50 pentru un ghid digital ≈ 70-230 RON) e nerealistă relativ la
  puterea de cumpărare locală. Interval realist pentru un ghid digital
  simplu: **~20-60 RON**, nu mai mult, decât dacă produsul are o
  componentă vizibil "premium" (video, plan personalizat, template-uri).
- **Încredere în prepay**: preferința pentru ramburs în e-commerce RO e
  un semnal indirect că pragul de încredere pentru plată în avans e mai
  ridicat decât în US/UK — deși rambursul nu se aplică direct la produse
  digitale, concluzia practică e aceeași: **primul contact plătit trebuie
  să fie friction minim** (sumă mică, one-time, nu abonament direct de
  la prima interacțiune).
- **Confort abonamente recurente**: în creștere (Netflix/Spotify sunt
  deja normalizate), dar tot mai sensibil la preț decât Europa de Vest.
- **IAP mobil**: confort bun la publicul tânăr, dar publicul central al
  nișei (proprietar de casă, gazon/grădină) skews mai în vârstă și poate
  prefera un checkout web unde poate vedea/printa o factură, față de
  IAP din store. De luat în calcul ambele canale, nu doar unul.

---

## 2. B2C vs. B2B — ce se potrivește aplicației

**Concluzie: B2C rămâne modelul principal**, cu un B2B2C secundar/explorator
construit pe infrastructura deja existentă (organization/enterprise), NU
pe tiparul #4 din research (cursuri/consultanță pentru alți profesioniști
din nișă).

De ce:
- Toate funcționalitățile din app (jurnal, calendar, calculatoare,
  diagnostic, enciclopedie) sunt gândite pentru propriul gazon/propria
  grădină — zero workflow de gestiune client, facturare job-uri,
  programare echipe — deci audiența naturală e proprietarul de casă, nu
  antreprenorul de peisagistică.
- Tiparul #4 (Jason Creel, Dirt Monkey etc.) funcționează pentru **creatori
  cu autoritate personală** într-o comunitate de profesioniști care au
  nevoie de business coaching. Aplicația noastră n-are acest tip de
  audiență și nici poziționare de "brand personal expert" — nu se
  potrivește fără un pivot de produs complet diferit.
- În schimb, infrastructura `organization`/`ENTERPRISE`/`SuperAdmin` deja
  existentă în cod sugerează un unghi B2B **diferit și mai potrivit**:
  **B2B2C prin licențiere** — vindem accesul la aplicație (white-label sau
  co-branded) către firme (centre de grădinărit, firme de peisagistică,
  asociații de proprietari) care îl oferă mai departe clienților/rezidenților
  lor. Nu vindem cursuri unor profesioniști, vindem produsul unor firme.

---

## 3. 5-7 idei concrete de monetizare (draft, de evaluat ulterior)

1. **Abonament PRO recalibrat pentru puterea de cumpărare RON**
   (adaptare tipar #2, dar recurent, nu ghid single) — folosește
   infrastructura PRO deja existentă; testat cu preț ancorat (ex. "10 luni
   plătite, 12 primite" la anual) mai degrabă decât port direct din EUR/USD.

2. **Affiliate contextual 2Performant/eMAG în output-urile instrumentelor**
   (adaptare tipar #1) — link affiliate direct la produsul recomandat de
   Calculator NPK, Calculator Tratamente, Irrigation Calibration etc.
   Zero efort de conținut nou, folosește ce hardware/consumabile app-ul
   deja calculează exact.

3. **Ghid digital single, low-friction, ca produs de intrare**
   (adaptare tipar #2, calibrat RO) — un singur PDF descărcabil/printabil
   (ex. "Calendarul Complet de Îngrijire a Gazonului") la ~19-29 RON,
   ca prim contact plătit cu risc minim, înainte de a cere abonament PRO.

4. **Loop viral bazat pe conținut generat deja de utilizator**
   (adaptare tipar #7/#8, extensie a referral-ului existent) — recap
   anual/sezonier al jurnalului/GDD tracker-ului, generat automat ca
   imagine shareabilă, cu CTA discret — nu necesită conținut nou creat
   manual, doar expune ce app-ul deja are.

5. **Licențiere B2B2C prin organization/enterprise** (unghi B2B propriu
   aplicației, nu tiparul #4 din research) — acces co-branded/white-label
   vândut către centre de grădinărit, firme de peisagistică, asociații
   de proprietari, care oferă app-ul mai departe clienților lor.

6. **Coduri de reducere branded cu retaileri RO de grădină**
   (tipar #3) — **necesită bază de utilizatori existentă** ca leverage
   de negociere (vezi secțiunea 4); notat ca idee de etapă ulterioară,
   nu de pornire.

7. **Merch propriu — prioritate scăzută/opțional**
   (tipar #5) — fulfillment RO (Printful/Printify) e mai puțin matur
   decât în US, marje subțiri după shipping+taxe vamale pe unele SKU-uri;
   consistent cu observația din research că merch e rar principal oriunde.

*(Notă: modelul membership/Patreon — tipar #6 — nu e recomandat; chiar
research-ul original îl marchează ca nedovedit în nișă (1/20), iar
abonamentul PRO deja existent acoperă mai bine acest rol prin utilitate
concretă, nu prin „susține-mă".)*

---

## 4. Ce necesită deja scară/audiență vs. alternativă la pornire de la zero

| Tipar | Necesită audiență mare? | Alternativă la scară mică |
|---|---|---|
| #1 Affiliate (2Performant/eMAG) | Nu — signup self-serve | Pornește imediat, fără negociere |
| #2 Freemium → produs plătit | Nu — infra deja există | Pornește imediat |
| #3 Coduri branded cu retaileri | **Da** — leverage de negociere | Construiește istoric de conversii via #1, apoi negociază direct |
| #4 B2B cursuri/consultanță peer-to-peer | **Da** — autoritate personală într-o comunitate de profesioniști | Nu se potrivește produsului; înlocuit cu #5 (licențiere B2B2C, nu necesită autoritate personală, ci doar produsul + un pitch de business) |
| #5 Licențiere B2B2C (organization) | Parțial — ajută un istoric/demo, dar nu necesită audiență de consumator | Poate porni cu 1-2 parteneri pilot, fără audiență mare |
| #6 Membership/Patreon | Irelevant — nedovedit oricum | Nu e nevoie de alternativă, se sare peste |
| #7 Format viral | Nu neapărat, dar are nevoie de conținut de arătat | Seed cu conținut generat de app (recap-uri automate), nu cu personalitate/creator |
| #8 Hub central de conversie | Nu — pur structural | Deja există parțial ("Contul meu" / "Recomandă & Câștigă") — de strâns într-un singur punct clar când venim la implementare |

**Recomandare de prioritate la pornire (zero audiență):** #1 și #2 primele
(nu necesită nimic în plus față de infrastructura deja existentă), apoi #4→#5
(licențiere) și #3 (coduri branded) după ce există un istoric de conversii
care poate fi arătat unui partener.
