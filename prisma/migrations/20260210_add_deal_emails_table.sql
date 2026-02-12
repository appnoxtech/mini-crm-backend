-- Migration: Add deal_emails junction table
-- Purpose: Link existing emails from mail integration to imported Pipedrive deals

-- Create deal_emails junction table
CREATE TABLE IF NOT EXISTS deal_emails (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL,
    email_id VARCHAR(255) NOT NULL,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    linked_method VARCHAR(50) NOT NULL CHECK (linked_method IN ('auto_contact', 'auto_domain', 'auto_subject', 'manual')),
    confidence_score INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by_user_id INTEGER,
    verified_at TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_deal_emails_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
    CONSTRAINT fk_deal_emails_email FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    CONSTRAINT fk_deal_emails_verified_by FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Unique constraint to prevent duplicate links
    CONSTRAINT unique_deal_email_link UNIQUE (deal_id, email_id)
);

-- Create indexes for performance
CREATE INDEX idx_deal_emails_deal ON deal_emails(deal_id);
CREATE INDEX idx_deal_emails_email ON deal_emails(email_id);
CREATE INDEX idx_deal_emails_verified ON deal_emails(is_verified);
CREATE INDEX idx_deal_emails_linked_method ON deal_emails(linked_method);
CREATE INDEX idx_deal_emails_created ON deal_emails(linked_at DESC);

-- Add sync status columns to deals table (optional but recommended for performance)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS email_sync_status VARCHAR(20) DEFAULT 'not_synced' CHECK (email_sync_status IN ('not_synced', 'syncing', 'synced', 'failed')),
ADD COLUMN IF NOT EXISTS email_last_synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS linked_emails_count INTEGER DEFAULT 0;

CREATE INDEX idx_deals_email_sync_status ON deals(email_sync_status);

-- Add flag to emails table for quick lookup
ALTER TABLE emails 
ADD COLUMN IF NOT EXISTS is_linked_to_deal BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_emails_is_linked ON emails(is_linked_to_deal);

-- Create email_link_log table for tracking bulk operations (optional for debugging)
CREATE TABLE IF NOT EXISTS email_link_log (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('bulk_link', 'single_deal_link', 're_sync')),
    deals_processed INTEGER DEFAULT 0,
    links_created INTEGER DEFAULT 0,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    error_message TEXT,
    triggered_by_user_id INTEGER,
    metadata JSONB,
    
    CONSTRAINT fk_email_link_log_user FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_email_link_log_status ON email_link_log(status);
CREATE INDEX idx_email_link_log_started ON email_link_log(started_at DESC);

-- Add comments for documentation
COMMENT ON TABLE deal_emails IS 'Junction table linking emails to deals with match metadata';
COMMENT ON COLUMN deal_emails.linked_method IS 'How this link was created: auto_contact, auto_domain, auto_subject, or manual';
COMMENT ON COLUMN deal_emails.confidence_score IS 'Match confidence from 0-100 for auto-linked emails';
COMMENT ON COLUMN deal_emails.is_verified IS 'Whether a user has confirmed this link is correct';
