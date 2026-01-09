# Email Draft API - First Principles Approach

## What is "First Principles Thinking"?

First principles thinking is a problem-solving approach where you break down a complex problem into its most fundamental truths and build up from there, rather than reasoning by analogy or copying existing solutions.

In software engineering, this means:
1. **Identify the core problem**: What is a draft fundamentally?
2. **Define essential operations**: What can you do with a draft?
3. **Build from fundamentals**: Create the solution from basic building blocks

---

## Applying First Principles to Email Drafts

### 1. Core Concept Analysis

**Question:** *What is an email draft?*

**Fundamental Truth:**
- A draft is an **incomplete email** - it has been created but not sent
- It exists in an **intermediate state** between composition and sending
- It can be **modified** multiple times before sending
- It can be **discarded** without consequences
- It should be **sent** to transition from draft to email

### 2. Essential Operations (CRUD + Send)

Based on the fundamental nature of a draft, we identified these operations:

| Operation | Why it's fundamental | Implementation |
|-----------|---------------------|----------------|
| **Create** | Must begin somewhere | `POST /drafts` |
| **Read** | Must retrieve for editing | `GET /drafts/:id`, `GET /drafts` |
| **Update** | Must be able to modify | `PUT /drafts/:id` |
| **Delete** | Must be able to discard | `DELETE /drafts/:id` |
| **Send** | Must transition to email | `POST /drafts/:id/send` |

Additional operations derived from use cases:
- **Duplicate**: Common workflow pattern
- **Schedule**: Time-based sending

### 3. Data Model Design

**Question:** *What data does a draft need?*

We broke this down into fundamental categories:

```typescript
interface EmailDraft {
  // IDENTITY: Who is this draft?
  id: string;
  userId: string;      // Ownership
  accountId: string;   // Which email account
  
  // CONTENT: What is the message?
  to: string[];        // Required - can't send without recipients
  cc?: string[];       // Optional - additional recipients
  bcc?: string[];      // Optional - hidden recipients
  subject: string;     // Required - emails need subjects
  body: string;        // Required - the main content
  htmlBody?: string;   // Optional - rich formatting
  attachments?: EmailAttachment[];
  
  // CONTEXT: How does this relate to other things?
  replyToMessageId?: string;
  forwardFromMessageId?: string;
  threadId?: string;
  contactIds?: string[];
  dealIds?: string[];
  
  // FEATURES: What special capabilities?
  enableTracking?: boolean;
  isScheduled?: boolean;
  scheduledFor?: Date;
  
  // METADATA: When was this created/modified?
  createdAt: Date;
  updatedAt: Date;
}
```

### 4. Architectural Layers

We applied **Separation of Concerns** - each layer has one job:

```
┌─────────────────────────────────────────┐
│           Routes Layer                   │
│  Responsibility: Define HTTP endpoints   │
│  Question: What URLs map to what?        │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│         Controller Layer                 │
│  Responsibility: Handle HTTP I/O         │
│  Question: How do we parse requests?     │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│          Service Layer                   │
│  Responsibility: Business logic          │
│  Question: What are the rules?           │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│           Model Layer                    │
│  Responsibility: Data persistence        │
│  Question: How do we store/retrieve?     │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│          Database                        │
└─────────────────────────────────────────┘
```

### 5. Business Rules Identification

**Question:** *What rules govern draft behavior?*

We derived rules from fundamental requirements:

1. **Validation Rules**:
   - A draft MUST have at least one recipient
   - Email addresses MUST be valid
   - Subject MUST not be empty
   - Scheduled time MUST be in the future

2. **Security Rules**:
   - Users MUST only access their own drafts
   - Authentication MUST be required

3. **Data Integrity Rules**:
   - Drafts MUST belong to an email account
   - Successful send MUST delete the draft
   - Timestamps MUST be maintained

### 6. API Design Principles

We followed REST principles, but from first principles:

**Why HTTP Methods?**
- GET: **Read** without side effects (idempotent)
- POST: **Create** or trigger actions
- PUT: **Replace/Update** existing resources
- DELETE: **Remove** resources

**Why Status Codes?**
- 200: Success - resource found/updated
- 201: Created - new resource made
- 400: Bad Request - client error in request
- 404: Not Found - resource doesn't exist
- 500: Server Error - something wrong on our end

**Why JSON?**
- Human-readable
- Language-agnostic
- Standard in web APIs
- Easy to parse

---

## Design Decisions Explained

### Decision 1: Separate Table for Drafts

**Question:** Should drafts be stored in the same table as emails?

**Analysis:**
- **Analogy approach**: "Other systems store them together"
- **First principles approach**: 
  - Drafts are NOT emails yet (different lifecycle)
  - Different query patterns (users list drafts differently than sent emails)
  - Different indices needed
  - Clear separation of concerns

**Decision:** Separate `email_drafts` table ✅

