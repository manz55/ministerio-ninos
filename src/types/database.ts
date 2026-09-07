export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          assigned_teacher_id: string | null
          badge_number: number | null
          category: string
          checked_in_at: string
          checked_out_at: string | null
          child_id: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          pager_number: number | null
          session_date: string
          team_color: string
        }
        Insert: {
          assigned_teacher_id?: string | null
          badge_number?: number | null
          category: string
          checked_in_at?: string
          checked_out_at?: string | null
          child_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          pager_number?: number | null
          session_date?: string
          team_color: string
        }
        Update: {
          assigned_teacher_id?: string | null
          badge_number?: number | null
          category?: string
          checked_in_at?: string
          checked_out_at?: string | null
          child_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          pager_number?: number | null
          session_date?: string
          team_color?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_assigned_teacher_id_fkey"
            columns: ["assigned_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      child_contacts: {
        Row: {
          child_id: string
          created_at: string
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          relationship: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          relationship?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_contacts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          allergies: string | null
          birth_date: string | null
          category: string | null
          comments: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          full_name: string
          guardian_relationship: string | null
          id: string
          medical_notes: string | null
          parent_id: string | null
          photo_url: string | null
          toilet_trained: boolean | null
        }
        Insert: {
          allergies?: string | null
          birth_date?: string | null
          category?: string | null
          comments?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name: string
          guardian_relationship?: string | null
          id?: string
          medical_notes?: string | null
          parent_id?: string | null
          photo_url?: string | null
          toilet_trained?: boolean | null
        }
        Update: {
          allergies?: string | null
          birth_date?: string | null
          category?: string | null
          comments?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string
          guardian_relationship?: string | null
          id?: string
          medical_notes?: string | null
          parent_id?: string | null
          photo_url?: string | null
          toilet_trained?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "children_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinator_requests: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          seen_by_author: boolean
          status: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          seen_by_author?: boolean
          status?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          seen_by_author?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_requests_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_computer_operator: {
        Row: {
          name: string
          session_date: string
          set_by: string | null
          updated_at: string
        }
        Insert: {
          name: string
          session_date: string
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          name?: string
          session_date?: string
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_computer_operator_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_coordinator: {
        Row: {
          name: string
          session_date: string
          set_by: string | null
          updated_at: string
        }
        Insert: {
          name: string
          session_date: string
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          name?: string
          session_date?: string
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_coordinator_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_log: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          id: string
          record_data: Json
          record_id: string
          table_name: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          record_data: Json
          record_id: string
          table_name: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          record_data?: Json
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_log_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inscripciones: {
        Row: {
          acompanantes: string | null
          comprobante_url: string | null
          cupos: number | null
          digitos_autorizacion: string | null
          estado: string | null
          estado_pago: string | null
          id: number
          metodo_pago: string | null
          responsable: string
          telefono: string
          ticket: string | null
          total: number | null
          ultimos_4_digitos: string | null
        }
        Insert: {
          acompanantes?: string | null
          comprobante_url?: string | null
          cupos?: number | null
          digitos_autorizacion?: string | null
          estado?: string | null
          estado_pago?: string | null
          id?: number
          metodo_pago?: string | null
          responsable: string
          telefono: string
          ticket?: string | null
          total?: number | null
          ultimos_4_digitos?: string | null
        }
        Update: {
          acompanantes?: string | null
          comprobante_url?: string | null
          cupos?: number | null
          digitos_autorizacion?: string | null
          estado?: string | null
          estado_pago?: string | null
          id?: number
          metodo_pago?: string | null
          responsable?: string
          telefono?: string
          ticket?: string | null
          total?: number | null
          ultimos_4_digitos?: string | null
        }
        Relationships: []
      }
      maestros: {
        Row: {
          apellido: string
          bautizado_aguas: boolean | null
          bautizado_espiritu: boolean | null
          celular: string | null
          created_at: string
          discipulador: string | null
          dpi: string | null
          fecha_nacimiento: string | null
          id: string
          nombre: string
          photo_url: string | null
          profesion: string | null
          team_color: string
          tiempo_asistencia: string | null
        }
        Insert: {
          apellido: string
          bautizado_aguas?: boolean | null
          bautizado_espiritu?: boolean | null
          celular?: string | null
          created_at?: string
          discipulador?: string | null
          dpi?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre: string
          photo_url?: string | null
          profesion?: string | null
          team_color?: string
          tiempo_asistencia?: string | null
        }
        Update: {
          apellido?: string
          bautizado_aguas?: boolean | null
          bautizado_espiritu?: boolean | null
          celular?: string | null
          created_at?: string
          discipulador?: string | null
          dpi?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          photo_url?: string | null
          profesion?: string | null
          team_color?: string
          tiempo_asistencia?: string | null
        }
        Relationships: []
      }
      parents: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_owner: boolean
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_owner?: boolean
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_owner?: boolean
          role?: string
        }
        Relationships: []
      }
      shift_notes: {
        Row: {
          author_id: string | null
          child_id: string | null
          created_at: string
          id: string
          note: string
          session_date: string
          team_color: string | null
        }
        Insert: {
          author_id?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          note: string
          session_date?: string
          team_color?: string | null
        }
        Update: {
          author_id?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          note?: string
          session_date?: string
          team_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_attendance_teacher: {
        Args: { p_attendance_id: string; p_teacher_id: string | null }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      set_daily_computer_operator: {
        Args: { p_name: string; p_session_date: string }
        Returns: undefined
      }
      set_daily_coordinator: {
        Args: { p_name: string; p_session_date: string }
        Returns: undefined
      }
      sync_child_category: {
        Args: { p_category: string; p_child_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
