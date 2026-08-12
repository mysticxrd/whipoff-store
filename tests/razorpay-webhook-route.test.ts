import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  outcomes: [] as string[],
  rpc: vi.fn(),
  verifyWebhookSignature: vi.fn(() => true),
  captureServerEvent: vi.fn(async () => {}),
  sendOrderConfirmationForOrder: vi.fn<(...args: unknown[]) => Promise<void>>(),
  sendMerchantOrderAlertForOrder: vi.fn<(...args: unknown[]) => Promise<void>>(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/razorpay", () => ({
  verifyWebhookSignature: h.verifyWebhookSignature,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: h.rpc }),
}));
vi.mock("@/lib/analytics-server", () => ({
  captureServerEvent: h.captureServerEvent,
}));
vi.mock("@/server/email/order-confirmation", () => ({
  sendOrderConfirmationForOrder: h.sendOrderConfirmationForOrder,
}));
vi.mock("@/server/email/merchant-order-alert", () => ({
  sendMerchantOrderAlertForOrder: h.sendMerchantOrderAlertForOrder,
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: h.captureMessage,
  captureException: h.captureException,
}));

import { POST } from "@/app/api/webhooks/razorpay/route";

const ORDER_ID = "order_MNabc123XYZ";
const PAYMENT_ID = "pay_MNabc123XYZ";

function webhookRequest(event: "order.paid" | "payment.captured", eventId: string): Request {
  return new Request("https://store.test/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": "a".repeat(64),
      "x-razorpay-event-id": eventId,
    },
    body: JSON.stringify({
      event,
      payload: {
        payment: {
          entity: {
            id: PAYMENT_ID,
            order_id: ORDER_ID,
            amount: 52800,
            status: "captured",
          },
        },
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.outcomes.length = 0;
  h.rpc.mockImplementation(async () => ({
    data: h.outcomes.shift() ?? "duplicate_event",
    error: null,
  }));
  h.sendOrderConfirmationForOrder.mockResolvedValue(undefined);
  h.sendMerchantOrderAlertForOrder.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("Razorpay paid-family orchestration", () => {
  it("lets only the event that inserts the order attempt receipt + merchant alert", async () => {
    h.outcomes.push("inserted", "duplicate_order");

    const inserted = await POST(webhookRequest("order.paid", "evt_paid"));
    const sibling = await POST(webhookRequest("payment.captured", "evt_captured"));

    expect(inserted.status).toBe(200);
    expect(sibling.status).toBe(200);
    expect(h.sendOrderConfirmationForOrder).toHaveBeenCalledTimes(1);
    expect(h.sendMerchantOrderAlertForOrder).toHaveBeenCalledTimes(1);
    expect(h.sendMerchantOrderAlertForOrder).toHaveBeenCalledWith(
      expect.anything(),
      ORDER_ID,
      expect.objectContaining({ onRetryableFailure: expect.any(Function) }),
    );
    expect(h.captureServerEvent).toHaveBeenCalledTimes(2);
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "payment_succeeded",
      expect.objectContaining({ provider_order_id: ORDER_ID, value_minor: 52800 }),
      ORDER_ID,
    );
    expect(h.captureServerEvent).toHaveBeenCalledWith(
      "order_completed",
      expect.objectContaining({ provider_order_id: ORDER_ID, value_minor: 52800 }),
      ORDER_ID,
    );
  });

  it.each(["duplicate_event", "duplicate_order"])(
    "keeps revenue effects deduplicated for %s",
    async (outcome) => {
      h.outcomes.push(outcome);

      const response = await POST(webhookRequest("payment.captured", `evt_${outcome}`));

      expect(response.status).toBe(200);
      expect(h.captureServerEvent).not.toHaveBeenCalled();
      expect(h.sendOrderConfirmationForOrder).toHaveBeenCalledTimes(
        outcome === "duplicate_event" ? 1 : 0,
      );
      expect(h.sendMerchantOrderAlertForOrder).toHaveBeenCalledTimes(
        outcome === "duplicate_event" ? 1 : 0,
      );
    },
  );

  it("returns 500 so Razorpay retries the same event after a transient email failure", async () => {
    h.outcomes.push("inserted");
    h.sendOrderConfirmationForOrder.mockImplementation(async (...args: unknown[]) => {
      const hooks = args[2] as { onRetryableFailure?: () => void };
      hooks?.onRetryableFailure?.();
    });

    const response = await POST(webhookRequest("order.paid", "evt_retryable_email"));

    expect(response.status).toBe(500);
    expect(h.captureException).toHaveBeenCalled();
  });

  it("attempts merchant alert on inserted even when confirmation succeeds", async () => {
    h.outcomes.push("inserted");

    const response = await POST(webhookRequest("order.paid", "evt_merchant"));

    expect(response.status).toBe(200);
    expect(h.sendOrderConfirmationForOrder).toHaveBeenCalledTimes(1);
    expect(h.sendMerchantOrderAlertForOrder).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when merchant alert signals a retryable failure", async () => {
    h.outcomes.push("inserted");
    h.sendMerchantOrderAlertForOrder.mockImplementation(async (...args: unknown[]) => {
      const hooks = args[2] as { onRetryableFailure?: () => void };
      hooks?.onRetryableFailure?.();
    });

    const response = await POST(webhookRequest("order.paid", "evt_merchant_retry"));

    expect(response.status).toBe(500);
  });
});
