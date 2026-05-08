#!/usr/bin/env tsx
import "dotenv/config";
import { PiAgent } from "../pi-agent";
import { PiOrchestrator } from "../pi-orchestrator";

let api_key : string = process.env.ANTHROPIC_API_KEY ?? ""; 
async function main() {
  const orchestrator = new PiOrchestrator({
    model: "anthropic/claude-sonnet-4-6",
    apiKey: api_key,
    sessionMode: "memory",
    systemPromptSuffix:
      "You are an orchestrator. Use the delegate tool to dispatch work to sub-agents. " +
      "Always use the delegate tool, never answer directly.",
  });

  orchestrator.addSubAgent({
    name: "python machine learning expert ",
    description: "expert in machine learning and python ML libraries",
    agent: new PiAgent({
      model: "anthropic/claude-haiku-4-5",
      apiKey: api_key,
      sessionMode: "memory",
      systemPromptSuffix:
        "you  are a machine learning python expert that specialized in all the libraries in relation with ML",
    }),
  });

  orchestrator.addSubAgent({
    name: "c++ developer",
    description: "write high performance c++ code ",
    agent: new PiAgent({
      model: "anthropic/claude-haiku-4-5",
      apiKey: api_key,
      sessionMode: "memory",
      systemPromptSuffix:
        "You are an expert in hpc and write c++ advanced optimized code ",
    }),
  });

  orchestrator.initialize();

  console.log("=== Test: Orchestrator delegates to sub-agents ===\n");

  await orchestrator.execute(
    "I want to write a high performance matmul code using c++ mpi, just write the c++ file no need to test it or to write makefiles etc, i'll do all of that by myself, don't even compile it or test just write the fucking .cpp nothing else. In parallel i want you to write a simple python code that print hello world 10",
    (event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.type === "tool_execution_start" && event.toolName === "delegate") {
        const agents = event.args?.agents as Array<{ name: string; task: string }> | undefined;
        if (agents) {
          console.log(`\n[delegate] calling ${agents.length} sub-agent(s):`);
          for (const a of agents) {
            console.log(`  -> [${a.name}] "${a.task}"`);
          }
          console.log(event);

        }
      }
      if (event.type === "tool_execution_end") {
        console.log(`\n[delegate] sub-agents finished\n`);
      }
    }
  );

  console.log("\n\n=== Done ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
