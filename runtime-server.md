# Runtime Server API Reference

Base URL: `http://localhost:5000`

The runtime server manages PiAgent sessions. It handles agent lifecycle (create, chat, abort, delete) and orchestrator workflows (multi-agent coordination). All request/response bodies are JSON unless noted otherwise.

---

## Data Types

### AgentData

```json
{
  "_id": "string (required)",
  "name": "string (required)",
  "model": "string (required) — e.g. 'claude-sonnet-4-6', 'gpt-4o'. Bare names are auto-prefixed with 'anthropic/' or 'openai/'",
  "description": "string (required)",
  "type": "string (optional)",
  "status": "string (optional)",
  "thinkingLevel": "'off' | 'low' | 'medium' | 'high' | 'xhigh' (optional, default 'medium')",
  "sessionMode": "'memory' | 'disk' | 'continue' (optional, default 'memory')",
  "workingDir": "string (optional) — required when sessionMode is 'disk' or 'continue'",
  "playground": "string (optional)",
  "apiKey": "string (optional) — falls back to server's ANTHROPIC_API_KEY env var",
  "stateful": "boolean (optional, default false) — used by orchestrator to decide sub-agent statefulness"
}
```

### AgentFile

```json
{
  "type": "'soul' | 'skills'",
  "content": "string — raw text content of the file"
}
```

- `soul` — appended as a system prompt suffix for the agent.
- `skills` — registered as tool/skill definitions the agent can use.

---

## Endpoints

### 1. Start an Agent

**`POST /runtime/run`**

Creates and registers a new PiAgent instance.

**Request body:**

```json
{
  "agent": AgentData,
  "files": AgentFile[]  // optional
}
```

**Success response (200):**

```json
{
  "success": true,
  "agentId": "string",
  "name": "string",
  "model": "string — resolved model e.g. 'anthropic/claude-sonnet-4-6'",
  "sessionMode": "string",
  "thinkingLevel": "string",
  "workingDir": "string | null",
  "hasCustomApiKey": "boolean"
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing `agent._id` or `agent.model` |
| 400 | `sessionMode` is `disk` or `continue` but `workingDir` is empty |
| 400 | Anthropic model with no API key (`error: 'api_key_required'`) |
| 500 | Agent instantiation failure |

---

### 2. Chat with an Agent (SSE)

**`POST /runtime/chat/:id`**

Sends a user message to an active agent and streams the response via **Server-Sent Events**.

**URL params:**

- `id` — the agent ID (same as `agent._id` from `/runtime/run`)

**Request body:**

```json
{
  "message": "string (required, non-empty)"
}
```

**Response:** `Content-Type: text/event-stream`

Each SSE frame is `data: <json>\n\n`. The event types are:

| Event type | Shape | Description |
|------------|-------|-------------|
| `delta` | `{"type":"delta","text":"..."}` | Streamed text chunk from the assistant |
| `thinking` | `{"type":"thinking","text":"..."}` | Streamed thinking/reasoning chunk |
| `tool_start` | `{"type":"tool_start","name":"...","args":{...}}` | A tool execution has started |
| `tool_end` | `{"type":"tool_end","name":"...","result":"...","isError":false}` | A tool execution completed |
| `done` | `{"type":"done"}` | The assistant turn is finished |
| `error` | `{"type":"error","message":"..."}` | An error occurred |

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Agent not found — must call `/runtime/run` first |
| 400 | Empty or missing `message` |

---

### 3. Abort an Agent

**`POST /runtime/agents/:id/abort`**

Interrupts the currently running agent loop.

**URL params:**

- `id` — the agent ID

**Success response (200):**

```json
{ "success": true }
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Agent not found |
| 409 | No active session to abort |

---

### 4. Get Agent Config

**`GET /runtime/agents/:id/config`**

Returns the resolved configuration and registered tools for an agent.

**URL params:**

- `id` — the agent ID

**Success response (200):**

