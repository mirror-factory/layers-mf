export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      action_item_status: {
        Row: {
          action_index: number
          completed_at: string | null
          completed_by: string | null
          context_item_id: string
          id: string
          org_id: string
          status: string
        }
        Insert: {
          action_index: number
          completed_at?: string | null
          completed_by?: string | null
          context_item_id: string
          id?: string
          org_id: string
          status?: string
        }
        Update: {
          action_index?: number
          completed_at?: string | null
          completed_by?: string | null
          context_item_id?: string
          id?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_status_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_status_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finish_reason: string | null
          id: string
          model: string
          org_id: string
          query: string
          step_count: number
          tool_calls: Json
          total_input_tokens: number | null
          total_output_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finish_reason?: string | null
          id?: string
          model: string
          org_id: string
          query: string
          step_count?: number
          tool_calls?: Json
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finish_reason?: string | null
          id?: string
          model?: string
          org_id?: string
          query?: string
          step_count?: number
          tool_calls?: Json
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          org_id: string
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: Json
          conversation_id: string | null
          created_at: string
          id: string
          model: string | null
          org_id: string
          role: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          content?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          org_id: string
          role: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          org_id?: string
          role?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      context_chunks: {
        Row: {
          chunk_index: number
          content: string
          context_item_id: string
          created_at: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          id: string
          metadata: Json | null
          org_id: string
          parent_content: string
          search_tsv: unknown
        }
        Insert: {
          chunk_index: number
          content: string
          context_item_id: string
          created_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          parent_content: string
          search_tsv?: unknown
        }
        Update: {
          chunk_index?: number
          content?: string
          context_item_id?: string
          created_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          parent_content?: string
          search_tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "context_chunks_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
        ]
      }
      context_item_versions: {
        Row: {
          change_type: string
          changed_by: string | null
          changed_fields: string[] | null
          content_hash: string | null
          context_item_id: string
          created_at: string
          id: string
          org_id: string
          raw_content: string | null
          source_metadata: Json | null
          source_updated_at: string | null
          title: string
          version_number: number
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          changed_fields?: string[] | null
          content_hash?: string | null
          context_item_id: string
          created_at?: string
          id?: string
          org_id: string
          raw_content?: string | null
          source_metadata?: Json | null
          source_updated_at?: string | null
          title: string
          version_number: number
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          content_hash?: string | null
          context_item_id?: string
          created_at?: string
          id?: string
          org_id?: string
          raw_content?: string | null
          source_metadata?: Json | null
          source_updated_at?: string | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "context_item_versions_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "context_item_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      context_items: {
        Row: {
          content_hash: string | null
          content_type: string
          description_long: string | null
          description_short: string | null
          embedding: string | null
          entities: Json | null
          freshness_at: string | null
          id: string
          ingested_at: string
          nango_connection_id: string | null
          org_id: string
          processed_at: string | null
          raw_content: string | null
          search_tsv: unknown
          source_created_at: string | null
          source_id: string | null
          source_metadata: Json | null
          source_type: string
          status: string
          title: string
          trust_weight: number
          updated_at: string | null
          user_notes: string | null
          user_tags: string[] | null
          user_title: string | null
          version_number: number
        }
        Insert: {
          content_hash?: string | null
          content_type: string
          description_long?: string | null
          description_short?: string | null
          embedding?: string | null
          entities?: Json | null
          freshness_at?: string | null
          id?: string
          ingested_at?: string
          nango_connection_id?: string | null
          org_id: string
          processed_at?: string | null
          raw_content?: string | null
          search_tsv?: unknown
          source_created_at?: string | null
          source_id?: string | null
          source_metadata?: Json | null
          source_type: string
          status?: string
          title: string
          trust_weight?: number
          updated_at?: string | null
          user_notes?: string | null
          user_tags?: string[] | null
          user_title?: string | null
          version_number?: number
        }
        Update: {
          content_hash?: string | null
          content_type?: string
          description_long?: string | null
          description_short?: string | null
          embedding?: string | null
          entities?: Json | null
          freshness_at?: string | null
          id?: string
          ingested_at?: string
          nango_connection_id?: string | null
          org_id?: string
          processed_at?: string | null
          raw_content?: string | null
          search_tsv?: unknown
          source_created_at?: string | null
          source_id?: string | null
          source_metadata?: Json | null
          source_type?: string
          status?: string
          title?: string
          trust_weight?: number
          updated_at?: string | null
          user_notes?: string | null
          user_tags?: string[] | null
          user_title?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "context_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          org_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          body: string | null
          context_item_id: string | null
          created_at: string
          id: string
          org_id: string
          priority: string
          read_at: string | null
          source_type: string | null
          source_url: string | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          context_item_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          priority?: string
          read_at?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          context_item_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          priority?: string
          read_at?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_sync_at: string | null
          nango_connection_id: string
          org_id: string
          provider: string
          status: string
          sync_config: Json | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_sync_at?: string | null
          nango_connection_id: string
          org_id: string
          provider: string
          status?: string
          sync_config?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_sync_at?: string | null
          nango_connection_id?: string
          org_id?: string
          provider?: string
          status?: string
          sync_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          credit_balance: number
          id: string
          name: string
          slug: string
          stripe_customer_id: string | null
        }
        Insert: {
          created_at?: string
          credit_balance?: number
          id?: string
          name: string
          slug: string
          stripe_customer_id?: string | null
        }
        Update: {
          created_at?: string
          credit_balance?: number
          id?: string
          name?: string
          slug?: string
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      session_context_links: {
        Row: {
          added_by: string
          context_item_id: string
          id: string
          relevance_score: number | null
          session_id: string
        }
        Insert: {
          added_by?: string
          context_item_id: string
          id?: string
          relevance_score?: number | null
          session_id: string
        }
        Update: {
          added_by?: string
          context_item_id?: string
          id?: string
          relevance_score?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_context_links_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_context_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          agent_config: Json | null
          created_at: string
          created_by: string
          goal: string
          id: string
          last_agent_run: string | null
          name: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_config?: Json | null
          created_at?: string
          created_by: string
          goal: string
          id?: string
          last_agent_run?: string | null
          name: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_config?: Json | null
          created_at?: string
          created_by?: string
          goal?: string
          id?: string
          last_agent_run?: string | null
          name?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { accepting_user_id: string; invitation_id: string }
        Returns: undefined
      }
      get_action_items: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_source_type?: string
          p_status?: string
        }
        Returns: {
          action_index: number
          completed_at: string
          content_type: string
          context_item_id: string
          source_created_at: string
          source_title: string
          source_type: string
          status: string
          task: string
        }[]
      }
      get_agent_metrics: {
        Args: { p_org_id: string; p_since?: string }
        Returns: Json
      }
      get_context_health: { Args: { p_org_id: string }; Returns: Json }
      get_integration_health: { Args: { p_org_id: string }; Returns: Json }
      get_user_org_ids: { Args: never; Returns: string[] }
      hybrid_search: {
        Args: {
          p_content_type?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_org_id: string
          p_query_embedding: string
          p_query_text: string
          p_source_type?: string
        }
        Returns: {
          content_type: string
          description_long: string
          description_short: string
          id: string
          rrf_score: number
          source_created_at: string
          source_type: string
          source_url: string
          title: string
        }[]
      }
      hybrid_search_chunks: {
        Args: {
          p_content_type?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_org_id: string
          p_query_embedding: string
          p_query_text: string
          p_source_type?: string
        }
        Returns: {
          content_type: string
          context_item_id: string
          description_short: string
          id: string
          parent_content: string
          rrf_score: number
          source_created_at: string
          source_type: string
          source_url: string
          title: string
        }[]
      }
      hybrid_search_text: {
        Args: {
          p_content_type?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_org_id: string
          p_query_text: string
          p_source_type?: string
        }
        Returns: {
          content_type: string
          description_long: string
          description_short: string
          id: string
          rrf_score: number
          source_created_at: string
          source_type: string
          source_url: string
          title: string
        }[]
      }
      search_context_items: {
        Args: {
          p_limit?: number
          p_org_id: string
          p_query_embedding: string
          p_query_text: string
        }
        Returns: {
          content_type: string
          description_long: string
          description_short: string
          id: string
          rrf_score: number
          source_type: string
          title: string
        }[]
      }
      search_context_items_text: {
        Args: { p_limit?: number; p_org_id: string; p_query_text: string }
        Returns: {
          content_type: string
          description_long: string
          description_short: string
          id: string
          rrf_score: number
          source_type: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

