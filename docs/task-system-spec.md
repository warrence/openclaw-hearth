# Hearth Household Task & Reminder System

## Overview
A family-first task management system with smart reminders, flexible assignments, and seamless offline sync. Built for real households where responsibilities shift, devices go offline, and not everyone uses the app.

---

## 1. Data Model

### 1.1 Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                         TASK                                    │
├─────────────────────────────────────────────────────────────────┤
│ id (uuid)              │ Primary identifier                     │
│ household_id (uuid)    │ FK → households                        │
│ created_by (uuid)      │ FK → profiles                          │
│ title (string)         │ "Buy milk"                             │
│ description (text)     │ Optional details                       │
│ status (enum)          │ pending | in_progress | completed |    │
│                        │ cancelled | archived                   │
│ priority (enum)        │ low | normal | high | urgent           │
│ category_id (uuid)     │ FK → categories (optional)             │
│ recurrence_rule (json) │ RRule-compatible (RFC 5545)            │
│ due_at (datetime)      │ Optional deadline                      │
│ estimated_minutes      │ For scheduling/prioritization          │
│ location_id (uuid)    │ FK → locations ("at grocery store")    │
│ metadata (json)        │ {source: "voice", ai_extracted: true}  │
│ created_at/updated_at  │ Timestamps                             │
│ client_generated_id    │ For offline→online sync resolution     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      TASK_ASSIGNMENT                            │
├─────────────────────────────────────────────────────────────────┤
│ id (uuid)                                                        │
│ task_id (uuid)              │ FK → tasks                         │
│ assignee_type (enum)        │ profile | group | external_email   │
│ assignee_id (uuid)          │ FK profiles OR group_id            │
│ assignee_email (string)     │ For non-app users                  │
│ assigned_by (uuid)          │ Who made the assignment            │
│ assigned_at (datetime)      │ When assigned                      │
│ claimed_at (datetime)       │ When assignee accepted             │
│ status (enum)               │ pending | accepted | declined |    │
│                             │ completed                          │
│ permissions (json)          │ {can_reassign: true, can_edit:     │
│                             │ false, can_delete: false}          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      REMINDER                                   │
├─────────────────────────────────────────────────────────────────┤
│ id (uuid)                                                        │
│ task_id (uuid)              │ FK → tasks (nullable - standalone) │
│ type (enum)                 │ task_due | location_based | time | │
│                             │ recurring | ai_suggested           │
│ trigger_at (datetime)       │ When to fire                       │
│ trigger_condition (json)    │ {location_id: "abc", radius_m: 100}│
│                             │ for geofenced reminders            │
│ notification_channels       │ [push, sms, email, in_app]         │
│ payload (json)              │ {title, body, action_url, deep_link}│
│ status (enum)               │ scheduled | sent | delivered |     │
│                             │ dismissed | snoozed                │
│ snooze_until (datetime)     │ If snoozed                         │
│ recipient_type (enum)       │ assignee | assigner | household |  │
│                             │ custom_list                        │
│ recipient_ids (json)        │ Array of profile IDs               │
│ created_by (uuid)           │ Who set the reminder               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      TASK_COMPLETION                            │
├─────────────────────────────────────────────────────────────────┤
│ id (uuid)                                                        │
│ task_id (uuid)              │ FK → tasks                         │
│ completed_by (uuid)         │ FK → profiles                      │
│ completed_at (datetime)     │ When done                          │
│ verification_type (enum)    │ self_reported | photo_required |   │
│                             │ witness_required | auto (location) │
│ verification_data (json)    │ {photo_url, location_coords,       │
│                             │ witness_profile_id}                │
│ notes (text)                │ "Used oat milk instead"            │
│ ai_verified (boolean)       │ Image recognition verified         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      CATEGORY                                   │
├─────────────────────────────────────────────────────────────────┤
│ id, household_id, name, color, icon, sort_order                  │
│ parent_id (uuid)            │ For subcategories                  │
│ default_assignee_id (uuid)  │ Auto-assign new tasks              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      TASK_COMMENT                               │
├─────────────────────────────────────────────────────────────────┤
│ id, task_id, profile_id, body, created_at                        │
│ type (enum)               │ comment | status_change | blockers   │
│ metadata (json)           │ {old_status, new_status, reason}     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Recurrence Schema (RFC 5545 Compatible)

