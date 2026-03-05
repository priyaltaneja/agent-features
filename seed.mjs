// Usage: KV_REST_API_URL=... KV_REST_API_TOKEN=... node seed.mjs

const features = [
  { agent: "OpenCode", name: "Doom Loop Detection", desc: `Built-in detection for when the agent gets stuck repeating the same tool call with identical parameters in an infinite loop. When detected, OpenCode intercepts the loop and prompts the user with three options: approve once, always allow, or reject. It's configured as a first-class permission alongside bash, edit, and webfetch, defaulting to "ask". You can set it to "deny" to hard-block loops automatically, or "allow" to let the agent keep trying.` },
  { agent: "OpenCode", name: "Compaction Prompt Override", desc: `When a conversation hits the context window limit, OpenCode compacts it into a summary. Plugins can hook into this process to inject domain-specific context that the default summarization would lose — project rules, todo states, agent personality, critical architectural decisions. Plugins can also replace the compaction prompt entirely, swapping in custom instructions like formatting the summary as a structured handoff for a multi-agent swarm.` },
  { agent: "OpenCode", name: "Worktree Context Injection", desc: `When running multiple AI agents in parallel via git worktrees, OpenCode's runtime automatically tells every plugin which worktree the session is in. This lets plugins make smart decisions: skip auto-push in throwaway worktrees, run lighter tests in parallel branches, skip deployment hooks from experimental checkouts.` },
  { agent: "OpenCode", name: "Built-in Auto-Formatting", desc: `Ships with 25+ language-specific formatters (Prettier, Biome, Ruff, Black, gofmt, rustfmt, etc.) that run automatically after every file the AI writes or edits. It detects what your project actually uses and silently applies the right formatter with zero configuration. Multiple formatters can match the same file type and run in sequence.` },
  { agent: "OpenCode", name: "Headless Server Architecture with Full HTTP API", desc: `OpenCode runs as a decoupled client-server system where the TUI is just one possible frontend. Run opencode serve and you get a full REST API with 80+ endpoints plus Server-Sent Events for real-time streaming. This means you can build dashboards monitoring multiple agents, inject coordination messages mid-task, or wire OpenCode into CI/CD pipelines, Slack bots, or mobile apps.` },
  { agent: "OpenCode", name: "Silent Context Injection", desc: `The SDK's prompt endpoint accepts a noReply: true flag that injects content into the session without triggering an AI response. The AI sees the message in its context but doesn't reply to it. This lets external systems feed information into a running session seamlessly — CI/CD failures, test results, production alerts, messages from other agents.` },
  { agent: "OpenCode", name: "Subagent Spawn Control", desc: `Lets you define which subagents any given agent is allowed to invoke via glob patterns in permission.task. An orchestrator agent can be configured to spawn research-* agents but denied from spawning build-* agents. When set to deny, the subagent is removed from the Task tool description entirely — the model doesn't even see it as an option.` },
  { agent: "OpenCode", name: "Git-Based Snapshot System", desc: `The /undo and /redo commands use git snapshots taken before every tool call, stored in a separate bare repo so they never touch your project's git history. Each snapshot hash is linked to the session message, creating a full timeline. /undo restores the exact working tree state from before the last agent response, covering all file changes regardless of which tool made them.` },
  { agent: "OpenCode", name: "Tool Call Output Truncation", desc: `Every tool call gets wrapped by Tool.define() which enforces automatic output truncation at 2,000 lines or ~50KB, whichever hits first. When output exceeds these limits, the full untruncated content is saved to a persistent file, and the model receives the truncated version with instructions on how to recover. This protects context from being blown by a single runaway command.` },
  { agent: "OpenCode", name: "Permission Resolution API", desc: `Handles and resolves specific permission requests within an active session. It accepts path parameters to specify the exact session ID and permission ID being targeted, along with a body payload that dictates the response action such as approving or denying the request. Returns a boolean indicating whether the permission response was successfully processed.` },
  { agent: "OpenCode", name: "Session Forking", desc: `Session.fork() copies an entire session up to a specific message into a new independent branch, preserving all prior context, tool results, and file references. This lets you reach a decision point and explore both approaches in parallel without losing context or destroying either thread. The forked sessions form a navigable tree.` },
  { agent: "Plandex", name: "Plan Version Control", desc: `Full-fledged version control for every update to the plan, including branches for exploring multiple paths or comparing different models. Plans are versioned entities you can branch, diff, and merge — like git for AI reasoning traces. A cumulative diff review sandbox keeps AI-generated changes separate from your project files until they are ready to go.` },
  { agent: "Cline", name: "Focus Chain", desc: `Addresses the lost-in-the-middle problem with a persistent todo list that gets re-injected into context every six messages, continuously reminding the agent what it's working on, what's completed, and what's next. It pairs with Cline's deep planning workflow, which separates exploration and implementation into two phases.` },
  { agent: "Aider", name: "Undo Reply Feedback Loop", desc: `When you /undo a change, Aider's send_undo_reply setting controls whether the model is told that its previous edit was reverted and shown the diff that was undone. This turns the undo into a learning signal where the model sees "your change was rejected, here's what you did wrong" and can use that context for the next attempt.` },
];

async function seed() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.error("Set KV_REST_API_URL and KV_REST_API_TOKEN env vars");
    process.exit(1);
  }

  // Use Upstash REST API directly to avoid import issues
  async function redis(cmd) {
    const res = await fetch(`${url}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    return res.json();
  }

  const featureObjs = features.map((f, i) => ({
    id: i + 1,
    agent_name: f.agent,
    feature_name: f.name,
    description: f.desc,
    added_by: "priya",
    created_at: new Date().toISOString(),
  }));

  await redis(["SET", "features", JSON.stringify(featureObjs)]);
  await redis(["SET", "feature_id_counter", String(features.length)]);
  await redis(["DEL", "clusters"]);

  console.log(`Seeded ${features.length} features.`);
}

seed();
