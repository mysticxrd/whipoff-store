"use server";

import { revalidatePath } from "next/cache";
import {
  addCartItemSchema,
  removeCartItemSchema,
  updateCartItemSchema,
  type AddCartItemInput,
  type RemoveCartItemInput,
  type UpdateCartItemInput,
} from "@/lib/contracts";
import { addLine, removeLine, updateLineQuantity, type CartView } from "@/lib/cart/service";
import { fail, fieldErrorsFromZod, type ActionResult } from "@/lib/action-result";

// Cart mutations. Thin by design: Zod-parse (#3) first, then delegate to lib/cart/service.ts,
// which resolves guest-vs-signed-in and re-derives price/ownership server-side (never trusting
// the client). Called directly from client components (qty stepper, remove, add-to-cart) rather
// than via <form action>, since these are button-driven, not form-driven — still one Server
// Action per intent, still typed input, per shared/api_conventions.md.

export async function addCartItem(input: AddCartItemInput): Promise<ActionResult<CartView>> {
  const parsed = addCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Please check the quantity and try again.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    });
  }
  const result = await addLine(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateCartItemQuantity(
  input: UpdateCartItemInput,
): Promise<ActionResult<CartView>> {
  const parsed = updateCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Please check the quantity and try again.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    });
  }
  const result = await updateLineQuantity(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function removeCartItem(
  input: RemoveCartItemInput,
): Promise<ActionResult<CartView>> {
  const parsed = removeCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail({ code: "validation", message: "Something went wrong. Please try again." });
  }
  const result = await removeLine(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
