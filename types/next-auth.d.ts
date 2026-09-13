import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
      email?: string | null;
      name?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    tenantId: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    role?: string;
    email?: string;
  }
}
