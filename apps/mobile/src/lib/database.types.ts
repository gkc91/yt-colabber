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
      ai_summary_runs: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summary_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_summary_runs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          created_at: string
          id: string
          note: string | null
          profile_id: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          profile_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          profile_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          band: Database["public"]["Enums"]["subscriber_band"] | null
          channel_title: string | null
          created_at: string
          id: string
          language: string
          niche_changed_at: string | null
          niche_id: number
          platform: string
          profile_id: string
          youtube_channel_id: string | null
          youtube_url: string
        }
        Insert: {
          band?: Database["public"]["Enums"]["subscriber_band"] | null
          channel_title?: string | null
          created_at?: string
          id?: string
          language?: string
          niche_changed_at?: string | null
          niche_id: number
          platform?: string
          profile_id: string
          youtube_channel_id?: string | null
          youtube_url: string
        }
        Update: {
          band?: Database["public"]["Enums"]["subscriber_band"] | null
          channel_title?: string | null
          created_at?: string
          id?: string
          language?: string
          niche_changed_at?: string | null
          niche_id?: number
          platform?: string
          profile_id?: string
          youtube_channel_id?: string | null
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_likes: {
        Row: {
          created_at: string
          from_id: string
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_likes_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_likes_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_matches: {
        Row: {
          a_id: string
          b_id: string
          created_at: string
          id: string
        }
        Insert: {
          a_id: string
          b_id: string
          created_at?: string
          id?: string
        }
        Update: {
          a_id?: string
          b_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_matches_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_matches_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_profiles: {
        Row: {
          bio: string | null
          is_open: boolean
          profile_id: string
          types: Database["public"]["Enums"]["collab_type"][]
          updated_at: string
        }
        Insert: {
          bio?: string | null
          is_open?: boolean
          profile_id: string
          types?: Database["public"]["Enums"]["collab_type"][]
          updated_at?: string
        }
        Update: {
          bio?: string | null
          is_open?: boolean
          profile_id?: string
          types?: Database["public"]["Enums"]["collab_type"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: number
          note: string | null
          profile_id: string
          reason: Database["public"]["Enums"]["ledger_reason"]
          ref_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: number
          note?: string | null
          profile_id: string
          reason: Database["public"]["Enums"]["ledger_reason"]
          ref_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: number
          note?: string | null
          profile_id?: string
          reason?: Database["public"]["Enums"]["ledger_reason"]
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: number
          match_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: number
          match_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: number
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "collab_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      niche_thumbnail_cache: {
        Row: {
          channel_title: string | null
          fetched_at: string
          id: number
          is_vertical: boolean
          niche_id: number
          thumbnail_url: string
          title: string
          video_id: string
          view_count: number | null
        }
        Insert: {
          channel_title?: string | null
          fetched_at?: string
          id?: number
          is_vertical?: boolean
          niche_id: number
          thumbnail_url: string
          title: string
          video_id: string
          view_count?: number | null
        }
        Update: {
          channel_title?: string | null
          fetched_at?: string
          id?: number
          is_vertical?: boolean
          niche_id?: number
          thumbnail_url?: string
          title?: string
          video_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "niche_thumbnail_cache_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          id: number
          is_active: boolean
          name: string
          queries: string[]
          slug: string
        }
        Insert: {
          id?: number
          is_active?: boolean
          name: string
          queries?: string[]
          slug: string
        }
        Update: {
          id?: number
          is_active?: boolean
          name?: string
          queries?: string[]
          slug?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload: Json
          profile_id: string
          sent_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          profile_id: string
          sent_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          profile_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          also_review_languages: string[]
          also_review_niche_ids: number[]
          created_at: string
          device_ids: string[]
          display_name: string | null
          expo_push_token: string | null
          flagged_at: string | null
          flagged_reason: string | null
          handle: string | null
          id: string
          is_flagged: boolean
          language: string
          niche_changed_at: string | null
          niche_id: number | null
          onboarding_done: boolean
          reputation: number
          reviews_given: number
          reviews_received: number
        }
        Insert: {
          also_review_languages?: string[]
          also_review_niche_ids?: number[]
          created_at?: string
          device_ids?: string[]
          display_name?: string | null
          expo_push_token?: string | null
          flagged_at?: string | null
          flagged_reason?: string | null
          handle?: string | null
          id: string
          is_flagged?: boolean
          language?: string
          niche_changed_at?: string | null
          niche_id?: number | null
          onboarding_done?: boolean
          reputation?: number
          reviews_given?: number
          reviews_received?: number
        }
        Update: {
          also_review_languages?: string[]
          also_review_niche_ids?: number[]
          created_at?: string
          device_ids?: string[]
          display_name?: string | null
          expo_push_token?: string | null
          flagged_at?: string | null
          flagged_reason?: string | null
          handle?: string | null
          id?: string
          is_flagged?: boolean
          language?: string
          niche_changed_at?: string | null
          niche_id?: number | null
          onboarding_done?: boolean
          reputation?: number
          reviews_given?: number
          reviews_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          credits: number
          id: string
          product_id: string
          profile_id: string
          raw: Json | null
          rc_event_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          product_id: string
          profile_id: string
          raw?: Json | null
          rc_event_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          product_id?: string
          profile_id?: string
          raw?: Json | null
          rc_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          overturned: boolean
          reason: string
          reporter_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          overturned?: boolean
          reason: string
          reporter_id: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          overturned?: boolean
          reason?: string
          reporter_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_tasks: {
        Row: {
          assigned_at: string
          candidate_position: number
          decoys: Json
          expires_at: string
          id: string
          reviewer_id: string
          status: Database["public"]["Enums"]["task_status"]
          submission_id: string
          thumbnail_index: number
          title_index: number
        }
        Insert: {
          assigned_at?: string
          candidate_position: number
          decoys: Json
          expires_at?: string
          id?: string
          reviewer_id: string
          status?: Database["public"]["Enums"]["task_status"]
          submission_id: string
          thumbnail_index: number
          title_index: number
        }
        Update: {
          assigned_at?: string
          candidate_position?: number
          decoys?: Json
          expires_at?: string
          id?: string
          reviewer_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          submission_id?: string
          thumbnail_index?: number
          title_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_tasks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tasks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          decision_ms: number
          helpful: boolean | null
          id: string
          is_reported: boolean
          leave_second: number | null
          picked_candidate: boolean
          picked_position: number
          promise_understood: boolean | null
          reason_tags: string[]
          reviewer_id: string | null
          submission_id: string
          task_id: string | null
          thumbnail_index: number
          time_spent_seconds: number
          title_guess: string
          title_index: number
          watched_seconds: number
          weight: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decision_ms: number
          helpful?: boolean | null
          id?: string
          is_reported?: boolean
          leave_second?: number | null
          picked_candidate: boolean
          picked_position: number
          promise_understood?: boolean | null
          reason_tags?: string[]
          reviewer_id?: string | null
          submission_id: string
          task_id?: string | null
          thumbnail_index: number
          time_spent_seconds: number
          title_guess: string
          title_index: number
          watched_seconds: number
          weight?: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          decision_ms?: number
          helpful?: boolean | null
          id?: string
          is_reported?: boolean
          leave_second?: number | null
          picked_candidate?: boolean
          picked_position?: number
          promise_understood?: boolean | null
          reason_tags?: string[]
          reviewer_id?: string | null
          submission_id?: string
          task_id?: string | null
          thumbnail_index?: number
          time_spent_seconds?: number
          title_guess?: string
          title_index?: number
          watched_seconds?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "review_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          ai_summary: string | null
          channel_id: string | null
          clip_deleted_at: string | null
          clip_duration_seconds: number
          clip_path: string
          closes_at: string
          created_at: string
          hidden_at: string | null
          hidden_reason: string | null
          id: string
          is_demo: boolean
          is_priority: boolean
          is_vertical: boolean
          language: string
          niche_id: number
          owner_id: string
          received_reviews: number
          report_count: number
          requested_reviews: number
          screen_attempts: number
          screened_at: string | null
          status: Database["public"]["Enums"]["submission_status"]
          thumbnail_paths: string[]
          title_options: string[]
        }
        Insert: {
          ai_summary?: string | null
          channel_id?: string | null
          clip_deleted_at?: string | null
          clip_duration_seconds: number
          clip_path: string
          closes_at?: string
          created_at?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          is_demo?: boolean
          is_priority?: boolean
          is_vertical?: boolean
          language?: string
          niche_id: number
          owner_id: string
          received_reviews?: number
          report_count?: number
          requested_reviews: number
          screen_attempts?: number
          screened_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          thumbnail_paths: string[]
          title_options: string[]
        }
        Update: {
          ai_summary?: string | null
          channel_id?: string | null
          clip_deleted_at?: string | null
          clip_duration_seconds?: number
          clip_path?: string
          closes_at?: string
          created_at?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          is_demo?: boolean
          is_priority?: boolean
          is_vertical?: boolean
          language?: string
          niche_id?: number
          owner_id?: string
          received_reviews?: number
          report_count?: number
          requested_reviews?: number
          screen_attempts?: number
          screened_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          thumbnail_paths?: string[]
          title_options?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "submissions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active: boolean
          expires_at: string | null
          profile_id: string
          source: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          expires_at?: string | null
          profile_id: string
          source?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          expires_at?: string | null
          profile_id?: string
          source?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profile_balances: {
        Row: {
          balance: number | null
          profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_channel: {
        Args: {
          p_band?: Database["public"]["Enums"]["subscriber_band"]
          p_channel_title?: string
          p_language?: string
          p_niche_id: number
          p_platform?: string
          p_youtube_channel_id?: string
          p_youtube_url: string
        }
        Returns: string
      }
      ai_summary_limit: { Args: never; Returns: number }
      ai_summary_min_reviews: { Args: never; Returns: number }
      ai_summary_status: { Args: { p_submission: string }; Returns: Json }
      appeal_submission: {
        Args: { p_note?: string; p_submission_id: string }
        Returns: string
      }
      balance_of: { Args: { p: string }; Returns: number }
      change_channel_niche: {
        Args: { p_channel_id: string; p_niche_id: number }
        Returns: undefined
      }
      change_niche: { Args: { p_niche_id: number }; Returns: undefined }
      claim_ai_summary: {
        Args: { p_profile: string; p_submission: string }
        Returns: string
      }
      clip_retention_days: { Args: never; Returns: number }
      close_stale_submissions: { Args: never; Returns: undefined }
      collab_candidates: { Args: { p_limit?: number }; Returns: Json }
      collab_like: { Args: { p_to: string }; Returns: string }
      create_demo_submission: {
        Args: {
          p_clip_duration: number
          p_clip_path: string
          p_is_vertical?: boolean
          p_language?: string
          p_niche_slug: string
          p_owner: string
          p_thumbnail_paths: string[]
          p_title_options: string[]
        }
        Returns: string
      }
      create_submission: {
        Args: {
          p_channel_id?: string
          p_clip_duration: number
          p_clip_path: string
          p_is_vertical?: boolean
          p_requested: number
          p_thumbnail_paths: string[]
          p_title_options: string[]
        }
        Returns: string
      }
      decoy_keywords: {
        Args: { p_niche_id: number; p_title: string }
        Returns: string[]
      }
      expire_tasks: { Args: never; Returns: undefined }
      expired_clips: {
        Args: { p_limit?: number }
        Returns: {
          clip_path: string
          id: string
        }[]
      }
      grant_monthly_pro_credits: { Args: never; Returns: number }
      grant_pro_credits: { Args: { p_profile: string }; Returns: boolean }
      grant_purchase: {
        Args: {
          p_credits: number
          p_pro_active?: boolean
          p_pro_expires?: string
          p_product: string
          p_profile: string
          p_raw: Json
          p_rc_event_id: string
        }
        Returns: undefined
      }
      is_pro: { Args: { p: string }; Returns: boolean }
      mark_clips_deleted: { Args: { p_ids: string[] }; Returns: number }
      media_paths: {
        Args: { p_submission_id?: string; p_task_id?: string }
        Returns: Json
      }
      next_review_task: { Args: never; Returns: Json }
      niches_to_refresh: {
        Args: never
        Returns: {
          slug: string
        }[]
      }
      pick_decoys: {
        Args: { p_niche_id: number; p_title: string; p_vertical?: boolean }
        Returns: Json
      }
      queue_task_reminders: { Args: never; Returns: number }
      rate_review: {
        Args: {
          p_helpful: boolean
          p_promise_understood?: boolean
          p_review_id: string
        }
        Returns: undefined
      }
      register_device: { Args: { p_device_id: string }; Returns: undefined }
      reject_appeal: {
        Args: { p_note?: string; p_submission_id: string }
        Returns: undefined
      }
      release_ai_summary_claim: {
        Args: { p_submission: string }
        Returns: undefined
      }
      release_stuck_screening: { Args: never; Returns: number }
      report_content: {
        Args: {
          p_note?: string
          p_reason: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      report_is_weighted: { Args: { p_reporter: string }; Returns: boolean }
      report_threshold: {
        Args: { p_reason: string; p_weighted: boolean }
        Returns: number
      }
      restore_submission: {
        Args: { p_note?: string; p_submission_id: string }
        Returns: undefined
      }
      reviewed_channel: { Args: { p_submission_id: string }; Returns: Json }
      screening_enabled: { Args: never; Returns: boolean }
      screening_failed: {
        Args: { p_reason?: string; p_submission_id: string }
        Returns: undefined
      }
      screening_passed: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      send_message: {
        Args: { p_body: string; p_match: string }
        Returns: number
      }
      set_initial_niche: {
        Args: { p_language?: string; p_niche_id: number }
        Returns: undefined
      }
      submission_results: {
        Args: { p_id: string; p_uid?: string }
        Returns: Json
      }
      submit_review: {
        Args: {
          p_comment: string
          p_decision_ms: number
          p_leave_second: number
          p_picked_candidate: boolean
          p_picked_position: number
          p_reason_tags: string[]
          p_task_id: string
          p_time_spent: number
          p_title_guess: string
          p_watched_seconds: number
        }
        Returns: string
      }
      trigger_cleanup_clips: { Args: never; Returns: undefined }
      trigger_notify: { Args: never; Returns: undefined }
      trigger_refresh_niche_cache: { Args: never; Returns: undefined }
      trigger_screen_media: { Args: never; Returns: undefined }
    }
    Enums: {
      collab_type:
        | "joint_video"
        | "guest"
        | "shorts"
        | "end_screen_swap"
        | "live"
      ledger_reason:
        | "signup_bonus"
        | "review_reward"
        | "submission_cost"
        | "refund"
        | "purchase"
        | "subscription_grant"
        | "admin"
      notification_kind:
        | "reviews_arriving"
        | "test_completed"
        | "tasks_waiting"
        | "submission_hidden"
      submission_status:
        | "open"
        | "completed"
        | "cancelled"
        | "hidden"
        | "screening"
      subscriber_band:
        | "b0_100"
        | "b100_1k"
        | "b1k_10k"
        | "b10k_100k"
        | "b100k_plus"
      subscription_tier: "free" | "pro"
      task_status: "assigned" | "done" | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      collab_type: [
        "joint_video",
        "guest",
        "shorts",
        "end_screen_swap",
        "live",
      ],
      ledger_reason: [
        "signup_bonus",
        "review_reward",
        "submission_cost",
        "refund",
        "purchase",
        "subscription_grant",
        "admin",
      ],
      notification_kind: [
        "reviews_arriving",
        "test_completed",
        "tasks_waiting",
        "submission_hidden",
      ],
      submission_status: [
        "open",
        "completed",
        "cancelled",
        "hidden",
        "screening",
      ],
      subscriber_band: [
        "b0_100",
        "b100_1k",
        "b1k_10k",
        "b10k_100k",
        "b100k_plus",
      ],
      subscription_tier: ["free", "pro"],
      task_status: ["assigned", "done", "expired"],
    },
  },
} as const