---

### Decision 2: Hard Delete vs Soft Delete

**Question:** Should we soft delete drafts?

**Analysis:**
- Drafts are NOT historical records
- Drafts are working documents
- Users expect deleted drafts to be gone
- No audit trail needed for drafts

**Decision:** Hard delete (actual removal from database) ✅

---

### Decision 3: Auto-delete After Send

**Question:** Should drafts persist after sending?

**Analysis:**
- Once sent, the email exists in `emails` table
- The draft has served its purpose
- Keeping both creates data duplication
- User expectation: draft disappears when sent

**Decision:** Delete draft after successful send ✅

---

### Decision 4: Scheduling Feature

**Question:** Should scheduling be part of drafts?

**Analysis:**
- Scheduled sending is a TIME-based action
- Draft is the content, schedule is the INTENT
- Separation of concerns: draft structure vs send timing
- But: scheduled emails ARE drafts until sent

**Decision:** Include scheduling in draft model ✅
- `isScheduled: boolean`
- `scheduledFor: Date`
- Separate processor for scheduled drafts

---

### Decision 5: Validation Layer

**Question:** Where should validation happen?

**Analysis:**
- Multiple layers need validation:
  - Client: Early feedback (UX)
  - Controller: Basic request validation (HTTP)
  - Service: Business rules (Logic)
  - Model: Data integrity (Persistence)

**Decision:** Validation at multiple layers ✅
- Controller: Parameter existence
- Service: Business rules (email format, required fields)
- Model: Type safety (TypeScript)
- Database: Constraints (FOREIGN KEY, NOT NULL)

---

### Decision 6: Update Strategy

**Question:** Should PUT replace entire draft or update fields?

**Analysis:**
- **Full replacement**: Simple but wasteful
- **Partial update**: More complex but efficient
- User workflow: Small edits, not full rewrites

**Decision:** Partial update (PATCH-like behavior with PUT) ✅
- Only update provided fields
- Maintain `updatedAt` timestamp
- More user-friendly

---

## Code Quality Principles Applied

### 1. Single Responsibility Principle
Each class/function has ONE job:
- `DraftModel`: Database operations
- `DraftService`: Business logic
- `DraftController`: HTTP handling
- `createDraftRoutes`: Route configuration

### 2. Type Safety
TypeScript interfaces for everything:
- `EmailDraft`: The entity
- `CreateDraftInput`: Creation payload
- `UpdateDraftInput`: Update payload
- `ListDraftsOptions`: Query options

### 3. Error Handling
Consistent error responses:
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}
```

### 4. Async/Await
Modern JavaScript patterns:
- Clearer than callbacks
- Better error handling
- Easier to read

---

## Testing Strategy (First Principles)

**Question:** *What needs to be tested?*

From first principles, we test:

1. **Core Operations**
   - ✓ Can create a draft
   - ✓ Can retrieve a draft
   - ✓ Can update a draft
   - ✓ Can delete a draft
   - ✓ Can send a draft

2. **Business Rules**
   - ✓ Validation works (empty recipients, invalid emails)
   - ✓ User isolation (can't access others' drafts)
   - ✓ Scheduled time validation

3. **Edge Cases**
   - ✓ Non-existent draft
   - ✓ Duplicate with scheduling
   - ✓ Send failure handling

---

## Lessons from First Principles Approach

### What We Gained:

1. **Clarity**: Every decision has a clear rationale
2. **Simplicity**: No unnecessary complexity
3. **Flexibility**: Easy to extend because we understand fundamentals
4. **Maintainability**: Clear structure makes changes easier
5. **Documentation**: Easy to explain because it's logical

### What We Avoided:

1. **Over-engineering**: Only built what's needed
2. **Cargo cult**: Didn't copy patterns without understanding
3. **Technical debt**: Solid foundation reduces future rewrites
4. **Feature creep**: Focused on essential operations first

---

## Extending the API

Because we built from first principles, extensions are straightforward:

### Example: Adding Draft Templates

**First Principles Analysis:**
1. What is a template? A reusable draft structure
2. How does it differ from a draft? It's a pattern, not a message
3. What operations? Create template, use template, list templates

**Implementation:**
```typescript
interface DraftTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  // ... similar to draft but without recipients
}

// New service method
async createDraftFromTemplate(templateId: string): Promise<EmailDraft>
```

---

## Conclusion

First principles thinking for the Email Draft API resulted in:

- ✅ **Clean architecture** with clear responsibilities
- ✅ **Intuitive API** that matches mental models
- ✅ **Robust validation** at appropriate layers
- ✅ **Type safety** throughout
- ✅ **Extensible design** for future features
- ✅ **Clear documentation** because design is logical

**Key Takeaway:** By breaking down the problem to its fundamentals (what IS a draft? what CAN you do with it?), we built a system that is both simple and complete.
