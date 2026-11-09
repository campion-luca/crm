# Prompt per Claude Code: Gestionale Lavoro

> Copia tutto da qui in giù in Claude Code (VS Code), in una cartella vuota.
> Se puoi, metti nella cartella anche `gestionale-lavoro.html` (il prototipo funzionante) e digli di usarlo come riferimento visivo e funzionale.

---

## Obiettivo

Costruisci **Gestionale Lavoro**, una web app desktop-first per un frontend developer / social media manager che lavora per più aziende contemporaneamente. Serve a organizzare le task per azienda e cartella, con priorità, scadenze, calendario, task collegate tra loro, storico dei completati e una scheda anagrafica per ogni azienda.

Nella cartella c'è `gestionale-lavoro.html`, un prototipo single-file già funzionante: **è la fonte di verità per layout, colori, testi e comportamento**. Ricrealo fedelmente con lo stack qui sotto, migliorando struttura, performance e persistenza. Tutti i testi dell'interfaccia sono in **italiano**.

Lavora per fasi (in fondo). Alla fine di ogni fase esegui typecheck, lint e test, poi passa alla successiva.

---

## Stack

| Livello | Scelta | Perché |
|---|---|---|
| Build / dev | **Vite 6 + React 19 + TypeScript (strict)** | SPA dietro login: niente SSR inutile, avvio istantaneo, bundle piccolo |
| Stile | **Tailwind CSS v4** con design token in CSS variables | Nessun runtime CSS, token in un solo posto |
| Routing | **TanStack Router** (type-safe, code-splitting per route) | Route tipizzate, search params tipizzati per i filtri |
| Dati server | **TanStack Query v5** con optimistic update | UI istantanea a ogni spunta o drag, rollback automatico se fallisce |
| Stato UI | **Zustand** (vista, filtri, preferenze UI) con `persist` su localStorage | Leggero, niente re-render a cascata |
| Backend | **Supabase**: Postgres + Auth + Row Level Security + Realtime | Postgres vero, sicurezza per riga, sync multi-dispositivo in tempo reale, zero server da mantenere |
| Drag & drop | **@dnd-kit/core** | Accessibile, performante, funziona tra liste, colonne e celle del calendario |
| Date | **date-fns** (locale `it`), settimana che inizia di lunedì | Tree-shakable |
| Form | **react-hook-form + zod** | Validazione tipizzata condivisa con i tipi DB |
| Icone | **lucide-react** | Tree-shakable |
| Font | `@fontsource-variable/plus-jakarta-sans` + `@fontsource/jetbrains-mono` | Self-hosted, niente richieste esterne |
| Liste lunghe | **@tanstack/react-virtual** quando una lista supera ~150 righe | |
| Test | **Vitest + Testing Library**, **Playwright** per 3-4 flussi end-to-end | |
| Deploy | **Vercel** (frontend) + Supabase (DB) | |

Tipi DB generati con `supabase gen types typescript`. Nessun `any`.

---

## Database (Supabase / Postgres)

Crea le migrazioni SQL in `supabase/migrations/`. Ogni tabella ha `user_id uuid not null default auth.uid() references auth.users on delete cascade` e RLS attiva con policy `user_id = auth.uid()` per select, insert, update e delete.

```sql
create type task_status as enum ('todo','doing','review','done');

create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 120),
  color text not null,                 -- hex
  position int not null default 0,
  profile jsonb not null default '{}', -- scheda azienda, vedi tipo CompanyProfile
  created_at timestamptz not null default now()
);

create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company_id uuid not null references companies on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company_id uuid not null references companies on delete cascade,
  folder_id uuid references folders on delete set null,
  title text not null check (length(title) between 1 and 300),
  notes text not null default '',
  link text not null default '',
  priority smallint not null default 3 check (priority between 1 and 5), -- 1 = più urgente
  status task_status not null default 'todo',
  due_date date not null,
  due_time time,
  estimate_min int not null default 0 check (estimate_min >= 0),
  checklist jsonb not null default '[]', -- [{id,text,done}]
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- task collegate: il parent si chiude dopo aver completato i child
create table task_links (
  parent_id uuid not null references tasks on delete cascade,
  child_id  uuid not null references tasks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  calendar_color_by text not null default 'company' check (calendar_color_by in ('company','priority')),
  horizon_days int not null default 14 check (horizon_days in (7,14,30,60)),
  show_done boolean not null default true,
  available_hours numeric not null default 8
);

create index on tasks (user_id, due_date);
create index on tasks (company_id, status);
create index on tasks (user_id, completed_at desc) where status = 'done';
create index on task_links (child_id);
```

