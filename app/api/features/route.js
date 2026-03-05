import { NextResponse } from "next/server";
import { getAllFeatures, insertFeature } from "../../../lib/db";

export async function GET() {
  try {
    const rows = await getAllFeatures();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { agent_name, feature_name, description, added_by } = body;

    if (!agent_name || !feature_name || !description) {
      return NextResponse.json(
        { error: "agent_name, feature_name, and description are required" },
        { status: 400 }
      );
    }

    const row = await insertFeature({
      agent_name: agent_name.trim(),
      feature_name: feature_name.trim(),
      description: description.trim(),
      added_by: (added_by || "anonymous").trim(),
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
