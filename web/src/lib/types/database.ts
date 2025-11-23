/**
 * Database Types
 *
 * TypeScript types for Supabase database schema
 * These match the schema defined in /supabase/migrations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      coaches: {
        Row: {
          id: string;
          name: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          created_at?: string;
        };
      };
      drivers: {
        Row: {
          id: string;
          name: string;
          email: string;
          coach_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          coach_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          coach_id?: string | null;
          created_at?: string;
        };
      };
      driver_profiles: {
        Row: {
          id: string;
          driver_id: string;
          experience_level: 'beginner' | 'intermediate' | 'advanced';
          total_sessions: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          experience_level: 'beginner' | 'intermediate' | 'advanced';
          total_sessions?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          experience_level?: 'beginner' | 'intermediate' | 'advanced';
          total_sessions?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      tracks: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          length_meters: number | null;
          config: string | null;
          map_image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          length_meters?: number | null;
          config?: string | null;
          map_image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string | null;
          length_meters?: number | null;
          config?: string | null;
          map_image_url?: string | null;
          created_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          driver_id: string;
          track_id: string;
          date: string;
          total_time_ms: number;
          best_lap_ms: number | null;
          coach_notes: string | null;
          ai_coaching_summary: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          track_id: string;
          date: string;
          total_time_ms: number;
          best_lap_ms?: number | null;
          coach_notes?: string | null;
          ai_coaching_summary?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          track_id?: string;
          date?: string;
          total_time_ms?: number;
          best_lap_ms?: number | null;
          coach_notes?: string | null;
          ai_coaching_summary?: string | null;
          source?: string;
          created_at?: string;
        };
      };
      laps: {
        Row: {
          id: string;
          session_id: string;
          lap_number: number;
          lap_time_ms: number;
          sector_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          lap_number: number;
          lap_time_ms: number;
          sector_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          lap_number?: number;
          lap_time_ms?: number;
          sector_data?: Json | null;
          created_at?: string;
        };
      };
      coaching_notes: {
        Row: {
          id: string;
          session_id: string;
          author: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          author: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          author?: string;
          body?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
