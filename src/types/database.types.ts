/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with the Supabase MCP `generate_typescript_types` tool, or:
 *   npx supabase gen types typescript --project-id pueadfincgiwwylpgxxs
 *
 * Exempt from the 350-line cap in CLAUDE.md §2 (generated artifact).
 * Last generated: 2026-08-21
 */

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
      api_usage: {
        Row: {
          created_at: string
          endpoint: string
          game_id: string | null
          id: string
          ip_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          game_id?: string | null
          id?: string
          ip_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          game_id?: string | null
          id?: string
          ip_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_games: {
        Row: {
          connection_scores: Json | null
          created_at: string | null
          hints: Json | null
          id: string
          play_date: string
          theme: string | null
          words: string[]
        }
        Insert: {
          connection_scores?: Json | null
          created_at?: string | null
          hints?: Json | null
          id?: string
          play_date: string
          theme?: string | null
          words: string[]
        }
        Update: {
          connection_scores?: Json | null
          created_at?: string | null
          hints?: Json | null
          id?: string
          play_date?: string
          theme?: string | null
          words?: string[]
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          feedback_type: string
          id: string
          message: string
          name: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          feedback_type: string
          id?: string
          message: string
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          feedback_type?: string
          id?: string
          message?: string
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      game_players: {
        Row: {
          consecutive_correct_guesses: number | null
          game_id: string
          has_left: boolean | null
          is_archived: boolean | null
          joined_at: string | null
          score: number | null
          user_id: string
        }
        Insert: {
          consecutive_correct_guesses?: number | null
          game_id: string
          has_left?: boolean | null
          is_archived?: boolean | null
          joined_at?: string | null
          score?: number | null
          user_id: string
        }
        Update: {
          consecutive_correct_guesses?: number | null
          game_id?: string
          has_left?: boolean | null
          is_archived?: boolean | null
          joined_at?: string | null
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          archived_at: string | null
          created_at: string | null
          current_turn_user_id: string | null
          fever_mode_remaining: number | null
          handle: number
          id: string
          last_activity_at: string | null
          max_messages: number | null
          mode: string | null
          solve_proposal_confirmations: string[] | null
          solving_proposal_created_at: string | null
          solving_started_at: string | null
          status: string | null
          team_consecutive_correct: number | null
          team_pot: number | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          current_turn_user_id?: string | null
          fever_mode_remaining?: number | null
          handle?: number
          id?: string
          last_activity_at?: string | null
          max_messages?: number | null
          mode?: string | null
          solve_proposal_confirmations?: string[] | null
          solving_proposal_created_at?: string | null
          solving_started_at?: string | null
          status?: string | null
          team_consecutive_correct?: number | null
          team_pot?: number | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          current_turn_user_id?: string | null
          fever_mode_remaining?: number | null
          handle?: number
          id?: string
          last_activity_at?: string | null
          max_messages?: number | null
          mode?: string | null
          solve_proposal_confirmations?: string[] | null
          solving_proposal_created_at?: string | null
          solving_started_at?: string | null
          status?: string | null
          team_consecutive_correct?: number | null
          team_pot?: number | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          receiver_id: string
          sender_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_hint: string | null
          author_points: number | null
          cipher_length: number | null
          cipher_text: string | null
          content: string | null
          created_at: string | null
          game_id: string
          hint_level: number | null
          id: string
          is_solved: boolean | null
          solved_by: string | null
          strikes: number | null
          type: string | null
          user_id: string
          winner_points: number | null
        }
        Insert: {
          ai_hint?: string | null
          author_points?: number | null
          cipher_length?: number | null
          cipher_text?: string | null
          content?: string | null
          created_at?: string | null
          game_id: string
          hint_level?: number | null
          id?: string
          is_solved?: boolean | null
          solved_by?: string | null
          strikes?: number | null
          type?: string | null
          user_id: string
          winner_points?: number | null
        }
        Update: {
          ai_hint?: string | null
          author_points?: number | null
          cipher_length?: number | null
          cipher_text?: string | null
          content?: string | null
          created_at?: string | null
          game_id?: string
          hint_level?: number | null
          id?: string
          is_solved?: boolean | null
          solved_by?: string | null
          strikes?: number | null
          type?: string | null
          user_id?: string
          winner_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          has_seen_onboarding: boolean | null
          id: string
          is_admin: boolean | null
          settings: Json | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          has_seen_onboarding?: boolean | null
          id: string
          is_admin?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          has_seen_onboarding?: boolean | null
          id?: string
          is_admin?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      translation_generations: {
        Row: {
          game_id: string
          generated_at: string
          id: string
          locale: string
          meta: Json | null
        }
        Insert: {
          game_id: string
          generated_at?: string
          id?: string
          locale: string
          meta?: Json | null
        }
        Update: {
          game_id?: string
          generated_at?: string
          id?: string
          locale?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_generations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "daily_games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_games_logic: { Args: never; Returns: string }
      delete_expired_guests: { Args: never; Returns: undefined }
      distribute_game_points: {
        Args: {
          author_amount?: number
          author_id?: string
          game_id_param: string
          winner_amount: number
          winner_id: string
        }
        Returns: undefined
      }
      increment_score: {
        Args: { amount: number; game_id_param: string; row_id: string }
        Returns: undefined
      }
      increment_team_pot: {
        Args: { amount: number; game_id_param: string }
        Returns: undefined
      }
      player_leave_game: { Args: { p_game_id: string }; Returns: Json }
      send_game_message: {
        Args: {
          p_cipher_length: number
          p_cipher_text: string
          p_content: string
          p_game_id: string
          p_potential_value: number
        }
        Returns: Json
      }
    }
    Enums: {
      GameMode: "INPUT" | "SOLVE_PENDING" | "SOLVE"
      InviteStatus: "PENDING" | "ACCEPTED" | "DECLINED"
      Status: "ACTIVE" | "ARCHIVED" | "DELETED" | "FINISHED"
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

export const Constants = {
  public: {
    Enums: {
      GameMode: ["INPUT", "SOLVE_PENDING", "SOLVE"],
      InviteStatus: ["PENDING", "ACCEPTED", "DECLINED"],
      Status: ["ACTIVE", "ARCHIVED", "DELETED", "FINISHED"],
    },
  },
} as const
