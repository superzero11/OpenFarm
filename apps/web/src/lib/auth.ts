import GoogleProvider from "next-auth/providers/google";
import { upsertUser } from "@/lib/db";
import { logger } from "@/lib/logger";

import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            try {
                const dbUser = await upsertUser(
                    user.email!,
                    user.name || user.email!,
                    user.image
                );
                (user as any).dbId = dbUser.id;
                logger.info({ email: user.email }, "user_signed_in");
                return true;
            } catch (error) {
                logger.error({ error, email: user.email }, "user_signin_failed");
                return false;
            }
        },
        async jwt({ token, user }) {
            if (user) {
                token.dbId = (user as any).dbId;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.dbId;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: "/",
        error: "/",
    },
};
