import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/supabase/types";

// Slice 5 — server/email/order-confirmation.ts, the webhook's post-commit side-effect.
// Re-keyed to provider_order_id for the Razorpay swap; behaviour is otherwise unchanged.
// Contracts under test (PRD AC 3/4/5 + Gate-1 #5 prefer-delivery):
//   * exactly-once: a set marker (or non-paid / missing order) means NO send and NO rpc;
//   * ordering: send resolves BEFORE mark_order_confirmation_email_sent is called;
//   * failure isolation: nothing — lookup error, compose error, send error, rpc error,
//     even a throwing client — ever escapes to the caller (the webhook's 500 path).

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  captureServerEvent: vi.fn(async () => {}),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/email/send", () => ({ sendEmail: h.sendEmail }));
vi.mock("@/lib/analytics-server", () => ({ captureServerEvent: h.captureServerEvent }));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: h.captureMessage,
  captureException: h.captureException,
}));
vi.mock("@/lib/env", () => ({ clientEnv: { NEXT_PUBLIC_APP_URL: "https://store.test" } }));

import { sendOrderConfirmationForOrder } from "@/server/email/order-confirmation";

const ORDER_ID = "order_MNabc123XYZ";

const paidOrder = {
  id: "ord_1",
  user_id: null as string | null,
  email: "buyer@example.com",
  status: "paid",
  currency: "INR",
  amount_subtotal_minor: 47000,
  amount_shipping_minor: 0,
  amount_tax_minor: 0,
  amount_total_minor: 47000,
  shipping_name: "Asha Kumar",
  shipping_address: { line1: "12 MG Road", city: "Bengaluru", country: "IN" },
  order_seq: 123,
  paid_at: "2026-07-03T10:00:00.000Z",
  created_at: "2026-07-03T09:59:00.000Z",
  confirmation_email_sent_at: null as string | null,
};

const paidItems = [
  {
    product_title: "Whipoff Gloss Wash",
    variant_title: "500 ml",
    sku: "WGW-500",
    unit_price_minor: 47000,
    quantity: 1,
    line_total_minor: 47000,
  },
];

type FakeAdminOpts = {
  order?: Record<string, unknown> | null;
  orderError?: { message: string } | null;
  items?: Record<string, unknown>[];
  itemsError?: { message: string } | null;
  rpcError?: { message: string } | null;
  log?: string[];
};

function makeAdmin(opts: FakeAdminOpts = {}) {
  const log = opts.log ?? [];
  const rpc = vi.fn(async (name: string, args: unknown) => {
    log.push(`rpc:${name}:${JSON.stringify(args)}`);
    return { data: true, error: opts.rpcError ?? null };
  });
  const admin = {
    from(table: string) {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.order === undefined ? paidOrder : opts.order,
                error: opts.orderError ?? null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: opts.items ?? paidItems,
              error: opts.itemsError ?? null,
            }),
          }),
        }),
      };
    },
    rpc,
  };
  return { admin: admin as unknown as SupabaseClient<Database>, rpc, log };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  h.sendEmail.mockResolvedValue({ ok: true, providerId: "email_abc" });
});

