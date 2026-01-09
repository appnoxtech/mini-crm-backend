# Email Draft API Documentation

## Overview

The Email Draft API provides comprehensive functionality for managing email drafts in the mini-CRM system. This API was built using **first principles**, focusing on clarity, simplicity, and robust functionality.

## Architecture

The Draft API follows a layered architecture:

```
Routes → Controller → Service → Model → Database
```

### First Principles Applied

1. **Separation of Concerns**: Each layer has a single responsibility
   - **Routes**: Define API endpoints and HTTP methods
   - **Controller**: Handle HTTP requests/responses and parameter validation
   - **Service**: Implement business logic and validation rules
   - **Model**: Manage database operations and data mapping

2. **Data Integrity**: 
   - User isolation (users can only access their own drafts)
   - Required field validation
   - Email address validation
   - Type safety with TypeScript interfaces

3. **RESTful Design**:
   - Standard HTTP methods (GET, POST, PUT, DELETE)
   - Meaningful status codes (200, 201, 400, 404, 500)
   - Resource-based URLs

## API Endpoints

### Base URL
```
/api/email/drafts
```

---

### 1. Create Draft
**`POST /api/email/drafts`**

Create a new email draft.

**Request Body:**
```typescript
{
  accountId: string;           // Email account ID
  to: string[];               // Recipient email addresses (required)
  cc?: string[];              // CC recipients (optional)
  bcc?: string[];             // BCC recipients (optional)
  subject: string;            // Email subject (required)
  body: string;               // Plain text body (required)
  htmlBody?: string;          // HTML body (optional)
  attachments?: EmailAttachment[];  // File attachments (optional)
  
  // Threading
  replyToMessageId?: string;  // If replying to an email
  forwardFromMessageId?: string;  // If forwarding an email
  threadId?: string;          // Thread ID
  
  // CRM Associations
  contactIds?: string[];      // Associated contact IDs
  dealIds?: string[];         // Associated deal IDs
  accountEntityIds?: string[]; // Associated account IDs
  
  // Features
  enableTracking?: boolean;   // Enable email tracking
  isScheduled?: boolean;      // Is this a scheduled email?
  scheduledFor?: Date;        // When to send (if scheduled)
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "draft-uuid",
    "accountId": "account-id",
    "userId": "user-id",
    "to": ["recipient@example.com"],
    "subject": "Meeting Follow-up",
    "body": "Draft body...",
    "createdAt": "2026-01-08T10:30:00Z",
    "updatedAt": "2026-01-08T10:30:00Z",
    ...
  },
  "message": "Draft created successfully"
}
```

**Validation:**
- At least one recipient required
- Subject cannot be empty
- Valid email addresses
- Scheduled time must be in the future (if scheduling)

---

### 2. Get Draft by ID
**`GET /api/email/drafts/:draftId`**

Retrieve a specific draft by its ID.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "draft-uuid",
    ...
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Draft not found"
}
```

---

### 3. List Drafts
**`GET /api/email/drafts`**

List all drafts for the authenticated user with optional filtering.

**Query Parameters:**
- `limit` (number): Maximum number of drafts to return (default: 50)
- `offset` (number): Number of drafts to skip (default: 0)
- `search` (string): Search in subject and body
- `accountId` (string): Filter by email account
- `scheduledOnly` (boolean): Only return scheduled drafts

**Example:**
```
GET /api/email/drafts?limit=20&offset=0&search=meeting&scheduledOnly=true
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "id": "draft-1", ... },
    { "id": "draft-2", ... }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 4. Update Draft
**`PUT /api/email/drafts/:draftId`**

Update an existing draft. Only provided fields will be updated.

**Request Body:**
```typescript
{
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  contactIds?: string[];
  dealIds?: string[];
  accountEntityIds?: string[];
  enableTracking?: boolean;
  isScheduled?: boolean;
  scheduledFor?: Date;
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "draft-uuid",
    "updatedAt": "2026-01-08T10:35:00Z",
    ...
  },
  "message": "Draft updated successfully"
}
```

**Validation:**
- Same validation rules as create
- Only validates fields that are being updated

---

### 5. Delete Draft
**`DELETE /api/email/drafts/:draftId`**

Permanently delete a draft.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Draft deleted successfully"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Draft not found"
}
```

---

### 6. Send Draft
**`POST /api/email/drafts/:draftId/send`**

Send a draft immediately. The draft will be deleted after successful sending.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "emailId": "message-id"
  },
  "message": "Draft sent successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Failed to send email: [reason]"
}
```

**Note:** The draft is automatically deleted after successful sending.

---

### 7. Duplicate Draft
**`POST /api/email/drafts/:draftId/duplicate`**

