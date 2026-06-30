"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function ProfileForm({
  defaultDisplayName,
}: {
  defaultDisplayName: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateProfile,
    null,
  );
  const errors =
    state && !state.ok ? state.error.fieldErrors?.displayName : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={defaultDisplayName}
          maxLength={80}
          placeholder="e.g. Alex"
          aria-invalid={Boolean(errors)}
          aria-describedby={errors ? "dn-error" : undefined}
        />
        {errors?.length ? (
          <p id="dn-error" className="text-sm text-destructive">
            {errors[0]}
          </p>
        ) : null}
      </div>

      {state?.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saved.
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