```json
{
  "freq": "WEEKLY",
  "interval": 1,
  "byday": ["MO", "WE", "FR"],
  "dtstart": "2026-03-20T08:00:00Z",
  "until": "2026-12-31T23:59:59Z",
  "count": null,
  "exdates": ["2026-12-25T08:00:00Z"],
  "template_task_id": "uuid"
}
```

- Recurring tasks spawn child instances on demand (not pre-created)
- Editing the template propagates to future uncompleted instances
- Individual instances can be edited independently ("just this one" vs "all future")

---

## 2. Family Permissions Model

### 2.1 Permission Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOUSEHOLD ROLES                              │
├─────────────────────────────────────────────────────────────────┤
│ ADMIN (Parents)                                                 │
│   • Full CRUD on all tasks                                      │
│   • Manage household members                                    │
│   • Configure categories, locations                             │
│   • Set household-level defaults                                │
│   • View analytics/reports                                      │
│   • Override any assignment                                     │
├─────────────────────────────────────────────────────────────────┤
│ MEMBER (Teens, Adult children)                                  │
│   • Create tasks (own or assign to others with permission)      │
│   • Edit tasks they created                                     │
│   • Complete assigned tasks                                     │
│   • Reassign their tasks (if permitted)                         │
│   • Decline assignments with reason                             │
│   • Cannot delete household tasks they didn't create            │
├─────────────────────────────────────────────────────────────────┤
│ GUEST (Babysitters, extended family)                            │
│   • View assigned tasks only                                    │
│   • Mark assigned tasks complete                                │
│   • Cannot create or assign tasks                               │
│   • Time-bounded access (auto-expire)                           │
├─────────────────────────────────────────────────────────────────┤
│ EXTERNAL (No app access)                                        │
│   • Receive email/SMS reminders                                 │
│   • Reply to complete via email/SMS                             │
│   • No app UI access                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Task-Level Permissions (Granular Override)

```json
{
  "task_permissions": {
    "edit": ["creator", "admin"],
    "delete": ["creator", "admin"],
    "reassign": ["assignee", "creator", "admin"],
    "add_reminders": ["assignee", "creator", "admin"],
    "view": ["household"],
    "complete": ["assignee", "admin"],
    "require_verification": true,
    "verification_type": "photo"
  }
}
```

### 2.3 Assignment Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Direct** | Assign to specific person | "Dad picks up Kid" |
| **Rotation** | Auto-rotate among group | Kids' chore rotation |
| **Claim** | First to claim gets it | "Who wants to grab groceries?" |
| **Shared** | Multiple assignees, any can complete | "Parents either can call plumber" |
| **All** | Everyone must complete | "Everyone pack bags for trip" |

### 2.4 Group Assignments

```
GROUP: "Kids Chores"
├── members: [Kid, Sibling2]
├── rotation_strategy: round_robin | least_recent | random
├── assignment_day: "Saturday 9am"
└── notify_all: false  // only assigned kid gets notified
```

---

## 3. Edge Cases & Handling

### 3.1 Conflict Resolution

| Scenario | Resolution |
|----------|------------|
| **Simultaneous completion** | Last-write-wins + conflict log; both get credit |
| **Edit while offline** | Client-generated IDs + vector clocks; show conflict UI |
| **Recurring task edit** | Prompt: "This instance only" / "This and future" / "All instances" |
| **Assignee leaves household** | Tasks auto-revert to creator; orphaned tasks flagged |
| **Task deleted mid-completion** | Soft delete; completion attempt returns "task no longer exists" |
| **Reminder fires after completion** | Auto-cancel pending reminders on completion |
| **Duplicate task creation** | Fuzzy match detection: "Similar to 'Buy milk' (due tomorrow)" |

