import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getVariantWithProduct } from "@/lib/catalog/queries";
import type {
  AddCartItemInput,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from "@/lib/contracts";
import { clearGuestCart, readGuestCartLines, writeGuestCartLines } from "@/lib/cart/cookie";
import { buildCartView, clampQuantity, type CartLineView, type CartView } from "@/lib/cart/pure";
import { fail, ok, type ActionResult } from "@/lib/action-result";

// Cart service — the ONE place that knows how to read/write a cart, whether it lives in
// public.carts/cart_items (signed-in) or the guest httpOnly cookie (lib/cart/cookie.ts). Server
// Actions (server/actions/cart.ts) are thin: Zod-parse, then delegate here. A cart line is never
// priced from its stored quantity alone — every read re-resolves the variant from the catalog
// layer, so price/availability are always live (security_shield flaw #3). Quantity clamping and
// totals math themselves live in lib/cart/pure.ts (unit-tested there).

export type { CartLineView, CartView };

type RawLine = { variantId: string; quantity: number };

async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    // Offline / unconfigured Supabase (local-first) — treat as a guest, same posture as
    // lib/supabase/middleware.ts.
    return null;
  }
}

async function getUserCartId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

async function getOrCreateUserCartId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const existing = await getUserCartId(supabase, userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create cart.");
  return data.id;
}

async function getUserRawLines(userId: string): Promise<RawLine[]> {
  try {
    const supabase = await createClient();
    const cartId = await getUserCartId(supabase, userId);
    if (!cartId) return [];
    const { data } = await supabase
      .from("cart_items")
      .select("variant_id, quantity")
      .eq("cart_id", cartId);
    return (data ?? []).map((row) => ({ variantId: row.variant_id, quantity: row.quantity }));
  } catch {
    return [];
  }
}

async function hydrateLines(rawLines: RawLine[]): Promise<CartLineView[]> {
  const resolved = await Promise.all(
    rawLines.map(async (line): Promise<CartLineView | null> => {
      const found = await getVariantWithProduct(line.variantId);
      if (!found) return null; // variant retired since it was added — drop defensively
      const { variant, product } = found;
      const quantity = clampQuantity(line.quantity);
      return {
        variantId: variant.id,
        productId: product.id,
        productSlug: product.slug,
        productTitle: product.title,
        variantTitle: variant.title,
        imageUrl: product.images[0]?.url ?? `gradient:${product.slug}:0`,
        quantity,
        unitPriceMinor: variant.price_cents,
        lineTotalMinor: variant.price_cents * quantity,
        currency: variant.currency,
        inStock: variant.inventory_count > 0,
      };
    }),
  );
  return resolved.filter((line): line is CartLineView => line !== null);
}

/** The current cart (signed-in DB cart, or guest cookie cart), server-recomputed. */
export async function getCart(): Promise<CartView> {
  const user = await getCurrentUser();
  const rawLines = user ? await getUserRawLines(user.id) : await readGuestCartLines();
  return buildCartView(await hydrateLines(rawLines));
}

/** Add a variant to the cart (or increment its existing line, clamped to the per-line cap). */
export async function addLine(input: AddCartItemInput): Promise<ActionResult<CartView>> {
  const found = await getVariantWithProduct(input.variantId);
  if (!found) return fail({ code: "validation", message: "This item is no longer available." });
  if (found.variant.inventory_count <= 0) {
    return fail({ code: "validation", message: "This item is currently out of stock." });
  }

  const user = await getCurrentUser();
  if (user) {
    try {
      const supabase = await createClient();
      const cartId = await getOrCreateUserCartId(supabase, user.id);
      const { data: existing } = await supabase
        .from("cart_items")
        .select("quantity")
        .eq("cart_id", cartId)
        .eq("variant_id", input.variantId)
        .maybeSingle();
      const quantity = clampQuantity((existing?.quantity ?? 0) + input.quantity);
      const { error } = await supabase
        .from("cart_items")
        .upsert(
          { cart_id: cartId, variant_id: input.variantId, quantity },
          { onConflict: "cart_id,variant_id" },
        );
      if (error) return fail({ code: "db", message: error.message });
    } catch {
      return fail({ code: "db", message: "Couldn't update your cart. Try again." });
    }
  } else {
    const lines = await readGuestCartLines();
    const existing = lines.find((line) => line.variantId === input.variantId);
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + input.quantity);
    } else {
      lines.push({ variantId: input.variantId, quantity: clampQuantity(input.quantity) });
    }
    await writeGuestCartLines(lines);
  }

  return ok(await getCart());
}