Create a copy of an existing draft.

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "new-draft-uuid",
    ...
  },
  "message": "Draft duplicated successfully"
}
```

**Note:** Scheduling information is not copied to the duplicate.

---

### 8. Process Scheduled Drafts
**`POST /api/email/drafts/scheduled/process`**

Process all scheduled drafts that are ready to send. Typically called by a cron job.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "processed": 5,
    "errors": 0
  },
  "message": "Processed 5 scheduled drafts"
}
```

---

## Data Models

### EmailDraft
```typescript
interface EmailDraft {
  id: string;
  accountId: string;
  userId: string;
  
  // Email content
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  
  // Threading
  replyToMessageId?: string;
  forwardFromMessageId?: string;
  threadId?: string;
  
  // CRM associations
  contactIds?: string[];
  dealIds?: string[];
  accountEntityIds?: string[];
  
  // Features
  enableTracking?: boolean;
  isScheduled?: boolean;
  scheduledFor?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### EmailAttachment
```typescript
interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  url: string;
}
```

---

## Database Schema

```sql
CREATE TABLE email_drafts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Recipients (JSON arrays)
  to_recipients TEXT NOT NULL,
  cc_recipients TEXT,
  bcc_recipients TEXT,
  
  -- Content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  
  -- Features (JSON)
  attachments TEXT,
  
  -- Threading
  reply_to_message_id TEXT,
  forward_from_message_id TEXT,
  thread_id TEXT,
  
  -- CRM associations (JSON arrays)
  contact_ids TEXT,
  deal_ids TEXT,
  account_entity_ids TEXT,
  
  -- Features
  enable_tracking INTEGER DEFAULT 0,
  is_scheduled INTEGER DEFAULT 0,
  scheduled_for TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_email_drafts_user` - For user-based queries
- `idx_email_drafts_account` - For account filtering
- `idx_email_drafts_created` - For sorting by creation date
- `idx_email_drafts_scheduled` - For scheduled draft queries

---

## Authentication

All endpoints require authentication via the `authMiddleware`. Include a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "error": "At least one recipient is required"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Draft not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to create draft"
}
```

---

## Usage Examples

### Create a Simple Draft
```javascript
const response = await fetch('/api/email/drafts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    accountId: 'account-123',
    to: ['client@example.com'],
    subject: 'Meeting Follow-up',
    body: 'Thank you for the meeting today...'
  })
});
```

### Schedule a Draft
```javascript
const response = await fetch('/api/email/drafts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    accountId: 'account-123',
    to: ['client@example.com'],
    subject: 'Weekly Report',
    body: 'Here is your weekly report...',
    isScheduled: true,
    scheduledFor: '2026-01-09T09:00:00Z'
  })
});
```

### Update a Draft
```javascript
const response = await fetch('/api/email/drafts/draft-123', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    subject: 'Updated: Meeting Follow-up',
    body: 'Updated content...'
  })
});
```

### Send a Draft
```javascript
const response = await fetch('/api/email/drafts/draft-123/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>'
  }
});
```

---

## Integration Guide

### 1. Initialize the Draft Module

In your email module initialization:

```typescript
import { DraftModel } from './modules/email/models/draftModel';
import { DraftService } from './modules/email/services/draftService';
import { DraftController } from './modules/email/controllers/draftController';
import { createDraftRoutes } from './modules/email/routes/draftRoutes';

// Initialize models
const draftModel = new DraftModel(db);
draftModel.initialize(); // Create tables

// Initialize services
const draftService = new DraftService(draftModel, emailService);

// Initialize controller
const draftController = new DraftController(draftService);

// Mount routes
app.use('/api/email/drafts', createDraftRoutes(draftController));
```

### 2. Set up Scheduled Draft Processing

Create a cron job to process scheduled drafts:

```typescript
// Using node-cron or similar
cron.schedule('* * * * *', async () => {  // Every minute
  try {
    const result = await draftService.processScheduledDrafts();
    console.log(`Processed ${result.processed} scheduled drafts`);
  } catch (error) {
    console.error('Error processing scheduled drafts:', error);
  }
});
```

---

## Best Practices

1. **Auto-save**: Implement auto-save on the frontend to prevent data loss
2. **Validation**: Validate email addresses on the frontend before submission
3. **Error Handling**: Always check response success status
4. **Pagination**: Use pagination for large draft lists
5. **Search**: Utilize the search parameter for quick draft lookups
6. **Scheduling**: Validate scheduled times on the frontend
7. **Testing**: Test edge cases (empty recipients, invalid emails, etc.)

---

## Future Enhancements

Potential areas for expansion:
- Draft templates
- Collaborative editing
- Version history
- Auto-complete for recipients
- Rich text editing
- Attachment upload/management
- Draft folders/categories
- AI-powered draft suggestions
