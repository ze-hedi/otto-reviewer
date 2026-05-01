# Runtime Server Details

## Overview

The **runtime server** is a TypeScript/Express server that instantiates and manages PiAgent sessions for the Otto Code frontend. It provides a REST API for creating agents, sending chat messages, and monitoring agent activity.

**Location:** `/home/bouchehdahed/code/otto_code/runtime/`

**Purpose:** Bridge between the React frontend and the PiAgent SDK, enabling web-based interaction with AI coding agents.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend                             │
│                  (otto_code/frontend/)                          │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP/SSE
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Runtime Server (Express)                       │
│                  (otto_code/runtime/)                           │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │ load-env.ts │─▶│  server.ts   │─▶│ agent-logger   │        │
│  │ (.env load) │  │ (REST API)   │  │ (event logs)   │        │
│  └─────────────┘  └──────┬───────┘  └────────────────┘        │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │   PiAgent Map   │                           │
│                  │ (active agents) │                           │
│                  └────────┬────────┘                           │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PiAgent SDK                                  │
│              (@mariozechner/pi-coding-agent)                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐       │
│  │   bash       │  │     read     │  │     write      │       │
│  │   (tool)     │  │   (tool)     │  │    (tool)      │       │
│  └──────────────┘  └──────────────┘  └────────────────┘       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              Anthropic/OpenAI API                               │
│         (Claude Sonnet 4, GPT-4, etc.)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. **server.ts** (Main Server)

**Responsibilities:**
- REST API endpoint definitions
- PiAgent instance management
- Server-Sent Events (SSE) streaming for chat responses
- Global state tracking (activeAgents map)

**Key Features:**
- Multi-agent support (manages multiple agents simultaneously)
- Session persistence (memory, disk, continue modes)
- Real-time streaming via SSE
- Integration with agent logger

### 2. **load-env.ts** (Environment Loader)

**Responsibilities:**
- Load `.env` file from project root (`otto_code/.env`)
- Must be imported **first** in `server.ts` (before SDK modules)
- Ensures API keys are available before SDK initialization

**Critical Behavior:**
- Reads `.env` from `../env` (one level up from runtime/)
- Never overwrites existing environment variables
- Fails gracefully if `.env` doesn't exist

### 3. **agent-logger.ts** (Async Logger)

**Responsibilities:**
- Capture and store agent events per session
- Asynchronous logging (non-blocking via `setImmediate`)
- Memory management (max 1000 logs per agent)
- Formatted log retrieval

**Logged Events:**
- `message_update` — Text deltas from LLM
- `tool_execution_start` — Tool invocation began
- `tool_execution_end` — Tool result returned
- `message_end` — LLM turn complete
- `prompt_end` — Entire query finished
- `error` — Execution errors

---

## REST API Endpoints

### POST `/runtime/run`

**Purpose:** Instantiate a new PiAgent session

**Request Body:**
```json
{
  "agent": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "PR Reviewer",
    "model": "claude-sonnet-4-6",
    "description": "Reviews pull requests",
    "thinkingLevel": "medium",
    "sessionMode": "memory",
    "workingDir": "/path/to/repo",
    "apiKey": "sk-ant-..."
  },
  "files": [
    {
      "type": "soul",
      "content": "You are a senior engineer doing PR reviews..."
    },
    {
      "type": "skills",
      "content": "Use conventional commits format for all suggestions."
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "agentId": "507f1f77bcf86cd799439011",
  "name": "PR Reviewer",
  "model": "anthropic/claude-sonnet-4-6",
  "sessionMode": "memory",
  "thinkingLevel": "medium",
  "workingDir": "/path/to/repo",
  "hasCustomApiKey": true
}
```

**Behavior:**
1. Validates request body (requires `_id`, `model`)
2. Validates session mode requirements (disk/continue require workingDir)
3. Resolves bare model names (`claude-sonnet-4-6` → `anthropic/claude-sonnet-4-6`)
4. Creates PiAgent instance with provided config
5. Stores in `activeAgents` map
6. Sets as global `activeAgent` and `activeAgentId`
7. Logs configuration to console (with working directory prominently displayed)

**Error Responses:**
- `400` — Missing required fields or invalid config
- `500` — PiAgent instantiation failed

---

### POST `/runtime/chat/:id`

**Purpose:** Send a message to an active agent and stream response

