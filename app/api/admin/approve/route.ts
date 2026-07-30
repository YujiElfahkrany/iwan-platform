import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { sendEmail, escapeHtml, multilingualEmail } from "@/lib/email";

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const loginUrlFor = (locale: string) => `${appUrl}/${locale}/auth/login`;
    const safeName = escapeHtml(user.name);
    try {
      await sendEmail({
        to: user.email,
        ...multilingualEmail({
          suffix: "Iwan Academy",
          ar: {
            subject: "تمت الموافقة على حسابك",
            body: `
            <h2>تمت الموافقة على حسابك</h2>
            <p>مرحباً ${safeName}،</p>
            <p>تمت الموافقة على حسابك في أكاديمية إيوان. يمكنك الآن تسجيل الدخول والبدء.</p>
            <p><a href="${loginUrlFor("ar")}">تسجيل الدخول</a></p>
          `,
          },
          en: {
            subject: "Account Approved",
            body: `
            <h2>Your account has been approved</h2>
            <p>Hi ${safeName},</p>
            <p>Your Iwan Academy account has been approved. You can now log in and get started.</p>
            <p><a href="${loginUrlFor("en")}">Log in</a></p>
          `,
          },
          ru: {
            subject: "Аккаунт одобрен",
            body: `
            <h2>Ваш аккаунт одобрен</h2>
            <p>Здравствуйте, ${safeName}!</p>
            <p>Ваш аккаунт в Iwan Academy одобрен. Теперь вы можете войти и начать занятия.</p>
            <p><a href="${loginUrlFor("ru")}">Войти</a></p>
          `,
          },
        }),
      });
    } catch (emailErr) {
      console.error("Failed to send account approval email:", emailErr);
    }
  }

  return NextResponse.json({ ok: true });
}
