import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { TopUpRequest } from "@/models/TopUpRequest";
import { User } from "@/models/User";
import { sendEmail, escapeHtml, multilingualEmail } from "@/lib/email";

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
        const safeName = escapeHtml(user.name);
        await sendEmail({
          to: user.email,
          ...multilingualEmail({
            suffix: "Iwan Academy",
            ar: {
              subject: "تمت الموافقة على شحن الرصيد",
              body: `
              <h2>تمت الموافقة على شحن الرصيد</h2>
              <p>مرحباً ${safeName}،</p>
              <p>تمت الموافقة على طلب شحن رصيدك بمبلغ <strong>${topup.amount} جنيه</strong>.</p>
              <p>رصيدك الحالي: <strong>${user.balance} جنيه</strong>.</p>
            `,
            },
            en: {
              subject: "Top-Up Approved",
              body: `
              <h2>Your top-up has been approved</h2>
              <p>Hi ${safeName},</p>
              <p>Your balance top-up request of <strong>${topup.amount} LE</strong> has been approved.</p>
              <p>Your current balance: <strong>${user.balance} LE</strong>.</p>
            `,
            },
            ru: {
              subject: "Пополнение баланса одобрено",
              body: `
              <h2>Ваше пополнение баланса одобрено</h2>
              <p>Здравствуйте, ${safeName}!</p>
              <p>Ваш запрос на пополнение баланса на сумму <strong>${topup.amount} EGP</strong> одобрен.</p>
              <p>Ваш текущий баланс: <strong>${user.balance} EGP</strong>.</p>
            `,
            },
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send top-up approval email:", emailErr);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