**URL Parameters:**
- `id` — Agent ID from `/runtime/run`

**Request Body:**
```json
{
  "message": "Review the latest git diff"
}
```

**Response:** Server-Sent Events (SSE) stream

**SSE Event Types:**

| Event Type    | Payload                                              | Description                 |
|---------------|------------------------------------------------------|-----------------------------|
| `delta`       | `{"type":"delta","text":"..."}`                      | LLM text token              |
| `tool_start`  | `{"type":"tool_start","name":"bash","args":"..."}`   | Tool execution started      |
| `tool_end`    | `{"type":"tool_end","name":"bash","result":"...","isError":false}` | Tool execution finished |
| `done`        | `{"type":"done"}`                                    | Assistant turn complete     |
| `error`       | `{"type":"error","message":"..."}`                   | Execution error occurred    |

**Behavior:**
1. Retrieves agent from `activeAgents` map
2. Validates message is non-empty
3. Sets SSE headers (`text/event-stream`, `no-cache`)
4. Calls `piAgent.execute()` with message
5. Streams events to client via SSE
6. Logs all events via `agentLogger`
7. Closes connection after turn complete or error

**Error Responses:**
- `404` — Agent ID not found in runtime
- `400` — Empty message

---

### GET `/runtime/status`

**Purpose:** Get list of active agents

**Response:**
```json
{
  "activeAgents": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "currentAgentId": "507f1f77bcf86cd799439011"
}
```

---

### DELETE `/runtime/agents/:id`

**Purpose:** Remove an agent from memory

**Response:**
```json
{
  "success": true
}
```

**Behavior:**
1. Removes agent from `activeAgents` map
2. Clears global `activeAgent`/`activeAgentId` if it was current
3. Clears logs for removed agent
4. Logs removal to console

**Error Responses:**
- `404` — Agent not found

---

### GET `/runtime/logs/:id`

**Purpose:** Retrieve logs for a specific agent

**Response:**
```json
{
  "success": true,
  "agentId": "507f1f77bcf86cd799439011",
  "count": 42,
  "logs": [
    {
      "timestamp": "2026-05-01T12:34:56.789Z",
      "agentId": "507f1f77bcf86cd799439011",
      "eventType": "tool_execution_start",
      "data": {
        "toolName": "bash",
        "args": "git diff HEAD~1",
        "timestamp": "2026-05-01T12:34:56.789Z"
      }
    }
  ]
}
```

**Side Effect:** Prints formatted logs to console

---

### GET `/runtime/logs`

**Purpose:** Retrieve logs for all agents

**Response:**
```json
{
  "success": true,
  "count": 3,
  "agents": {
    "507f1f77bcf86cd799439011": [...],
    "507f1f77bcf86cd799439012": [...],
    "507f1f77bcf86cd799439013": [...]
  }
}
```

**Side Effect:** Prints all formatted logs to console

---

## Data Flow

### Agent Creation Flow

```
Frontend                Runtime Server              PiAgent SDK
   │                           │                          │
   │  POST /runtime/run        │                          │
   ├──────────────────────────▶│                          │
   │                           │                          │
   │                           │  new PiAgent(config)     │
   │                           ├─────────────────────────▶│
   │                           │                          │
   │                           │  agent instance          │
   │                           │◀─────────────────────────┤
   │                           │                          │
   │                           │  activeAgents.set(id, agent)
   │                           │  global.activeAgent = agent
   │                           │  global.activeAgentId = id
   │                           │                          │
   │  { success, agentId, ... }│                          │
   │◀──────────────────────────┤                          │
   │                           │                          │
```

### Chat Message Flow (SSE)