### 3.2 Recurring Task Edge Cases

```
Scenario: "Take out trash every Tuesday"

Edge: User completes Monday night
→ Next reminder still fires Tuesday AM (configurable)
→ Option: "Skip next occurrence" or "Mark series ahead"

Edge: Task missed 3 weeks
→ Escalation: notify admin, suggest reassignment
→ Auto-archive after N missed (configurable)

Edge: Template edited after some instances created
→ Future instances use new template
→ Past/completed instances frozen
→ In-progress instances: prompt user
```

### 3.3 Offline-Online Transition

```
Scenario: User completes task offline, comes online 2 days later

1. Task was reassigned to someone else in meantime
   → Show: "This task was reassigned. Your completion was noted
      but [Name] is now responsible."

2. Task was deleted
   → Log to activity: "Completed deleted task: [Title]"
   → Offer to restore or discard

3. Task due date passed
   → Complete anyway, mark as "late completion"
   → Option to add note explaining delay
```

### 3.4 Notification Storm Prevention

```
Max notifications per household per hour: 10
Priority escalation queue: urgent > high > normal
Batch similar reminders: "3 tasks due today"
Quiet hours: 22:00 - 08:00 (configurable per profile)
  → Urgent tasks still notify
  → Others queue for morning batch
```

### 3.5 Location-Based Reminder Failures

```
Scenario: "Remind me to buy milk at grocery store"

Edge: GPS unavailable / denied
→ Fallback to time-based: "Were you at [Store] today?"

Edge: Multiple locations with same name
→ Disambiguation: "Which [Store]? [Location A] [Location B]"

Edge: Location reached but task not completable yet
→ Snooze option: "Remind me when I leave / in 30 min"
```

---

## 4. Offline Sync Architecture

### 4.1 Sync Strategy: Delta + CRDT Lite

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYNC PROTOCOL                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client Sync Queue (IndexedDB)                                  │
│  ├── pending_creates: [{local_id, payload, timestamp}]          │
│  ├── pending_updates: [{id, changes, base_version, timestamp}]  │
│  ├── pending_completions: [{task_id, completed_at, evidence}]   │
│  └── pending_deletes: [{id, timestamp}]                         │
│                                                                 │
│  Sync Process:                                                  │
│  1. Client sends: last_sync_timestamp + delta queue             │
│  2. Server responds: server_changes_since_timestamp + conflicts │
│  3. Client applies server changes, resolves conflicts           │
│  4. Client retries failed ops with exponential backoff          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Conflict Resolution Rules

```javascript
// Server-side conflict resolver
function resolveConflict(clientOp, serverState) {
  if (clientOp.type === 'complete' && serverState.status === 'completed') {
    // Both completed - keep first completion, log second as "also completed"
    return { resolution: 'merge', keep: serverState, log: clientOp };
  }
  
  if (clientOp.base_version !== serverState.version) {
    // Divergent edits - return both, let client prompt user
    return { 
      resolution: 'client_decide', 
      server: serverState, 
      client: clientOp,
      auto_mergeable: canAutoMerge(clientOp.changes, serverState)
    };
  }
  
  return { resolution: 'accept_client' };
}
```

### 4.3 Optimistic UI with Rollback

```
User taps "Complete"
  ↓
UI immediately shows completed state (optimistic)
  ↓
Background: queue completion operation
  ↓
Sync success: keep state, play success sound
  ↓
Sync failure: 
  → If retryable: auto-retry (silent)
  → If conflict: show resolution UI
  → If permission error: rollback + toast "Couldn't complete - reassigned"
```

### 4.4 Sync Queue Priorities

```
Priority 1 (Immediate on connectivity):
  • Task completions
  • Acceptance/decline of assignments
  
Priority 2 (Within 30s):
  • Task creates/updates
  • New assignments
  
Priority 3 (Background batch):
  • Comment additions
  • View tracking (for "seen by")
  • Analytics events
```

