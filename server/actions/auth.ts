"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signInSchema } from "@/lib/contracts";
import { clientEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fieldErrorsFromZod,
  ok,
  type ActionResult,
} from "@/lib/action-result";

/** Email magic-link sign-in. Server re-validates input before any side effect (#3). */
export async function signIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Please check the form and try again.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/account` },
  });
  if (error) {
    return fail({ code: "auth", message: error.message });
  }

  return ok();
}

/** Sign out and return to the sign-in surface. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