```
Frontend                Runtime Server                 PiAgent SDK              LLM API
   │                           │                             │                     │
   │  POST /runtime/chat/:id   │                             │                     │
   ├──────────────────────────▶│                             │                     │
   │                           │                             │                     │
   │  SSE connection opened    │  piAgent.execute(message)   │                     │
   │◀──────────────────────────┤────────────────────────────▶│                     │
   │                           │                             │                     │
   │                           │                             │  API call           │
   │                           │                             ├────────────────────▶│
   │                           │                             │                     │
   │                           │                             │  text_delta         │
   │                           │  onEvent(message_update)    │◀────────────────────┤
   │                           │◀────────────────────────────┤                     │
   │                           │  agentLogger.log(...)       │                     │
   │  data: {"type":"delta"}   │                             │                     │
   │◀──────────────────────────┤                             │                     │
   │                           │                             │                     │
   │                           │  onEvent(tool_execution_start)                    │
   │                           │◀────────────────────────────┤                     │
   │  data: {"type":"tool_start"}                            │                     │
   │◀──────────────────────────┤                             │                     │
   │                           │                             │                     │
   │                           │  onEvent(tool_execution_end)│                     │
   │                           │◀────────────────────────────┤                     │
   │  data: {"type":"tool_end"}│                             │                     │
   │◀──────────────────────────┤                             │                     │
   │                           │                             │                     │
   │                           │  onEvent(turn_end)          │                     │
   │                           │◀────────────────────────────┤                     │
   │  data: {"type":"done"}    │                             │                     │
   │◀──────────────────────────┤                             │                     │
   │                           │                             │                     │
   │  SSE connection closed    │                             │                     │
   │                           │                             │                     │
```

---

## Configuration

### Environment Variables

**Location:** `otto_code/.env` (one level up from runtime/)

**Required Variables:**
```bash
# Anthropic API key (for Claude models)
ANTHROPIC_API_KEY=sk-ant-api03-...

# OpenAI API key (for GPT models, optional)
OPENAI_API_KEY=sk-...

# Runtime server port (optional, defaults to 5000)
PORT=5000
```

**Loading Behavior:**
- Loaded via `load-env.ts` before SDK initialization
- Never overwrites existing environment variables
- Gracefully continues if `.env` doesn't exist

---

### Model Name Resolution

**Input:** Bare model name from frontend (e.g., `"claude-sonnet-4-6"`)

**Resolution Logic:**
```typescript
function resolveModel(model: string): string {
  if (model.includes('/')) return model;  // Already qualified
  if (model.startsWith('claude-')) return `anthropic/${model}`;
  if (model.startsWith('gpt-'))    return `openai/${model}`;
  return `anthropic/${model}`;  // Fallback to Anthropic
}
```

**Examples:**
- `"claude-sonnet-4-6"` → `"anthropic/claude-sonnet-4-6"`
- `"gpt-4o"` → `"openai/gpt-4o"`
- `"anthropic/claude-opus-3"` → `"anthropic/claude-opus-3"` (unchanged)

---

### Session Modes

| Mode       | Description                        | workingDir Required | Use Case                    |
|------------|------------------------------------|---------------------|-----------------------------|
| `memory`   | In-memory only, no disk writes     | No                  | Quick one-off queries       |
| `disk`     | Save session to `.jsonl` file      | Yes                 | Resume later, inspect logs  |
| `continue` | Resume most recent disk session    | Yes                 | Multi-turn conversations    |

**Validation:**
- Runtime server validates that `workingDir` is provided for `disk` and `continue` modes
- Returns `400` error if validation fails

---

## Global State

### activeAgents Map

**Type:** `Map<string, PiAgent>`

**Purpose:** Store all instantiated agent instances

**Key:** Agent `_id` from database

**Value:** PiAgent instance

**Operations:**
- `activeAgents.set(id, piAgent)` — Add new agent
- `activeAgents.get(id)` — Retrieve agent
- `activeAgents.has(id)` — Check existence
- `activeAgents.delete(id)` — Remove agent
- `activeAgents.keys()` — Get all agent IDs

---

### Global Variables

```typescript
declare global {
  var activeAgent: PiAgent | null;
  var activeAgentId: string | null;
}
```

**Purpose:** Convenience pointers to the last agent that was run

**Updated:** On every `/runtime/run` call

**Accessed:** Can be used in REPL or debugging scripts

**Example:**
```bash
# In Node.js REPL attached to running server
> global.activeAgent
PiAgent { ... }

> global.activeAgentId
"507f1f77bcf86cd799439011"
```

---

## Logging System

### AgentLogger Class

**Singleton Instance:** `agentLogger` (exported from `agent-logger.ts`)

**Methods:**

#### `log(agentId, eventType, data): Promise<void>`

Log an event asynchronously (non-blocking via `setImmediate`)

**Example:**
```typescript
agentLogger.log('507f1f77bcf86cd799439011', 'tool_execution_start', {
  toolName: 'bash',
  args: 'git diff HEAD~1',
  timestamp: new Date().toISOString()
});
```

