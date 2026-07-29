import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { sweepRecordings } from "@/lib/recordingSweep";
import { isR2Configured, sweepOps } from "@/lib/r2";

// Runs periodically: finalizes recordings whose teacher tab died mid-session so
// the uploaded parts still become a playable object, and deletes docs past the
// retention window.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "Recording is not configured" }, { status: 500 });
  }

  try {
    await connectDB();
    const result = await sweepRecordings(sweepOps, new Date());
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
