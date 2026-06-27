import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { TopUpRequest } from "@/models/TopUpRequest";
import { User } from "@/models/User";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const requests = await TopUpRequest.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .populate("userId", "name email")
    .lean();

  return NextResponse.json(
    requests.map((r) => ({
      id: r._id.toString(),
      amount: r.amount,
      receiptData: r.receiptData,
      status: r.status,
      createdAt: r.createdAt,
      user: {
        id: (r.userId as { _id: { toString(): string }; name: string; email: string })._id.toString(),
        name: (r.userId as { name: string }).name,
        email: (r.userId as { email: string }).email,
      },
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await req.json();
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await connectDB();
  const topup = await TopUpRequest.findById(id);
  if (!topup || topup.status !== "pending") {
    return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });
  }

  topup.status = action === "approve" ? "approved" : "rejected";
  await topup.save();

  if (action === "approve") {
    await User.findByIdAndUpdate(topup.userId, { $inc: { balance: topup.amount } });
  }

  return NextResponse.json({ ok: true });
}