```json
{
  "config": { ... },
  "tools": [ ... ]
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Agent not found |

---

### 5. Get Agent Stats

**`GET /runtime/agents/:id/stats`**

Returns context window usage and session statistics.

**URL params:**

- `id` — the agent ID

**Success response (200):**

```json
{
  "contextUsage": { ... },
  "sessionStats": { ... }
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Agent not found |
| 503 | No active session — send a message first |

---

### 6. Delete an Agent

**`DELETE /runtime/agents/:id`**

Removes an agent (or orchestrator) from memory and clears its logs.

**URL params:**

- `id` — the agent ID or orchestrator ID

**Success response (200):**

```json
{ "success": true }
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Agent not found |

---

### 7. Runtime Status

**`GET /runtime/status`**

Returns all active agent IDs and the current (most recently run) agent.

**Response (200):**

```json
{
  "activeAgents": ["id1", "id2"],
  "currentAgentId": "id2"
}
```

---

### 8. Get Logs (single agent)

**`GET /runtime/logs/:id`**

Returns logs for a specific agent.

**URL params:**

- `id` — the agent ID

**Response (200):**

```json
{
  "success": true,
  "agentId": "string",
  "count": 5,
  "logs": [ ... ]
}
```

If no logs exist, `count` is omitted, `message` is `"No logs found"`, and `logs` is `[]`.

---

### 9. Get Logs (all agents)

**`GET /runtime/logs`**

Returns logs for every agent.

**Response (200):**

```json
{
  "success": true,
  "count": 2,
  "agents": {
    "agentId1": [ ... ],
    "agentId2": [ ... ]
  }
}
```

---

## Orchestrator Endpoints

Orchestrators coordinate multiple sub-agents. The orchestrator itself is stored as an agent in the runtime, so you can use `/runtime/chat/:id`, `/runtime/agents/:id/abort`, `/runtime/agents/:id/stats`, and `DELETE /runtime/agents/:id` with the orchestrator's ID.

### 10. Start an Orchestrator

**`POST /runtime/orchestrator/run`**

Creates a PiOrchestrator with the given sub-agents.

**Request body:**

```json
{
  "orchestratorId": "string (required)",
  "systemPrompt": "string — system prompt for the orchestrator agent",
  "model": "string (optional, default 'claude-sonnet-4-6')",
  "playground": "string (optional)",
  "agents": AgentData[]  // required, at least one
}
```

Sub-agent files (soul/skills) are fetched automatically from `http://localhost:4000/api/agents/:id/files`.

**Success response (200):**

```json
{
  "success": true,
  "orchestratorId": "string",
  "model": "string",
  "subAgents": ["agent-name-1", "agent-name-2"]
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing `orchestratorId` |
| 400 | Empty `agents` array |
| 400 | A sub-agent is missing `_id` or `model` |
| 500 | Instantiation failure |

---

### 11. Get Orchestrator Sub-Agents

**`GET /runtime/orchestrator/:id/subagents`**

Returns the list of sub-agent metadata for an orchestrator.

**URL params:**

- `id` — the orchestrator ID

**Success response (200):** `AgentData[]`

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Orchestrator not found |

---

### 12. Get Sub-Agent Messages

**`GET /runtime/orchestrator/:orchId/subagent/:agentId/messages`**

Returns the full conversation history for a specific sub-agent within an orchestrator.

**URL params:**

- `orchId` — the orchestrator ID
- `agentId` — the sub-agent ID

**Success response (200):** Array of messages from the sub-agent's conversation.

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Orchestrator not found |
| 404 | Sub-agent not found |
| 500 | Failed to retrieve messages |

---

## Typical Flow

1. **`POST /runtime/run`** with agent data → get `agentId`
2. **`POST /runtime/chat/:agentId`** with a message → consume SSE stream
3. Repeat step 2 for multi-turn conversation
4. **`POST /runtime/agents/:agentId/abort`** to cancel a running turn
5. **`GET /runtime/agents/:agentId/stats`** to check context usage
6. **`DELETE /runtime/agents/:agentId`** when done

For orchestrators, replace step 1 with `POST /runtime/orchestrator/run`, then chat using the orchestrator ID.