/** Set a line's absolute quantity. A no-op (not an error) if the line no longer exists. */
export async function updateLineQuantity(
  input: UpdateCartItemInput,
): Promise<ActionResult<CartView>> {
  const user = await getCurrentUser();
  if (user) {
    try {
      const supabase = await createClient();
      const cartId = await getUserCartId(supabase, user.id);
      if (cartId) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: clampQuantity(input.quantity) })
          .eq("cart_id", cartId)
          .eq("variant_id", input.variantId);
        if (error) return fail({ code: "db", message: error.message });
      }
    } catch {
      return fail({ code: "db", message: "Couldn't update your cart. Try again." });
    }
  } else {
    const lines = await readGuestCartLines();
    const line = lines.find((l) => l.variantId === input.variantId);
    if (line) {
      line.quantity = clampQuantity(input.quantity);
      await writeGuestCartLines(lines);
    }
  }
  return ok(await getCart());
}

/** Remove a line entirely. A no-op (not an error) if the line no longer exists. */
export async function removeLine(input: RemoveCartItemInput): Promise<ActionResult<CartView>> {
  const user = await getCurrentUser();
  if (user) {
    try {
      const supabase = await createClient();
      const cartId = await getUserCartId(supabase, user.id);
      if (cartId) {
        const { error } = await supabase
          .from("cart_items")
          .delete()
          .eq("cart_id", cartId)
          .eq("variant_id", input.variantId);
        if (error) return fail({ code: "db", message: error.message });
      }
    } catch {
      return fail({ code: "db", message: "Couldn't update your cart. Try again." });
    }
  } else {
    const lines = (await readGuestCartLines()).filter((l) => l.variantId !== input.variantId);
    await writeGuestCartLines(lines);
  }
  return ok(await getCart());
}

/** Who owns the current cart — feeds checkout-session metadata (lib/checkout/service.ts). */
export type CartOwner = {
  userId: string | null; // null = guest
  email: string | null;
  cartId: string | null; // DB cart id; null for guests (cookie cart) or when no cart row exists
};

export async function getCartOwner(): Promise<CartOwner> {
  const user = await getCurrentUser();
  if (!user) return { userId: null, email: null, cartId: null };
  try {
    const supabase = await createClient();
    return {
      userId: user.id,
      email: user.email ?? null,
      cartId: await getUserCartId(supabase, user.id),
    };
  } catch {
    return { userId: user.id, email: user.email ?? null, cartId: null };
  }
}

/**
 * Empty the CALLER's cart — guest cookie and (when signed in) own DB cart, via the anon
 * client so RLS still scopes the delete. Used by the post-payment return surface: the
 * webhook already clears the DB cart via RPC, but it cannot touch the guest cookie (no
 * request cookies in a webhook), and a double clear of the DB cart is a harmless no-op.
 */
export async function clearOwnCart(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    try {
      const supabase = await createClient();
      const cartId = await getUserCartId(supabase, user.id);
      if (cartId) await supabase.from("cart_items").delete().eq("cart_id", cartId);
    } catch {
      // Best-effort: the webhook's RPC clear is the authoritative one for DB carts.
    }
  }
  await clearGuestCart();
}

/**
 * Merge the guest cookie cart into the just-signed-in user's DB cart (quantities SUMMED per
 * variant, clamped to the per-line cap), then clear the cookie. Called ONLY from the auth
 * callback Route Handler — that is the one place with both a fresh session and cookie-write
 * access (a Server Component render cannot clear the cookie; see lib/cart/cookie.ts).
 * Best-effort: on any DB failure the guest cookie is left intact rather than silently dropped.
 */
export async function mergeGuestCartIntoUser(userId: string): Promise<void> {
  const guestLines = await readGuestCartLines();
  if (guestLines.length === 0) return;

  try {
    const supabase = await createClient();
    const cartId = await getOrCreateUserCartId(supabase, userId);
    const { data: existingItems } = await supabase
      .from("cart_items")
      .select("variant_id, quantity")
      .eq("cart_id", cartId);
    const existingByVariant = new Map(
      (existingItems ?? []).map((row) => [row.variant_id, row.quantity]),
    );

    for (const guestLine of guestLines) {
      const quantity = clampQuantity(
        (existingByVariant.get(guestLine.variantId) ?? 0) + guestLine.quantity,
      );
      await supabase
        .from("cart_items")
        .upsert(
          { cart_id: cartId, variant_id: guestLine.variantId, quantity },
          { onConflict: "cart_id,variant_id" },
        );
    }

    await clearGuestCart();
  } catch {
    // Leave the guest cookie in place — the next sign-in attempt will retry the merge.
  }
}
