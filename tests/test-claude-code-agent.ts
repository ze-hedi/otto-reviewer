#!/usr/bin/env tsx
// tests/test-claude-code-agent.ts
// Smoke-tests ClaudeCodeAgent — spawns the Claude CLI using the local Pro/Max
// subscription. Run from the repo root so Claude works inside this repo.
//
// Usage:
//   cd /path/to/otto_code
//   npx tsx tests/test-claude-code-agent.ts

import { ClaudeCodeAgent } from "../claude-code-agents.ts/claude-code-agent";

// ── Test: system prompt + simple question ──────────────────────────────────────
// Creates an agent with only a systemPrompt configured, then asks what
// programming languages the repo uses. Claude inherits the CWD of this
// process so it works inside the repo where the test is executed.

async function testSystemPromptAndLanguages() {
  console.log("=== Test: system prompt + repo languages ===\n");

  const agent = new ClaudeCodeAgent({
    systemPrompt:
      "You are a concise code reviewer. Answer in plain text, no markdown.",
  });

  const cfg = (agent as any).config as ClaudeCodeAgentConfig;
  console.log("[agent] systemPrompt  :", cfg.systemPrompt);
  console.log("[agent] model         :", cfg.model);
  console.log("[agent] maxTurns      :", cfg.maxTurns);
  console.log("[agent] permissionMode:", cfg.permissionMode);
  console.log("[agent] allowedTools  :", cfg.allowedTools);
  console.log("[agent] mcpServers    :", cfg.mcpServers);
  console.log("[agent] sessionId     :", (agent as any).sessionId);
  console.log();

  process.stdout.write("Response: ");

  for await (const event of agent.run(
    "What programming languages are used in this repository? Give a short list."
  )) {
    switch (event.type) {
      case "system":
        console.log(`[init] session=${event.sessionId} model=${event.model} cwd=${event.cwd}`);
        console.log(`[init] tools=${event.tools.join(", ")}`);
        break;
      case "thinking":
        console.log(`\n[thinking] ${event.thinking}`);
        break;
      case "text":
        process.stdout.write(event.delta);
        break;
      case "tool_start":
        console.log(`\n[tool: ${event.name}] ${JSON.stringify(event.input)}`);
        break;
      case "tool_result":
        console.log(`[result${event.isError ? " (error)" : ""}] ${event.content}`);
        break;
      case "result":
        console.log(`\n\nSession ID : ${event.sessionId}`);
        console.log(`Subtype    : ${event.subtype}`);
        console.log(`Cost       : $${event.costUsd.toFixed(6)}`);
        console.log(`Duration   : ${event.durationMs}ms`);
        console.log(`Turns      : ${event.numTurns}`);
        console.log(`Tokens     : in=${event.usage.inputTokens} out=${event.usage.outputTokens} cache_read=${event.usage.cacheReadInputTokens} cache_write=${event.usage.cacheCreationInputTokens}`);
        break;
      case "error":
        console.error("\nError:", event.message);
        process.exit(1);
    }
  }

  console.log("\n");
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function main() {
  await testSystemPromptAndLanguages();
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
