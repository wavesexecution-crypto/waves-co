import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { lookupUserByEmail } from "./context";

function resolveSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET missing or too short");
  return s;
}

async function findUserByEmail(email: string, retries = 3): Promise<Awaited<ReturnType<typeof lookupUserByEmail>>> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await lookupUserByEmail(email);
    } catch (err: any) {
      const isLast = attempt === retries - 1;
      const isConnectionError =
        err?.code === "P1001" ||
        err?.message?.includes("Can't reach database") ||
        err?.message?.includes("ECONNREFUSED") ||
        err?.name === "PrismaClientInitializationError";
      if (isConnectionError && !isLast) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[auth] DB connection failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolveSecret(),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  cookies: process.env.NEXTAUTH_COOKIE_DOMAIN
    ? {
        sessionToken: {
          name: "__Secure-authjs.session-token",
          options: {
            domain: process.env.NEXTAUTH_COOKIE_DOMAIN,
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true,
          },
        },
      }
    : undefined,
  providers: [
    Credentials({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const user = await findUserByEmail(email);
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        if (user.status !== "active") return null;
        return { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, role: user.role } as any;
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/") && !url.startsWith("//")) return `${baseUrl}${url}`;
      try {
        const dest = new URL(url);
        const base = new URL(baseUrl);
        if (dest.origin === base.origin) return url;
        const allowed = ["wavesco.in", "app.wavesco.in", "www.wavesco.in", "localhost", "127.0.0.1"];
        const host = dest.hostname;
        if (allowed.some((h) => host === h || host.endsWith(`.${h}`))) return url;
      } catch {}
      return baseUrl;
    },
    jwt({ token, user }) {
      const u = user as any;
      if (u?.id) {
        (token as any).id = u.id;
        (token as any).tenantId = u.tenantId ?? "";
        (token as any).role = u.role ?? "member";
        (token as any).email = u.email ?? "";
      }
      return token;
    },
    session({ session, token }) {
      const t = token as any;
      (session.user as any).id = t.id ?? "";
      (session.user as any).tenantId = t.tenantId ?? "";
      (session.user as any).role = t.role ?? "member";
      (session.user as any).email = t.email ?? session.user.email;
      return session;
    },
  },
});
