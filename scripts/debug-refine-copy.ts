import { refineCopy } from "../server/ai/aiTennisService";

async function main() {
  process.env.AI_PROVIDER = "memory";
  
  console.log("Testing refineCopy with memory transport...\n");
  
  try {
    const result = await refineCopy(
      {
        userText: "Rewrite my homepage headline to be more compelling",
        targetSection: "hero",
      },
      "memory"
    );
    
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
  }
}

main();
