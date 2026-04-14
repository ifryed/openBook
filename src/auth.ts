import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";

const googleProvider =
  process.env.AUTH_GOOGLE_ID?.trim() &&
  process.env.AUTH_GOOGLE_SECRET?.trim()
    ? Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: true,
      })
    : null;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, ...rest }) {
      let t = token;
      if (authConfig.callbacks?.jwt) {
        t = await authConfig.callbacks.jwt({ token: t, user, ...rest });
      }
      if (user?.id) {
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isAdmin: true },
        });
        t.isAdmin = row?.isAdmin ?? false;
      }
      return t;
    },
    async session({ session, token, ...rest }) {
      let s = session;
      if (authConfig.callbacks?.session) {
        s = await authConfig.callbacks.session({
          session: s,
          token,
          ...rest,
        });
      }
      if (s.user) {
        s.user.isAdmin = Boolean(token.isAdmin);
      }
      return s;
    },
  },
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
});
