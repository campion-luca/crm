# Gestionale Lavoro

Web app desktop-first per chi lavora per più aziende contemporaneamente: task per azienda e cartella, priorità, scadenze, calendario, task collegate, storico dei completati, scheda anagrafica e Setup aziendale (logo, colori, font, tono di voce) di ogni azienda.

Ricostruzione del prototipo `gestionale-lavoro.html` (fonte di verità per layout, colori, testi e comportamento) con uno stack di produzione: dati su Postgres con sicurezza per riga, sincronizzazione in tempo reale tra dispositivi, aggiornamenti ottimistici e coda offline.

## Avvio rapido (modalità locale)

```bash
npm install
npm run dev        # http://localhost:5173
```

Senza variabili d'ambiente l'app parte in **modalità locale**: niente login, i dati restano in `localStorage` e le altre schede dello stesso browser si aggiornano da sole. Serve per provarla subito e per i test end-to-end. Con Supabase configurato (sotto) diventa multi-utente e multi-dispositivo.

## Stack

| Livello | Scelta |
|---|---|
| Build | Vite 6 + React 19 + TypeScript strict |
| Stile | Tailwind CSS v4, token in `src/styles/tokens.css` mappati con `@theme` |
| Routing | TanStack Router (route tipizzate, code-splitting, preload su hover/focus, search params tipizzati per i filtri) |
| Dati server | TanStack Query v5: optimistic update, rollback, coda delle modifiche offline, cache persistita |
| Stato UI | Zustand con `persist` (ultima vista, ambito, cartelle espanse, raggruppamento) |
| Backend | Supabase: Postgres + Auth (email e password, link via email, Google) + RLS + Realtime |
| Drag & drop | @dnd-kit/core (mouse, touch e tastiera) |
| Date | date-fns, locale `it`, settimana da lunedì |
| Form | react-hook-form + zod |
| UI | lucide-react, sonner (toast con "Annulla"), Radix Dialog, vaul (drawer mobile), cmdk (⌘K) |
| Liste lunghe | @tanstack/react-virtual oltre ~150 righe |
| Test | Vitest + Testing Library, PGlite (Postgres reale in WASM) per il database, Playwright |

## Setup Supabase

