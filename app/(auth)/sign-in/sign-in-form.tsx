"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Email me a link"}
    </Button>
  );
}

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    signIn,
    null,
  );
  const emailErrors =
    state && !state.ok ? state.error.fieldErrors?.email : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* Carried through the magic-link round-trip; re-sanitized server-side (open-redirect guard). */}
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(emailErrors)}
          aria-describedby={emailErrors ? "email-error" : undefined}
        />
        {emailErrors?.length ? (
          <p id="email-error" className="text-sm text-destructive">
            {emailErrors[0]}
          </p>
        ) : null}
      </div>

      {state?.ok ? (
        <p role="status" className="text-sm text-foreground">
          Check your inbox for the sign-in link.
        </p>
      ) : null}
      {state && !state.ok && state.error.code !== "validation" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
