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
          cache_read_tokens: number | null
          cache_write_tokens: number | null
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          finish_reason: string | null
          gateway_cost_usd: number | null
          id: string
          model: string
          org_id: string
          query: string
          step_count: number
          step_details: Json
          tool_calls: Json
          total_input_tokens: number | null
          total_output_tokens: number | null
          user_id: string
        }
        Insert: {
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finish_reason?: string | null
          gateway_cost_usd?: number | null
          id?: string
          model: string
          org_id: string
          query: string
          step_count?: number
          step_details?: Json
          tool_calls?: Json
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          user_id: string
        }
        Update: {
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finish_reason?: string | null
          gateway_cost_usd?: number | null
          id?: string
          model?: string
          org_id?: string
          query?: string
          step_count?: number
          step_details?: Json
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
      approval_queue: {
        Row: {
          action_type: string
          conflict_reason: string | null
          created_at: string
          id: string
          org_id: string
          payload: Json
          reasoning: string | null
          requested_by_agent: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_service: string
        }
        Insert: {
          action_type: string
          conflict_reason?: string | null
          created_at?: string
          id?: string
          org_id: string
          payload: Json
          reasoning?: string | null
          requested_by_agent?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_service: string
        }
        Update: {
          action_type?: string
          conflict_reason?: string | null
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          reasoning?: string | null
          requested_by_agent?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_service?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_interactions: {
        Row: {
          artifact_id: string
          chat_context: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          interaction_type: string
          metadata: Json | null
          user_id: string
          version_number: number | null
        }
        Insert: {
          artifact_id: string
          chat_context?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          interaction_type: string
          metadata?: Json | null
          user_id: string
          version_number?: number | null
        }
        Update: {
          artifact_id?: string
          chat_context?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          interaction_type?: string
          metadata?: Json | null
          user_id?: string
          version_number?: number | null
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
      canvas_connections: {
        Row: {
          canvas_id: string
          created_at: string
          from_item_id: string
          id: string
          label: string | null
          style: Json | null
          to_item_id: string
        }
        Insert: {
          canvas_id: string
          created_at?: string
          from_item_id: string
          id?: string
          label?: string | null
          style?: Json | null
          to_item_id: string
        }
        Update: {
          canvas_id?: string
          created_at?: string
          from_item_id?: string
          id?: string
          label?: string | null
          style?: Json | null
          to_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_connections_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_connections_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "canvas_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_connections_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "canvas_items"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_items: {
        Row: {
          canvas_id: string
          color: string | null
          content: string | null
          context_item_id: string | null
          created_at: string
          height: number
          id: string
          item_type: string
          style: Json | null
          updated_at: string
          width: number
          x: number
          y: number
        }
        Insert: {
          canvas_id: string
          color?: string | null
          content?: string | null
          context_item_id?: string | null
          created_at?: string
          height?: number
          id?: string
          item_type?: string
          style?: Json | null
          updated_at?: string
          width?: number
          x?: number
          y?: number
        }
        Update: {
          canvas_id?: string
          color?: string | null
          content?: string | null
          context_item_id?: string | null
          created_at?: string
          height?: number
          id?: string
          item_type?: string
          style?: Json | null
          updated_at?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_items_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_items_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
        ]
      }
      canvases: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          org_id: string
          settings: Json | null
          updated_at: string
          viewport: Json | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          settings?: Json | null
          updated_at?: string
          viewport?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          settings?: Json | null
          updated_at?: string
          viewport?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "canvases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel: string
          content: Json
          conversation_id: string | null
          created_at: string
          discord_channel_id: string | null
          discord_message_id: string | null
          id: string
          model: string | null
          org_id: string
          role: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          content?: Json
          conversation_id?: string | null
          created_at?: string
          discord_channel_id?: string | null
          discord_message_id?: string | null
          id?: string
          model?: string | null
          org_id: string
          role: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          content?: Json
          conversation_id?: string | null
          created_at?: string
          discord_channel_id?: string | null
          discord_message_id?: string | null
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
      collection_items: {
        Row: {
          added_at: string | null
          added_by: string | null
          collection_id: string
          context_item_id: string
          id: string
          sort_order: number | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          collection_id: string
          context_item_id: string
          id?: string
          sort_order?: number | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          collection_id?: string
          context_item_id?: string
          id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string
          description: string | null
          icon: string | null
          id: string
          is_smart: boolean | null
          name: string
          org_id: string
          parent_id: string | null
          smart_filter: Json | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          is_smart?: boolean | null
          name: string
          org_id: string
          parent_id?: string | null
          smart_filter?: Json | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_smart?: boolean | null
          name?: string
          org_id?: string
          parent_id?: string | null
          smart_filter?: Json | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      content_shares: {
        Row: {
          content_id: string | null
          content_type: string | null
          created_at: string
          id: string
          org_id: string | null
          permission: string | null
          resource_id: string | null
          resource_type: string | null
          scope: string | null
          shared_by: string
          shared_with: string | null
          shared_with_user_id: string | null
        }
        Insert: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          permission?: string | null
          resource_id?: string | null
          resource_type?: string | null
          scope?: string | null
          shared_by: string
          shared_with?: string | null
          shared_with_user_id?: string | null
        }
        Update: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          permission?: string | null
          resource_id?: string | null
          resource_type?: string | null
          scope?: string | null
          shared_by?: string
          shared_with?: string | null
          shared_with_user_id?: string | null
        }
        Relationships: []
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
          ai_category: string | null
          archived_at: string | null
          confidence_score: number | null
          content_hash: string | null
          content_type: string
          description_long: string | null
          description_short: string | null
          embedding: string | null
          entities: Json | null
          freshness_at: string | null
          id: string
          ingested_at: string
          last_viewed_at: string | null
          library_item_type: string | null
          library_scope: string
          nango_connection_id: string | null
          org_id: string
          permissions: Json
          priority_weight: number
          processed_at: string | null
          raw_content: string | null
          relationship_metadata: Json
          search_tsv: unknown
          source_created_at: string | null
          source_id: string | null
          source_metadata: Json | null
          source_quote: string | null
          source_type: string
          staleness_score: number | null
          status: string
          summary: string | null
          title: string
          trust_weight: number
          updated_at: string | null
          user_notes: string | null
          user_tags: string[] | null
          user_title: string | null
          version_number: number
          view_count: number | null
        }
        Insert: {
          ai_category?: string | null
          archived_at?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          content_type: string
          description_long?: string | null
          description_short?: string | null
          embedding?: string | null
          entities?: Json | null
          freshness_at?: string | null
          id?: string
          ingested_at?: string
          last_viewed_at?: string | null
          library_item_type?: string | null
          library_scope?: string
          nango_connection_id?: string | null
          org_id: string
          permissions?: Json
          priority_weight?: number
          processed_at?: string | null
          raw_content?: string | null
          relationship_metadata?: Json
          search_tsv?: unknown
          source_created_at?: string | null
          source_id?: string | null
          source_metadata?: Json | null
          source_quote?: string | null
          source_type: string
          staleness_score?: number | null
          status?: string
          summary?: string | null
          title: string
          trust_weight?: number
          updated_at?: string | null
          user_notes?: string | null
          user_tags?: string[] | null
          user_title?: string | null
          version_number?: number
          view_count?: number | null
        }
        Update: {
          ai_category?: string | null
          archived_at?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          content_type?: string
          description_long?: string | null
          description_short?: string | null
          embedding?: string | null
          entities?: Json | null
          freshness_at?: string | null
          id?: string
          ingested_at?: string
          last_viewed_at?: string | null
          library_item_type?: string | null
          library_scope?: string
          nango_connection_id?: string | null
          org_id?: string
          permissions?: Json
          priority_weight?: number
          processed_at?: string | null
          raw_content?: string | null
          relationship_metadata?: Json
          search_tsv?: unknown
          source_created_at?: string | null
          source_id?: string | null
          source_metadata?: Json | null
          source_quote?: string | null
          source_type?: string
          staleness_score?: number | null
          status?: string
          summary?: string | null
          title?: string
          trust_weight?: number
          updated_at?: string | null
          user_notes?: string | null
          user_tags?: string[] | null
          user_title?: string | null
          version_number?: number
          view_count?: number | null
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
      context_pack_items: {
        Row: {
          context_item_id: string
          context_pack_id: string
          created_at: string
          id: string
          include_full_content: boolean
          note: string | null
          sort_order: number
        }
        Insert: {
          context_item_id: string
          context_pack_id: string
          created_at?: string
          id?: string
          include_full_content?: boolean
          note?: string | null
          sort_order?: number
        }
        Update: {
          context_item_id?: string
          context_pack_id?: string
          created_at?: string
          id?: string
          include_full_content?: boolean
          note?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "context_pack_items_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "context_pack_items_context_pack_id_fkey"
            columns: ["context_pack_id"]
            isOneToOne: false
            referencedRelation: "context_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      context_packs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          metadata: Json
          name: string
          org_id: string
          purpose: string | null
          retrieval_query: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          metadata?: Json
          name: string
          org_id: string
          purpose?: string | null
          retrieval_query?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          metadata?: Json
          name?: string
          org_id?: string
          purpose?: string | null
          retrieval_query?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "context_packs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          can_see_history_before_join: boolean | null
          conversation_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          can_see_history_before_join?: boolean | null
          conversation_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          can_see_history_before_join?: boolean | null
          conversation_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          compacted_summary: string | null
          created_at: string
          id: string
          initiated_by: string
          org_id: string
          schedule_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compacted_summary?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          org_id: string
          schedule_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compacted_summary?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          org_id?: string
          schedule_id?: string | null
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
          {
            foreignKeyName: "conversations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "scheduled_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          org_id: string
          provider: string
          refresh_token_encrypted: string | null
          token_encrypted: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          org_id: string
          provider: string
          refresh_token_encrypted?: string | null
          token_encrypted: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          token_encrypted?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dewey_profiles: {
        Row: {
          allowed_tools: string[]
          approval_policy: string
          created_at: string
          default_retrieval_scope: Json
          id: string
          instructions: string | null
          is_default: boolean
          memory_policy: Json
          name: string
          org_id: string
          save_behavior: string
          tone: string
          updated_at: string
          voice: string
        }
        Insert: {
          allowed_tools?: string[]
          approval_policy?: string
          created_at?: string
          default_retrieval_scope?: Json
          id?: string
          instructions?: string | null
          is_default?: boolean
          memory_policy?: Json
          name?: string
          org_id: string
          save_behavior?: string
          tone?: string
          updated_at?: string
          voice?: string
        }
        Update: {
          allowed_tools?: string[]
          approval_policy?: string
          created_at?: string
          default_retrieval_scope?: Json
          id?: string
          instructions?: string | null
          is_default?: boolean
          memory_policy?: Json
          name?: string
          org_id?: string
          save_behavior?: string
          tone?: string
          updated_at?: string
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "dewey_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ditto_profiles: {
        Row: {
          communication_style: string | null
          confidence: number | null
          created_at: string
          detail_level: string | null
          id: string
          interaction_count: number | null
          interests: Json | null
          last_generated_at: string | null
          org_id: string
          preferred_sources: Json | null
          priority_topics: Json | null
          updated_at: string
          user_id: string
          working_hours: Json | null
        }
        Insert: {
          communication_style?: string | null
          confidence?: number | null
          created_at?: string
          detail_level?: string | null
          id?: string
          interaction_count?: number | null
          interests?: Json | null
          last_generated_at?: string | null
          org_id: string
          preferred_sources?: Json | null
          priority_topics?: Json | null
          updated_at?: string
          user_id: string
          working_hours?: Json | null
        }
        Update: {
          communication_style?: string | null
          confidence?: number | null
          created_at?: string
          detail_level?: string | null
          id?: string
          interaction_count?: number | null
          interests?: Json | null
          last_generated_at?: string | null
          org_id?: string
          preferred_sources?: Json | null
          priority_topics?: Json | null
          updated_at?: string
          user_id?: string
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ditto_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_summary: string | null
          content: string
          context_item_id: string
          created_at: string
          edited_by: string
          id: string
          title: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          content: string
          context_item_id: string
          created_at?: string
          edited_by: string
          id?: string
          title: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          content?: string
          context_item_id?: string
          created_at?: string
          edited_by?: string
          id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_proposals: {
        Row: {
          approvals: Json | null
          change_summary: string | null
          context_item_id: string
          created_at: string
          id: string
          org_id: string
          proposed_by: string
          proposed_content: string
          proposed_title: string | null
          required_approvals: number
          status: string
        }
        Insert: {
          approvals?: Json | null
          change_summary?: string | null
          context_item_id: string
          created_at?: string
          id?: string
          org_id: string
          proposed_by: string
          proposed_content: string
          proposed_title?: string | null
          required_approvals?: number
          status?: string
        }
        Update: {
          approvals?: Json | null
          change_summary?: string | null
          context_item_id?: string
          created_at?: string
          id?: string
          org_id?: string
          proposed_by?: string
          proposed_content?: string
          proposed_title?: string | null
          required_approvals?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_proposals_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_proposals_org_id_fkey"
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
      item_pins: {
        Row: {
          context_item_id: string
          id: string
          pinned_at: string | null
          user_id: string
        }
        Insert: {
          context_item_id: string
          id?: string
          pinned_at?: string | null
          user_id: string
        }
        Update: {
          context_item_id?: string
          id?: string
          pinned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_pins_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_tags: {
        Row: {
          added_at: string | null
          confidence: number | null
          context_item_id: string
          id: string
          source: string | null
          tag_id: string
        }
        Insert: {
          added_at?: string | null
          confidence?: number | null
          context_item_id: string
          id?: string
          source?: string | null
          tag_id: string
        }
        Update: {
          added_at?: string | null
          confidence?: number | null
          context_item_id?: string
          id?: string
          source?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_tags_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      library_assets: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          kind: string
          license: string | null
          metadata: Json
          mime_type: string | null
          model: string | null
          ocr_text: string | null
          org_id: string
          original_url: string | null
          prompt: string | null
          sha256: string | null
          size_bytes: number | null
          source_id: string | null
          storage_bucket: string | null
          storage_path: string | null
          thumbnail_path: string | null
          title: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          kind?: string
          license?: string | null
          metadata?: Json
          mime_type?: string | null
          model?: string | null
          ocr_text?: string | null
          org_id: string
          original_url?: string | null
          prompt?: string | null
          sha256?: string | null
          size_bytes?: number | null
          source_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
          title?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          kind?: string
          license?: string | null
          metadata?: Json
          mime_type?: string | null
          model?: string | null
          ocr_text?: string | null
          org_id?: string
          original_url?: string | null
          prompt?: string | null
          sha256?: string | null
          size_bytes?: number | null
          source_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
          title?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_assets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "library_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      library_external_calls: {
        Row: {
          actor_type: string
          created_at: string
          direction: string
          id: string
          metadata: Json
          org_id: string
          request_summary: string | null
          status: string
          target_service: string | null
          tool_name: string | null
          user_id: string | null
        }
        Insert: {
          actor_type?: string
          created_at?: string
          direction: string
          id?: string
          metadata?: Json
          org_id: string
          request_summary?: string | null
          status?: string
          target_service?: string | null
          tool_name?: string | null
          user_id?: string | null
        }
        Update: {
          actor_type?: string
          created_at?: string
          direction?: string
          id?: string
          metadata?: Json
          org_id?: string
          request_summary?: string | null
          status?: string
          target_service?: string | null
          tool_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_external_calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      library_item_assets: {
        Row: {
          asset_id: string
          context_item_id: string
          created_at: string
          id: string
          org_id: string
          role: string
          sort_order: number
        }
        Insert: {
          asset_id: string
          context_item_id: string
          created_at?: string
          id?: string
          org_id: string
          role?: string
          sort_order?: number
        }
        Update: {
          asset_id?: string
          context_item_id?: string
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_item_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "library_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_item_assets_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_item_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      library_item_relationships: {
        Row: {
          confidence: number
          created_at: string
          created_by: string | null
          from_context_item_id: string
          id: string
          metadata: Json
          org_id: string
          relationship_type: string
          to_context_item_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          from_context_item_id: string
          id?: string
          metadata?: Json
          org_id: string
          relationship_type: string
          to_context_item_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          from_context_item_id?: string
          id?: string
          metadata?: Json
          org_id?: string
          relationship_type?: string
          to_context_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_item_relationships_from_context_item_id_fkey"
            columns: ["from_context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_item_relationships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_item_relationships_to_context_item_id_fkey"
            columns: ["to_context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
        ]
      }
      library_sources: {
        Row: {
          context_item_id: string | null
          created_at: string
          external_id: string | null
          external_url: string | null
          id: string
          import_mode: string
          imported_by: string | null
          license: string | null
          mcp_server_id: string | null
          metadata: Json
          model: string | null
          org_id: string
          prompt: string | null
          provider: string | null
          source_created_at: string | null
          source_kind: string
          source_updated_at: string | null
        }
        Insert: {
          context_item_id?: string | null
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_mode?: string
          imported_by?: string | null
          license?: string | null
          mcp_server_id?: string | null
          metadata?: Json
          model?: string | null
          org_id: string
          prompt?: string | null
          provider?: string | null
          source_created_at?: string | null
          source_kind: string
          source_updated_at?: string | null
        }
        Update: {
          context_item_id?: string | null
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_mode?: string
          imported_by?: string | null
          license?: string | null
          mcp_server_id?: string | null
          metadata?: Json
          model?: string | null
          org_id?: string
          prompt?: string | null
          provider?: string | null
          source_created_at?: string | null
          source_kind?: string
          source_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_sources_context_item_id_fkey"
            columns: ["context_item_id"]
            isOneToOne: false
            referencedRelation: "context_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_sources_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          mcp_server_id: string | null
          metadata: Json
          mode: string
          org_id: string
          query: string | null
          requested_by: string | null
          saved_count: number
          selected_count: number
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mcp_server_id?: string | null
          metadata?: Json
          mode: string
          org_id: string
          query?: string | null
          requested_by?: string | null
          saved_count?: number
          selected_count?: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mcp_server_id?: string | null
          metadata?: Json
          mode?: string
          org_id?: string
          query?: string | null
          requested_by?: string | null
          saved_count?: number
          selected_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_import_batches_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_import_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_servers: {
        Row: {
          api_key_encrypted: string | null
          auth_type: string
          created_at: string
          discovered_tools: Json | null
          error_message: string | null
          failure_count: number
          health_checked_at: string | null
          health_status: string
          id: string
          is_active: boolean
          last_connected_at: string | null
          name: string
          oauth_authorize_url: string | null
          oauth_client_id: string | null
          oauth_client_secret: string | null
          oauth_expires_at: string | null
          oauth_refresh_token: string | null
          oauth_scopes: string[]
          oauth_status: string
          oauth_token_metadata: Json
          oauth_token_url: string | null
          org_id: string
          reconnect_after: string | null
          tool_snapshot: Json
          transport_type: string
          url: string
        }
        Insert: {
          api_key_encrypted?: string | null
          auth_type?: string
          created_at?: string
          discovered_tools?: Json | null
          error_message?: string | null
          failure_count?: number
          health_checked_at?: string | null
          health_status?: string
          id?: string
          is_active?: boolean
          last_connected_at?: string | null
          name: string
          oauth_authorize_url?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          oauth_scopes?: string[]
          oauth_status?: string
          oauth_token_metadata?: Json
          oauth_token_url?: string | null
          org_id: string
          reconnect_after?: string | null
          tool_snapshot?: Json
          transport_type?: string
          url: string
        }
        Update: {
          api_key_encrypted?: string | null
          auth_type?: string
          created_at?: string
          discovered_tools?: Json | null
          error_message?: string | null
          failure_count?: number
          health_checked_at?: string | null
          health_status?: string
          id?: string
          is_active?: boolean
          last_connected_at?: string | null
          name?: string
          oauth_authorize_url?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          oauth_scopes?: string[]
          oauth_status?: string
          oauth_token_metadata?: Json
          oauth_token_url?: string | null
          org_id?: string
          reconnect_after?: string | null
          tool_snapshot?: Json
          transport_type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_sync_rules: {
        Row: {
          approval_required: boolean
          cadence: string | null
          created_at: string
          created_by: string | null
          destination_collection_id: string | null
          id: string
          is_active: boolean
          item_type: string | null
          last_run_at: string | null
          mcp_server_id: string
          metadata: Json
          name: string
          next_run_at: string | null
          org_id: string
          query: string | null
          selector: Json
          tool_name: string | null
          updated_at: string
        }
        Insert: {
          approval_required?: boolean
          cadence?: string | null
          created_at?: string
          created_by?: string | null
          destination_collection_id?: string | null
          id?: string
          is_active?: boolean
          item_type?: string | null
          last_run_at?: string | null
          mcp_server_id: string
          metadata?: Json
          name: string
          next_run_at?: string | null
          org_id: string
          query?: string | null
          selector?: Json
          tool_name?: string | null
          updated_at?: string
        }
        Update: {
          approval_required?: boolean
          cadence?: string | null
          created_at?: string
          created_by?: string | null
          destination_collection_id?: string | null
          id?: string
          is_active?: boolean
          item_type?: string | null
          last_run_at?: string | null
          mcp_server_id?: string
          metadata?: Json
          name?: string
          next_run_at?: string | null
          org_id?: string
          query?: string | null
          selector?: Json
          tool_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_sync_rules_destination_collection_id_fkey"
            columns: ["destination_collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_sync_rules_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_sync_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          digest_enabled: boolean
          digest_time: string
          email_on_action_item: boolean
          email_on_mention: boolean
          email_on_new_context: boolean
          id: string
          org_id: string
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          created_at?: string
          digest_enabled?: boolean
          digest_time?: string
          email_on_action_item?: boolean
          email_on_mention?: boolean
          email_on_new_context?: boolean
          id?: string
          org_id: string
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          created_at?: string
          digest_enabled?: boolean
          digest_time?: string
          email_on_action_item?: boolean
          email_on_mention?: boolean
          email_on_new_context?: boolean
          id?: string
          org_id?: string
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json | null
          org_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          org_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          org_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
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
      partner_settings: {
        Row: {
          ai_gateway_key_encrypted: string | null
          approval_preferences: Json | null
          created_at: string
          default_model: string | null
          discord_user_id: string | null
          id: string
          notification_preferences: Json | null
          timezone: string | null
          tool_permissions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_gateway_key_encrypted?: string | null
          approval_preferences?: Json | null
          created_at?: string
          default_model?: string | null
          discord_user_id?: string | null
          id?: string
          notification_preferences?: Json | null
          timezone?: string | null
          tool_permissions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_gateway_key_encrypted?: string | null
          approval_preferences?: Json | null
          created_at?: string
          default_model?: string | null
          discord_user_id?: string | null
          id?: string
          notification_preferences?: Json | null
          timezone?: string | null
          tool_permissions?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      portal_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          portal_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          portal_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          portal_id?: string
          session_id?: string
        }
        Relationships: []
      }
      priority_documents: {
        Row: {
          content: string
          created_at: string
          filename: string
          id: string
          is_active: boolean
          org_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          content: string
          created_at?: string
          filename: string
          id?: string
          is_active?: boolean
          org_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          content?: string
          created_at?: string
          filename?: string
          id?: string
          is_active?: boolean
          org_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "priority_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_content_shares: {
        Row: {
          allow_public_view: boolean
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          org_id: string
          password_hash: string | null
          resource_id: string
          resource_type: string
          share_token: string
          shared_by: string
        }
        Insert: {
          allow_public_view?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          password_hash?: string | null
          resource_id: string
          resource_type: string
          share_token?: string
          shared_by: string
        }
        Update: {
          allow_public_view?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          password_hash?: string | null
          resource_id?: string
          resource_type?: string
          share_token?: string
          shared_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_content_shares_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          applies_to_all: boolean
          created_at: string
          id: string
          is_active: boolean
          org_id: string
          priority: number
          scope: string
          text: string
          updated_at: string
        }
        Insert: {
          applies_to_all?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          org_id: string
          priority?: number
          scope?: string
          text: string
          updated_at?: string
        }
        Update: {
          applies_to_all?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string
          priority?: number
          scope?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_snapshots: {
        Row: {
          cpu_usage_ms: number | null
          created_at: string
          id: string
          metadata: Json | null
          name: string
          network_egress_bytes: number | null
          network_ingress_bytes: number | null
          org_id: string
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          cpu_usage_ms?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          network_egress_bytes?: number | null
          network_ingress_bytes?: number | null
          org_id: string
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          cpu_usage_ms?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          network_egress_bytes?: number | null
          network_ingress_bytes?: number | null
          org_id?: string
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_usage: {
        Row: {
          cost_usd: number | null
          cpu_ms: number | null
          created_at: string
          id: string
          memory_mb_seconds: number | null
          network_egress_bytes: number | null
          network_ingress_bytes: number | null
          org_id: string
          sandbox_id: string | null
          user_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          cpu_ms?: number | null
          created_at?: string
          id?: string
          memory_mb_seconds?: number | null
          network_egress_bytes?: number | null
          network_ingress_bytes?: number | null
          org_id: string
          sandbox_id?: string | null
          user_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          cpu_ms?: number | null
          created_at?: string
          id?: string
          memory_mb_seconds?: number | null
          network_egress_bytes?: number | null
          network_ingress_bytes?: number | null
          org_id?: string
          sandbox_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json | null
          id: string
          is_shared: boolean
          name: string
          org_id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          id?: string
          is_shared?: boolean
          name: string
          org_id: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json | null
          id?: string
          is_shared?: boolean
          name?: string
          org_id?: string
          query?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_actions: {
        Row: {
          action_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          last_run_at: string | null
          max_runs: number | null
          name: string
          next_run_at: string | null
          org_id: string
          payload: Json
          run_count: number
          schedule: string
          status: string
          target_service: string | null
          tool_tier: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          max_runs?: number | null
          name: string
          next_run_at?: string | null
          org_id: string
          payload?: Json
          run_count?: number
          schedule: string
          status?: string
          target_service?: string | null
          tool_tier?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          max_runs?: number | null
          name?: string
          next_run_at?: string | null
          org_id?: string
          payload?: Json
          run_count?: number
          schedule?: string
          status?: string
          target_service?: string | null
          tool_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      session_insights: {
        Row: {
          created_at: string
          description: string
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          insight_type: string
          metadata: Json | null
          org_id: string
          related_item_ids: string[] | null
          session_id: string
          severity: string
          source_item_ids: string[] | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          insight_type: string
          metadata?: Json | null
          org_id: string
          related_item_ids?: string[] | null
          session_id: string
          severity?: string
          source_item_ids?: string[] | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          insight_type?: string
          metadata?: Json | null
          org_id?: string
          related_item_ids?: string[] | null
          session_id?: string
          severity?: string
          source_item_ids?: string[] | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_insights_session_id_fkey"
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
          compacted_summary: string | null
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
          compacted_summary?: string | null
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
          compacted_summary?: string | null
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
      shared_conversations: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          shared_by: string
          shared_with: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          shared_by: string
          shared_with: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          shared_by?: string
          shared_with?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          author: string | null
          category: string
          config: Json | null
          created_at: string
          description: string
          icon: string | null
          id: string
          install_count: number
          is_active: boolean
          is_builtin: boolean
          name: string
          org_id: string
          reference_files: Json
          slash_command: string | null
          slug: string
          system_prompt: string | null
          tools: Json | null
          updated_at: string
          version: string
        }
        Insert: {
          author?: string | null
          category?: string
          config?: Json | null
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          install_count?: number
          is_active?: boolean
          is_builtin?: boolean
          name: string
          org_id: string
          reference_files?: Json
          slash_command?: string | null
          slug: string
          system_prompt?: string | null
          tools?: Json | null
          updated_at?: string
          version?: string
        }
        Update: {
          author?: string | null
          category?: string
          config?: Json | null
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          install_count?: number
          is_active?: boolean
          is_builtin?: boolean
          name?: string
          org_id?: string
          reference_files?: Json
          slash_command?: string | null
          slug?: string
          system_prompt?: string | null
          tools?: Json | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_org_id_fkey"
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
          created_by: string | null
          id: string
          name: string
          org_id: string
          tag_type: string | null
          usage_count: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          org_id: string
          tag_type?: string | null
          usage_count?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string
          tag_type?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          cost_usd: number | null
          created_at: string
          credits_used: number | null
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string
          operation: string
          org_id: string
          output_tokens: number | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          credits_used?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model: string
          operation: string
          org_id: string
          output_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          credits_used?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string
          operation?: string
          org_id?: string
          output_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interactions: {
        Row: {
          content_type: string | null
          created_at: string
          id: string
          interaction_type: string
          metadata: Json | null
          org_id: string
          query: string | null
          resource_id: string | null
          resource_type: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          id?: string
          interaction_type: string
          metadata?: Json | null
          org_id: string
          query?: string | null
          resource_id?: string | null
          resource_type?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          id?: string
          interaction_type?: string
          metadata?: Json | null
          org_id?: string
          query?: string | null
          resource_id?: string | null
          resource_type?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          processed_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: []
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
      add_credits: {
        Args: { p_amount: number; p_org_id: string }
        Returns: number
      }
      deduct_credits: {
        Args: { p_amount: number; p_org_id: string }
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

