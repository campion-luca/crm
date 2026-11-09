import { useRouterState } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useData, useSaveSettings, useSettings } from '@/data/queries'
import { inScope, summaryCounts } from '@/lib/filters'
import { cn } from '@/lib/format'
import { useToday } from '@/lib/hooks'
import { PRIOS } from '@/lib/priority'
import type { DueFilter, ListGroup } from '@/lib/types'
import { useUi } from '@/stores/ui'
import { useTaskFilters } from './useTaskFilters'

/** Toolbar filtri (Board, Lista, Calendario): ricerca, priorità, raggruppa, mostra completati, azzera. */
export function Toolbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { q, prio, due, set, clear } = useTaskFilters()
  const { show_done } = useSettings()
  const saveSettings = useSaveSettings()
  const listGroup = useUi((s) => s.listGroup)
  const setListGroup = useUi((s) => s.setListGroup)
  // input locale: la URL si aggiorna a ogni tasto senza perdere il cursore
  const [text, setText] = useState(q)
  const [prevQ, setPrevQ] = useState(q)
  if (q !== prevQ) {
    setPrevQ(q)
    setText(q)
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-[22px] py-2.5 mobile:gap-2 mobile:px-4">
      <label className="flex h-8 w-[210px] items-center gap-[7px] rounded-[7px] border border-line bg-surface px-2.5 text-ink-3 focus-within:border-accent mobile:w-full">
        <Search className="size-[15px] shrink-0" aria-hidden />
        <input
          id="gl-search"
          type="search"
          aria-label="Cerca"
          placeholder="Cerca lavori, note, aziende…"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            set({ q: e.target.value || undefined })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setText('')
              set({ q: undefined })
              e.currentTarget.blur()
            }
          }}
          className="w-full border-0 bg-transparent text-ink outline-none placeholder:text-ink-3"
        />
      </label>
      <div className="ml-auto flex flex-wrap items-center gap-2 mobile:ml-0">
        <select
          className="select"
          aria-label="Priorità"
          value={prio ?? ''}
          onChange={(e) => set({ prio: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Tutte le priorità</option>
          {PRIOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} · {p.name}
            </option>
          ))}
        </select>
        {pathname === '/lista' && (
          <select
            className="select"
            aria-label="Raggruppa"
            value={listGroup}
            onChange={(e) => setListGroup(e.target.value as ListGroup)}
          >
            <option value="priority">Raggruppa: priorità</option>
            <option value="company">Raggruppa: azienda</option>
            <option value="status">Raggruppa: stato</option>
          </select>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-ink-2 select-none">
          <input
            type="checkbox"
            checked={show_done}
            onChange={(e) => saveSettings({ show_done: e.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          Mostra completati
        </label>
        {(prio || q || due) && (
          <Button
            variant="ghost"
            onClick={() => {
              setText('')
              clear()
            }}
          >
            Azzera filtri
          </Button>
        )}
      </div>
    </div>
  )
}

const TILES: { id: DueFilter; label: string; color: string }[] = [
  { id: 'over', label: 'In ritardo', color: 'var(--danger)' },
  { id: 'today', label: 'Scadono oggi', color: 'var(--warn)' },
  { id: 'week', label: 'Prossimi 7 giorni', color: 'var(--accent)' },
  { id: 'doing', label: 'In corso', color: 'var(--ok)' },
]

/** Riepilogo: 4 tile cliccabili che filtrano la vista. */
export function Summary() {
  const view = useData()
  const scope = useUi((s) => s.scope)
  const today = useToday()
  const { due, set } = useTaskFilters()
  const counts = summaryCounts(
    view.tasks.filter((t) => inScope(t, scope)),
    today,
  )
  return (
    // su telefono: una riga che scorre in orizzontale invece di due righe di tile
    <div className="grid grid-cols-4 gap-2.5 px-[22px] pt-3.5 pb-1 mobile:flex mobile:[scrollbar-width:none] mobile:gap-2 mobile:overflow-x-auto mobile:px-4 mobile:pt-2.5">
      {TILES.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={due === t.id}
          title="Filtra"
          onClick={() => set({ due: due === t.id ? undefined : t.id })}
          className={cn(
            'flex items-center gap-3 rounded-ctl border bg-surface px-3.5 py-2.5 text-left transition-colors mobile:shrink-0 mobile:gap-2 mobile:px-3 mobile:py-2',
            due === t.id
              ? 'border-accent shadow-[inset_0_0_0_1px_var(--accent)]'
              : 'border-line hover:border-ink-3',
          )}
        >
          <span className="w-1 self-stretch rounded-[3px]" style={{ background: t.color }} aria-hidden />
          <span className="num text-[22px] leading-none font-medium mobile:text-lg">{counts[t.id]}</span>
          <span className="text-[12.5px] whitespace-nowrap text-ink-2">{t.label}</span>
        </button>
      ))}
    </div>
  )
}
