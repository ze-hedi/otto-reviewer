// examples.ts
// Examples using the PiAgent class

import { PiAgent } from "./pi-agent";
import { AgentEvent } from "@mariozechner/pi-coding-agent";

// ============================================================================
// Example 1: Basic usage with event streaming
// ============================================================================

async function basicExample() {
  const agent = new PiAgent({
    model: "anthropic/claude-sonnet-4-5",
    thinkingLevel: "medium",
    sessionMode: "memory",
  });

  console.log("=== Basic Example ===\n");

  await agent.execute(
    "List all .ts files in the current directory and count them",
    (event) => {
      // Stream text deltas to stdout
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        process.stdout.write(event.assistantMessageEvent.delta);
      }

      // Log tool calls
      if (event.type === "tool_call_start") {
        console.error(`\n⚙️  [${event.toolName}]`);
      }
    }
  );

  console.log("\n\n✅ Done\n");
}

// ============================================================================
// Example 2: PR Reviewer Agent
// ============================================================================

async function prReviewerExample() {
  const prReviewer = new PiAgent({
    model: "anthropic/claude-sonnet-4-5",
    thinkingLevel: "high",
    sessionMode: "memory",
    systemPromptSuffix: `
You are a senior engineer doing PR reviews.

When reviewing code changes:
- Be direct and opinionated, don't hedge
- Flag anything that could cause a bug or regression as BLOCKING
- Flag style/perf issues as NON-BLOCKING
- Always suggest a concrete fix, not just a problem description
- Output in this format:

## Summary
<one paragraph overview>

## Blocking issues
<list or "none">

## Non-blocking suggestions
<list or "none">
    `,
  });

  console.log("=== PR Review ===\n");

  await prReviewer.execute(
    `Run git diff --staged, then review all changes and provide feedback in the format specified in your system prompt.`,
    (event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
    }
  );

  console.log("\n\n✅ Review complete\n");
}

// ============================================================================
// Example 3: Multiple queries with same agent (conversation)
// ============================================================================

async function conversationExample() {
  const agent = new PiAgent({
    model: "anthropic/claude-sonnet-4-5",
    sessionMode: "disk", // Persist to disk so we can continue
  });

  console.log("=== Conversation Example ===\n");

  // First query
  console.log("Query 1: Analyze codebase structure\n");
  await agent.execute(
    "List all TypeScript files and group them by their apparent purpose (e.g., examples, core, utils)",
    streamToStdout
  );

  console.log("\n---\n");

  // Second query (same session, agent remembers context)
  console.log("Query 2: Deep dive into core files\n");
  await agent.execute(
    "Now read the core files and explain the main class or function in each",
    streamToStdout
  );

  console.log("\n\n✅ Conversation complete\n");
}

// ============================================================================
// Example 4: Custom event handling (log everything)
// ============================================================================

async function detailedLoggingExample() {
  const agent = new PiAgent({
    model: "anthropic/claude-sonnet-4-5",
  });

  console.log("=== Detailed Logging ===\n");

  const logEvent = (event: AgentEvent) => {
    switch (event.type) {
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;

      case "tool_call_start":
        console.log(
          `\n\n⚙️  Tool: ${event.toolName}\n   Input: ${JSON.stringify(event.input, null, 2)}`
        );
        break;

      case "tool_call_end":
        console.log(
          `✅  Tool finished: ${event.toolName}\n   Output preview: ${event.output.slice(0, 100)}...`
        );
        break;

      case "message_end":
        console.log("\n--- Turn complete ---");
        break;

      case "prompt_end":
        console.log("\n🏁 Agent finished");
        break;

      case "compaction":
        console.log("\n⚠️  Context compacted (approaching token limit)");
        break;
    }
  };

  await agent.execute(
    "Run git log --oneline -5 and explain what each commit does",
    logEvent
  );

  console.log("\n");
}

// ============================================================================
// Example 5: Non-blocking query (don't wait for completion)
// ============================================================================

async function nonBlockingExample() {
  const agent = new PiAgent({
    model: "anthropic/claude-sonnet-4-5",
  });

  console.log("=== Non-blocking Query ===\n");

  // Start query but don't await
  const session = await agent.query(
    "Count all lines of code in .ts files",
    streamToStdout
  );

  console.log("Query started, doing other work...\n");

  // You can do other work here while the agent runs

  // Later, subscribe to know when it's done
  return new Promise<void>((resolve) => {
    session.subscribe((event) => {
      if (event.type === "prompt_end") {
        console.log("\n✅ Agent finished in background");
        resolve();
      }
    });
  });
}

// ============================================================================
// Helper: Stream text deltas to stdout
// ============================================================================

function streamToStdout(event: AgentEvent) {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
}

// ============================================================================
// Run examples
// ============================================================================

async function main() {
  const example = process.argv[2] || "basic";

  switch (example) {
    case "basic":
      await basicExample();
      break;
    case "pr":
      await prReviewerExample();
      break;
    case "conversation":
      await conversationExample();
      break;
    case "logging":
      await detailedLoggingExample();
      break;
    case "nonblocking":
      await nonBlockingExample();
      break;
    default:
      console.log("Usage: tsx examples.ts [basic|pr|conversation|logging|nonblocking]");
  }
}

main().catch(console.error);
