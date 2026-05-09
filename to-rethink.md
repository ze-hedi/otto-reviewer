# To Rethink

## Inter-service communication: REST vs gRPC

### Problem

The runtime server (port 5000) communicates with the DB server (port 4000) via REST API calls (e.g. `fetch('http://localhost:4000/api/agents/:id/files')`). This works but is suboptimal for internal service-to-service communication:

- HTTP/1.1 overhead: TCP handshake per request, verbose headers, JSON serialization/deserialization
- No service contract: the caller just knows a URL and hopes the shape matches
- Fragile: if the DB server is slow or down, failures are silent or hard to diagnose

### Why it matters

These two servers form a microservices architecture. In production they may run on separate machines, so direct DB access (sharing Mongoose models) is not an option.

### Proposed solution: gRPC

gRPC is the standard protocol for internal microservice communication:

- **Binary serialization (protobuf)**: smaller payloads, faster than JSON
- **HTTP/2**: persistent connections, multiplexing, no repeated handshakes
- **Schema-first (.proto files)**: typed contracts between services, breaking changes are caught at build time
- **Streaming support**: useful if we later need to stream events between services

### What it would involve

1. Define a `.proto` file with service methods (e.g. `GetAgentFiles`, `GetAgent`)
2. DB server exposes a gRPC server alongside its existing Express server
3. Runtime server uses a gRPC client instead of `fetch` for inter-service calls
4. Code generation step for TypeScript types from the proto definitions

### Affected code

- `runtime/server.ts` — the `fetch('http://localhost:4000/...')` calls in `POST /runtime/orchestrator/run`
- `database/server.js` — would need to add a gRPC server
