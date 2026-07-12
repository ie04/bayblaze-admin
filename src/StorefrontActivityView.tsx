import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";

import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "./components/ui";
import { loadStorefrontActivitySessions } from "./lib/adminApi";
import type { StorefrontActivitySession } from "./lib/types";

export function StorefrontActivityView({ token }: { token: string }) {
  const [sessions, setSessions] = useState<StorefrontActivitySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const stats = useMemo(() => {
    const abandoned = sessions.filter((session) => session.abandoned).length;
    const withCart = sessions.filter((session) => session.cart.itemCount > 0).length;

    return {
      abandoned,
      active: Math.max(0, sessions.length - abandoned),
      withCart,
    };
  }, [sessions]);

  const load = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (options.quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      setSessions((await loadStorefrontActivitySessions(token)).sessions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Storefront activity could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Storefront"
        icon={<Activity size={22} aria-hidden="true" />}
        title="Customer Activity"
        subtitle="Recent storefront sessions, last activity, and likely abandonment moments."
        actions={
          <Button loading={refreshing} onClick={() => void load({ quiet: true })} variant="secondary">
            <RefreshCw size={17} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Ended" value={stats.abandoned} />
        <Metric label="Still Active" value={stats.active} />
        <Metric label="With Cart" value={stats.withCart} />
      </div>

      {error ? <ErrorState>{error}</ErrorState> : null}
      {loading ? <LoadingState label="Loading storefront activity" /> : null}
      {!loading && sessions.length === 0 ? <EmptyState>No storefront activity has been recorded yet.</EmptyState> : null}

      <div className="grid gap-3">
        {sessions.map((session) => (
          <ActivitySessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

function ActivitySessionCard({ session }: { session: StorefrontActivitySession }) {
  const eventTone = session.abandoned ? "warning" : "success";

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={eventTone}>{session.abandoned ? "Ended" : "Active"}</Badge>
            <Badge tone="neutral">{formatEventType(session.lastEventType)}</Badge>
            {session.cart.itemCount > 0 ? <Badge tone="brand">{session.cart.itemCount} in cart</Badge> : null}
          </div>
          <h2 className="mt-3 break-words text-xl font-black text-[var(--bb-charcoal)]">
            {session.lastPage.path || "/"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">
            Last seen {formatDateTime(session.lastSeenAt)}
          </p>
        </div>
        <div className="grid gap-2 text-left md:min-w-48 md:text-right">
          <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Cart value</p>
          <p className="text-lg font-black text-[var(--bb-charcoal)]">{formatCurrency(session.cart.valueCents)}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Detail label="Session" value={shorten(session.id)} />
        <Detail label="Visitor" value={shorten(session.visitorId)} />
        <Detail label="Reason" value={formatReason(session.abandonmentReason)} />
      </div>

      {session.lastPage.referrer ? (
        <p className="truncate text-xs font-semibold text-[var(--bb-muted)]">
          Referrer: {session.lastPage.referrer}
        </p>
      ) : null}

      {session.lastPage.url ? (
        <a
          className="inline-flex items-center gap-2 text-sm font-black text-[var(--bb-blaze)]"
          href={session.lastPage.url}
          rel="noreferrer"
          target="_blank"
        >
          Open last page
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      ) : null}

      <div className="space-y-2 border-t border-[var(--bb-line)] pt-3">
        <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Recent events</p>
        <div className="grid gap-2">
          {session.recentEvents.slice(0, 5).map((event) => (
            <div
              className="grid gap-1 rounded-2xl bg-[var(--bb-surface-warm)] px-3 py-2 text-sm md:grid-cols-[9rem_minmax(0,1fr)_9rem]"
              key={event.eventId}
            >
              <span className="font-black text-[var(--bb-charcoal)]">{formatEventType(event.eventType)}</span>
              <span className="min-w-0 truncate font-semibold text-[var(--bb-muted)]">{event.path || "/"}</span>
              <span className="font-semibold text-[var(--bb-muted)] md:text-right">{formatTime(event.occurredAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-4">
      <p className="text-xs font-black uppercase text-[var(--bb-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[var(--bb-charcoal)]">{value}</p>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--bb-line)] px-3 py-2">
      <p className="text-xs font-black uppercase text-[var(--bb-muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-[var(--bb-charcoal)]">{value || "-"}</p>
    </div>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function formatDateTime(value: string) {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatEventType(value: string) {
  return value.replace(/_/g, " ") || "event";
}

function formatReason(value: string) {
  return value.replace(/_/g, " ") || "Not ended";
}

function shorten(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}
