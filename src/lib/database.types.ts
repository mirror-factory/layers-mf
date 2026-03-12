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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
      ai_usage: {
        Row: {
          cost_cents: number
          created_at: string | null
          feature: string
          id: string
          input_tokens: number
          metadata: Json | null
          model: string
          note_id: string | null
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          cost_cents?: number
          created_at?: string | null
          feature: string
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model: string
          note_id?: string | null
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          cost_cents?: number
          created_at?: string | null
          feature?: string
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model?: string
          note_id?: string | null
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string | null
          user_id?: string
        }
        Relationships: []
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
          embedding: string | null
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
          embedding?: string | null
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
          embedding?: string | null
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
      context_items: {
        Row: {
          content_hash: string | null
          content_type: string
          description_long: string | null
          description_short: string | null
          embedding: string | null
          entities: Json | null
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
        }
        Insert: {
          content_hash?: string | null
          content_type: string
          description_long?: string | null
          description_short?: string | null
          embedding?: string | null
          entities?: Json | null
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
        }
        Update: {
          content_hash?: string | null
          content_type?: string
          description_long?: string | null
          description_short?: string | null
          embedding?: string | null
          entities?: Json | null
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
      credit_balances: {
        Row: {
          balance: number
          created_at: string
          credits_reset_at: string | null
          id: string
          monthly_credits: number
          overage_rate: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          credits_reset_at?: string | null
          id?: string
          monthly_credits?: number
          overage_rate?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          credits_reset_at?: string | null
          id?: string
          monthly_credits?: number
          overage_rate?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
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
      margin_configs: {
        Row: {
          created_at: string
          global_margin_percent: number
          id: string
          model_overrides: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          global_margin_percent?: number
          id?: string
          model_overrides?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          global_margin_percent?: number
          id?: string
          model_overrides?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: Json | null
          content_text: string | null
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          is_archived: boolean | null
          is_deleted: boolean | null
          is_pinned: boolean | null
          pinned_at: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          content_text?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json | null
          content_text?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_analytics: {
        Row: {
          ai_calls: number | null
          created_at: string | null
          features_used: Json | null
          id: string
          notes_created: number | null
          notes_edited: number | null
          session_end: string | null
          session_start: string
          user_id: string | null
        }
        Insert: {
          ai_calls?: number | null
          created_at?: string | null
          features_used?: Json | null
          id?: string
          notes_created?: number | null
          notes_edited?: number | null
          session_end?: string | null
          session_start?: string
          user_id?: string | null
        }
        Update: {
          ai_calls?: number | null
          created_at?: string | null
          features_used?: Json | null
          id?: string
          notes_created?: number | null
          notes_edited?: number | null
          session_end?: string | null
          session_start?: string
          user_id?: string | null
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
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          api_key_id: string | null
          cost_usd: number | null
          created_at: string
          credits_used: number | null
          error_message: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json | null
          model_id: string
          output_tokens: number | null
          provider: string
          request_type: string
          status: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          cost_usd?: number | null
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_id: string
          output_tokens?: number | null
          provider: string
          request_type: string
          status?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          cost_usd?: number | null
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_id?: string
          output_tokens?: number | null
          provider?: string
          request_type?: string
          status?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_ai_usage_summary: {
        Row: {
          day: string | null
          model: string | null
          total_calls: number | null
          total_cost_cents: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
        }
        Relationships: []
      }
      user_ai_usage_summary: {
        Row: {
          day: string | null
          model: string | null
          total_calls: number | null
          total_cost_cents: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: { accepting_user_id: string; invitation_id: string }
        Returns: undefined
      }
      add_credits: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      deduct_credits: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
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
      has_sufficient_credits: {
        Args: { p_required: number; p_user_id: string }
        Returns: boolean
      }
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
  public: {
    Enums: {},
  },
} as const
