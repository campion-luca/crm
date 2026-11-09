import { Chip } from '@/components/ui/Chip'
import { Module } from '@/components/ui/Module'
import { useData, useSaveSettings, useSettings } from '@/data/queries'
import { inScope } from '@/lib/filters'
import { HORIZONS } from '@/lib/types'
import { useUi } from '@/stores/ui'
import { DeadlineList } from '@/features/deadlines/DeadlineList'

export function DeadlinesPage() {
  const view = useData()
  const settings = useSettings()
  const saveSettings = useSaveSettings()
  const scope = useUi((s) => s.scope)
  const open = view.tasks.filter((t) => t.status !== 'done' && inScope(t, scope))

  return (
    <div className="flex max-w-[820px] flex-col gap-[18px]">
      <div>
        <p className="m-0 text-ink-2">Tutto quello che scade, dal più urgente.</p>
        <div className="mt-2.5 flex flex-wrap gap-[5px]" role="group" aria-label="Orizzonte">
          {HORIZONS.map((n) => (
            <Chip key={n} on={settings.horizon_days === n} onClick={() => saveSettings({ horizon_days: n })}>
              {n} giorni
            </Chip>
          ))}
        </div>
      </div>
      <Module>
        <DeadlineList tasks={open} horizon={settings.horizon_days} />
      </Module>
    </div>
  )
}
