import {
  addDaysISO,
  capitalize,
  diffDaysISO,
  fmtDayMonth,
  fmtDone,
  fmtDue,
  fmtLongDate,
  fmtMonthYear,
  fmtPanelDate,
  fmtShortDate,
  fmtTime,
  greeting,
  isWeekend,
  lateDays,
  monthGrid,
  monthOf,
  parseDate,
  shiftMonth,
  toISODate,
  todayISO,
} from './dates'

// 2026-11-06 è un venerdì
const TODAY = '2026-11-06'
const NOW = new Date(2026, 10, 6, 15, 25)
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

describe('basic ISO helpers', () => {
  it('toISODate / todayISO use local calendar date', () => {
    expect(toISODate(new Date(2026, 10, 6, 0, 0))).toBe('2026-11-06')
    expect(toISODate(new Date(2026, 10, 6, 23, 59))).toBe('2026-11-06')
    expect(todayISO(NOW)).toBe(TODAY)
  })

  it('parseDate returns local midnight', () => {
    const d = parseDate(TODAY)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 10, 6, 0, 0,
    ])
  })

  it('addDaysISO crosses month and year boundaries', () => {
    expect(addDaysISO(TODAY, 1)).toBe('2026-11-07')
    expect(addDaysISO(TODAY, -6)).toBe('2026-10-31')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO(TODAY, 0)).toBe(TODAY)
  })

  it('addDaysISO is not affected by DST changes', () => {
    // fine ora legale in Europa: 25 ottobre 2026
    expect(addDaysISO('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDaysISO('2026-03-28', 2)).toBe('2026-03-30')
  })

  it('diffDaysISO counts calendar days (a - b)', () => {
    expect(diffDaysISO('2026-11-10', TODAY)).toBe(4)
    expect(diffDaysISO(TODAY, '2026-11-10')).toBe(-4)
    expect(diffDaysISO(TODAY, TODAY)).toBe(0)
    expect(diffDaysISO('2026-10-26', '2026-10-24')).toBe(2)
  })

  it('capitalize', () => {
    expect(capitalize('venerdì')).toBe('Venerdì')
    expect(capitalize('')).toBe('')
  })

  it('fmtTime trims seconds and tolerates empty values', () => {
    expect(fmtTime('15:30:00')).toBe('15:30')
    expect(fmtTime('09:05')).toBe('09:05')
    expect(fmtTime(null)).toBe('')
    expect(fmtTime(undefined)).toBe('')
    expect(fmtTime('')).toBe('')
  })

  it('monthOf', () => {
    expect(monthOf('2026-11-06')).toBe('2026-11')
  })
})

describe('fmtDue', () => {
  it('today / tomorrow / yesterday', () => {
    expect(fmtDue(TODAY, null, TODAY)).toBe('Oggi')
    expect(fmtDue('2026-11-07', null, TODAY)).toBe('Domani')
    expect(fmtDue('2026-11-05', null, TODAY)).toBe('Ieri')
  })

  it('appends the time (HH:MM) when present', () => {
    expect(fmtDue('2026-11-07', '12:00', TODAY)).toBe('Domani 12:00')
    expect(fmtDue(TODAY, '15:30:00', TODAY)).toBe('Oggi 15:30')
    expect(fmtDue('2026-11-12', '09:00', TODAY)).toBe('gio 09:00')
    expect(fmtDue('2026-11-20', '09:00', TODAY)).toBe('20 nov 09:00')
  })

  it('uses the Italian weekday abbreviation for 2–6 days ahead', () => {
    expect(fmtDue('2026-11-08', null, TODAY)).toBe('dom')
    expect(fmtDue('2026-11-09', null, TODAY)).toBe('lun')
    expect(fmtDue('2026-11-10', null, TODAY)).toBe('mar')
    expect(fmtDue('2026-11-11', null, TODAY)).toBe('mer')
    expect(fmtDue('2026-11-12', null, TODAY)).toBe('gio')
  })

  it('uses "d MMM" from 7 days ahead and from 2 days ago', () => {
    expect(fmtDue('2026-11-13', null, TODAY)).toBe('13 nov')
    expect(fmtDue('2026-11-04', null, TODAY)).toBe('4 nov')
    expect(fmtDue('2026-12-25', null, TODAY)).toBe('25 dic')
    expect(fmtDue('2027-01-02', null, TODAY)).toBe('2 gen')
  })

  it('empty time is ignored', () => {
    expect(fmtDue(TODAY, '', TODAY)).toBe('Oggi')
    expect(fmtDue(TODAY, undefined, TODAY)).toBe('Oggi')
  })
})