describe("sendOrderConfirmationForOrder", () => {
  it("happy path (guest): sends to the captured email, THEN marks, then emits the sent event", async () => {
    const { admin, log } = makeAdmin({ log: [] });
    h.sendEmail.mockImplementation(async () => {
      log.push("send");
      return { ok: true, providerId: "email_abc" };
    });

    await sendOrderConfirmationForOrder(admin, ORDER_ID);

    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(h.sendEmail.mock.calls[0]![0].to).toBe("buyer@example.com");
    expect(h.sendEmail.mock.calls[0]![0].idempotencyKey).toBe(`order-receipt/${ORDER_ID}`);
    // Prefer-delivery ordering: the send completed before the marker RPC fired.
    expect(log).toEqual([
      "send",
      `rpc:mark_order_confirmation_email_sent:${JSON.stringify({ p_order_id: "ord_1" })}`,
    ]);
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "order_confirmation_email_sent",
      { provider_order_id: ORDER_ID, value_minor: 47000, currency: "INR" },
      "guest",
    );
    expect(h.captureMessage).not.toHaveBeenCalled();
  });

  it("authenticated order: analytics distinct id is the user id", async () => {
    const { admin } = makeAdmin({ order: { ...paidOrder, user_id: "user_abc" } });
    await sendOrderConfirmationForOrder(admin, ORDER_ID);
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "order_confirmation_email_sent",
      expect.anything(),
      "user_abc",
    );
  });

  it("marker already set: skips — no send, no rpc (exactly-once)", async () => {
    const { admin, rpc } = makeAdmin({
      order: { ...paidOrder, confirmation_email_sent_at: "2026-07-04T00:00:00.000Z" },
    });
    await sendOrderConfirmationForOrder(admin, ORDER_ID);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(h.captureServerEvent).not.toHaveBeenCalled();
  });

  it("non-paid order: skips silently (failed/processing path falls through)", async () => {
    const { admin, rpc } = makeAdmin({ order: { ...paidOrder, status: "pending" } });
    await sendOrderConfirmationForOrder(admin, ORDER_ID);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("no order row: skips silently (unreconcilable-payment call site) — no Sentry", async () => {
    const { admin } = makeAdmin({ order: null });
    await sendOrderConfirmationForOrder(admin, ORDER_ID);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.captureMessage).not.toHaveBeenCalled();
    expect(h.captureException).not.toHaveBeenCalled();
  });

  it("send failure: marker NOT set (retry re-sends), failed event + Sentry, no throw", async () => {
    const { admin, rpc } = makeAdmin();
    h.sendEmail.mockResolvedValue({ ok: false, reason: "resend_http_500" });

    await expect(sendOrderConfirmationForOrder(admin, ORDER_ID)).resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "order_confirmation_email_failed",
      { provider_order_id: ORDER_ID, reason: "resend_http_500" },
      "guest",
    );
    expect(h.captureMessage).toHaveBeenCalled();
  });

  it("signals the webhook to retry a transient provider failure", async () => {
    const { admin } = makeAdmin();
    const onRetryableFailure = vi.fn();
    h.sendEmail.mockResolvedValue({ ok: false, reason: "resend_http_503" });

    await sendOrderConfirmationForOrder(admin, ORDER_ID, { onRetryableFailure });

    expect(onRetryableFailure).toHaveBeenCalledTimes(1);
  });

  it("does not retry a permanent provider validation failure", async () => {
    const { admin } = makeAdmin();
    const onRetryableFailure = vi.fn();
    h.sendEmail.mockResolvedValue({
      ok: false,
      reason: "resend_http_422_validation_error",
    });

    await sendOrderConfirmationForOrder(admin, ORDER_ID, { onRetryableFailure });

    expect(onRetryableFailure).not.toHaveBeenCalled();
  });

  it("not_configured: failed event recorded but NOT a Sentry alarm (deliberate local posture)", async () => {
    const { admin, rpc } = makeAdmin();
    h.sendEmail.mockResolvedValue({ ok: false, reason: "not_configured" });

    await sendOrderConfirmationForOrder(admin, ORDER_ID);

    expect(rpc).not.toHaveBeenCalled();
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "order_confirmation_email_failed",
      expect.objectContaining({ reason: "not_configured" }),
      "guest",
    );
    expect(h.captureMessage).not.toHaveBeenCalled();
  });

  it("compose failure (zero items): permanent — no send, failed event + Sentry", async () => {
    const { admin } = makeAdmin({ items: [] });
    await sendOrderConfirmationForOrder(admin, ORDER_ID);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "order_confirmation_email_failed",
      expect.objectContaining({ reason: expect.stringContaining("compose_failed") }),
      "guest",
    );
    expect(h.captureMessage).toHaveBeenCalled();
  });

  it("marker write failure AFTER a successful send: warning only, sent event still fires", async () => {
    const { admin } = makeAdmin({ rpcError: { message: "db hiccup" } });

    await expect(sendOrderConfirmationForOrder(admin, ORDER_ID)).resolves.toBeUndefined();

    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(h.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("provider idempotency key"),
      "warning",
    );
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "order_confirmation_email_sent",
      expect.anything(),
      "guest",
    );
  });

  it("order lookup error: recorded loudly, no send, no throw", async () => {
    const { admin } = makeAdmin({ orderError: { message: "connection refused" } });
    await sendOrderConfirmationForOrder(admin, ORDER_ID);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.captureMessage).toHaveBeenCalled();
  });

  it("belt-and-braces: even a throwing client never escapes to the webhook", async () => {
    const throwingAdmin = {
      from() {
        throw new Error("boom");
      },
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>;

    const onRetryableFailure = vi.fn();
    await expect(
      sendOrderConfirmationForOrder(throwingAdmin, ORDER_ID, { onRetryableFailure }),
    ).resolves.toBeUndefined();
    expect(h.captureMessage).toHaveBeenCalledWith(
      "order confirmation email failed: unexpected_error",
      "error",
    );
    expect(onRetryableFailure).toHaveBeenCalledTimes(1);
  });
});
