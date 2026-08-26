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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_blocks: {
        Row: {
          adhoc_filters: Json
          adhoc_groupby: Json
          adhoc_metrics: Json
          adhoc_order_desc: boolean
          background_color: string | null
          block_type: string
          body: string | null
          border_color: string | null
          chart_id: number | null
          chart_kind: string
          chart_name: string | null
          container_config: Json
          created_at: string
          dataset_id: number | null
          dataset_name: string | null
          embed_uuid: string | null
          height_px: number
          height_sm_px: number
          hide_on_mobile: boolean
          id: string
          layout: Json
          padding_px: number
          parent_block_id: string | null
          parent_slot: string | null
          position: number
          radius_px: number | null
          render_mode: string
          report_id: string
          row_limit: number
          show_title: boolean
          span_lg: number
          span_md: number
          span_sm: number
          style_config: Json
          title: string | null
          updated_at: string
        }
        Insert: {
          adhoc_filters?: Json
          adhoc_groupby?: Json
          adhoc_metrics?: Json
          adhoc_order_desc?: boolean
          background_color?: string | null
          block_type?: string
          body?: string | null
          border_color?: string | null
          chart_id?: number | null
          chart_kind?: string
          chart_name?: string | null
          container_config?: Json
          created_at?: string
          dataset_id?: number | null
          dataset_name?: string | null
          embed_uuid?: string | null
          height_px?: number
          height_sm_px?: number
          hide_on_mobile?: boolean
          id?: string
          layout?: Json
          padding_px?: number
          parent_block_id?: string | null
          parent_slot?: string | null
          position?: number
          radius_px?: number | null
          render_mode?: string
          report_id: string
          row_limit?: number
          show_title?: boolean
          span_lg?: number
          span_md?: number
          span_sm?: number
          style_config?: Json
          title?: string | null
          updated_at?: string
        }
        Update: {
          adhoc_filters?: Json
          adhoc_groupby?: Json
          adhoc_metrics?: Json
          adhoc_order_desc?: boolean
          background_color?: string | null
          block_type?: string
          body?: string | null
          border_color?: string | null
          chart_id?: number | null
          chart_kind?: string
          chart_name?: string | null
          container_config?: Json
          created_at?: string
          dataset_id?: number | null
          dataset_name?: string | null
          embed_uuid?: string | null
          height_px?: number
          height_sm_px?: number
          hide_on_mobile?: boolean
          id?: string
          layout?: Json
          padding_px?: number
          parent_block_id?: string | null
          parent_slot?: string | null
          position?: number
          radius_px?: number | null
          render_mode?: string
          report_id?: string
          row_limit?: number
          show_title?: boolean
          span_lg?: number
          span_md?: number
          span_sm?: number
          style_config?: Json
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_blocks_parent_block_id_fkey"
            columns: ["parent_block_id"]
            isOneToOne: false
            referencedRelation: "report_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_blocks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_themes: {
        Row: {
          accent_color: string
          border_color: string
          created_at: string
          description: string | null
          font_family: string
          gap_px: number
          id: string
          is_default: boolean
          muted_text_color: string
          name: string
          page_color: string
          palette: string[]
          radius_px: number
          surface_color: string
          text_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          border_color?: string
          created_at?: string
          description?: string | null
          font_family?: string
          gap_px?: number
          id?: string
          is_default?: boolean
          muted_text_color?: string
          name: string
          page_color?: string
          palette?: string[]
          radius_px?: number
          surface_color?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          border_color?: string
          created_at?: string
          description?: string | null
          font_family?: string
          gap_px?: number
          id?: string
          is_default?: boolean
          muted_text_color?: string
          name?: string
          page_color?: string
          palette?: string[]
          radius_px?: number
          surface_color?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          connection_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          grid_columns: number
          id: string
          is_published: boolean
          max_width_px: number
          slug: string
          theme_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grid_columns?: number
          id?: string
          is_published?: boolean
          max_width_px?: number
          slug: string
          theme_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grid_columns?: number
          id?: string
          is_published?: boolean
          max_width_px?: number
          slug?: string
          theme_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "superset_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "report_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      superset_connections: {
        Row: {
          auth_provider: string
          base_url: string
          created_at: string
          id: string
          is_default: boolean
          last_checked_at: string | null
          last_status: string | null
          name: string
          service_username: string
          updated_at: string
        }
        Insert: {
          auth_provider?: string
          base_url: string
          created_at?: string
          id?: string
          is_default?: boolean
          last_checked_at?: string | null
          last_status?: string | null
          name: string
          service_username?: string
          updated_at?: string
        }
        Update: {
          auth_provider?: string
          base_url?: string
          created_at?: string
          id?: string
          is_default?: boolean
          last_checked_at?: string | null
          last_status?: string | null
          name?: string
          service_username?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      can_edit: { Args: { _user_id: string }; Returns: boolean }
      get_public_block_context: {
        Args: { _block_id: string }
        Returns: {
          adhoc_filters: Json
          adhoc_groupby: Json
          adhoc_metrics: Json
          adhoc_order_desc: boolean
          auth_provider: string
          base_url: string
          block_type: string
          chart_id: number
          dataset_id: number
          row_limit: number
          service_username: string
        }[]
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
      app_role: "admin" | "editor" | "viewer"
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
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
