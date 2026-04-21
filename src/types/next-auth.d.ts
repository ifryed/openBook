import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      isAdmin: boolean;
      termsAccepted: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
    /** Mirrors User.termsAcceptedAt != null; refreshed on sign-in, JWT update, or when missing on legacy tokens. */
    termsAccepted?: boolean;
  }
}
