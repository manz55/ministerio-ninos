import { supabase } from './supabase'
import type { UserRole } from '../types/domain'

type AdminUsersResponse = { ok?: true; id?: string; error?: string }

async function callAdminUsers(body: Record<string, unknown>): Promise<AdminUsersResponse> {
  const { data, error } = await supabase.functions.invoke<AdminUsersResponse>('admin-users', { body })
  if (error) return { error: error.message }
  return data ?? { error: 'Sin respuesta del servidor' }
}

export function createUser(email: string, password: string, full_name: string, role: UserRole) {
  return callAdminUsers({ action: 'create', email, password, full_name, role })
}

export function updateUserRole(user_id: string, role: UserRole) {
  return callAdminUsers({ action: 'update-role', user_id, role })
}

export function setUserActive(user_id: string, active: boolean) {
  return callAdminUsers({ action: 'set-active', user_id, active })
}

export function deleteUser(user_id: string) {
  return callAdminUsers({ action: 'delete', user_id })
}
