import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";

class PendingApprovalError extends CredentialsSignin {
  code = "pending_approval";
}

class AccountRejectedError extends CredentialsSignin {
  code = "account_rejected";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        // Hardcoded admin account
        if (credentials.email === "admin" && credentials.password === "admin") {
          return { id: "admin-system", email: "admin", name: "Admin", role: "admin", image: null };
        }
        await connectDB();
        const user = await User.findOne({ email: credentials.email });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        if (user.status === "pending") throw new PendingApprovalError();
        if (user.status === "rejected") throw new AccountRejectedError();
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          gender: user.gender,
          image: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.gender = (user as { gender?: string }).gender;
      }
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if (typeof session.image === "string") token.picture = session.image;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.gender = token.gender as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/ar/auth/login",
  },
  session: { strategy: "jwt" },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      gender?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
