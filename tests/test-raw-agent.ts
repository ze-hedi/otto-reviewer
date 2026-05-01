#!/usr/bin/env tsx
// tests/test-raw-agent.ts
// Verifies that createRawAgent produces a PiAgent with no tools and no context files.

import "dotenv/config";
import { createRawAgent } from "../raw-agent";
import { handleEvent } from "../pi-agent-utils";

const CONFIG = {
  model: "anthropic/claude-sonnet-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
  sessionMode: "memory" as const,
  thinkingLevel: "off" as const,
};

// ── Test 1: basic instantiation and response ───────────────────────────────────
// Sends a plain text query and expects a streamed reply.
// If the agent fails to instantiate or the session wiring is broken, this throws.

async function testBasicResponse() {
  console.log("=== Test 1: basic response ===\n");

  const agent = createRawAgent(CONFIG);
  await agent.execute("Reply with exactly three words, nothing else.", handleEvent);

  console.log("\n");
}

// ── Test 2: confirm no tools are available ─────────────────────────────────────
// Asks the agent to list its available tools.
// A correctly stripped agent should say it has none.

async function testNoTools() {
  console.log("=== Test 2: no tools ===\n");

  const agent = createRawAgent(CONFIG);
  await agent.execute(
    "List every tool you have access to right now. If you have none, say 'no tools'.",
    handleEvent
  );

  console.log("\n");
}

// ── Test 3: confirm no project context files ───────────────────────────────────
// Asks the agent what project it is working in.
// With context files stripped, it should have no knowledge of the current project.

async function testNoContextFiles() {
  console.log("=== Test 3: no project context ===\n");

  const agent = createRawAgent(CONFIG);
  await agent.execute(
    "What project are you working in right now? What files do you know about?",
    handleEvent
  );

  console.log("\n");
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function main() {
  await testBasicResponse();
  await testNoTools();
  await testNoContextFiles();

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