### 4.5 Data Retention for Offline

```
Device stores:
- All tasks: last 90 days + all future
- Household members: full list (small)
- Categories/locations: full list
- Pending operations: unlimited until synced

Cleanup (on sync success):
- Completed tasks > 90 days: archive to cold storage
- Cancelled tasks > 30 days: delete (configurable)
```

---

## 5. API Design (Key Endpoints)

### 5.1 Task Management

```http
# List tasks (with filtering)
GET /api/households/{id}/tasks
  ?status=pending&assignee=me&due_before=2026-03-25
  &include=assignments,creator,category

# Create task
POST /api/tasks
Body: {
  "title": "Buy milk",
  "due_at": "2026-03-21T18:00:00Z",
  "assignments": [{"type": "profile", "id": "uuid"}],
  "recurrence": {...},
  "client_id": "client-generated-uuid-for-idempotency"
}

# Bulk operations
POST /api/tasks/bulk-complete
POST /api/tasks/bulk-reassign
POST /api/tasks/bulk-snooze
```

### 5.2 Sync Endpoint

```http
POST /api/sync
Body: {
  "last_sync_at": "2026-03-20T10:00:00Z",
  "pending_ops": [...],
  "device_id": "uuid"
}
Response: {
  "server_changes": [...],
  "conflicts": [...],
  "synced_at": "2026-03-20T10:05:00Z"
}
```

### 5.3 Reminder Management

```http
# Smart reminder suggestions (AI)
GET /api/tasks/{id}/suggested-reminders
Response: [
  { "type": "time", "trigger_at": "...", "reason": "1 hour before due" },
  { "type": "location", "location_id": "...", "reason": "Near grocery store" }
]

# Snooze
POST /api/reminders/{id}/snooze
Body: { "duration_minutes": 30 | "until": "datetime" }
```

---

## 6. Rollout Plan

### 6.1 Phase 1: Core Tasks (Weeks 1-2)

**Scope:**
- Basic CRUD tasks
- Simple assignments (direct only)
- Due dates, priorities, categories
- In-app notifications only

**Success Criteria:**
- Create, assign, complete flow works end-to-end
- 100% offline create/complete support
- No data loss on sync

**Deferred:**
- Recurring tasks
- Location reminders
- External (non-app) assignees
- Groups/rotation

### 6.2 Phase 2: Reminders & Recurrence (Weeks 3-4)

**Scope:**
- Time-based reminders
- Push notification integration
- Basic recurrence (daily, weekly, monthly)
- Snooze functionality

**Success Criteria:**
- Reminders fire reliably (±1 minute)
- Recurring tasks spawn correctly
- Notification preferences respected

### 6.3 Phase 3: Advanced Assignment (Weeks 5-6)

**Scope:**
- Groups with rotation
- Claim-based assignments
- External assignees (email/SMS)
- Permission tier enforcement

**Success Criteria:**
- Chore rotation works automatically
- External users can complete via email reply
- Permission boundaries enforced

### 6.4 Phase 4: Intelligence & Polish (Weeks 7-8)

**Scope:**
- Location-based reminders
- AI-suggested reminders
- Duplicate detection
- Analytics dashboard

**Success Criteria:**
- Location reminders fire at correct locations
- AI suggestions are >70% accepted
- Household admin can view completion rates

### 6.5 Beta Release Checklist

```
□ 100 tasks created across 5 test households
□ 7-day offline usage test passed
□ Battery impact <5% daily (location services)
□ Sync conflict resolution UI tested
□ Notification delivery >99% success rate
□ Load test: 1000 reminders/hour
□ Security audit: permission boundaries
□ Accessibility: screen reader tested
```

---

## 7. Database Migrations

### Migration 001: Core Tasks Schema

