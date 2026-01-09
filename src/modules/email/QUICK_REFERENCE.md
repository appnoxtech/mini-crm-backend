# Draft API - Quick Reference for Developers

## 🚀 Quick Start

### 1. Import the Components

```typescript
import {
  DraftModel,
  DraftService,
  DraftController,
  createDraftRoutes,
  EmailDraft,
  CreateDraftInput,
  UpdateDraftInput
} from './modules/email';
```

### 2. Initialize (one-time setup)

```typescript
// In your server initialization
const draftModel = new DraftModel(db);
draftModel.initialize(); // Creates table

const draftService = new DraftService(draftModel, emailService);
const draftController = new DraftController(draftService);

app.use('/api/email/drafts', createDraftRoutes(draftController));
```

---

## 📝 Common Operations

### Create a Draft

```typescript
POST /api/email/drafts
Content-Type: application/json
Authorization: Bearer <token>

{
  "accountId": "string",
  "to": ["email@example.com"],
  "subject": "Meeting Follow-up",
  "body": "Thank you for the meeting..."
}

Response: 201 Created
{
  "success": true,
  "data": { /* draft object */ },
  "message": "Draft created successfully"
}
```

### List Drafts

```typescript
GET /api/email/drafts?limit=20&offset=0&search=meeting
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": [ /* array of drafts */ ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Single Draft

```typescript
GET /api/email/drafts/:draftId
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": { /* draft object */ }
}
```

### Update Draft

```typescript
PUT /api/email/drafts/:draftId
Content-Type: application/json
Authorization: Bearer <token>

{
  "subject": "Updated Subject",
  "body": "Updated content..."
}

