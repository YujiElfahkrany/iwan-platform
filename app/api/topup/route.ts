import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { TopUpRequest } from "@/models/TopUpRequest";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const amount = Number(form.get("amount"));
  const file = form.get("receipt") as File | null;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!file || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Receipt image required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 2 MB)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const receiptData = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;

  await connectDB();
  const request = await TopUpRequest.create({
    userId: session.user.id,
    amount,
    receiptData,
  });

  return NextResponse.json({ id: request._id.toString() }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const requests = await TopUpRequest.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .select("amount status createdAt")
    .lean();

  return NextResponse.json(
    requests.map((r) => ({
      id: r._id.toString(),
      amount: r.amount,
      status: r.status,
      createdAt: r.createdAt,
    }))
  );
}
