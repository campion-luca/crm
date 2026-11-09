import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, ConfirmButton } from '@/components/ui/Button'
import { Module } from '@/components/ui/Module'
import { useData, useSaveSettings, useSettings, useSyncStatus } from '@/data/queries'
import type { CalendarColorBy, HorizonDays } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { signOut, useAuth } from '@/app/authContext'
import { ColorSwatches } from '@/features/companies/CompanyModal'
import { useCompanyActions } from '@/features/companies/actions'
import { Avatar } from '@/features/companies/CompanyCard'
import { useDataActions } from '@/features/settings/actions'

function Row({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-[18px] py-3 last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="font-semibold">{title}</b>
        {hint && <span className="text-xs text-ink-3">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

const SYNC_TEXT = {
  local: 'Dati salvati solo in questo browser (modalità locale, senza account)',
  syncing: 'Sincronizzazione in corso',
  synced: 'Sincronizzati sul tuo account',
  offline: 'Offline: le modifiche restano in coda e partono appena torna la rete',
} as const

export function SettingsPage() {
  const view = useData()
  const settings = useSettings()
  const saveSettings = useSaveSettings()
  const { setColor } = useCompanyActions()
  const { loadSamples, wipeAll } = useDataActions()
  const sync = useSyncStatus()
  const auth = useAuth()

  return (
    <div className="flex max-w-[820px] flex-col gap-[18px]">
      <Module
        title="Aziende"
        right={
          <Button onClick={() => openModal({ kind: 'company' })}>
            <Plus /> Nuova azienda
          </Button>
        }
      >
        {view.companies.length ? (
          view.companies.map((c) => (
            <div key={c.id} style={{ '--c': c.color } as React.CSSProperties}>
              <Row
                title={
                  <span className="flex items-center gap-2.5">
                    <Avatar name={c.name} logo={c.brand.avatar} size="sm" />
                    {c.name}
                  </span>
                }
              >
                <ColorSwatches
                  size="sm"
                  value={c.color}
                  onChange={(col) => setColor(c.id, col)}
                  label={`Colore di ${c.name}`}
                />
                <Button variant="ghost" onClick={() => openModal({ kind: 'company', companyId: c.id })}>
                  Modifica
                </Button>
              </Row>
            </div>
          ))
        ) : (
          <Row title={<span className="text-xs font-normal text-ink-3">Nessuna azienda.</span>} />
        )}
      </Module>

      <Module title="Preferenze">
        <Row title="Colori del calendario" hint="Come colorare i lavori nel calendario">
          <select
            className="select"
            aria-label="Colori del calendario"
            value={settings.calendar_color_by}
            onChange={(e) => saveSettings({ calendar_color_by: e.target.value as CalendarColorBy })}
          >
            <option value="company">Per azienda</option>
            <option value="priority">Per priorità</option>
          </select>
        </Row>
        <Row title="Orizzonte scadenze" hint="Quanti giorni mostrare nel modulo In scadenza">
          <select
            className="select"
            aria-label="Orizzonte scadenze"
            value={settings.horizon_days}
            onChange={(e) => saveSettings({ horizon_days: Number(e.target.value) as HorizonDays })}
          >
            {[7, 14, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} giorni
              </option>
            ))}
          </select>
        </Row>
        <Row title="Lavori completati" hint="Mostrali in board, lista e calendario">
          <select
            className="select"
            aria-label="Lavori completati"
            value={settings.show_done ? '1' : '0'}
            onChange={(e) => saveSettings({ show_done: e.target.value === '1' })}
          >
            <option value="1">Mostra</option>
            <option value="0">Nascondi</option>
          </select>
        </Row>
        <Row
          title="Ore disponibili al giorno"
          hint="Usate nel calendario per confrontare il tempo stimato del giorno"
        >
          <HoursInput value={settings.available_hours} onSave={(h) => saveSettings({ available_hours: h })} />
        </Row>
      </Module>

      <Module title="Dati">
        <Row title="Salvataggio" hint={SYNC_TEXT[sync.state]} />
        <Row title="Backup e ripristino" hint="Esporta i dati in JSON o ripristinali da un backup">
          <Button onClick={() => openModal({ kind: 'backup' })}>Apri</Button>
        </Row>
        <Row title="Dati di esempio" hint="Aggiunge tre aziende di prova per vedere come funziona">
          <Button onClick={() => loadSamples()}>Carica esempi</Button>
        </Row>
        <Row
          title="Svuota tutto"
          hint="Elimina aziende, cartelle e lavori (puoi annullare per qualche secondo)"
        >
          <ConfirmButton onConfirm={wipeAll}>Svuota</ConfirmButton>
        </Row>
        {auth.mode === 'supabase' && (
          <>
            <Row title="Password" hint="Per entrare con email e password, oltre che con il link via email">
              <Button onClick={() => openModal({ kind: 'password' })}>Imposta password</Button>
            </Row>
            <Row title="Account" hint={auth.user?.email ?? undefined}>
              <Button onClick={() => void signOut(auth.user?.id)}>Esci</Button>
            </Row>
          </>
        )}
      </Module>
    </div>
  )
}

function HoursInput({ value, onSave }: { value: number; onSave: (h: number) => void }) {
  const [text, setText] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    setText(String(value))
  }
  const commit = () => {
    const h = Math.min(24, Math.max(0, Number(text.replace(',', '.'))))
    if (Number.isFinite(h) && h !== value) onSave(Math.round(h * 2) / 2)
    else setText(String(value))
  }
  return (
    <input
      type="number"
      min={0}
      max={24}
      step={0.5}
      inputMode="decimal"
      aria-label="Ore disponibili al giorno"
      className="input w-24 num"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
    />
  )
}
