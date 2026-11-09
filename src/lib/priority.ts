import type { Priority, TaskStatus } from './types'

export interface PrioDef {
  id: Priority
  label: string
  name: string
  color: string
}

// 1 = più urgente, 5 = meno urgente
export const PRIOS: PrioDef[] = [
  { id: 1, label: 'P1', name: 'Massima', color: '#ff5d73' },
  { id: 2, label: 'P2', name: 'Alta', color: '#ff9f43' },
  { id: 3, label: 'P3', name: 'Media', color: '#ffd166' },
  { id: 4, label: 'P4', name: 'Bassa', color: '#5ec8ff' },
  { id: 5, label: 'P5', name: 'Minima', color: '#8e8e99' },
]

export function toPriority(v: unknown): Priority {
  const n = Math.round(Number(v))
  return (n >= 1 && n <= 5 ? n : 3) as Priority
}

export const prio = (p: number): PrioDef => PRIOS[toPriority(p) - 1]!

export interface StatusDef {
  id: TaskStatus
  label: string
  color: string
}

export const STATI: StatusDef[] = [
  { id: 'todo', label: 'Da fare', color: '#9c9ab0' },
  { id: 'doing', label: 'In corso', color: '#6c4cf5' },
  { id: 'review', label: 'In revisione', color: '#f59e0b' },
  { id: 'done', label: 'Fatto', color: '#16b364' },
]

export const statusDef = (s: string): StatusDef => STATI.find((x) => x.id === s) ?? STATI[0]!

export const isTaskStatus = (s: unknown): s is TaskStatus => STATI.some((x) => x.id === s)