Aggiungi anche:
- un trigger `updated_at`;
- un trigger su `tasks` che imposta `completed_at = now()` quando `status` passa a `done` e lo azzera quando esce da `done`;
- un trigger su `task_links` che **impedisce i cicli** (CTE ricorsiva: rifiuta l'insert se `parent_id` è già raggiungibile partendo da `child_id`);
- Realtime attivo su `companies`, `folders`, `tasks` e `task_links`.

Tipo `CompanyProfile` (jsonb, validato con zod):

```ts
{
  contacts: { name: string; role?: string; email?: string; phone?: string }[];
  website?: string;
  links: { label: string; url: string }[];
  social: Partial<Record<'instagram'|'facebook'|'linkedin'|'tiktok'|'youtube', string>>;
  brandColors: string[]; // hex
  fonts?: string;
  address?: string;
  vat?: string;          // P.IVA / CF
  notes?: string;
}
```

Auth: login con **magic link** e **Google**. Al primo accesso crea `user_settings` e offri due opzioni: "Inizia da zero" oppure "Carica esempi" (vedi Seed).

---

## Design system (tema unico scuro)

Definisci i token in `src/styles/tokens.css` come CSS variables e mappali in Tailwind v4 (`@theme`).

```
--bg #0a0a0b       --side #050505      --surface #151517   --surface-2 #1e1e21
--line #2a2a2e     --ink #f3f3f5       --ink-2 #b4b4bc     --ink-3 #77777f
--accent #ff6eb4 (rosa)   --accent-ink #3a0b22   --accent-soft rgba(255,110,180,.14)
--danger #ff5d73   --warn #ffb547      --ok #3ddc97
font body: Plus Jakarta Sans · font numeri/date: JetBrains Mono (tabular-nums)
radius: 10–12px per controlli, 16–20px per moduli e card · color-scheme: dark
```

- **Priorità**: P1 Massima `#ff5d73` · P2 Alta `#ff9f43` · P3 Media `#ffd166` · P4 Bassa `#5ec8ff` · P5 Minima `#8e8e99`. La pillola mostra "P1" su sfondo al 16% del colore.
- **Stati**: Da fare `#9c9ab0` · In corso `#6c4cf5` · In revisione `#f59e0b` · Fatto `#16b364`.
- **Palette aziende**, assegnata in ordine e ben distinta: `#ffe08a` giallo pastello, `#12b76a` verde, `#1d3fae` blu scuro, `#ff5a5f`, `#a64dff`, `#00b8d9`, `#ff7a1a`, `#e83e8c`, `#7cb518`, `#2f6bff`, `#ffb000`, `#475467`.
- **Dettagli rosa**:
  - trattino rosa di 38×2px sotto il titolo di ogni modulo;
  - voce attiva del menu con barra rosa a sinistra;
  - bordo rosa al passaggio del mouse su card e righe;
  - bordo superiore rosa sulle finestre modali;
  - intestazioni delle tabelle in rosa.
- Nel pannello di un'azienda gli accenti (barra laterale dell'intestazione, trattini, chip attive, barra di avanzamento) usano il **colore dell'azienda** (`--c`).
- Gli eventi nel calendario hanno sfondo al 28% del colore sopra `--surface` e bordo sinistro pieno di 4px.
- Focus sempre visibile, rispetto di `prefers-reduced-motion`, contrasto AA.
- Desktop-first, ottimizzato per ≥1280px. Sotto i 1150px i moduli vanno in colonna, sotto i 900px la sidebar diventa un drawer.

---

## Layout generale

