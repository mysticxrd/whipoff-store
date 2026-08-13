"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="flex-1" disabled={pending}>
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
  const [savedName, setSavedName] = useState(defaultDisplayName);
  const [value, setValue] = useState(defaultDisplayName);
  const [editing, setEditing] = useState(defaultDisplayName.length === 0);
  const valueRef = useRef(value);
  const editingRef = useRef(editing);
  valueRef.current = value;
  editingRef.current = editing;
  const errors =
    state && !state.ok ? state.error.fieldErrors?.displayName : undefined;

  useEffect(() => {
    setSavedName(defaultDisplayName);
    if (!editingRef.current) {
      setValue(defaultDisplayName);
    }
  }, [defaultDisplayName]);

  useEffect(() => {
    if (!state?.ok) {
      return;
    }
    setSavedName(valueRef.current.trim());
    setEditing(false);
  }, [state]);

  function startEditing() {
    setValue(savedName);
    setEditing(true);
  }

  function cancelEditing() {
    setValue(savedName);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium leading-none">Display name</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-muted-foreground hover:text-foreground"
            onClick={startEditing}
          >
            Edit
          </Button>
        </div>
        <p className="text-base text-foreground">
          {savedName || (
            <span className="text-muted-foreground">Not set</span>
          )}
        </p>
        {state?.ok ? (
          <p role="status" className="text-sm text-muted-foreground">
            Saved.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={80}
          placeholder="e.g. Alex"
          autoFocus
          aria-invalid={Boolean(errors)}
          aria-describedby={errors ? "dn-error" : undefined}
        />
        {errors?.length ? (
          <p id="dn-error" className="text-sm text-destructive">
            {errors[0]}
          </p>
        ) : null}
      </div>

      {state && !state.ok && state.error.code !== "validation" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        {savedName.length > 0 ? (
          <Button type="button" variant="outline" onClick={cancelEditing}>
            Cancel
          </Button>
        ) : null}
        <SubmitButton />
      </div>
    </form>
  );
}
