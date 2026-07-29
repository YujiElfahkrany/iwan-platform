import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { sendEmail, escapeHtml } from "@/lib/email";
import { routing } from "@/i18n/routing";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const RESET_EMAIL = {
  ar: {
    subject: "إعادة تعيين كلمة المرور — أكاديمية إيوان",
    html: (name: string, resetUrl: string) => `
      <div dir="rtl">
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>مرحباً ${escapeHtml(name)}،</p>
        <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الرابط أدناه لتعيين كلمة مرور جديدة:</p>
        <p><a href="${resetUrl}">إعادة تعيين كلمة المرور</a></p>
        <p>هذا الرابط صالح لمدة ساعة واحدة. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة.</p>
      </div>
    `,
  },
  en: {
    subject: "Reset your password — Iwan Academy",
    html: (name: string, resetUrl: string) => `
      <h2>Reset your password</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>We received a request to reset the password for your account. Click the link below to choose a new password:</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>This link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
    `,
  },
  ru: {
    subject: "Сброс пароля — Академия Айван",
    html: (name: string, resetUrl: string) => `
      <h2>Сброс пароля</h2>
      <p>Здравствуйте, ${escapeHtml(name)}!</p>
      <p>Мы получили запрос на сброс пароля для вашего аккаунта. Перейдите по ссылке ниже, чтобы задать новый пароль:</p>
      <p><a href="${resetUrl}">Сбросить пароль</a></p>
      <p>Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
    `,
  },
} as const;

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

      const appUrl = req.nextUrl.origin;
      // hasOwn (not `in`): locale comes from the request body, and inherited
      // keys like "toString" must not select a template.
      const lang = (
        typeof locale === "string" && Object.hasOwn(RESET_EMAIL, locale)
          ? locale
          : routing.defaultLocale
      ) as keyof typeof RESET_EMAIL;
      const resetUrl = `${appUrl}/${lang}/auth/reset-password?token=${token}`;

      const template = RESET_EMAIL[lang];

      try {
        await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html(user.name, resetUrl),
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
