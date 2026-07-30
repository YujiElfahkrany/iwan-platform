import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { sendEmail, escapeHtml, multilingualEmail } from "@/lib/email";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Builds the trilingual reset email. Each language links to the reset page in
 * its own locale, carrying the same one-hour token.
 */
function resetEmail(name: string, resetUrlFor: (locale: string) => string) {
  const safeName = escapeHtml(name);
  return multilingualEmail({
    suffix: "Iwan Academy",
    ar: {
      subject: "إعادة تعيين كلمة المرور",
      body: `
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>مرحباً ${safeName}،</p>
        <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الرابط أدناه لتعيين كلمة مرور جديدة:</p>
        <p><a href="${resetUrlFor("ar")}">إعادة تعيين كلمة المرور</a></p>
        <p>هذا الرابط صالح لمدة ساعة واحدة. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة.</p>
      `,
    },
    en: {
      subject: "Reset your password",
      body: `
        <h2>Reset your password</h2>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset the password for your account. Click the link below to choose a new password:</p>
        <p><a href="${resetUrlFor("en")}">Reset password</a></p>
        <p>This link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
      `,
    },
    ru: {
      subject: "Сброс пароля",
      body: `
        <h2>Сброс пароля</h2>
        <p>Здравствуйте, ${safeName}!</p>
        <p>Мы получили запрос на сброс пароля для вашего аккаунта. Перейдите по ссылке ниже, чтобы задать новый пароль:</p>
        <p><a href="${resetUrlFor("ru")}">Сбросить пароль</a></p>
        <p>Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
      `,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // `locale` may still be sent by the client; it is ignored because every
    // email now carries all three platform languages.
    const { email } = body;

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

      const appUrl = req.nextUrl.origin;
      const resetUrlFor = (lang: string) =>
        `${appUrl}/${lang}/auth/reset-password?token=${token}`;

      try {
        await sendEmail({
          to: user.email,
          ...resetEmail(user.name, resetUrlFor),
        });
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