**Sidebar** (264px, sfondo `--side`):
- In alto: logo "GL" con gradiente rosa→pesca, "Gestionale Lavoro" e sotto "N aziende · N lavori aperti".
- **Menu**: Home (H), Calendario (C), In scadenza (badge col numero, rosso se c'è qualcosa in ritardo), Aziende (numero), Board (B), Lista task (L).
- **Filtra per azienda**: "Tutte le aziende", poi ogni azienda con pallino colore, conteggio aperte (rosso se ce ne sono in ritardo), freccia per espandere le cartelle, menu "⋯" per modificare. Sotto ogni azienda: cartelle con conteggio e "+ Nuova cartella". Pulsante "+ Nuova".
- In fondo: **Impostazioni** e stato della sincronizzazione (pallino più testo).
- Le aziende e le cartelle nella sidebar sono drop target: trascinandoci una task la sposti lì.

**Top bar**:
- titolo della vista;
- chip con il filtro attivo (azienda / cartella) e × per toglierlo;
- suggerimento "N nuovo · / cerca";
- pulsante rosa **"+ Nuova task"**.

Nella vista azienda: freccia indietro, pallino colore e nome dell'azienda.

**Toolbar filtri** (solo in Board, Lista e Calendario completo): ricerca testuale, filtro priorità, "Raggruppa" (solo Lista), "Mostra completati", "Azzera filtri".

**Riepilogo** (solo in Board, Lista e Calendario): 4 tile cliccabili che filtrano. In ritardo · Scadono oggi · Prossimi 7 giorni · In corso.

---

## Viste

### 1. Home (default)

- **Saluto**: Buongiorno / Buon pomeriggio / Buonasera in base all'ora, con data estesa sotto ("Venerdì 6 novembre").
- **Pillole a destra**: "N in ritardo" (rossa), "N oggi" (ambra), "N questa settimana" (rosa). Cliccandole apri la Lista con quel filtro.
- **Griglia a due colonne** (1.8fr / 1fr):
  - **Colonna sinistra**:
    - **Modulo Calendario**: mese con griglia lun→dom e 6 settimane. Mostra **tutte le task di tutte le aziende** nel giorno di scadenza, colorate **per azienda**, senza limite di righe (la cella si allunga). Legenda delle aziende. Frecce, "Oggi", link "Apri pianificazione". Il giorno di oggi ha il numero su badge rosa. Cliccando una cella apri la modale del giorno (lista task più "Aggiungi task"). Il "+" su ogni cella crea una task con quella data. Trascinando un evento su un altro giorno ne cambi la scadenza.
    - **Riga "Aziende"**: card in griglia da 3, cliccabili, che aprono il pannello dell'azienda.
  - **Colonna destra** (sticky): **Modulo In scadenza** per i prossimi `horizon_days`, raggruppato in In ritardo (rosso) · Oggi (ambra) · Domani (rosa) · Entro 7 giorni (blu) · Più avanti (verde). Ogni riga ha:
    - checkbox per completare;
    - titolo;
    - azienda · cartella;
    - progresso delle collegate;
    - etichetta "per: …" se la task serve a un'altra;
    - pillola priorità e scadenza relativa ("Oggi", "Domani 12:00", "gio", "12 nov").

    In fondo al modulo: "N task senza scadenza" e "Vedi tutto in lista".
- **Tabella Completi** a tutta larghezza (vedi sotto).

**Card azienda**:
- barra superiore di 5px nel colore dell'azienda;
- avatar con iniziali (sfondo al 26% del colore);
- nome e "N cartelle · X h stimati";
- tre box: aperti · ritardo (rosso se >0) · 7 giorni;
- barra di avanzamento fatte/totali con percentuale;
- "Prossima: titolo + scadenza".

All'hover la card si alza e il bordo diventa rosa. È anche un drop target.

### 2. Pannello azienda (`/aziende/:id`)

- **Intestazione**:
  - avatar grande, nome;
  - chip delle cartelle ("Tutte le cartelle", una per cartella, "+ Cartella") che filtrano il pannello;
  - pulsanti "Modifica azienda" e "Nuova task" (preimpostata su quell'azienda e cartella);
  - **link rapidi** (sito più i link utili della scheda, massimo 6).
- **Tab**: Panoramica | Scheda azienda.
- **Panoramica**:
  - KPI: da svolgere · in ritardo · scadono oggi · tempo stimato · avanzamento;
  - **Calendario solo di quell'azienda, colorato per priorità**;
  - modulo **Da svolgere** con tutte le aperte, raggruppate come sopra più "Senza scadenza", con la cartella al posto dell'azienda;
  - **Completi** filtrati per azienda.
- **Scheda azienda**: card Referenti · Link utili · Social · Brand (swatch grandi con hex) · Dati aziendali e note.
  - Click su email, telefono, hex, font o P.IVA: **copia negli appunti** e mostra un toast.
  - Gli @handle dei social diventano URL in automatico.
  - Se la scheda è vuota: stato vuoto con "Compila la scheda".
  - Modale di modifica larga (840px) con righe dinamiche (aggiungi/rimuovi) per referenti, link e colori. Ogni colore ha color picker e campo hex sincronizzati.
  - Nota nella modale: "Niente password qui".

### 3. Calendario completo

Come il modulo, più:
- selettore "Colori: azienda / priorità";
- pannello destro (290px) con il **giorno selezionato** (task, ore stimate, "Aggiungi a questo giorno");
- pannello **Da pianificare** (task senza data) trascinabili sui giorni.

Massimo 3 eventi per cella, poi "+N altri". Rispetta filtri e ambito.

### 4. In scadenza

Pagina dedicata con chip 7 / 14 / 30 / 60 giorni e la stessa lista raggruppata.

### 5. Aziende

Griglia di card grandi (con chip delle cartelle cliccabili) più la card tratteggiata "Nuova azienda".

### 6. Board

Colonne Da fare / In corso / In revisione / Fatto:
- conteggio e ore stimate in ogni colonna;
- "+" per creare una task con quello stato;
- card con: azienda · cartella, titolo, etichetta "per:", stima, pillola priorità, progresso delle collegate e della checklist, scadenza (rossa se in ritardo, ambra se oggi);
- striscia sinistra nel colore della priorità.

Si trascina tra le colonne. Ordine: priorità, poi scadenza.

### 7. Lista task

Tabella raggruppabile per **priorità / azienda / stato**, con ore stimate per gruppo. Colonne: ✓ · Task · Azienda/cartella · Priorità · Stato · Scadenza · Stima.

### 8. Impostazioni

- **Aziende**: nome, swatch per cambiare colore al volo, "Modifica".
- **Preferenze**: colori del calendario, orizzonte scadenze, mostra completati, ore disponibili al giorno.
- **Dati**: stato sync, **Backup** (esporta JSON scaricabile / importa da file o testo), "Carica esempi", "Svuota tutto" (conferma con doppio click: il pulsante diventa "Conferma" per 3 secondi).

---

## Task

**Modale task** (Ctrl+Invio per salvare, Esc per chiudere):
- titolo (grande);
- azienda;
- cartella, con l'opzione "+ Nuova cartella…" inline;
- **priorità 1–5** come pulsanti segmentati ("P1 Massima" … "P5 Minima");
- stato;
- **scadenza obbligatoria** (default oggi);
- ora facoltativa;
- stima in minuti;
- **Task collegate**;
- checklist (Invio per aggiungere; spunta e rimuovi);
- link, con "Apri link";
- note.

Azioni: Elimina (doppio click per confermare), Duplica (azzera stato, collegate e checklist), Annulla, Salva.

Non esistono tipologie: le task sono tutte uguali.

**Task collegate** (le dipendenze):
- Sezione con barra di avanzamento d/n e lista delle collegate. Ogni riga ha:
  - checkbox che completa la collegata senza chiudere la modale;
  - click sul titolo che apre la collegata, dopo aver salvato la corrente;
  - badge "scade dopo" se la collegata scade dopo la principale;
  - × per scollegare.
- "+ Collega una task esistente…": select raggruppata per azienda, con l'azienda corrente per prima. Esclude se stessa, le già collegate e gli antenati (niente cicli).
- "+ Nuova task collegata": Invio crea la task con stessa azienda, cartella, priorità e scadenza, e la collega.
- Spuntando una principale con collegate aperte: modale "Mancano N task collegate" con le opzioni **Completa tutte** / **Completa solo questa** / Annulla.
- Completata l'ultima collegata: toast "Tutte le collegate di «X» sono fatte" con il pulsante **"Completa anche questa"**.
- Nelle liste:
  - la principale mostra l'icona link con d/n (rosa; verde quando sono tutte fatte);
  - la collegata mostra la chip rosa "per: <titolo principale>" (+N se le principali sono più di una).

**Completamento e tabella Completi**:
- Spuntare una task la sposta nella tabella **Completi**, ordinata per `completed_at` decrescente.
- Mostra le ultime 10, poi "Mostra tutte".
- Colonne: ✓ (toglierla riapre la task) · Task (barrata) · Azienda/cartella · Priorità · Scadenza · **Completata il** ("Oggi, 15:25", "3 nov, 20:25") · **Esito** ("In tempo" verde, oppure "N gg di ritardo" rosso, confrontando la data di completamento con la scadenza).
- Ogni completamento, eliminazione o spostamento mostra un **toast con "Annulla"** (7 secondi).

---

## Interazioni globali

- Scorciatoie (disattivate mentre si scrive): N nuova task · / cerca · H Home · C Calendario · S In scadenza · A Aziende · B Board · L Lista · Esc chiude.
- Drag & drop ovunque con @dnd-kit:
  - task → colonna (stato);
  - task → giorno (scadenza);
  - task → azienda o cartella (spostamento).

  Evidenzia il target con un bordo tratteggiato rosa.
- **Optimistic update** su ogni mutazione, con rollback e toast d'errore se Supabase fallisce.
- **Realtime**: le modifiche da un altro dispositivo compaiono senza ricaricare la pagina.
- Stato della sync nella sidebar: Sincronizzato / Sincronizzo… / Offline (le modifiche vengono messe in coda).
- Le preferenze UI (ultima vista, cartelle espanse, raggruppamento) restano in localStorage tramite Zustand persist.
- Stati vuoti curati ovunque. Nessuna schermata bianca durante il caricamento: usa skeleton.

---

## Seed "Carica esempi"

- **Pasta Monesi** `#ffe08a`, cartelle "Social novembre" e "Sito e-commerce". Task:
  - Piano editoriale settimana prossima (P2, oggi, in corso, checklist 1/2);
  - Carosello formati di pasta (P3, +2 giorni);
  - Aggiornare spedizioni festive nel footer (P1, ieri: in ritardo);
  - Ottimizzare immagini prodotti (P5, +8 giorni).
- **Belelli** `#12b76a`, cartelle "Campagna" e "Video". Task:
  - Locandina evento (P1, domani 12:00, in revisione);
  - Reel presentazione prodotto (P2, +3 giorni);
  - **Call con il cliente per promo gennaio** (P3, +4 giorni 15:30), con 3 collegate:
    - Preparare slide della proposta promo (P2, +3 giorni, in corso);
    - Inviare invito Google Meet (P3, fatta);
    - Raccogliere loghi partner in alta risoluzione (P4, +2 giorni).
- **Hybrix** `#1d3fae`, cartelle "Lancio" e "Materiale stampa". Task:
  - Brochure prodotti (P2, +6 giorni, in corso);
  - Video di lancio (P3, +9 giorni);
  - Post annuncio lancio (P3, fatta 3 giorni fa);
  - Comunicato stampa (P2, +12 giorni).

Le date sono relative al giorno in cui si caricano gli esempi.

---

## Struttura del progetto

```
src/
  app/            router, providers (QueryClient, Supabase, Toaster), layout con Sidebar e TopBar
  routes/         home, calendario, scadenze, aziende, aziende.$id, board, lista, impostazioni, login
  features/
    tasks/        api (query + mutation), hooks, TaskModal, TaskRow, TaskCard, LinkedTasks, CompletedTable
    companies/    api, CompanyCard, CompanyDashboard, CompanyProfile, ProfileModal
    calendar/     MonthGrid, DayCell, DayModal, PlanningPanel
    deadlines/    DeadlineList (raggruppamento puro e testato)
    settings/
  components/ui/  Button, Chip, Pill, Modal, Toast, Segmented, Checkbox, Skeleton
  lib/            supabase.ts, dates.ts (fmtDue, raggruppamenti, giorni di ritardo), priority.ts, colors.ts, cycles.ts
  stores/ui.ts    Zustand
  styles/         tokens.css, index.css
supabase/migrations/   schema, RLS, trigger
```

Separa la logica pura (date, raggruppamenti, cicli, esito, statistiche azienda) in `lib/` con **test unitari**.

---

## Fasi di lavoro

1. **Setup**: Vite + React + TS strict, Tailwind v4 con i token, ESLint + Prettier, Vitest, alias `@/`, font self-hosted. Client Supabase da `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), più `.env.example`.
2. **Database**: migrazioni (schema, indici, RLS, trigger `updated_at`, `completed_at` e anti-ciclo), generazione dei tipi, funzione di seed.
3. **Shell**: login (magic link e Google), layout con sidebar, top bar e routing, toast, modale base, scorciatoie.
4. **Dati**: hook TanStack Query per companies, folders, tasks e task_links con optimistic update e sottoscrizione Realtime.
5. **Home**: calendario, In scadenza, card aziende, Completi.
6. **Task**: modale completa, checklist, collegate con tutte le regole, toast "Annulla".
7. **Pannello azienda** e **Scheda azienda**.
8. **Calendario completo, Board, Lista, In scadenza, Aziende, Impostazioni** (con backup JSON).
9. **Drag & drop** su tutti i target.
10. **Rifinitura**:
    - stati vuoti, skeleton, accessibilità da tastiera;
    - code-splitting per route;
    - virtualizzazione delle liste lunghe;
    - Lighthouse ≥ 95 su Performance e Accessibilità;
    - test Playwright: crea una task → completala → appare in Completi con l'esito; collega 3 task → completa la principale → compare la modale; trascina una task su un altro giorno.
11. **Deploy**: `vercel.json` con rewrite SPA, README con setup Supabase e Vercel.

---

## Criteri di accettazione

- Il risultato è visivamente e funzionalmente equivalente a `gestionale-lavoro.html`.
- `npm run typecheck`, `npm run lint` e `npm test` passano senza errori.
- Due browser con lo stesso account si aggiornano a vicenda in tempo reale.
- Nessuna query restituisce dati di un altro utente (RLS verificata).
- Spunta, drag e modifica sono istantanei (optimistic) anche con 1.000 task.
