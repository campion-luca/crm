// Generato da `supabase gen types typescript` (rigenera con `npm run gen:types` dopo `supabase link`).
// Allineato alle migrazioni in supabase/migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5'
  }
  public: {
    Tables: {
      companies: {
        Row: {
          brand: Json
          color: string
          created_at: string
          id: string
          name: string
          position: number
          profile: Json
          user_id: string
        }
        Insert: {
          brand?: Json
          color: string
          created_at?: string
          id?: string
          name: string
          position?: number
          profile?: Json
          user_id?: string
        }
        Update: {
          brand?: Json
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          profile?: Json
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'folders_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      task_links: {
        Row: {
          child_id: string
          parent_id: string
          user_id: string
        }
        Insert: {
          child_id: string
          parent_id: string
          user_id?: string
        }
        Update: {
          child_id?: string
          parent_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_links_child_id_fkey'
            columns: ['child_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_links_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          checklist: Json
          company_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          due_time: string | null
          estimate_min: number
          folder_id: string | null
          id: string
          link: string
          notes: string
          priority: number
          status: Database['public']['Enums']['task_status']
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist?: Json
          company_id: string
          completed_at?: string | null
          created_at?: string
          due_date: string
          due_time?: string | null
          estimate_min?: number
          folder_id?: string | null
          id?: string
          link?: string
          notes?: string
          priority?: number
          status?: Database['public']['Enums']['task_status']
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          checklist?: Json
          company_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          due_time?: string | null
          estimate_min?: number
          folder_id?: string | null
          id?: string
          link?: string
          notes?: string
          priority?: number
          status?: Database['public']['Enums']['task_status']
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_folder_id_fkey'
            columns: ['folder_id']
            isOneToOne: false
            referencedRelation: 'folders'
            referencedColumns: ['id']
          },
        ]
      }
      user_settings: {
        Row: {
          available_hours: number
          calendar_color_by: string
          horizon_days: number
          show_done: boolean
          user_id: string
        }
        Insert: {
          available_hours?: number
          calendar_color_by?: string
          horizon_days?: number
          show_done?: boolean
          user_id?: string
        }
        Update: {
          available_hours?: number
          calendar_color_by?: string
          horizon_days?: number
          show_done?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_changes: {
        Args: { changes: Json }
        Returns: undefined
      }
    }
    Enums: {
      task_status: 'todo' | 'doing' | 'review' | 'done'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      task_status: ['todo', 'doing', 'review', 'done'],
    },
  },
} as const
