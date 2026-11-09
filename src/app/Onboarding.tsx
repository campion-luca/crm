import { Sparkles, SquarePen } from 'lucide-react'
import { useDataActions } from '@/features/settings/actions'
import { useAuth } from './authContext'

/** Primo accesso: "Inizia da zero" oppure "Carica esempi". */
export function Onboarding() {
  const { completeOnboarding } = useDataActions()
  const auth = useAuth()
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="squircle w-full max-w-[560px] rounded-module border border-t-[3px] border-line border-t-accent bg-surface p-7 shadow-module">
        <div className="mb-5 flex items-center gap-3">
          <div
            aria-hidden
            className="grid size-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6eb4,#ff9a7a)] text-[15px] font-bold text-accent-ink"
          >
            GL
          </div>
          <div>
            <h1 className="m-0 text-xl font-extrabold tracking-[-0.02em]">Benvenuto in Gestionale Lavoro</h1>
            {auth.user?.email && <p className="m-0 text-[13px] text-ink-3">{auth.user.email}</p>}
          </div>
        </div>
        <p className="mt-0 mb-5 text-ink-2">
          Organizza le task per azienda e cartella, con priorità, scadenze, calendario e task collegate. Come
          vuoi partire?
        </p>
        <div className="grid grid-cols-2 gap-3 mobile:grid-cols-1">
          <button
            type="button"
            onClick={() => completeOnboarding(false)}
            className="flex flex-col items-start gap-1.5 rounded-card border border-line bg-surface-2 p-4 text-left transition-colors hover:border-accent"
          >
            <SquarePen className="size-5 text-accent" aria-hidden />
            <b className="text-[15px]">Inizia da zero</b>
            <span className="text-[13px] text-ink-2">Crea la prima azienda e aggiungi le tue task.</span>
          </button>
          <button
            type="button"
            onClick={() => completeOnboarding(true)}
            className="flex flex-col items-start gap-1.5 rounded-card border border-accent bg-accent-soft p-4 text-left transition-colors hover:brightness-110"
          >
            <Sparkles className="size-5 text-accent" aria-hidden />
            <b className="text-[15px]">Carica esempi</b>
            <span className="text-[13px] text-ink-2">
              Tre aziende di prova per vedere come funziona. Le elimini quando vuoi.
            </span>
          </button>
        </div>
      </div>
    </main>
  )
}
