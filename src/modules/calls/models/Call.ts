import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';

// ============================================
// Call-related Interfaces
// ============================================

/**
 * Call direction - whether the call is outgoing (from CRM to contact) or incoming
 */
export type CallDirection = 'inbound' | 'outbound';

/**
 * Call status lifecycle
 * - initiated: Call has been requested but not yet connected
 * - ringing: Call is ringing on the recipient's end
 * - in-progress: Call is currently active
 * - completed: Call ended normally
 * - busy: Recipient's line was busy
 * - no-answer: Call was not answered
 * - failed: Call failed due to technical issues
 * - canceled: Call was canceled before being answered
 * - voicemail: Call went to voicemail
 */
export type CallStatus =
    | 'initiated'
    | 'ringing'
    | 'in-progress'
    | 'completed'
    | 'busy'
    | 'no-answer'
    | 'failed'
    | 'canceled'
    | 'voicemail';

/**
 * Call disposition - outcome/result of the call for CRM tracking
 */
export type CallDisposition =
    | 'connected'
    | 'left-voicemail'
    | 'no-answer'
    | 'busy'
    | 'wrong-number'
    | 'callback-requested'
    | 'not-interested'
    | 'interested'
    | 'follow-up-scheduled'
    | 'other';

/**
 * Main Call interface
 */
export interface Call extends BaseEntity {
    // Twilio identifiers
    twilioCallSid: string;           // Unique Twilio Call SID
    twilioAccountSid: string;        // Twilio Account SID

    // Call metadata
    direction: CallDirection;
    status: CallStatus;
    fromNumber: string;              // Caller phone number
    toNumber: string;                // Recipient phone number

    // Timing
    startTime?: string;              // When the call was initiated
    answerTime?: string;             // When the call was answered
    endTime?: string;                // When the call ended
    duration: number;                // Call duration in seconds
    ringDuration?: number;           // How long the phone rang before answer

    // CRM relationships
    userId: number;                  // User who made/received the call
    contactId?: number;              // Associated contact (if exists)
    dealId?: number;                 // Associated deal (if any)
    leadId?: number;                 // Associated lead (if any)

    // Call outcome/notes
    disposition?: CallDisposition;
    notes?: string;
    summary?: string;                // AI-generated call summary

    // Queue/routing info
    queueName?: string;              // For incoming calls routed through queue
    assignedAgentId?: number;        // For incoming call routing

    // Soft delete
    deletedAt?: string;
}

/**
 * Call participant for multi-party calls
 */
export interface CallParticipant extends BaseEntity {
    callId: number;
    participantSid?: string;         // Twilio participant SID
    phoneNumber: string;
    name?: string;
    role: 'caller' | 'callee' | 'transfer' | 'conference';
    joinTime?: string;
    leaveTime?: string;
    muted: boolean;
    hold: boolean;
}

/**
 * Call recording metadata
 */
export interface CallRecording extends BaseEntity {
    callId: number;
    recordingSid: string;            // Twilio Recording SID
    recordingUrl?: string;           // URL to access the recording
    localFilePath?: string;          // Local file path if downloaded
    duration: number;                // Recording duration in seconds
    fileSize?: number;               // File size in bytes
    channels: number;                // 1 = mono, 2 = dual-channel
    status: 'processing' | 'completed' | 'failed' | 'deleted';

    // Transcription
    transcriptionSid?: string;
    transcriptionText?: string;
    transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    transcriptionUrl?: string;
}

/**
 * Call event/log for tracking call lifecycle
 */
export interface CallEvent extends BaseEntity {
    callId: number;
    eventType: string;               // e.g., 'status-change', 'note-added', 'transferred'
    eventData?: string;              // JSON string with event details
    triggeredBy?: number;            // User ID if triggered by a user action
}

// ============================================
// Call Model Class
// ============================================