#### `getLogs(agentId): AgentLogEntry[]`

Retrieve all logs for a specific agent

#### `getAllLogs(): Map<string, AgentLogEntry[]>`

Retrieve logs for all agents

#### `clearLogs(agentId): void`

Clear logs for a specific agent (called on agent removal)

#### `clearAllLogs(): void`

Clear all logs

#### `formatLogs(agentId): string`

Format logs as human-readable text (used by `/runtime/logs/:id`)

#### `formatAllLogs(): string`

Format all logs (used by `/runtime/logs`)

---

### Log Entry Structure

```typescript
interface AgentLogEntry {
  timestamp: Date;
  agentId: string;
  eventType: 'message_update' | 'tool_execution_start' | 'tool_execution_end' | 'message_end' | 'prompt_end' | 'error';
  data: any;
}
```

**Example:**
```json
{
  "timestamp": "2026-05-01T12:34:56.789Z",
  "agentId": "507f1f77bcf86cd799439011",
  "eventType": "tool_execution_end",
  "data": {
    "toolName": "bash",
    "result": "diff --git a/src/main.ts...",
    "isError": false,
    "timestamp": "2026-05-01T12:34:56.789Z"
  }
}
```

---

### Memory Management

**Max Logs Per Agent:** 1000

**Eviction Policy:** FIFO (oldest logs removed first when limit exceeded)

**Purpose:** Prevent memory overflow in long-running sessions

---

## Integration with PiAgent

### PiAgent Import

```typescript
import { PiAgent, PiAgentConfig } from '../pi-agent.js';
```

**Note:** Imported from parent directory (`otto_code/pi-agent.ts`)

### PiAgent Configuration

**Constructed from:**
1. Agent data from database (`agent._id`, `agent.model`, etc.)
2. Files from database (`soul`, `skills`)
3. Default values for missing fields

**Example:**
```typescript
const config: PiAgentConfig = {
  model: resolveModel(agent.model),
  systemPromptSuffix: soulFile?.content?.trim() || undefined,
  skills: skillsFile ? [{ name: 'agent-skills', content: skillsFile.content }] : [],
  sessionMode: agent.sessionMode || 'memory',
  thinkingLevel: agent.thinkingLevel || 'medium',
  workingDir: agent.workingDir?.trim() || undefined,
  apiKey: agent.apiKey || undefined,
};

const piAgent = new PiAgent(config);
```

---

### Event Handling

**Two parallel flows:**

1. **Console logging** via `handleEvent()` (from `pi-agent-utils.ts`)
2. **SSE streaming** to frontend

**Example:**
```typescript
await piAgent.execute(message.trim(), (event) => {
  // Console logging
  handleEvent(event);

  // SSE streaming
  if (event.type === 'message_update') {
    const sub = event.assistantMessageEvent;
    if (sub?.type === 'text_delta') {
      send({ type: 'delta', text: sub.delta });
    }
  }
});
```

---

## Server Configuration

### Port

**Default:** `5000`

**Override:** Set `PORT` environment variable

**Example:**
```bash
PORT=8080 npm start
```

---

### CORS

**Enabled:** All origins allowed (`cors()` middleware with no config)

**Headers:** Standard CORS headers

**Preflight:** Handled automatically by `cors` middleware

---

### Body Parsing

**Middleware:** `express.json()`

**Limit:** Default Express limit (100kb)

**Content-Type:** `application/json` only

---

## Usage Examples

### 1. Start Runtime Server

```bash
cd /home/bouchehdahed/code/otto_code/runtime
npm install  # First time only
npm start
```

**Output:**
```
[runtime] .env loaded from /home/bouchehdahed/code/otto_code/.env
Runtime server running on http://localhost:5000
```

---

### 2. Create Agent (curl)

```bash
curl -X POST http://localhost:5000/runtime/run \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "_id": "test-agent-1",
      "name": "Test Agent",
      "model": "claude-sonnet-4-6",
      "description": "Test agent for debugging",
      "thinkingLevel": "medium",
      "sessionMode": "memory"
    },
    "files": [
      {
        "type": "soul",
        "content": "You are a helpful coding assistant."
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "agentId": "test-agent-1",
  "name": "Test Agent",
  "model": "anthropic/claude-sonnet-4-6",
  "sessionMode": "memory",
  "thinkingLevel": "medium",
  "workingDir": null,
  "hasCustomApiKey": false
}
```

