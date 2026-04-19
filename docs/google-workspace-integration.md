# Google Docs + Sheets integration for Hearth

## Goal
Let Hearth users connect their own Google account so the agent can safely read and edit Google Sheets and Google Docs from inside the Hearth app.

## Recommendation
Use a **real per-user Google OAuth integration** in Hearth, then expose **Hearth-specific Google tools** to the OpenClaw session used by the Hearth app.

Do **not** use browser automation as the core path.

Do **not** rely on a single host-level Google login for all Hearth users.

## Why this approach
Hearth is a multi-user household app, not a single-user operator console.
That means Google access needs to be:
- per-user
- revocable
- permission-aware
- conversation-safe
- compatible with future household/privacy rules

A host-level CLI login is fine for personal operator workflows, but it is the wrong trust model for Hearth app users.

## Important constraint
OpenClaw already has Google-related pieces in the broader ecosystem, including a bundled `google` extension and the `gog` Google Workspace CLI skill.
Those are useful references, but they are **not enough by themselves** for Hearth’s in-app multi-user integration.

Also, `gog` currently supports Docs export/cat/copy, but not full in-place Docs editing. So Hearth should not depend on `gog` alone for the final product path.

## Product shape

### User-facing flow
1. User opens Hearth settings/dashboard
2. User taps **Connect Google**
3. Hearth runs Google OAuth for that signed-in Hearth user
4. User links a Doc or Sheet into a conversation
5. Linked files appear as conversation resources
6. During chat, the agent can read/write those linked resources through Hearth-native tools

### Best first milestone
Start with:
- Google Sheets read/write
- Google Docs read + append/create

Then expand later to richer Docs editing.

Sheets is the better first target because it is structured, safer, and easier to validate.

## Recommended architecture

### 1) Hearth owns Google OAuth
Nest API should manage Google OAuth and token refresh.

Store tokens per Hearth user, encrypted at rest.

Suggested OAuth scopes for Phase 1:
- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/spreadsheets`

`drive.file` is preferred over broad full-drive scope for the first pass.

### 2) Hearth stores linked conversation resources
A Hearth conversation should be able to reference one or more linked Google files.

Recommended table shape:
- `conversation_resources`
  - `id`
  - `conversation_id`
  - `user_id`
  - `provider` (`google`)
  - `resource_type` (`sheet`, `doc`)
  - `external_id`
  - `title`
  - `capability` (`read`, `edit`)
  - `created_at`
  - `updated_at`

This generic table is better than a Google-only table because it leaves room for future Notion, Calendar, Drive file, or Apple Notes integrations.

### 3) OpenClaw gets Hearth-native Google tools
The `openclaw-plugin-hearth-app` plugin should expose Hearth-specific Google tools to the live agent session.

That is the key move that makes the feature feel native.

Example tool surface:
- `hearth_google_list_resources`
- `hearth_google_search_files`
- `hearth_google_read_doc`
- `hearth_google_append_doc`
- `hearth_google_create_doc`
- `hearth_google_read_sheet`
- `hearth_google_write_sheet_range`
- `hearth_google_append_sheet_rows`

These tools should infer the active Hearth conversation from the session mapping that already exists in the plugin.

### 4) Nest remains the trust boundary
The plugin tool should not hold raw Google OAuth state directly.

Instead:
- plugin tool call -> Nest API
- Nest resolves current conversation + current Hearth user
- Nest enforces ownership/role checks
- Nest uses encrypted Google credentials to call Google APIs
- Nest returns a constrained result to the tool

This keeps Google access governed by Hearth’s own auth and privacy model.

## Permissions and safety

### User model
Default rule:
- a user can only use their own connected Google account
- a user can only access files they explicitly linked or selected

### Owner/member rule
Being a Hearth owner should **not automatically** grant access to another person’s Google account.
Google access should stay personal unless a future explicit household-sharing model exists.

### Edit safety
For Phase 1:
- read operations can happen directly
- destructive write operations should require explicit user intent
- bulk overwrite actions should be avoided at first

Recommended initial edit scope:
- append rows to sheet
- update a specific range in sheet
- append text/content to doc
- create a new doc/sheet

Avoid these in Phase 1:
- full-document rewrite
- sheet/tab deletion
- large structural spreadsheet mutations
- broad Drive search across all files without an explicit user selection flow

## UI additions

### Dashboard/settings
Add a new owner/member-safe settings card:
- Connect Google
- Connected account email
- Disconnect Google
- Reconnect if token expired

### Conversation UI
Add a conversation-level resource section:
- Link Google Doc
- Link Google Sheet
- Show linked resources as chips/cards
- Remove linked resource

## Backend slices

### Slice A: OAuth + connection state
Build:
- Google OAuth start endpoint
- Google OAuth callback endpoint
- connection status endpoint
- disconnect endpoint
- encrypted token persistence

### Slice B: Linked resources
Build:
- file picker/search endpoint
- create/list/delete conversation resource links
- UI to attach linked files to a conversation

### Slice C: Read tools
Build first real agent tools:
- read linked doc
- read linked sheet range
- list linked resources

### Slice D: Safe write tools
Build:
- append doc content
- write/update sheet range
- append rows to sheet

### Slice E: Rich Docs editing
Later:
- structured paragraph insertion
- replace selected blocks
- heading/list/table helpers
- revision-aware edits

## API surface sketch

### Nest endpoints
- `GET /api/google/status`
- `POST /api/google/oauth/start`
- `GET /api/google/oauth/callback`
- `DELETE /api/google/connection`
- `GET /api/google/files/search`
- `GET /api/conversations/:id/resources`
- `POST /api/conversations/:id/resources`
- `DELETE /api/conversations/:id/resources/:resourceId`

### Tool-to-Nest internal endpoints
Potential internal endpoints for the plugin/tool layer:
- `POST /api/internal/google/doc/read`
- `POST /api/internal/google/doc/append`
- `POST /api/internal/google/sheet/read`
- `POST /api/internal/google/sheet/write-range`
- `POST /api/internal/google/sheet/append-rows`

These should require a trusted internal token from the Hearth plugin.

## Suggested implementation order
1. Add DB storage for Google connections + conversation resources
2. Add Google OAuth connect/disconnect flow in Nest
3. Add settings UI card for connection state
4. Add conversation resource linking UI
5. Add read-only tools first
6. Add safe write tools for Sheets
7. Add safe append/create tools for Docs
8. Add richer Docs editing later

## Delivery recommendation

### Phase 1
Ship:
- Google connect/disconnect
- link sheet/doc to a conversation
- Sheets read/write/append rows
- Docs read/append/create

### Phase 2
Ship:
- richer Docs editing
- Drive picker polish
- reusable file linking across conversations
- shared household resource model

## Key product decision I recommend
Treat Google as a **per-user connected account**, not a household-global integration.

That keeps trust cleaner and avoids accidental cross-person document access.

## Definition of done for Phase 1
- User can connect Google from Hearth
- User can link a Sheet or Doc into a chat
- Agent can read the linked resource in-chat
- Agent can safely make narrow edits
- Access is enforced per Hearth user
- Disconnect cleanly revokes future use
- Conversation UX makes linked resources visible and manageable
