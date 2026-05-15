#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Mem0 } from "../mem0";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });
async function main() {
  const memBefore = process.memoryUsage();
  const mem = new Mem0();
  const memAfter = process.memoryUsage();

  const heapUsed = memAfter.heapUsed - memBefore.heapUsed;
  const rss = memAfter.rss - memBefore.rss;
  console.log("=== Mem0 object size ===");
  console.log(`  Heap used delta:  ${heapUsed} bytes (${(heapUsed / 1024).toFixed(2)} KB)`);
  console.log(`  RSS delta:        ${rss} bytes (${(rss / 1024).toFixed(2)} KB)`);
  console.log(`  Total heap after: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log();

  console.log("=== Test 1: add memories from a conversation ===");
  const addResult = await mem.add(
    [
      { role: "user", content: "I'm building a coding agent in TypeScript." },
      { role: "assistant", content: "Cool! What stack are you using?" },
      { role: "user", content: "I'm using the Pi coding agent SDK with Anthropic." },
    ],
    { userId: "hedi" }
  );
  
  
  console.log("Added:", JSON.stringify(addResult, null, 2));

  const added_results =   await mem.add(                                                                                    
    [{ role: "user", content: "I'm learning PyTorch and training a GPT model from scratch." }],
    { userId: "hedi" }                                                                               
  );
  
  console.log("Added 2 ", JSON.stringify(added_results,null,2)) ; 

  console.log("\n=== Test 2: search memories ===");
  const results = await mem.search("What is the user building?", { userId: "hedi" });
  console.log("Results:", JSON.stringify(results, null, 2));

  console.log("\n=== Test 3: getAll ===");
  const all = await mem.getAll({ userId: "hedi" });
  console.log("All memories:", JSON.stringify(all, null, 2));

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("FAILED:", err.message ?? err);
  process.exit(1);
});
