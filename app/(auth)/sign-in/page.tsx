import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeReturnTo } from "@/lib/contracts";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}) {
  const { redirectTo } = await searchParams;
  // Where to land after the magic link completes. Sanitized here (open-redirect guard) and again
  // in the sign-in action + /auth/callback — unsafe values fall back to /account.
  const safeDestination = safeReturnTo(
    Array.isArray(redirectTo) ? redirectTo[0] : redirectTo,
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Whipoff</CardTitle>
          <CardDescription>We&apos;ll email you a secure sign-in link.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm redirectTo={safeDestination} />
        </CardContent>
      </Card>
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back home
      </Link>
    </main>
  );
}
