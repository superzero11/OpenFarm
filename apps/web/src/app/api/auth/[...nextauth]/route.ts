import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Force dynamic - prevents App Router's two-phase "prospective render"
// from invoking the handler twice (which consumes the OAuth code on the
// first speculative run, causing the real run to fail).
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
