-- Database Migrations for Track App V1 Dashboard & Analytics
-- Run these in Supabase SQL Editor

-- Migration 1: Add coach_notes column to sessions table
-- This allows coaches to add notes directly to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coach_notes TEXT;

-- Migration 2: Add mapImageUrl column to tracks table (optional)
-- This allows storing track map images for future use
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS map_image_url TEXT;

-- Verify migrations
-- Check that columns were added successfully
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sessions' AND column_name = 'coach_notes';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tracks' AND column_name = 'map_image_url';