```php
// Laravel migration outline
Schema::create('tasks', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('household_id')->constrained();
    $table->foreignUuid('created_by')->constrained('profiles');
    $table->string('title');
    $table->text('description')->nullable();
    $table->enum('status', ['pending', 'in_progress', 'completed', 'cancelled', 'archived'])
          ->default('pending');
    $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
    $table->foreignUuid('category_id')->nullable()->constrained();
    $table->json('recurrence_rule')->nullable();
    $table->timestamp('due_at')->nullable();
    $table->integer('estimated_minutes')->nullable();
    $table->foreignUuid('location_id')->nullable();
    $table->json('metadata')->default('{}');
    $table->string('client_generated_id')->nullable()->index();
    $table->timestamps();
    $table->softDeletes();
    
    $table->index(['household_id', 'status', 'due_at']);
    $table->index(['created_by', 'created_at']);
});

Schema::create('task_assignments', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('task_id')->constrained()->onDelete('cascade');
    $table->enum('assignee_type', ['profile', 'group', 'external_email']);
    $table->foreignUuid('assignee_id')->nullable();
    $table->string('assignee_email')->nullable();
    $table->foreignUuid('assigned_by')->constrained('profiles');
    $table->timestamp('assigned_at');
    $table->timestamp('claimed_at')->nullable();
    $table->enum('status', ['pending', 'accepted', 'declined', 'completed'])
          ->default('pending');
    $table->json('permissions')->default('{}');
    $table->timestamps();
    
    $table->index(['task_id', 'assignee_type', 'assignee_id']);
});

// Additional migrations for reminders, completions, comments...
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```php
// Task policy tests
class TaskPolicyTest extends TestCase {
    public function test_member_cannot_delete_others_task() { }
    public function test_admin_can_delete_any_task() { }
    public function test_assignee_can_complete_task() { }
}

// Recurrence engine tests
class RecurrenceEngineTest extends TestCase {
    public function test_weekly_recurrence_generates_correct_dates() { }
    public function test_exdates_are_respected() { }
    public function test_monthly_recurrence_handles_short_months() { }
}
```

### 8.2 Integration Tests

```php
// Offline sync scenario
class OfflineSyncTest extends TestCase {
    public function test_offline_create_syncs_correctly() { }
    public function test_conflicting_edits_prompt_resolution() { }
    public function test_completion_after_reassignment_fails_gracefully() { }
}

// Notification delivery
class ReminderDeliveryTest extends TestCase {
    public function test_push_notification_sent_at_trigger_time() { }
    public function test_quiet_hours_respected() { }
    public function test_batch_notifications_group_correctly() { }
}
```

### 8.3 E2E Tests (Critical Flows)

```
1. Create task → Assign → Complete (happy path)
2. Offline create → Online sync → Verify persistence
3. Recurring task → Complete instance → Verify next spawns
4. Rotation group → Auto-assign → Complete → Verify rotation
5. External assignee → Email sent → Reply complete → Verify
```

---

## 9. Future Considerations (Post-MVP)

| Feature | Description | Complexity |
|---------|-------------|------------|
 **Gamification** | Streaks, points, household leaderboards | Medium |
| **AI Task Extraction** | Parse natural language: "Remind me to..." | Low |
| **Smart Scheduling** | Optimal task timing based on calendar | High |
| **Voice Integration** | Siri/Alexa: "Add task to Hearth" | Medium |
| **Shared Shopping Lists** | Task-adjacent list functionality | Medium |
| **Inter-household** | Share tasks with neighbors/family | High |
| **Calendar Sync** | Export to Google/Apple Calendar | Low |

---

## 10. Open Questions for Alex

1. **Kid's role:** Should children have different permission tiers than adult members?
2. **Verification requirements:** Should any tasks require photo proof by default? Which categories?
3. **Notification preferences:** Should this be per-household or per-user setting?
4. **External users:** Priority level? Is email/SMS MVP or Phase 3?
5. **Location services:** Is GPS-based reminders MVP? Battery vs. utility tradeoff.

---

**Document Version:** 1.0  
**Author:** Aeris (Design)  
**Next Step:** Alex review → Forge implementation planning
