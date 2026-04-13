-- Add 'confirmed' to alert_event_status enum for cloud confirmation results.
-- Run in Supabase SQL Editor before deploying analyze v1.3.0.
ALTER TYPE alert_event_status ADD VALUE IF NOT EXISTS 'confirmed';
