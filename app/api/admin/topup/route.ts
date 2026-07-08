import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { TopUpRequest } from "@/models/TopUpRequest";
import { User } from "@/models/User";
import { sendEmail } from "@/lib/email";

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
    const user = await User.findByIdAndUpdate(topup.userId, { $inc: { balance: topup.amount } }, { new: true }).lean();
    if (user) {
      try {
        await sendEmail({
          to: user.email,
          subject: "تمت الموافقة على شحن الرصيد | Top-Up Approved — Iwan Academy",
          html: `
            <div dir="rtl">
              <h2>تمت الموافقة على شحن الرصيد</h2>
              <p>مرحباً ${user.name}،</p>
              <p>تمت الموافقة على طلب شحن رصيدك بمبلغ <strong>${topup.amount} جنيه</strong>.</p>
              <p>رصيدك الحالي: <strong>${user.balance} جنيه</strong>.</p>
            </div>
            <hr />
            <div dir="ltr">
              <h2>Your top-up has been approved</h2>
              <p>Hi ${user.name},</p>
              <p>Your balance top-up request of <strong>${topup.amount} LE</strong> has been approved.</p>
              <p>Your current balance: <strong>${user.balance} LE</strong>.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send top-up approval email:", emailErr);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
