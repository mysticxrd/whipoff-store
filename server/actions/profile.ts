"use server";

import { revalidatePath } from "next/cache";
import { profileUpdateSchema } from "@/lib/contracts";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fieldErrorsFromZod,
  ok,
  type ActionResult,
} from "@/lib/action-result";

/**
 * Update the signed-in user's display name. Full server-side path:
 * Zod-parse (#3) → authenticate (#5) → authorize (own row; RLS re-enforces) → write →
 * revalidate → typed result.
 */
export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Please check the form and try again.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail({
      code: "unauthenticated",
      message: "Sign in to update your profile.",
    });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);
  if (error) {
    return fail({ code: "db", message: error.message });
  }

  revalidatePath("/account");
  return ok();
}
