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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_config: {
        Row: {
          auto_escalate_enabled: boolean | null
          auto_escalate_threshold: number | null
          collect_email_enabled: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          max_call_duration: number | null
          profanity_filter: string | null
          prompt_version: string
          send_summary_enabled: boolean | null
          system_prompt: string
          troll_detection_enabled: boolean | null
          voice_clarity: number | null
          voice_id: string | null
          voice_speed: number | null
          voice_stability: number | null
        }
        Insert: {
          auto_escalate_enabled?: boolean | null
          auto_escalate_threshold?: number | null
          collect_email_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          max_call_duration?: number | null
          profanity_filter?: string | null
          prompt_version: string
          send_summary_enabled?: boolean | null
          system_prompt: string
          troll_detection_enabled?: boolean | null
          voice_clarity?: number | null
          voice_id?: string | null
          voice_speed?: number | null
          voice_stability?: number | null
        }
        Update: {
          auto_escalate_enabled?: boolean | null
          auto_escalate_threshold?: number | null
          collect_email_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          max_call_duration?: number | null
          profanity_filter?: string | null
          prompt_version?: string
          send_summary_enabled?: boolean | null
          system_prompt?: string
          troll_detection_enabled?: boolean | null
          voice_clarity?: number | null
          voice_id?: string | null
          voice_speed?: number | null
          voice_stability?: number | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          created_at: string | null
          duration: number | null
          id: string
          phone_number: string | null
          sentiment: string | null
          topics: string[] | null
          transcript: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          id?: string
          phone_number?: string | null
          sentiment?: string | null
          topics?: string[] | null
          transcript?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          id?: string
          phone_number?: string | null
          sentiment?: string | null
          topics?: string[] | null
          transcript?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          number: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          number: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          number?: string
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          config_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          system_prompt: string
          version_number: number
        }
        Insert: {
          config_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          system_prompt: string
          version_number: number
        }
        Update: {
          config_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          system_prompt?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "ai_config"
            referencedColumns: ["id"]
          },
        ]
      }
      response_templates: {
        Row: {
          config_id: string | null
          content: string
          created_at: string | null
          id: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          config_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          config_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "response_templates_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "ai_config"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_version_number: {
        Args: { p_config_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "team_member"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "team_member"],
    },
  },
} as const
