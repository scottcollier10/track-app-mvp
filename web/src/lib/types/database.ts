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

export interface Database {
  public: {
    Tables: {
      drivers: {
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
      tracks: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          length_meters: number | null;
          config: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          length_meters?: number | null;
          config?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string | null;
          length_meters?: number | null;
          config?: string | null;
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
}