1. **Crea il progetto** su [supabase.com](https://supabase.com) e copia il *Project URL* (pulsante *Connect* in alto, oppure *Project Settings → Data API*) e la chiave **Publishable** (*Project Settings → API Keys*). La chiave *Secret* non serve e non va mai messa nel frontend.
2. **Variabili d'ambiente**: copia `.env.example` in `.env` e compila:
   ```bash
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   Funziona anche la vecchia chiave `anon` in `VITE_SUPABASE_ANON_KEY`, ma Supabase la ritira nel 2027.
3. **Migrazioni** (schema, indici, RLS, trigger `updated_at`, `completed_at`, anti-ciclo e controllo proprietà, Realtime, RPC `apply_changes`, Setup aziendale e bucket privato `brand` per i file). Scegli **un solo** metodo e usa sempre quello, così Supabase tiene traccia di cosa è già applicato:
   - **Integrazione GitHub** (consigliato): *Project Settings → Integrations → GitHub*, collega il repository con *Working directory* `.` e *Production branch* `main`, attiva **Deploy to production**. A ogni push su `main` Supabase applica le migrazioni nuove; l'esito compare come check sul commit in GitHub.
   - **CLI**:
     ```bash
     npx supabase login
     npx supabase link --project-ref <ref>
     npx supabase db push
     ```
   Non incollare le migrazioni a mano nel SQL Editor se usi uno dei due metodi: al deploy successivo verrebbero rieseguite e fallirebbero.
4. **Tipi TypeScript** dal database collegato (sovrascrive `src/lib/database.types.ts`, che oggi è scritto a mano nello stesso formato):
   ```bash
   npm run gen:types
   ```
5. **Auth**:
   - *Authentication → Sign In / Providers → Email*: attivo. Dà sia l'accesso con **email e password** sia il **link via email**; in *Minimum password length* metti 8, come chiede l'app.
   - Chi è entrato con il link imposta la password da *Impostazioni → Password*, oppure dal login con *Password dimenticata?* (il link riporta all'app, che chiede la password nuova).
   - Se l'app la usi solo tu, disattiva *Allow new users to sign up*: il login smette di mostrare "Crea un account".
   - *Authentication → Providers → Google*: crea un OAuth Client su Google Cloud Console (tipo "Web application") con redirect URI `https://<ref>.supabase.co/auth/v1/callback`, poi incolla Client ID e Secret in Supabase.
   - *Authentication → URL Configuration*: *Site URL* = l'URL di produzione; in *Redirect URLs* aggiungi `http://localhost:5173` e il dominio Vercel (anche i preview: `https://*-<team>.vercel.app`).
6. **Realtime**: la migrazione aggiunge `companies`, `folders`, `tasks` e `task_links` alla publication `supabase_realtime`. Puoi verificarlo in *Database → Publications*.
7. **Storage**: la migrazione `…_brand_storage.sql` crea il bucket privato `brand` (file fino a 25 MB) con le policy che limitano ogni utente alla propria cartella. Lo trovi in *Storage*: non serve renderlo pubblico, l'app usa URL firmati a scadenza.

Al primo accesso l'app crea `user_settings` e propone **Inizia da zero** oppure **Carica esempi**.

## Deploy su Vercel

1. Importa il repository su Vercel: il framework Vite viene rilevato da solo, `vercel.json` aggiunge il rewrite SPA (tutte le route → `index.html`) e la cache immutabile degli asset.
2. In *Settings → Environment Variables* aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (Production e Preview).
3. Aggiungi il dominio di produzione alle *Redirect URLs* di Supabase (punto 5 sopra).

## Script

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | typecheck + build di produzione in `dist/` |
| `npm run preview` | serve la build |
| `npm run typecheck` | `tsc -b` su app, test e config |
| `npm run lint` | ESLint (typescript-eslint strict, regole React Compiler) |
| `npm test` | Vitest: logica pura, livello dati e database su PGlite |
| `npm run test:e2e` | Playwright (avvia da solo il server in modalità locale; la prima volta `npx playwright install chromium`) |
| `npm run gen:types` | rigenera i tipi dal progetto Supabase collegato |

## Architettura

```
src/
  app/            shell: router, layout con sidebar e top bar, toolbar, scorciatoie, ⌘K, modali, onboarding, auth
  routes/         home, calendario, scadenze, aziende, azienda ($id), board, lista, impostazioni, login
  features/
    tasks/        azioni (completamento, collegate, spostamenti), TaskModal, LinkedTasks, TaskCard, TaskRow, CompletedTable
    companies/    azioni, CompanyCard, CompanyDashboard, CompanyProfile, ProfileModal, modali azienda/cartella
    brand/        Setup aziendale: logo, colori, font, tono di voce, documenti; upload e anteprime
    calendar/     MonthGrid, DayCell, DayModal, PlanningPanel
    deadlines/    raggruppamento per scadenza (puro, testato) e DeadlineList
    settings/     backup JSON (anche import dal prototipo), seed, svuota tutto
    dnd/          DndProvider unico e hook per drag e drop target
  data/           gateway Supabase / locale, applyChanges, query e mutazioni, sync, file (Storage / IndexedDB)
  components/ui/  Button, Chip, Modal, Segmented, Checkbox, Skeleton, Module, VirtualList
  lib/            date, priorità, colori, filtri, cicli, statistiche, profilo azienda, seed
  stores/         Zustand: UI (persistita) e modali
supabase/migrations/   schema, RLS, trigger, apply_changes
tests/db/              test del database su PGlite
e2e/                   test Playwright
```

### Come viaggiano le modifiche

Ogni azione dell'interfaccia (spunta, drag, modifica, eliminazione, import) produce un elenco di **modifiche** (`upsert` / `patch` / `delete`, vedi `src/data/changes.ts`).

1. `applyChanges` le applica subito alla cache (optimistic) e calcola le **modifiche inverse**. Il cascade è lo stesso del database: eliminare un'azienda toglie cartelle, task e collegamenti.
2. Le modifiche partono verso il server con una sola chiamata alla RPC `apply_changes`, in una transazione atomica. Le mutazioni sono in fila (scope di TanStack Query) e offline restano in coda, anche dopo un ricaricamento, perché la cache è persistita.
3. Se il server rifiuta, la cache applica le inverse (rollback) e compare un toast d'errore.
4. **Annulla** nei toast applica le stesse inverse: annullare l'eliminazione di un'azienda ricrea anche le sue cartelle, task e collegamenti.
5. Realtime riporta le modifiche fatte da altri dispositivi. Le righe con una modifica locale ancora in volo non vengono sovrascritte, così non c'è "rimbalzo".

Tutte le operazioni sono idempotenti (upsert per id, patch con valori assoluti), quindi ripetere un batch dopo un errore di rete non crea duplicati. In modalità locale lo stesso `applyChanges` gira in modalità *strict* e fa da database, con gli stessi vincoli di FK, cartella/azienda e cicli.

### Sicurezza

- RLS su tutte le tabelle: select, insert, update e delete solo dove `user_id = auth.uid()`.
- Le FK non passano dalla RLS. Senza un controllo, un utente che conosce l'id di una riga altrui potrebbe agganciarci una cartella, una task o un collegamento. I trigger `check_owner` e `task_links_guard` lo impediscono e verificano anche che la cartella di una task appartenga alla stessa azienda.
- `apply_changes` è `security invoker` (la RLS resta attiva) e ignora qualsiasi `user_id` nel payload.

## Test

- `src/**/*.test.ts`: date, raggruppamenti, cicli, esito, statistiche, filtri, profilo, seed, backup (anche il formato del prototipo), `applyChanges` (inverse e cascade), gateway locale.
- `tests/db/*.test.ts`: le migrazioni girano su un Postgres reale (PGlite) con uno stub di `auth`. Coprono RLS tra due utenti, trigger, anti-ciclo, `apply_changes`, vincoli e le policy dei file del Setup aziendale su `storage.objects`. `client-batches.test.ts` manda alla RPC i batch prodotti dal client, e i loro inversi, così come sono: seed, eliminazione con annulla e spostamento di cartella.
- `e2e/*.spec.ts`:
  - crea una task → completala → compare in Completi con l'esito;
  - collega 3 task → completa la principale → compare la modale (Completa tutte / solo questa / Completa anche questa);
  - trascina una task su un altro giorno e una card in un'altra colonna;
  - Annulla, scadenza obbligatoria, gesto indietro;
  - lista virtualizzata con 300 task.
  - telefono (390×844): nessuna pagina scorre di lato, barra in basso, menu, nuova task nel pannello dal basso, calendario a pallini;
  - Setup aziendale: logo caricato con avatar, fondo scuro, rinomina, elimina e annulla, persistenza dopo il ricaricamento; colori con copia e colore dell'azienda; font dal file; tono di voce, link e documenti con download.

## Su telefono

Sotto i 900 px di larghezza l'app cambia forma:

- **Barra in basso** con Home, Calendario, Scadenze (con il numero delle task in arrivo) e Menu; al centro il **+** per una nuova task. Il Menu apre la sidebar come pannello laterale (chiudibile con lo swipe o col gesto indietro) con Aziende, Board, Lista, Impostazioni e il filtro per azienda.
- **Modali come pannelli dal basso** (vaul): si chiudono trascinandoli giù, con la ×, col gesto indietro.
- **Calendario a pallini**: un pallino colorato per task (i titoli non entrano in celle da 50 px); toccando il giorno si vede l'elenco.
- **Lista** su due righe (titolo e priorità, azienda e scadenza) invece della tabella da scorrere di lato; **Board** con una colonna per schermata e lo scorrimento che si aggancia.
- **Home** con "In scadenza" in cima, poi calendario, aziende e completati.
- Campi a 16 px (sotto, iOS ingrandisce la pagina al tocco) e aree di tocco da almeno 44 px.

## Setup aziendale

Ogni azienda ha un tab **Setup aziendale** nel suo pannello (`/aziende/:id?tab=setup`):

- **Logo**: carichi una o più varianti (SVG, PNG, JPG, WebP) trascinandole o con il pulsante. Ognuna si vede sul fondo per cui è pensata (chiaro o scuro, proposto in automatico per i loghi in negativo), si rinomina con un clic e si scarica. Il primo logo diventa l'**avatar dell'azienda** in tutta l'app: una miniatura da pochi KB salvata insieme ai dati, così compare subito anche offline.
- **Colori**: nome, HEX, ruolo (primario, secondario…) e nota per Pantone o CMYK. Clic sul colore per copiare l'HEX, RGB già calcolato, contrasto del testo bianco o nero con il livello WCAG. Un colore del brand può diventare il colore dell'azienda nell'app (calendario, card, filtri).
- **Font**: carichi i file (WOFF2, WOFF, TTF, OTF), che vengono raggruppati per famiglia con nome e stile letti dal nome del file; oppure aggiungi il nome e un link. L'anteprima usa il file caricato, poi Google Fonts (solo se il link punta lì) e infine il font installato sul dispositivo.
- **Tono e linee guida**: payoff, tono di voce, hashtag e regole d'uso, ognuno copiabile.
- **Documenti e risorse**: brand book e template caricati (fino a 25 MB) oppure link a Drive, Figma, Canva.
- **Copia variabili CSS**: palette e font come variabili `:root`, da incollare in un foglio di stile.

I dati stanno in `companies.brand` (jsonb), i file nel bucket privato `brand` di Supabase Storage (in modalità locale in IndexedDB). Eliminare un logo, un font o un documento si annulla dal toast; il file sparisce dallo storage solo quando non si può più annullare. Lo stesso vale per i file di un'azienda eliminata.

## Scelte da sapere

- **Home a schermo intero**: da 1150×680 px in su la Home non scorre. Il calendario prende l'altezza disponibile e ogni giorno mostra tanti eventi quanti ne entrano, con "+N" nella testata per gli altri (clic sul giorno per vederli tutti). "In scadenza" e "Completi" scorrono al loro interno. Le aziende compaiono in versione compatta: le card complete restano nella pagina Aziende. Sotto quella dimensione la pagina torna a scorrere.
- **Contrasto**: `--ink-3` è `#8a8a93` invece del `#77777f` del prototipo, che su `--surface-2` non arriva al rapporto AA di 4.5:1.
- **Scadenza obbligatoria**: con `due_date not null` il pannello "Da pianificare" e il gruppo "Senza scadenza" restano sempre vuoti. Sono implementati come da specifica e tornano utili se in futuro la data diventa facoltativa.
- **Ultima vista**: aprendo `/` l'app riporta all'ultima vista usata nella sessione precedente, come faceva il prototipo.
- **Carica esempi** dalle Impostazioni *aggiunge* le aziende di prova, senza sostituire i dati, e si può annullare. Nel prototipo li sostituiva.
- **Import dal prototipo**: *Impostazioni → Backup* accetta anche il JSON esportato da `gestionale-lavoro.html`.
- **Backup e file del Setup**: il backup JSON contiene colori, font, testi e link del Setup aziendale, non i file (loghi, file dei font, documenti caricati). Ripristinandolo, quelle voci non vengono ricreate.
- **Colori e font della scheda**: prima stavano nella Scheda azienda come lista di HEX e testo libero. Ora vivono nel Setup aziendale, che li recupera da solo finché non viene salvato la prima volta.
- **Avatar con il logo**: un logo molto largo in un quadrato piccolo si legge poco. Il Setup lo segnala e suggerisce di usare come avatar il pittogramma.
- **Scorciatoie**: usano `event.key`, così `/` funziona anche sulla tastiera italiana (Shift+7). Per questo niente react-hotkeys-hook, che confronta il codice fisico del tasto.
