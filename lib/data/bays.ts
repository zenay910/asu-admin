import { createClient } from '@/lib/supabase/server'
import type { Bay, MachineType } from '@/lib/types/refurbishment'

function mapBay(row: Record<string, unknown>): Bay {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    name: String(row.name),
    machine_type: row.machine_type as MachineType,
    position: Number(row.position),
  }
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export async function listBays(): Promise<Bay[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bays')
    .select('*')
    .order('machine_type', { ascending: true })
    .order('position', { ascending: true })

  throwOnError(error, 'Failed to list bays')
  return (data ?? []).map((row) => mapBay(row as Record<string, unknown>))
}

export async function getBayById(id: string): Promise<Bay | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bays')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch bay')
  if (!data) return null
  return mapBay(data as Record<string, unknown>)
}
