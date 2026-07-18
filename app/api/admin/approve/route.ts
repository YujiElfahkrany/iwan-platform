import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { sendEmail, escapeHtml } from "@/lib/email";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json();
  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findByIdAndUpdate(id, { status }, { new: true }).lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status === "approved") {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/ar/auth/login`;
    try {
      await sendEmail({
        to: user.email,
        subject: "تمت الموافقة على حسابك | Account Approved — Iwan Academy",
        html: `
          <div dir="rtl">
            <h2>تمت الموافقة على حسابك</h2>
            <p>مرحباً ${escapeHtml(user.name)}،</p>
            <p>تمت الموافقة على حسابك في أكاديمية إيوان. يمكنك الآن تسجيل الدخول والبدء.</p>
            <p><a href="${loginUrl}">تسجيل الدخول</a></p>
          </div>
          <hr />
          <div dir="ltr">
            <h2>Your account has been approved</h2>
            <p>Hi ${escapeHtml(user.name)},</p>
            <p>Your Iwan Academy account has been approved. You can now log in and get started.</p>
            <p><a href="${loginUrl}">Log in</a></p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send account approval email:", emailErr);
    }
  }

  return NextResponse.json({ ok: true });
}