Response: 200 OK
{
  "success": true,
  "data": { /* updated draft */ },
  "message": "Draft updated successfully"
}
```

### Send Draft

```typescript
POST /api/email/drafts/:draftId/send
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": { "emailId": "message-id" },
  "message": "Draft sent successfully"
}
```

### Delete Draft

```typescript
DELETE /api/email/drafts/:draftId
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "message": "Draft deleted successfully"
}
```

---

## 🎯 TypeScript Interfaces

### EmailDraft

```typescript
interface EmailDraft {
  id: string;
  accountId: string;
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  replyToMessageId?: string;
  forwardFromMessageId?: string;
  threadId?: string;
  contactIds?: string[];
  dealIds?: string[];
  accountEntityIds?: string[];
  enableTracking?: boolean;
  isScheduled?: boolean;
  scheduledFor?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### CreateDraftInput

```typescript
interface CreateDraftInput {
  accountId: string;           // Required
  to: string[];               // Required
  subject: string;            // Required
  body: string;               // Required
  cc?: string[];
  bcc?: string[];
  htmlBody?: string;
  attachments?: EmailAttachment[];
  replyToMessageId?: string;
  forwardFromMessageId?: string;
  threadId?: string;
  contactIds?: string[];
  dealIds?: string[];
  accountEntityIds?: string[];
  enableTracking?: boolean;
  isScheduled?: boolean;
  scheduledFor?: Date;
}
```

### UpdateDraftInput

```typescript
interface UpdateDraftInput {
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

---

## ⚠️ Validation Rules

### Required Fields (Create)
- ✅ `accountId` - Must be valid email account
- ✅ `to` - At least one recipient
- ✅ `subject` - Cannot be empty
- ✅ `body` - Cannot be empty

### Email Validation
```typescript
// Valid format: user@domain.com
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Scheduling Rules
- ✅ If `isScheduled = true`, `scheduledFor` is required
- ✅ `scheduledFor` must be in the future
- ✅ Processed by cron job at scheduled time

---

## 🔒 Security

### Authentication Required
All endpoints require valid JWT token:

```typescript
Authorization: Bearer <your-jwt-token>
```

### User Isolation
- Users can ONLY access their own drafts
- Enforced at service layer
- `userId` extracted from JWT token

---

## 📊 Query Parameters

### List Drafts

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max results to return |
| `offset` | number | 0 | Results to skip |
| `search` | string | - | Search in subject/body |
| `accountId` | string | - | Filter by account |
| `scheduledOnly` | boolean | false | Only scheduled drafts |

**Example:**
```
GET /api/email/drafts?limit=10&search=invoice&scheduledOnly=true
```

---

## 🛠️ Service Methods

```typescript
class DraftService {
  // Core CRUD
  createDraft(userId: string, input: CreateDraftInput): Promise<EmailDraft>
  getDraftById(draftId: string, userId: string): Promise<EmailDraft | null>
  listDrafts(userId: string, options?: ListDraftsOptions): Promise<{drafts, total}>
  updateDraft(draftId: string, userId: string, updates: UpdateDraftInput): Promise<EmailDraft | null>
  deleteDraft(draftId: string, userId: string): Promise<boolean>
  
  // Actions
  sendDraft(draftId: string, userId: string): Promise<{success, emailId?, error?}>
  duplicateDraft(draftId: string, userId: string): Promise<EmailDraft | null>
  
  // Scheduled
  processScheduledDrafts(): Promise<{processed: number, errors: number}>
}
```

---

## 🔄 Scheduled Drafts Workflow

### 1. Create Scheduled Draft

```typescript
POST /api/email/drafts
{
  "accountId": "acc-123",
  "to": ["client@example.com"],
  "subject": "Weekly Report",
  "body": "Report content...",
  "isScheduled": true,
  "scheduledFor": "2026-01-09T09:00:00Z"
}
```

### 2. Setup Cron Job

```typescript
import cron from 'node-cron';

// Every minute
cron.schedule('* * * * *', async () => {
  const result = await draftService.processScheduledDrafts();
  console.log(`Processed: ${result.processed}, Errors: ${result.errors}`);
});
```

### 3. Automatic Processing

- Cron job checks for `scheduledFor <= now`
- Sends eligible drafts
- Deletes drafts after sending
- Reports success/errors

---

## ❌ Error Handling

### Common Errors

```typescript
// 400 Bad Request
{
  "success": false,
  "error": "At least one recipient is required"
}

// 404 Not Found
{
  "success": false,
  "error": "Draft not found"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "Failed to create draft"
}
```

### Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Validation failed, missing required fields |
| 404 | Not Found | Draft doesn't exist or wrong user |
| 500 | Server Error | Database error, email service down |

---

## 🧪 Testing Examples

### Unit Test (Service)

```typescript
describe('DraftService', () => {
  it('should create draft with valid input', async () => {
    const input: CreateDraftInput = {
      accountId: 'acc-123',
      to: ['test@example.com'],
      subject: 'Test',
      body: 'Test body'
    };
    
    const draft = await draftService.createDraft('user-1', input);
    
    expect(draft.id).toBeDefined();
    expect(draft.to).toEqual(['test@example.com']);
  });
  
  it('should reject draft without recipients', async () => {
    const input: CreateDraftInput = {
      accountId: 'acc-123',
      to: [],
      subject: 'Test',
      body: 'Test body'
    };
    
    await expect(
      draftService.createDraft('user-1', input)
    ).rejects.toThrow('At least one recipient is required');
  });
});
```

### Integration Test (API)

```typescript
describe('POST /api/email/drafts', () => {
  it('should create draft', async () => {
    const response = await request(app)
      .post('/api/email/drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acc-123',
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Test body'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
  });
});
```

---

## 💡 Best Practices

### 1. Frontend Auto-save

```typescript
// Debounced auto-save
const autoSave = debounce(async (draftId, changes) => {
  await fetch(`/api/email/drafts/${draftId}`, {
    method: 'PUT',
    body: JSON.stringify(changes)
  });
}, 2000); // Save 2 seconds after typing stops
```

### 2. Optimistic Updates

```typescript
// Update UI immediately, then sync
setDraft(updatedDraft);
try {
  await saveDraft(updatedDraft);
} catch (error) {
  // Revert on error
  setDraft(previousDraft);
  showError('Save failed');
}
```

### 3. Error Handling

```typescript
try {
  const response = await fetch('/api/email/drafts', {
    method: 'POST',
    body: JSON.stringify(draftData)
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return result.data;
} catch (error) {
  console.error('Failed to create draft:', error);
  throw error;
}
```

### 4. Pagination

```typescript
// Load more pattern
const [offset, setOffset] = useState(0);
const limit = 20;

const loadMore = async () => {
  const { drafts, total } = await fetchDrafts({ limit, offset });
  setDrafts(prev => [...prev, ...drafts]);
  setOffset(offset + limit);
  setHasMore(drafts.length === limit);
};
```

---

## 🔍 Debugging Tips

### 1. Check Draft Exists

```sql
SELECT * FROM email_drafts WHERE id = 'draft-id';
```

### 2. Verify User Access

```sql
SELECT * FROM email_drafts 
WHERE id = 'draft-id' AND user_id = 'user-id';
```

### 3. Check Scheduled Drafts

```sql
SELECT * FROM email_drafts 
WHERE is_scheduled = 1 
AND scheduled_for <= datetime('now');
```

### 4. View Recent Drafts

```sql
SELECT id, subject, created_at 
FROM email_drafts 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 📚 Related Documentation

- **DRAFT_API_DOCUMENTATION.md** - Full API reference
- **FIRST_PRINCIPLES.md** - Design philosophy
- **README_DRAFT_API.md** - Implementation summary

---

## 🤝 Need Help?

Common issues and solutions:

1. **"Draft not found"** → Check draftId and userId match
2. **"Invalid email"** → Validate email format client-side
3. **"At least one recipient required"** → Ensure `to` array has items
4. **Scheduled draft not sending** → Check cron job is running

---

**Last Updated:** 2026-01-08
**Version:** 1.0.0