---

### 3. Send Chat Message (curl with SSE)

```bash
curl -X POST http://localhost:5000/runtime/chat/test-agent-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "List all TypeScript files in this directory"}' \
  --no-buffer
```

**Output (SSE stream):**
```
data: {"type":"tool_start","name":"bash","args":"ls -la *.ts"}

data: {"type":"tool_end","name":"bash","result":"server.ts\nagent-logger.ts\nload-env.ts","isError":false}

data: {"type":"delta","text":"I found 3 TypeScript files:\n"}

data: {"type":"delta","text":"- server.ts (main server)\n"}

data: {"type":"delta","text":"- agent-logger.ts (logging)\n"}

data: {"type":"delta","text":"- load-env.ts (environment)\n"}

data: {"type":"done"}
```

---

### 4. Check Status

```bash
curl http://localhost:5000/runtime/status
```

**Response:**
```json
{
  "activeAgents": ["test-agent-1"],
  "currentAgentId": "test-agent-1"
}
```

---

### 5. Get Logs

```bash
curl http://localhost:5000/runtime/logs/test-agent-1
```

**Response:**
```json
{
  "success": true,
  "agentId": "test-agent-1",
  "count": 5,
  "logs": [...]
}
```

---

### 6. Remove Agent

```bash
curl -X DELETE http://localhost:5000/runtime/agents/test-agent-1
```

**Response:**
```json
{
  "success": true
}
```

---

## Troubleshooting

### API Quota Exceeded

**Error:**
```
400 {"type":"error","error":{"type":"invalid_request_error","message":"Third-party apps now draw from your extra usage..."}}
```

