export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      parents: {
        Row: {
          id: string
          full_name: string
          phone: string
          created_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone: string
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string
          created_at?: string
        }
        Relationships: []
      }
      children: {
        Row: {
          id: string
          parent_id: string
          full_name: string
          birth_date: string
          allergies: string | null
          medical_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          parent_id: string
          full_name: string
          birth_date: string
          allergies?: string | null
          medical_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          full_name?: string
          birth_date?: string
          allergies?: string | null
          medical_notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'children_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'parents'
            referencedColumns: ['id']
          }
        ]
      }
      attendance: {
        Row: {
          id: string
          child_id: string
          session_date: string
          team_color: 'rojo' | 'amarillo' | 'azul'
          category: 'corderitos' | 'hormiguitas' | 'saltamontes' | 'exploradores'
          badge_number: number | null
          pager_number: number | null
          checked_in_at: string
          checked_out_at: string | null
        }
        Insert: {
          id?: string
          child_id: string
          session_date?: string
          team_color: 'rojo' | 'amarillo' | 'azul'
          category: 'corderitos' | 'hormiguitas' | 'saltamontes' | 'exploradores'
          badge_number?: number | null
          pager_number?: number | null
          checked_in_at?: string
          checked_out_at?: string | null
        }
        Update: {
          id?: string
          child_id?: string
          session_date?: string
          team_color?: 'rojo' | 'amarillo' | 'azul'
          category?: 'corderitos' | 'hormiguitas' | 'saltamontes' | 'exploradores'
          badge_number?: number | null
          pager_number?: number | null
          checked_in_at?: string
          checked_out_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_child_id_fkey'
            columns: ['child_id']
            referencedRelation: 'children'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