export class CallModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    /**
     * Initialize all call-related tables with proper indexes
     */
    initialize(): void {
        // Main calls table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        twilioCallSid TEXT UNIQUE,
        twilioAccountSid TEXT,
        direction TEXT NOT NULL DEFAULT 'outbound',
        status TEXT NOT NULL DEFAULT 'initiated',
        fromNumber TEXT NOT NULL,
        toNumber TEXT NOT NULL,
        startTime TEXT,
        answerTime TEXT,
        endTime TEXT,
        duration INTEGER DEFAULT 0,
        ringDuration INTEGER,
        userId INTEGER NOT NULL,
        contactId INTEGER,
        dealId INTEGER,
        leadId INTEGER,
        disposition TEXT,
        notes TEXT,
        summary TEXT,
        queueName TEXT,
        assignedAgentId INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (contactId) REFERENCES persons(id),
        FOREIGN KEY (dealId) REFERENCES deals(id),
        FOREIGN KEY (leadId) REFERENCES leads(id),
        FOREIGN KEY (assignedAgentId) REFERENCES users(id)
      )
    `);

        // Call participants table (for multi-party calls)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callId INTEGER NOT NULL,
        participantSid TEXT,
        phoneNumber TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'callee',
        joinTime TEXT,
        leaveTime TEXT,
        muted INTEGER DEFAULT 0,
        hold INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (callId) REFERENCES calls(id) ON DELETE CASCADE
      )
    `);

        // Call recordings table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callId INTEGER NOT NULL,
        recordingSid TEXT UNIQUE,
        recordingUrl TEXT,
        localFilePath TEXT,
        duration INTEGER DEFAULT 0,
        fileSize INTEGER,
        channels INTEGER DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'processing',
        transcriptionSid TEXT,
        transcriptionText TEXT,
        transcriptionStatus TEXT,
        transcriptionUrl TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (callId) REFERENCES calls(id) ON DELETE CASCADE
      )
    `);

        // Call events/log table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callId INTEGER NOT NULL,
        eventType TEXT NOT NULL,
        eventData TEXT,
        triggeredBy INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (callId) REFERENCES calls(id) ON DELETE CASCADE,
        FOREIGN KEY (triggeredBy) REFERENCES users(id)
      )
    `);

        // Create indexes for performance
        this.createIndexes();
    }

    /**
     * Create indexes for optimal query performance
     */
    private createIndexes(): void {
        // Calls table indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_userId ON calls(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_contactId ON calls(contactId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_dealId ON calls(dealId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_leadId ON calls(leadId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_twilioCallSid ON calls(twilioCallSid)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_createdAt ON calls(createdAt)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_startTime ON calls(startTime)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_calls_deletedAt ON calls(deletedAt)');

        // Participants indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_call_participants_callId ON call_participants(callId)');

        // Recordings indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_call_recordings_callId ON call_recordings(callId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_call_recordings_recordingSid ON call_recordings(recordingSid)');

        // Events indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_call_events_callId ON call_events(callId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_call_events_eventType ON call_events(eventType)');
    }

    // ============================================
    // Call CRUD Operations
    // ============================================

    /**
     * Create a new call record
     */
    createCall(callData: Omit<Call, 'id' | 'createdAt' | 'updatedAt'>): Call {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO calls (
        twilioCallSid, twilioAccountSid, direction, status,
        fromNumber, toNumber, startTime, answerTime, endTime,
        duration, ringDuration, userId, contactId, dealId, leadId,
        disposition, notes, summary, queueName, assignedAgentId,
        createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            callData.twilioCallSid,
            callData.twilioAccountSid,
            callData.direction,
            callData.status,
            callData.fromNumber,
            callData.toNumber,
            callData.startTime || now,
            callData.answerTime,
            callData.endTime,
            callData.duration || 0,
            callData.ringDuration,
            callData.userId,
            callData.contactId || null,
            callData.dealId || null,
            callData.leadId || null,
            callData.disposition || null,
            callData.notes || null,
            callData.summary || null,
            callData.queueName || null,
            callData.assignedAgentId || null,
            now,
            now
        );

        const call = this.findById(result.lastInsertRowid as number);
        if (!call) throw new Error('Failed to create call');

        // Add initial event
        this.addEvent(call.id, 'call-initiated', JSON.stringify({ status: 'initiated', direction: callData.direction }));

        return call;
    }

    /**
     * Find call by ID
     */
    findById(id: number): Call | undefined {
        const stmt = this.db.prepare('SELECT * FROM calls WHERE id = ? AND deletedAt IS NULL');
        return stmt.get(id) as Call | undefined;
    }

    /**
     * Find call by Twilio Call SID
     */
    findByTwilioSid(twilioCallSid: string): Call | undefined {
        const stmt = this.db.prepare('SELECT * FROM calls WHERE twilioCallSid = ? AND deletedAt IS NULL');
        return stmt.get(twilioCallSid) as Call | undefined;
    }

    /**
     * Get calls for a user with pagination and filters
     */
    findByUserId(userId: number, options: {
        direction?: CallDirection;
        status?: CallStatus;
        contactId?: number;
        dealId?: number;
        startDate?: string;
        endDate?: string;
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): { calls: Call[]; count: number; total: number } {
        let query = 'SELECT * FROM calls WHERE userId = ?';
        const params: any[] = [userId];

        if (!options.includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }

        if (options.direction) {
            query += ' AND direction = ?';
            params.push(options.direction);
        }

        if (options.status) {
            query += ' AND status = ?';
            params.push(options.status);
        }

        if (options.contactId) {
            query += ' AND contactId = ?';
            params.push(options.contactId);
        }

        if (options.dealId) {
            query += ' AND dealId = ?';
            params.push(options.dealId);
        }

        if (options.startDate) {
            query += ' AND createdAt >= ?';
            params.push(options.startDate);
        }

        if (options.endDate) {
            query += ' AND createdAt <= ?';
            params.push(options.endDate);
        }

        if (options.search) {
            query += ' AND (fromNumber LIKE ? OR toNumber LIKE ? OR notes LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Get total count before pagination
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
        const countResult = this.db.prepare(countQuery).get(...params) as { count: number };

        // Add ordering and pagination
        query += ' ORDER BY createdAt DESC';

        if (options.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(options.limit, options.offset || 0);
        }

        const calls = this.db.prepare(query).all(...params) as Call[];

        // Get total for user (without filters)
        const totalQuery = options.includeDeleted
            ? 'SELECT COUNT(*) as total FROM calls WHERE userId = ?'
            : 'SELECT COUNT(*) as total FROM calls WHERE userId = ? AND deletedAt IS NULL';
        const totalResult = this.db.prepare(totalQuery).get(userId) as { total: number };

        return { calls, count: countResult.count, total: totalResult.total };
    }

    /**
     * Update call status
     */
    updateStatus(id: number, status: CallStatus, additionalData?: Partial<Call>): Call | null {
        const call = this.findById(id);
        if (!call) return null;

        const now = new Date().toISOString();
        let updates = ['status = ?', 'updatedAt = ?'];
        const params: any[] = [status, now];

        // Handle status-specific updates
        if (status === 'in-progress' && !call.answerTime) {
            updates.push('answerTime = ?');
            params.push(now);
        }

        if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(status)) {
            updates.push('endTime = ?');
            params.push(now);

            // Calculate duration if we have answer time
            if (call.answerTime) {
                const duration = Math.floor((new Date(now).getTime() - new Date(call.answerTime).getTime()) / 1000);
                updates.push('duration = ?');
                params.push(duration);
            }
        }

        // Apply additional data
        if (additionalData) {
            if (additionalData.disposition) {
                updates.push('disposition = ?');
                params.push(additionalData.disposition);
            }
            if (additionalData.notes !== undefined) {
                updates.push('notes = ?');
                params.push(additionalData.notes);
            }
            if (additionalData.duration !== undefined) {
                updates.push('duration = ?');
                params.push(additionalData.duration);
            }
        }

        params.push(id);

        const stmt = this.db.prepare(`UPDATE calls SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...params);

        // Add event
        this.addEvent(id, 'status-change', JSON.stringify({ previousStatus: call.status, newStatus: status }));

        return this.findById(id) || null;
    }

    /**
     * Update call notes and disposition
     */
    updateCallDetails(id: number, userId: number, data: { notes?: string; disposition?: CallDisposition; summary?: string }): Call | null {
        const call = this.findById(id);
        if (!call || call.userId !== userId) return null;

        const now = new Date().toISOString();
        const updates: string[] = ['updatedAt = ?'];
        const params: any[] = [now];

        if (data.notes !== undefined) {
            updates.push('notes = ?');
            params.push(data.notes);
        }

        if (data.disposition !== undefined) {
            updates.push('disposition = ?');
            params.push(data.disposition);
        }

        if (data.summary !== undefined) {
            updates.push('summary = ?');
            params.push(data.summary);
        }

        params.push(id);

        const stmt = this.db.prepare(`UPDATE calls SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...params);

        // Add event
        this.addEvent(id, 'details-updated', JSON.stringify(data), userId);

        return this.findById(id) || null;
    }

    /**
     * Soft delete a call
     */
    softDelete(id: number, userId: number): boolean {
        const call = this.findById(id);
        if (!call || call.userId !== userId) return false;

        const now = new Date().toISOString();
        const stmt = this.db.prepare('UPDATE calls SET deletedAt = ?, updatedAt = ? WHERE id = ?');
        const result = stmt.run(now, now, id);

        return result.changes > 0;
    }

    // ============================================
    // Call Participants Operations
    // ============================================

    addParticipant(participantData: Omit<CallParticipant, 'id' | 'createdAt' | 'updatedAt'>): CallParticipant {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO call_participants (
        callId, participantSid, phoneNumber, name, role,
        joinTime, leaveTime, muted, hold, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            participantData.callId,
            participantData.participantSid || null,
            participantData.phoneNumber,
            participantData.name || null,
            participantData.role,
            participantData.joinTime || now,
            participantData.leaveTime || null,
            participantData.muted ? 1 : 0,
            participantData.hold ? 1 : 0,
            now,
            now
        );

        return this.getParticipantById(result.lastInsertRowid as number)!;
    }

    getParticipantById(id: number): CallParticipant | undefined {
        const stmt = this.db.prepare('SELECT * FROM call_participants WHERE id = ?');
        const participant = stmt.get(id) as any;
        if (!participant) return undefined;
        return { ...participant, muted: !!participant.muted, hold: !!participant.hold };
    }

    getParticipantsByCallId(callId: number): CallParticipant[] {
        const stmt = this.db.prepare('SELECT * FROM call_participants WHERE callId = ?');
        const participants = stmt.all(callId) as any[];
        return participants.map(p => ({ ...p, muted: !!p.muted, hold: !!p.hold }));
    }

    // ============================================
    // Call Recordings Operations
    // ============================================

    addRecording(recordingData: Omit<CallRecording, 'id' | 'createdAt' | 'updatedAt'>): CallRecording {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO call_recordings (
        callId, recordingSid, recordingUrl, localFilePath, duration,
        fileSize, channels, status, transcriptionSid, transcriptionText,
        transcriptionStatus, transcriptionUrl, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            recordingData.callId,
            recordingData.recordingSid,
            recordingData.recordingUrl || null,
            recordingData.localFilePath || null,
            recordingData.duration || 0,
            recordingData.fileSize || null,
            recordingData.channels || 1,
            recordingData.status,
            recordingData.transcriptionSid || null,
            recordingData.transcriptionText || null,
            recordingData.transcriptionStatus || null,
            recordingData.transcriptionUrl || null,
            now,
            now
        );

        return this.getRecordingById(result.lastInsertRowid as number)!;
    }

    getRecordingById(id: number): CallRecording | undefined {
        const stmt = this.db.prepare('SELECT * FROM call_recordings WHERE id = ?');
        return stmt.get(id) as CallRecording | undefined;
    }

    getRecordingByCallId(callId: number): CallRecording | undefined {
        const stmt = this.db.prepare('SELECT * FROM call_recordings WHERE callId = ?');
        return stmt.get(callId) as CallRecording | undefined;
    }

    getRecordingByRecordingSid(recordingSid: string): CallRecording | undefined {
        const stmt = this.db.prepare('SELECT * FROM call_recordings WHERE recordingSid = ?');
        return stmt.get(recordingSid) as CallRecording | undefined;
    }

    updateRecording(id: number, data: Partial<CallRecording>): CallRecording | null {
        const recording = this.getRecordingById(id);
        if (!recording) return null;

        const now = new Date().toISOString();
        const updates: string[] = ['updatedAt = ?'];
        const params: any[] = [now];

        const allowedFields = ['recordingUrl', 'localFilePath', 'duration', 'fileSize', 'status',
            'transcriptionSid', 'transcriptionText', 'transcriptionStatus', 'transcriptionUrl'];

        for (const field of allowedFields) {
            if ((data as any)[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push((data as any)[field]);
            }
        }

        params.push(id);
        const stmt = this.db.prepare(`UPDATE call_recordings SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...params);

        return this.getRecordingById(id) || null;
    }

    // ============================================
    // Call Events Operations
    // ============================================

    addEvent(callId: number, eventType: string, eventData?: string, triggeredBy?: number): CallEvent {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO call_events (callId, eventType, eventData, triggeredBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(callId, eventType, eventData || null, triggeredBy || null, now, now);
        return this.getEventById(result.lastInsertRowid as number)!;
    }

    getEventById(id: number): CallEvent | undefined {
        const stmt = this.db.prepare('SELECT * FROM call_events WHERE id = ?');
        return stmt.get(id) as CallEvent | undefined;
    }

    getEventsByCallId(callId: number): CallEvent[] {
        const stmt = this.db.prepare('SELECT * FROM call_events WHERE callId = ? ORDER BY createdAt DESC');
        return stmt.all(callId) as CallEvent[];
    }

    // ============================================
    // Statistics and Analytics
    // ============================================

    getCallStats(userId: number, options: { startDate?: string; endDate?: string } = {}): {
        totalCalls: number;
        inboundCalls: number;
        outboundCalls: number;
        completedCalls: number;
        missedCalls: number;
        totalDuration: number;
        averageDuration: number;
    } {
        let whereClause = 'WHERE userId = ? AND deletedAt IS NULL';
        const params: any[] = [userId];

        if (options.startDate) {
            whereClause += ' AND createdAt >= ?';
            params.push(options.startDate);
        }

        if (options.endDate) {
            whereClause += ' AND createdAt <= ?';
            params.push(options.endDate);
        }

        const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inboundCalls,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outboundCalls,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedCalls,
        SUM(CASE WHEN status IN ('no-answer', 'busy', 'canceled') THEN 1 ELSE 0 END) as missedCalls,
        COALESCE(SUM(duration), 0) as totalDuration,
        COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as averageDuration
      FROM calls ${whereClause}
    `);

        const result = stmt.get(...params) as any;

        return {
            totalCalls: result.totalCalls || 0,
            inboundCalls: result.inboundCalls || 0,
            outboundCalls: result.outboundCalls || 0,
            completedCalls: result.completedCalls || 0,
            missedCalls: result.missedCalls || 0,
            totalDuration: result.totalDuration || 0,
            averageDuration: Math.round(result.averageDuration || 0)
        };
    }

    /**
     * Get recent calls for a contact
     */
    getCallsByContactId(contactId: number, limit: number = 10): Call[] {
        const stmt = this.db.prepare(`
      SELECT * FROM calls 
      WHERE contactId = ? AND deletedAt IS NULL 
      ORDER BY createdAt DESC 
      LIMIT ?
    `);
        return stmt.all(contactId, limit) as Call[];
    }

    /**
     * Get calls associated with a deal
     */
    getCallsByDealId(dealId: number): Call[] {
        const stmt = this.db.prepare(`
      SELECT * FROM calls 
      WHERE dealId = ? AND deletedAt IS NULL 
      ORDER BY createdAt DESC
    `);
        return stmt.all(dealId) as Call[];
    }

    /**
     * Find contact by phone number (for incoming call lookup)
     */
    findContactByPhoneNumber(phoneNumber: string): { contactId: number; name: string; company?: string } | undefined {
        // Try to find in persons table
        const stmt = this.db.prepare(`
      SELECT id as contactId, name, organisation as company 
      FROM persons 
      WHERE phone LIKE ? OR phone LIKE ?
    `);

        // Clean the phone number for matching
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const result = stmt.get(`%${cleanNumber}%`, `%${phoneNumber}%`) as any;

        return result || undefined;
    }
}
