import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAllFeaturesRaw, getAllClusters, saveClusters } from "../../../lib/db";

const PALETTE = [
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ef4444", // red
  "#3b82f6", // blue
];

export async function GET() {
  try {
    const clusters = await getAllClusters();
    return NextResponse.json(clusters);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const features = await getAllFeaturesRaw();

    if (features.length === 0) {
      return NextResponse.json(
        { error: "No features to cluster" },
        { status: 400 }
      );
    }

    const payload = features.map((f) => ({
      id: f.id,
      agent: f.agent_name,
      name: f.feature_name,
      description: f.description,
    }));

    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an expert at categorizing software features. Given the following list of coding-agent features as JSON, create semantic clusters that group related capabilities together.

Rules:
- Create between 3 and 10 clusters depending on how many distinct capability areas exist.
- Every feature must be assigned to exactly one cluster.
- Use short, technical cluster names (e.g. "Context Management", "Edit Application Strategy", "Tool Use & Shell").
- Include a 1-2 sentence rationale per cluster explaining why these features belong together.
- Return ONLY valid JSON — no markdown fences, no preamble, no explanation outside the JSON.

Features:
${JSON.stringify(payload, null, 2)}

Return a JSON array with this exact shape:
[
  {
    "label": "Cluster Name",
    "rationale": "Why these features are grouped.",
    "featureIds": [1, 4, 7]
  }
]`,
        },
      ],
    });

    const text = message.content[0].text.trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response if it has extra text
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return NextResponse.json(
          { error: "LLM returned invalid JSON", raw: text },
          { status: 502 }
        );
      }
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "LLM response is not an array", raw: text },
        { status: 502 }
      );
    }

    // Assign IDs and colors
    const clustersWithColors = parsed.map((c, i) => ({
      id: i + 1,
      label: c.label,
      rationale: c.rationale || "",
      color: PALETTE[i % PALETTE.length],
      featureIds: c.featureIds || [],
    }));

    await saveClusters(clustersWithColors);
    return NextResponse.json(clustersWithColors);
  } catch (err) {
    console.error("Clustering error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