describe('fmtDone', () => {
  it('returns a dash when not completed', () => {
    expect(fmtDone(null, NOW)).toBe('—')
    expect(fmtDone(undefined, NOW)).toBe('—')
    expect(fmtDone('', NOW)).toBe('—')
  })

  it('today and yesterday', () => {
    expect(fmtDone(local(2026, 11, 6, 15, 25), NOW)).toBe('Oggi, 15:25')
    expect(fmtDone(local(2026, 11, 6, 0, 5), NOW)).toBe('Oggi, 00:05')
    expect(fmtDone(local(2026, 11, 5, 20, 25), NOW)).toBe('Ieri, 20:25')
  })

  it('older dates in the same year omit the year', () => {
    expect(fmtDone(local(2026, 11, 3, 20, 25), NOW)).toBe('3 nov, 20:25')
    expect(fmtDone(local(2026, 1, 15, 8, 0), NOW)).toBe('15 gen, 08:00')
  })

  it('dates in another year include the year', () => {
    expect(fmtDone(local(2025, 12, 30, 9, 15), NOW)).toBe('30 dic 2025, 09:15')
  })

  it('future dates (clock skew) are shown as a plain date', () => {
    expect(fmtDone(local(2026, 11, 7, 10, 0), NOW)).toBe('7 nov, 10:00')
  })
})

describe('long/short date formats', () => {
  it('fmtShortDate / fmtDayMonth', () => {
    expect(fmtShortDate('2026-11-12')).toBe('12 nov')
    expect(fmtDayMonth('2026-11-12')).toBe('12 novembre')
  })

  it('fmtLongDate capitalizes the weekday', () => {
    expect(fmtLongDate(NOW)).toBe('Venerdì 6 novembre')
    expect(fmtLongDate(new Date(2026, 10, 9))).toBe('Lunedì 9 novembre')
  })

  it('fmtPanelDate', () => {
    expect(fmtPanelDate(TODAY)).toBe('Ven 6 novembre')
    expect(fmtPanelDate('2026-11-08')).toBe('Dom 8 novembre')
  })

  it('fmtMonthYear', () => {
    expect(fmtMonthYear('2026-11')).toBe('novembre 2026')
    expect(fmtMonthYear('2027-01')).toBe('gennaio 2027')
  })
})

describe('greeting', () => {
  it.each([
    [0, 'Buongiorno'],
    [8, 'Buongiorno'],
    [12, 'Buongiorno'],
    [13, 'Buon pomeriggio'],
    [17, 'Buon pomeriggio'],
    [18, 'Buonasera'],
    [23, 'Buonasera'],
  ])('hour %i → %s', (h, expected) => {
    expect(greeting(h)).toBe(expected)
  })
})

describe('shiftMonth', () => {
  it('moves forward and backward across years', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-11', 0)).toBe('2026-11')
    expect(shiftMonth('2026-11', -13)).toBe('2025-10')
  })
})

describe('monthGrid', () => {
  it.each(['2026-11', '2026-02', '2026-06', '2027-03', '2026-08'])(
    '%s: 42 consecutive days starting on Monday',
    (ym) => {
      const grid = monthGrid(ym)
      expect(grid).toHaveLength(42)
      expect(parseDate(grid[0]!).getDay()).toBe(1)
      expect(parseDate(grid[41]!).getDay()).toBe(0)
      expect(grid).toContain(`${ym}-01`)
      for (let i = 1; i < grid.length; i++) expect(diffDaysISO(grid[i]!, grid[i - 1]!)).toBe(1)
      // l'ultimo giorno del mese è dentro la griglia
      const lastDay = addDaysISO(`${shiftMonth(ym, 1)}-01`, -1)
      expect(grid).toContain(lastDay)
    },
  )

  it('November 2026 starts on Monday 26 October', () => {
    const grid = monthGrid('2026-11')
    expect(grid[0]).toBe('2026-10-26')
    expect(grid[41]).toBe('2026-12-06')
  })

  it('a month starting on Monday starts on its 1st', () => {
    // 1 giugno 2026 è un lunedì
    expect(monthGrid('2026-06')[0]).toBe('2026-06-01')
  })
})

describe('isWeekend', () => {
  it('true only on Saturday and Sunday', () => {
    expect(isWeekend('2026-11-06')).toBe(false) // ven
    expect(isWeekend('2026-11-07')).toBe(true) // sab
    expect(isWeekend('2026-11-08')).toBe(true) // dom
    expect(isWeekend('2026-11-09')).toBe(false) // lun
  })
})

describe('lateDays', () => {
  it('null when not completed', () => {
    expect(lateDays({ due_date: TODAY, completed_at: null })).toBeNull()
  })

  it('0 when completed on the due date (any time of day)', () => {
    expect(lateDays({ due_date: TODAY, completed_at: local(2026, 11, 6, 0, 1) })).toBe(0)
    expect(lateDays({ due_date: TODAY, completed_at: local(2026, 11, 6, 23, 59) })).toBe(0)
  })

  it('positive when late, negative when early', () => {
    expect(lateDays({ due_date: TODAY, completed_at: local(2026, 11, 9, 10, 0) })).toBe(3)
    expect(lateDays({ due_date: TODAY, completed_at: local(2026, 11, 4, 18, 0) })).toBe(-2)
  })

  it('uses the local completion date', () => {
    // 23:30 locale del 6 → stesso giorno, anche se in UTC può essere già il 7 (o ancora il 6)
    expect(lateDays({ due_date: '2026-11-07', completed_at: local(2026, 11, 6, 23, 30) })).toBe(-1)
  })
})
