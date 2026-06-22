import type { Industry } from '../types'

const REGISTRY_KEY = 'syodan_program_registry'
const CURRENT_PROGRAM_KEY = 'syodan_current_program_id'

export type ProgramRegistryEntry = {
  id: string
  industry: Industry
  sub_industry: string
  time_limit_minutes: number
}

export function loadRegistry(): ProgramRegistryEntry[] {
  const raw = localStorage.getItem(REGISTRY_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as ProgramRegistryEntry[]
  } catch {
    localStorage.removeItem(REGISTRY_KEY)
    return []
  }
}

export function saveRegistry(entries: ProgramRegistryEntry[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries))
}

export function addRegistryEntry(entry: ProgramRegistryEntry): void {
  const entries = loadRegistry().filter((e) => e.id !== entry.id)
  saveRegistry([...entries, entry])
}

export function getCurrentProgramId(): string | null {
  return localStorage.getItem(CURRENT_PROGRAM_KEY)
}

export function setCurrentProgramId(id: string): void {
  localStorage.setItem(CURRENT_PROGRAM_KEY, id)
}

export function findRegistryEntry(programId: string): ProgramRegistryEntry | undefined {
  return loadRegistry().find((e) => e.id === programId)
}

export function clearLocalData(): void {
  localStorage.removeItem(REGISTRY_KEY)
  localStorage.removeItem(CURRENT_PROGRAM_KEY)
}