**Solutions:**
1. Add API quota at [claude.ai/settings/usage](https://claude.ai/settings/usage)
2. Use a different API key in `.env`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Provide per-agent API key via `agent.apiKey` field

---

### Agent Not Found

**Error:** `404 Agent not found in runtime. Call /runtime/run first.`

**Cause:** Agent ID doesn't exist in `activeAgents` map

**Solutions:**
1. Call `/runtime/run` to create agent first
2. Check `/runtime/status` to see active agents
3. Verify agent ID matches exactly

---

### Working Directory Required

**Error:** `400 workingDir is required when sessionMode is "disk"`

**Cause:** `disk` or `continue` session mode without `workingDir`

**Solution:** Provide `workingDir` in request:
```json
{
  "agent": {
    ...
    "sessionMode": "disk",
    "workingDir": "/home/user/projects/my-repo"
  }
}
```

---

### Environment Variables Not Loaded

**Symptom:** API key errors despite `.env` file existing

**Cause:** `.env` file in wrong location or malformed

**Debug:**
1. Check `.env` exists at `otto_code/.env` (one level up from runtime/)
2. Verify format: `ANTHROPIC_API_KEY=sk-ant-...` (no quotes, no spaces)
3. Check console output: `[runtime] .env loaded from ...`

**Workaround:** Set environment variable directly:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

---

### SSE Connection Closed Prematurely

**Symptom:** Frontend receives incomplete response

**Causes:**
1. Network timeout
2. Agent execution error (logged as `{"type":"error"}` event)
3. Client disconnected

**Debug:**
1. Check runtime server console for errors
2. Check browser Network tab for SSE events
3. Call `/runtime/logs/:id` to see full event log

---

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::5000`

**Solutions:**
1. Stop the existing process:
   ```bash
   lsof -ti:5000 | xargs kill -9
   ```
2. Use a different port:
   ```bash
   PORT=8080 npm start
   ```

---

## Development

### Dependencies

**Runtime:**
- `express` — Web server framework
- `cors` — CORS middleware

**Development:**
- `tsx` — TypeScript execution
- `typescript` — TypeScript compiler
- `@types/express` — Express type definitions
- `@types/cors` — CORS type definitions

### Install

```bash
cd runtime
npm install
```

### Run

```bash
npm start
```

Equivalent to:
```bash
tsx server.ts
```

### Type Checking

```bash
tsc --noEmit
```

---

## File Structure

```
runtime/
├── server.ts              # Main server (REST API, SSE, state management)
├── agent-logger.ts        # Async logging system
├── load-env.ts            # Environment variable loader
├── package.json           # Dependencies and scripts
├── package-lock.json      # Dependency lock file
├── hello_world.py         # Test file (not part of runtime)
└── node_modules/          # Installed dependencies
```

---

## Security Considerations

### API Key Handling

**Storage:**
- Environment variables (`.env` file)
- Per-agent API keys (stored in database, passed in request)

**Transmission:**
- Never logged in plaintext (masked as `sk-ant-...***...xyz`)
- Not returned in API responses (only `hasCustomApiKey: true/false`)

**Exposure:**
- CORS allows all origins — **DO NOT expose to public internet**
- Intended for local development or trusted internal network

---

### Input Validation

**Validated Fields:**
- `agent._id` — Required, must be non-empty
- `agent.model` — Required, must be non-empty
- `message` — Required, must be non-empty
- `workingDir` — Required for disk/continue modes

**Not Validated:**
- File paths (delegated to PiAgent SDK)
- Shell commands (delegated to PiAgent SDK bash tool)
- LLM prompt content (delegated to LLM API)

**Risk:** Malicious prompts could execute arbitrary commands via bash tool

**Mitigation:** Runtime should only be exposed to trusted users/frontends

---

### Memory Management

**Active Agents:**
- No automatic cleanup (agents persist until explicitly deleted)
- Could grow unbounded in long-running servers

**Logs:**
- Capped at 1000 entries per agent
- FIFO eviction prevents unbounded growth

**Recommendation:** Implement periodic cleanup of inactive agents

---

## Production Considerations

### Not Production-Ready (Current State)

**Missing Features:**
1. Authentication/authorization
2. Rate limiting
3. Request validation (input sanitization)
4. Logging to disk (only console logs)
5. Health check endpoint
6. Metrics/monitoring
7. Graceful shutdown
8. Process manager (PM2, systemd)
9. HTTPS support
10. Agent timeout/cleanup

---

### Production Checklist

If deploying to production:

- [ ] Add authentication middleware (JWT, OAuth)
- [ ] Restrict CORS to known origins
- [ ] Add rate limiting per IP/user
- [ ] Implement request body size limits
- [ ] Add request validation (Zod, Joi)
- [ ] Switch to structured logging (Winston, Pino)
- [ ] Add health check: `GET /health`
- [ ] Add metrics: `GET /metrics` (Prometheus format)
- [ ] Implement graceful shutdown (SIGTERM handler)
- [ ] Use process manager (PM2, Docker, K8s)
- [ ] Add HTTPS/TLS termination (nginx, traefik)
- [ ] Implement agent timeout (auto-delete after N minutes idle)
- [ ] Add database for persistent agent metadata
- [ ] Implement multi-process load balancing
- [ ] Add error tracking (Sentry, Rollbar)

---

## Testing

### Manual Testing

**Test Agent Creation:**
```bash
curl -X POST http://localhost:5000/runtime/run -H "Content-Type: application/json" -d @test-agent.json
```

**Test Chat:**
```bash
curl -X POST http://localhost:5000/runtime/chat/test-agent-1 -H "Content-Type: application/json" -d '{"message": "Hello"}' --no-buffer
```

**Test Status:**
```bash
curl http://localhost:5000/runtime/status
```

**Test Logs:**
```bash
curl http://localhost:5000/runtime/logs/test-agent-1
```

**Test Deletion:**
```bash
curl -X DELETE http://localhost:5000/runtime/agents/test-agent-1
```

---

### Automated Testing

**Not implemented** — No test suite exists

**Recommended:**
- Unit tests for `resolveModel()` function
- Integration tests for each endpoint
- SSE streaming tests
- Error handling tests
- AgentLogger tests

---

## Related Documentation

- **Main Project README:** `../README.md`
- **PiAgent Implementation:** `../pi-agent.ts`
- **Pi SDK Docs:** `../node_modules/@mariozechner/pi-coding-agent/README.md`
- **Frontend Integration:** `../frontend/` (React app)
- **Database Schema:** `../database/` (MongoDB)

---

## Changelog

### Current Version (1.0.0)

**Features:**
- Multi-agent session management
- SSE streaming for real-time responses
- Async logging system
- Model name resolution
- Session mode validation
- Global state tracking
- Log retrieval endpoints
- Working directory display

**Known Issues:**
- No authentication
- No automatic agent cleanup
- SSE implementation commented out (using `execute()` instead of `chat()`)
- Global variables exposed (security risk)

---

## License

MIT (inherited from parent project)
