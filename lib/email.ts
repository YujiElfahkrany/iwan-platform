import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const FROM_EMAIL = `Iwan Academy <${process.env.GMAIL_USER}>`;

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  await transporter.sendMail({ from: FROM_EMAIL, ...opts });
}
