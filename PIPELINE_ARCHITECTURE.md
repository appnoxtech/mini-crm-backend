# Pipeline CRUD Architecture - Mini CRM

## Overview

This document outlines the architecture for implementing a Pipedrive-like pipeline system in the Mini CRM application. The pipeline system allows users to create custom sales processes with multiple stages, and track deals/leads as they move through these stages.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Database Schema](#database-schema)
3. [Module Structure](#module-structure)
4. [API Endpoints](#api-endpoints)
5. [Data Flow](#data-flow)
6. [Business Logic](#business-logic)
7. [Integration with Existing Modules](#integration-with-existing-modules)
8. [Implementation Checklist](#implementation-checklist)

---

## 1. Core Concepts

### What is a Pipeline?

A **Pipeline** represents a customizable sales process. Each user/organization can have multiple pipelines for different types of deals (e.g., "Sales Pipeline", "Recruitment Pipeline", "Customer Onboarding").

### What is a Stage?

A **Stage** is a step within a pipeline (e.g., "Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"). Each pipeline has multiple stages in a specific order.

### What is a Deal?

A **Deal** (or Opportunity) is an entity that moves through the pipeline stages. It represents a potential sale or business opportunity.

### Key Features

- ✅ Multiple pipelines per user/organization
- ✅ Customizable stages for each pipeline
- ✅ Drag-and-drop stage ordering
- ✅ Deal progression tracking
- ✅ Pipeline analytics (conversion rates, stage duration)
- ✅ Stage-based automation triggers
- ✅ Historical tracking of deal movements

---

## 2. Database Schema

### 2.1 Pipelines Table

```sql
CREATE TABLE IF NOT EXISTS pipelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  userId INTEGER NOT NULL,
  isDefault BOOLEAN DEFAULT 0,
  isActive BOOLEAN DEFAULT 1,
  dealRotting BOOLEAN DEFAULT 0,  -- Flag to enable deal rotting alerts
  rottenDays INTEGER DEFAULT 30,  -- Days before a deal is considered rotten
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipelines_userId ON pipelines(userId);
CREATE INDEX IF NOT EXISTS idx_pipelines_isActive ON pipelines(isActive);
```

### 2.2 Pipeline Stages Table

```sql
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipelineId INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',  -- Hex color for UI visualization
  orderIndex INTEGER NOT NULL,   -- 0, 1, 2, 3... for stage ordering
  rottenDays INTEGER,             -- Override pipeline-level rotten days
  probability INTEGER DEFAULT 0,  -- Win probability % (0-100)
  isWon BOOLEAN DEFAULT 0,        -- Is this a "won" stage?
  isLost BOOLEAN DEFAULT 0,       -- Is this a "lost" stage?
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (pipelineId) REFERENCES pipelines(id) ON DELETE CASCADE,
  UNIQUE(pipelineId, orderIndex)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipelineId ON pipeline_stages(pipelineId);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_orderIndex ON pipeline_stages(orderIndex);
```

### 2.3 Deals Table (Enhanced from existing Leads)

```sql
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  value REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  
  -- Pipeline tracking
  pipelineId INTEGER NOT NULL,
  stageId INTEGER NOT NULL,
  
  -- Contact information
  personName TEXT,
  organizationName TEXT,
  email TEXT,
  phone TEXT,
  
  -- Deal details
  description TEXT,
  expectedCloseDate TEXT,
  actualCloseDate TEXT,
  probability INTEGER DEFAULT 0,  -- Win probability %
  
  -- Ownership and assignment
  userId INTEGER NOT NULL,        -- Owner
  assignedTo INTEGER,             -- Can be assigned to team member
  
  -- Status tracking
  status TEXT DEFAULT 'open',     -- open, won, lost, deleted
  lostReason TEXT,                -- Reason if lost
  
  -- Rotten deal detection
  lastActivityAt TEXT,
  isRotten BOOLEAN DEFAULT 0,
  
  -- Metadata
  source TEXT,                    -- lead source (email, web, import, etc.)
  labels TEXT,                    -- JSON array of labels
  customFields TEXT,              -- JSON object for custom fields
  
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pipelineId) REFERENCES pipelines(id) ON DELETE RESTRICT,
  FOREIGN KEY (stageId) REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_userId ON deals(userId);
CREATE INDEX IF NOT EXISTS idx_deals_pipelineId ON deals(pipelineId);
CREATE INDEX IF NOT EXISTS idx_deals_stageId ON deals(stageId);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_expectedCloseDate ON deals(expectedCloseDate);
```

### 2.4 Deal History Table

```sql
CREATE TABLE IF NOT EXISTS deal_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  
  -- Change tracking
  eventType TEXT NOT NULL,  -- stage_change, value_change, assigned, created, etc.
  fromValue TEXT,           -- JSON snapshot of old value
  toValue TEXT,             -- JSON snapshot of new value
  
  -- Stage change specific
  fromStageId INTEGER,
  toStageId INTEGER,
  stageDuration INTEGER,    -- Seconds spent in previous stage
  
  description TEXT,         -- Human-readable description
  metadata TEXT,            -- JSON object for additional data
  
  createdAt TEXT NOT NULL,
  
  FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (fromStageId) REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  FOREIGN KEY (toStageId) REFERENCES pipeline_stages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deal_history_dealId ON deal_history(dealId);
CREATE INDEX IF NOT EXISTS idx_deal_history_userId ON deal_history(userId);
CREATE INDEX IF NOT EXISTS idx_deal_history_eventType ON deal_history(eventType);
CREATE INDEX IF NOT EXISTS idx_deal_history_createdAt ON deal_history(createdAt);
```

### 2.5 Deal Activities Table

```sql
CREATE TABLE IF NOT EXISTS deal_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  
  type TEXT NOT NULL,       -- call, email, meeting, note, task, etc.
  subject TEXT,
  description TEXT,
  
  -- Scheduling
  dueDate TEXT,
  dueTime TEXT,
  duration INTEGER,         -- Minutes
  isDone BOOLEAN DEFAULT 0,
  completedAt TEXT,
  
  -- Email integration
  emailId INTEGER,          -- Link to email if activity is email
  
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  
  FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (emailId) REFERENCES emails(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deal_activities_dealId ON deal_activities(dealId);
CREATE INDEX IF NOT EXISTS idx_deal_activities_userId ON deal_activities(userId);
CREATE INDEX IF NOT EXISTS idx_deal_activities_dueDate ON deal_activities(dueDate);
```

### 2.6 Pipeline Analytics Table (Aggregated Stats)

```sql
CREATE TABLE IF NOT EXISTS pipeline_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipelineId INTEGER NOT NULL,
  stageId INTEGER,
  userId INTEGER NOT NULL,
  
  -- Time period
  periodType TEXT NOT NULL, -- day, week, month, quarter, year
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  
  -- Metrics
  dealsCount INTEGER DEFAULT 0,
  dealsValue REAL DEFAULT 0,
  dealsWon INTEGER DEFAULT 0,
  dealsLost INTEGER DEFAULT 0,
  dealsWonValue REAL DEFAULT 0,
  dealsLostValue REAL DEFAULT 0,
  
  averageTimeInStage INTEGER, -- Seconds
  conversionRate REAL,        -- Percentage
  
  calculatedAt TEXT NOT NULL,
  
  FOREIGN KEY (pipelineId) REFERENCES pipelines(id) ON DELETE CASCADE,
  FOREIGN KEY (stageId) REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(pipelineId, stageId, userId, periodType, periodStart)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_analytics_pipelineId ON pipeline_analytics(pipelineId);
CREATE INDEX IF NOT EXISTS idx_pipeline_analytics_periodStart ON pipeline_analytics(periodStart);
```

---

## 3. Module Structure

Following the existing project structure (`/modules/leads`, `/modules/email`, `/modules/auth`), create a new module:

```
/src/modules/pipelines/
├── index.ts
├── models/
│   ├── Pipeline.ts
│   ├── PipelineStage.ts
│   ├── Deal.ts
│   ├── DealHistory.ts
│   └── DealActivity.ts
├── services/
│   ├── pipelineService.ts
│   ├── pipelineStageService.ts
│   ├── dealService.ts
│   ├── dealHistoryService.ts
│   ├── dealActivityService.ts
│   └── pipelineAnalyticsService.ts
├── controllers/
│   ├── pipelineController.ts
│   ├── dealController.ts
│   └── activityController.ts
└── routes/
    ├── pipelineRoutes.ts
    ├── dealRoutes.ts
    └── activityRoutes.ts
```

---

## 4. API Endpoints

### 4.1 Pipeline Endpoints

#### Create Pipeline

```
POST /api/pipelines
Authorization: Bearer <token>

Request Body:
{
  "name": "Sales Pipeline",
  "description": "Primary sales process",
  "isDefault": true,
  "dealRotting": true,
  "rottenDays": 30
}

Response: 201
{
  "id": 1,
  "name": "Sales Pipeline",
  "description": "Primary sales process",
  "userId": 123,
  "isDefault": true,
  "isActive": true,
  "dealRotting": true,
  "rottenDays": 30,
  "createdAt": "2026-01-09T12:00:00Z",
  "updatedAt": "2026-01-09T12:00:00Z",
  "stages": []
}
```

#### Get All Pipelines

```
GET /api/pipelines?includeStages=true
Authorization: Bearer <token>

Response: 200
{
  "pipelines": [
    {
      "id": 1,
      "name": "Sales Pipeline",
      "description": "Primary sales process",
      "isDefault": true,
      "isActive": true,
      "dealRotting": true,
      "rottenDays": 30,
      "stageCount": 5,
      "dealCount": 42,
      "totalValue": 150000,
      "stages": [
        {
          "id": 1,
          "name": "Lead",
          "color": "#3B82F6",
          "orderIndex": 0,
          "probability": 10,
          "dealCount": 15
        },
        // ... more stages
      ]
    }
  ]
}
```

#### Get Pipeline by ID

```
GET /api/pipelines/:id
Authorization: Bearer <token>

Response: 200
{
  "id": 1,
  "name": "Sales Pipeline",
  "stages": [...],
  "stats": {
    "totalDeals": 42,
    "totalValue": 150000,
    "wonDeals": 8,
    "wonValue": 50000,
    "lostDeals": 3,
    "conversionRate": 72.5
  }
}
```

#### Update Pipeline

```
PUT /api/pipelines/:id
Authorization: Bearer <token>

Request Body:
{
  "name": "Updated Pipeline Name",
  "description": "Updated description",
  "isActive": true
}

Response: 200
{
  "id": 1,
  "name": "Updated Pipeline Name",
  ...
}
```

#### Delete Pipeline

```
DELETE /api/pipelines/:id
Authorization: Bearer <token>

Response: 200
{
  "message": "Pipeline deleted successfully",
  "dealsAffected": 42
}
```

### 4.2 Pipeline Stage Endpoints

#### Create Stage

```
POST /api/pipelines/:pipelineId/stages
Authorization: Bearer <token>

Request Body:
{
  "name": "Qualified Lead",
  "color": "#10B981",
  "orderIndex": 1,
  "probability": 25,
  "rottenDays": 14
}

Response: 201
{
  "id": 2,
  "pipelineId": 1,
  "name": "Qualified Lead",
  "color": "#10B981",
  "orderIndex": 1,
  "probability": 25,
  "rottenDays": 14
}
```

#### Get Stages for Pipeline

```
GET /api/pipelines/:pipelineId/stages
Authorization: Bearer <token>

Response: 200
{
  "stages": [
    {
      "id": 1,
      "name": "Lead",
      "orderIndex": 0,
      "dealCount": 15,
      "totalValue": 45000
    },
    // ... more stages
  ]
}
```

#### Update Stage

```
PUT /api/pipelines/:pipelineId/stages/:stageId
Authorization: Bearer <token>

Request Body:
{
  "name": "Hot Lead",
  "color": "#EF4444",
  "probability": 40
}

Response: 200
```

#### Reorder Stages

```
PATCH /api/pipelines/:pipelineId/stages/reorder
Authorization: Bearer <token>

Request Body:
{
  "stageOrder": [3, 1, 2, 4]  // Array of stage IDs in new order
}

Response: 200
{
  "message": "Stages reordered successfully",
  "stages": [...]
}
```

#### Delete Stage

```
DELETE /api/pipelines/:pipelineId/stages/:stageId?moveDealsToStageId=2
Authorization: Bearer <token>

Response: 200
{
  "message": "Stage deleted successfully",
  "dealsMoved": 12
}
```

### 4.3 Deal Endpoints

#### Create Deal

```
POST /api/deals
Authorization: Bearer <token>

Request Body:
{
  "title": "Acme Corp - Enterprise License",
  "pipelineId": 1,
  "stageId": 1,
  "value": 50000,
  "currency": "USD",
  "personName": "John Doe",
  "organizationName": "Acme Corp",
  "email": "john@acme.com",
  "phone": "+1-555-0123",
  "expectedCloseDate": "2026-03-15",
  "description": "Enterprise license for 100 users"
}

Response: 201
{
  "id": 1,
  "title": "Acme Corp - Enterprise License",
  "pipelineId": 1,
  "stageId": 1,
  "value": 50000,
  "status": "open",
  ...
}
```

#### Get All Deals

```
GET /api/deals?pipelineId=1&stageId=2&status=open&page=1&limit=20
Authorization: Bearer <token>

Response: 200
{
  "deals": [...],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

#### Get Deal by ID

```
GET /api/deals/:id
Authorization: Bearer <token>

Response: 200
{
  "id": 1,
  "title": "Acme Corp - Enterprise License",
  "pipeline": {
    "id": 1,
    "name": "Sales Pipeline"
  },
  "stage": {
    "id": 2,
    "name": "Qualified Lead"
  },
  "history": [...],
  "activities": [...],
  "timeInCurrentStage": 172800  // seconds
}
```

#### Update Deal

```
PUT /api/deals/:id
Authorization: Bearer <token>

Request Body:
{
  "title": "Updated Deal Title",
  "value": 60000,
  "expectedCloseDate": "2026-04-01"
}

Response: 200
```

#### Move Deal to Stage

```
PATCH /api/deals/:id/move
Authorization: Bearer <token>

Request Body:
{
  "toStageId": 3,
  "note": "Client is interested, moving to proposal stage"
}

Response: 200
{
  "id": 1,
  "stageId": 3,
  "message": "Deal moved successfully",
  "history": {
    "fromStage": "Qualified Lead",
    "toStage": "Proposal",
    "timeInPreviousStage": 259200
  }
}
```

#### Mark Deal as Won/Lost

```
PATCH /api/deals/:id/close
Authorization: Bearer <token>

Request Body:
{
  "status": "won",  // or "lost"
  "lostReason": "Budget constraints"  // if lost
}

Response: 200
```

#### Delete Deal

```
DELETE /api/deals/:id
Authorization: Bearer <token>

Response: 200
{
  "message": "Deal deleted successfully"
}
```

### 4.4 Deal Activity Endpoints

#### Create Activity

```
POST /api/deals/:dealId/activities
Authorization: Bearer <token>

Request Body:
{
  "type": "meeting",
  "subject": "Product Demo",
  "description": "Schedule product demonstration",
  "dueDate": "2026-01-15",
  "dueTime": "14:00",
  "duration": 60
}

Response: 201
```

#### Get Activities for Deal

```
GET /api/deals/:dealId/activities?type=meeting&isDone=false
Authorization: Bearer <token>

Response: 200
{
  "activities": [...],
  "count": 12
}
```

#### Update Activity

```
PUT /api/deals/:dealId/activities/:activityId
Authorization: Bearer <token>
```

#### Mark Activity as Done

```
PATCH /api/deals/:dealId/activities/:activityId/complete
Authorization: Bearer <token>

Response: 200
```

### 4.5 Analytics Endpoints

#### Get Pipeline Analytics

```
GET /api/pipelines/:id/analytics?period=month&startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer <token>

Response: 200
{
  "pipelineId": 1,
  "period": {
    "type": "month",
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "overview": {
    "totalDeals": 50,
    "totalValue": 200000,
    "dealsWon": 12,
    "dealsLost": 5,
    "wonValue": 75000,
    "lostValue": 15000,
    "conversionRate": 70.6
  },
  "stageMetrics": [
    {
      "stageId": 1,
      "stageName": "Lead",
      "dealsEntered": 50,
      "dealsExited": 45,
      "dealsRemaining": 5,
      "averageTimeInStage": 259200,  // seconds
      "conversionRate": 90
    },
    // ... more stages
  ],
  "funnel": {
    "stages": [
      { "name": "Lead", "count": 50, "value": 200000 },
      { "name": "Qualified", "count": 45, "value": 180000 },
      { "name": "Proposal", "count": 30, "value": 120000 },
      { "name": "Negotiation", "count": 18, "value": 90000 },
      { "name": "Won", "count": 12, "value": 75000 }
    ]
  }
}
```

---

## 5. Data Flow

### 5.1 Create Deal Flow

```
User Request → Controller → Service Layer → Model Layer → Database
                                    ↓
                            Create History Entry
                                    ↓
                            Emit Real-time Event (Socket.IO)
                                    ↓
                            Return Response
```

### 5.2 Move Deal Between Stages Flow

```
1. User drags deal to new stage (Frontend)
2. API Request: PATCH /api/deals/:id/move
3. Controller validates request
4. Service Layer:
   a. Verify user permissions
   b. Validate stage belongs to same pipeline
   c. Calculate time spent in previous stage
   d. Update deal.stageId
   e. Create history entry
   f. Check if new stage is won/lost
   g. Update deal.status if needed
   h. Update deal.lastActivityAt
   i. Check for rotten deal status
5. Update analytics (async)
6. Emit Socket.IO event for real-time UI update
7. Return updated deal
```

### 5.3 Pipeline Analytics Calculation Flow

```
Cron Job (Daily) → Analytics Service
                        ↓
                  For each pipeline:
                    - Calculate stage metrics
                    - Calculate conversion rates
                    - Calculate average time in stages
                    - Aggregate won/lost deals
                        ↓
                  Store in pipeline_analytics table
                        ↓
                  Cache results for quick access
```

---

## 6. Business Logic

### 6.1 Pipeline Rules

1. **Default Pipeline**: Each user must have at least one default pipeline
2. **Active Status**: Inactive pipelines cannot have new deals added
3. **Delete Protection**: Cannot delete pipeline if it has active deals
4. **Stage Minimum**: Each pipeline must have at least 2 stages

### 6.2 Stage Rules

1. **Unique Names**: Stage names must be unique within a pipeline
2. **Order Integrity**: orderIndex must be sequential (0, 1, 2, 3...)
3. **Win/Loss Exclusivity**: A stage cannot be both won and lost
4. **Delete Protection**: Cannot delete stage if it has deals (must move deals first)

### 6.3 Deal Rules

1. **Pipeline-Stage Match**: stageId must belong to the specified pipelineId
2. **Status Sync**: When moved to won/lost stage, deal.status updates automatically
3. **Rotten Deals**: If no activity for X days (configurable), mark as rotten
4. **Close Date**: actualCloseDate set automatically when marked won/lost
5. **History Tracking**: Every significant change creates a history entry

### 6.4 Validation Rules

```typescript
// Pipeline validation
- name: required, 1-100 characters
- rottenDays: 1-365

// Stage validation
- name: required, 1-50 characters
- color: valid hex color
- probability: 0-100
- orderIndex: non-negative integer

// Deal validation
- title: required, 1-200 characters
- value: non-negative number
- pipelineId: must exist and belong to user
- stageId: must exist and belong to specified pipeline
- expectedCloseDate: must be future date or null
- email: valid email format or null
```

---

## 7. Integration with Existing Modules

### 7.1 Integration with Leads Module

```typescript
// Option 1: Migrate existing leads to deals
// Create migration script to:
// - Create default pipeline for each user
// - Create stages: Open, Won, Lost
// - Convert leads to deals

// Option 2: Keep leads separate, add conversion
// Add endpoint: POST /api/leads/:id/convert-to-deal
// Creates deal from lead and archives lead
```

### 7.2 Integration with Email Module

```typescript
// Link emails to deals
// When viewing email thread, show associated deals
// Add "Link to Deal" button in email interface
// Create deal activity when email sent/received

// Deal Activities linked to emails
interface DealActivity {
  emailId?: number;  // Reference to email
  type: 'email';
  // ... other fields
}

// Automatic deal creation from emails
// When email comes from known contact, suggest creating/linking deal
```

### 7.3 Integration with Auth Module

```typescript
// User permissions for pipelines
// - Pipeline owners can edit their pipelines
// - Team members can view shared pipelines
// - Admin can view all pipelines

// Future: Role-based access
interface PipelinePermission {
  pipelineId: number;
  userId: number;
  role: 'owner' | 'editor' | 'viewer';
}
```

---

## 8. Implementation Checklist

### Phase 1: Database & Models (Week 1)

- [ ] Create database schema (all tables)
- [ ] Create Pipeline model class
- [ ] Create PipelineStage model class
- [ ] Create Deal model class
- [ ] Create DealHistory model class
- [ ] Create DealActivity model class
- [ ] Write database initialization script
- [ ] Create database indexes

### Phase 2: Services Layer (Week 1-2)

- [ ] Implement PipelineService
- [ ] Implement PipelineStageService
- [ ] Implement DealService
- [ ] Implement DealHistoryService
- [ ] Implement DealActivityService
- [ ] Add business logic validations
- [ ] Implement error handling

### Phase 3: Controllers & Routes (Week 2)

- [ ] Create PipelineController
- [ ] Create DealController
- [ ] Create ActivityController
- [ ] Define all API routes
- [ ] Add authentication middleware
- [ ] Add authorization checks
- [ ] Add request validation

### Phase 4: Analytics (Week 3)

- [ ] Implement PipelineAnalyticsService
- [ ] Create analytics calculation cron job
- [ ] Add analytics API endpoints
- [ ] Implement funnel visualization data
- [ ] Add conversion rate calculations

### Phase 5: Real-time & Integration (Week 3)

- [ ] Add Socket.IO events for deal updates
- [ ] Integrate with email module
- [ ] Add lead-to-deal conversion
- [ ] Create default pipelines for existing users
- [ ] Add rotten deal detection

### Phase 6: Testing & Documentation (Week 4)

- [ ] Write unit tests for models
- [ ] Write integration tests for API
- [ ] Create API documentation
- [ ] Add example requests/responses
- [ ] Performance testing

---

## 9. Example Implementation Code

### 9.1 Pipeline Model

```typescript
// src/modules/pipelines/models/Pipeline.ts
import Database from 'better-sqlite3';

export interface Pipeline {
  id: number;
  name: string;
  description?: string;
  userId: number;
  isDefault: boolean;
  isActive: boolean;
  dealRotting: boolean;
  rottenDays: number;
  createdAt: string;
  updatedAt: string;
}

export class PipelineModel {
  constructor(private db: Database.Database) {}

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        userId INTEGER NOT NULL,
        isDefault BOOLEAN DEFAULT 0,
        isActive BOOLEAN DEFAULT 1,
        dealRotting BOOLEAN DEFAULT 0,
        rottenDays INTEGER DEFAULT 30,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    this.db.exec('CREATE INDEX IF NOT EXISTS idx_pipelines_userId ON pipelines(userId)');
  }

  create(data: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>): Pipeline {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO pipelines (name, description, userId, isDefault, isActive, dealRotting, rottenDays, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.name,
      data.description || null,
      data.userId,
      data.isDefault ? 1 : 0,
      data.isActive ? 1 : 0,
      data.dealRotting ? 1 : 0,
      data.rottenDays,
      now,
      now
    );

    return this.findById(result.lastInsertRowid as number)!;
  }

  findById(id: number): Pipeline | undefined {
    return this.db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id) as Pipeline;
  }

  findByUserId(userId: number): Pipeline[] {
    return this.db.prepare('SELECT * FROM pipelines WHERE userId = ? ORDER BY isDefault DESC, name').all(userId) as Pipeline[];
  }

  // ... more methods
}
```

### 9.2 Deal Service

```typescript
// src/modules/pipelines/services/dealService.ts
import { DealModel, Deal } from '../models/Deal';
import { DealHistoryModel } from '../models/DealHistory';
import { PipelineModel } from '../models/Pipeline';

export class DealService {
  constructor(
    private dealModel: DealModel,
    private historyModel: DealHistoryModel,
    private pipelineModel: PipelineModel
  ) {}

  async moveDealToStage(dealId: number, toStageId: number, userId: number): Promise<Deal> {
    const deal = this.dealModel.findById(dealId);
    if (!deal) throw new Error('Deal not found');
    if (deal.userId !== userId) throw new Error('Unauthorized');

    const fromStageId = deal.stageId;
    
    // Calculate time in previous stage
    const lastStageChange = this.historyModel.findLastStageChange(dealId);
    const now = new Date();
    const stageDuration = lastStageChange 
      ? Math.floor((now.getTime() - new Date(lastStageChange.createdAt).getTime()) / 1000)
      : 0;

    // Update deal
    const updatedDeal = this.dealModel.update(dealId, { stageId: toStageId });

    // Create history entry
    this.historyModel.create({
      dealId,
      userId,
      eventType: 'stage_change',
      fromStageId,
      toStageId,
      stageDuration,
      description: `Moved from stage ${fromStageId} to ${toStageId}`,
      createdAt: now.toISOString()
    });

    return updatedDeal;
  }

  // ... more methods
}
```

---

## 10. Frontend Integration Notes

### Kanban Board View

```typescript
// Visual representation
Pipeline: "Sales Pipeline"
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│    Lead     │  Qualified  │  Proposal   │ Negotiation │     Won     │
│   (15 deals)│  (12 deals) │   (8 deals) │   (5 deals) │   (3 deals) │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ Deal 1      │ Deal 6      │ Deal 14     │ Deal 22     │ Deal 40     │
│ $10,000     │ $25,000     │ $50,000     │ $100,000    │ $75,000     │
│             │             │             │             │             │
│ Deal 2      │ Deal 7      │ Deal 15     │ Deal 23     │ Deal 41     │
│ $5,000      │ $15,000     │ $30,000     │ $80,000     │ $50,000     │
│ ...         │ ...         │ ...         │ ...         │ ...         │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘

Drag-and-drop enabled
```

### Analytics Dashboard

- Conversion funnel visualization
- Stage duration charts
- Win/loss analysis
- Revenue forecasting
- Activity timeline

---

## Conclusion

This architecture provides a robust, scalable foundation for a Pipedrive-like CRM pipeline system. It leverages your existing modular structure and can be implemented incrementally over 4 weeks.

**Next Steps:**

1. Review and approve architecture
2. Create database migrations
3. Implement models and services
4. Build API endpoints
5. Integrate with frontend
6. Add advanced features (automation, forecasting, etc.)
