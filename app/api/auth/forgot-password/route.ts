import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { sendEmail } from "@/lib/email";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, locale } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always respond with success so we don't reveal whether the email exists
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      user.resetTokenHash = tokenHash;
      user.resetTokenExpiry = new Date(Date.now() + TOKEN_TTL_MS);
      await user.save();

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const lang = locale === "en" ? "en" : "ar";
      const resetUrl = `${appUrl}/${lang}/auth/reset-password?token=${token}`;

      const subject =
        lang === "ar" ? "إعادة تعيين كلمة المرور — أكاديمية إيوان" : "Reset your password — Iwan Academy";
      const html =
        lang === "ar"
          ? `
            <div dir="rtl">
              <h2>إعادة تعيين كلمة المرور</h2>
              <p>مرحباً ${user.name}،</p>
              <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الرابط أدناه لتعيين كلمة مرور جديدة:</p>
              <p><a href="${resetUrl}">إعادة تعيين كلمة المرور</a></p>
              <p>هذا الرابط صالح لمدة ساعة واحدة. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة.</p>
            </div>
          `
          : `
            <h2>Reset your password</h2>
            <p>Hi ${user.name},</p>
            <p>We received a request to reset the password for your account. Click the link below to choose a new password:</p>
            <p><a href="${resetUrl}">Reset password</a></p>
            <p>This link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
          `;

      try {
        await sendEmail({ to: user.email, subject, html });
      } catch (emailErr) {
        console.error("Failed to send password reset email:", emailErr);
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
