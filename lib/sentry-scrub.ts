import type { ErrorEvent, Event } from "@sentry/nextjs";

const FILTERED = "[Filtered]";
const SENSITIVE_KEY =
  /(?:authorization|cookie|email|phone|address|name|password|secret|token|api[_-]?key)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

function scrubString(value: string): string {
  return value.replace(EMAIL, FILTERED).replace(BEARER, `Bearer ${FILTERED}`).replace(JWT, FILTERED);
}

function stripUrlQuery(value: string | undefined): string | undefined {
  if (!value) return value;
  const boundary = value.search(/[?#]/);
  return boundary === -1 ? value : value.slice(0, boundary);
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return FILTERED;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value === null || typeof value !== "object") return value;

  const scrubbed: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    scrubbed[key] = SENSITIVE_KEY.test(key) ? FILTERED : scrubValue(child, depth + 1);
  }
  return scrubbed;
}

function scrubEvent<T extends Event>(event: T): T {
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: stripUrlQuery(event.request.url),
      headers: scrubValue(event.request.headers) as Record<string, string>,
    };
  }
  event.message = event.message ? scrubString(event.message) : event.message;
  event.extra = scrubValue(event.extra) as ErrorEvent["extra"];
  event.contexts = scrubValue(event.contexts) as ErrorEvent["contexts"];
  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    ...breadcrumb,
    message: breadcrumb.message ? scrubString(breadcrumb.message) : breadcrumb.message,
    data: scrubValue(breadcrumb.data) as typeof breadcrumb.data,
  }));
  event.exception?.values?.forEach((exception) => {
    if (exception.value) exception.value = scrubString(exception.value);
  });
  if (event.spans) {
    event.spans = event.spans.map((span) => ({
      ...span,
      description: stripUrlQuery(span.description ? scrubString(span.description) : undefined),
      data: scrubValue(span.data) as typeof span.data,
    }));
  }
  if (event.transaction) event.transaction = stripUrlQuery(scrubString(event.transaction));
  return event;
}

/** Shared client/server/edge PII minimizer for error events. */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  return scrubEvent(event);
}

/** Shared client/server/edge PII minimizer for transaction/span events. */
export function scrubSentryTransaction<T extends Event>(event: T): T {
  return scrubEvent(event);
}
