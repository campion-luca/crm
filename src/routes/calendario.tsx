import { useData, useSaveSettings, useSettings } from '@/data/queries'
import type { CalendarColorBy } from '@/lib/types'
import { useUi } from '@/stores/ui'
import { useFilteredTasks } from '@/app/useTaskFilters'
import { MonthGrid } from '@/features/calendar/MonthGrid'
import { PlanningPanel } from '@/features/calendar/PlanningPanel'

/** Calendario completo: max 3 eventi per cella, giorno selezionato a destra e "Da pianificare". */
export function CalendarPage() {
  const view = useData()
  const settings = useSettings()
  const saveSettings = useSaveSettings()
  const scope = useUi((s) => s.scope)
  const calDay = useUi((s) => s.calDay)
  const selectDay = useUi((s) => s.selectDay)
  const tasks = useFilteredTasks({ ignoreDue: true })
  const colorBy = settings.calendar_color_by
  const legend = scope.companyId ? view.companies.filter((c) => c.id === scope.companyId) : view.companies

  return (
    <div className="grid h-full min-h-[560px] grid-cols-[minmax(0,1fr)_290px] gap-4 mobile:h-auto mobile:grid-cols-1">
      <MonthGrid
        className="rounded-card border border-line"
        tasks={tasks}
        companies={view.companyById}
        colorBy={colorBy}
        legendCompanies={legend}
        selectedDay={calDay}
        onDayClick={selectDay}
        extra={
          <select
            className="select ml-2"
            aria-label="Colora per"
            value={colorBy}
            onChange={(e) => saveSettings({ calendar_color_by: e.target.value as CalendarColorBy })}
          >
            <option value="company">Colori: azienda</option>
            <option value="priority">Colori: priorità</option>
          </select>
        }
      />
      <PlanningPanel
        day={calDay}
        tasks={tasks}
        view={view}
        colorBy={colorBy}
        availableHours={settings.available_hours}
      />
    </div>
  )
}
