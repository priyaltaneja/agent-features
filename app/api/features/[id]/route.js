import { NextResponse } from "next/server";
import { deleteFeature } from "../../../../lib/db";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const numId = Number(id);

    if (!Number.isInteger(numId) || numId < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const deleted = await deleteFeature(numId);

    if (deleted === null) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: numId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
