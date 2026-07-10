import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, Save, Send } from "lucide-react";

import { loadEmailAutomations, sendEmailAutomationTest, updateEmailAutomation } from "./lib/adminApi";
import type { EmailAutomation, EmailAutomationLog, EmailRecipientMode } from "./lib/types";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Textarea } from "./components/ui";

type EditableAutomation = EmailAutomation & {
  internalRecipientsText: string;
};

export function EmailAutomationsView({ token }: { token: string }) {
  const [automations, setAutomations] = useState<EditableAutomation[]>([]);
  const [logs, setLogs] = useState<EmailAutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState("");
  const [testingEvent, setTestingEvent] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const response = await loadEmailAutomations(token);
      setAutomations(response.automations.map(toEditableAutomation));
      setLogs(response.logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load email automations.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  function updateLocal(eventType: EmailAutomation["eventType"], input: Partial<EditableAutomation>) {
    setAutomations((current) =>
      current.map((automation) => automation.eventType === eventType ? { ...automation, ...input } : automation),
    );
  }

  async function saveAutomation(automation: EditableAutomation) {
    setSavingEvent(automation.eventType);
    setError("");
    setNotice("");
    try {
      const response = await updateEmailAutomation(token, automation.eventType, {
        enabled: automation.enabled,
        fromEmail: automation.fromEmail,
        htmlTemplate: automation.htmlTemplate,
        internalRecipientEmails: parseRecipientEmails(automation.internalRecipientsText),
        recipientMode: automation.recipientMode,
        replyTo: automation.replyTo,
        subjectTemplate: automation.subjectTemplate,
        textTemplate: automation.textTemplate,
      });
      updateLocal(response.automation.eventType, toEditableAutomation(response.automation));
      setNotice(`${response.automation.label} saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save email automation.");
    } finally {
      setSavingEvent("");
    }
  }

  async function sendTest(automation: EditableAutomation) {
    setTestingEvent(automation.eventType);
    setError("");
    setNotice("");
    try {
      await sendEmailAutomationTest(token, automation.eventType, { recipientEmail: testEmail });
      setNotice(`Test email sent to ${testEmail}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send test email.");
    } finally {
      setTestingEvent("");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button loading={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw size={17} aria-hidden="true" />
            Refresh
          </Button>
        }
        icon={<Mail size={22} aria-hidden="true" />}
        title="Email"
        subtitle="Configure automated customer and internal emails sent by BayBlaze API."
      />

      {error ? <ErrorState>{error}</ErrorState> : null}
      {notice ? (
        <div className="rounded-2xl border border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] px-4 py-3 text-sm font-black text-[var(--bb-success-strong)]">
          {notice}
        </div>
      ) : null}
      {loading ? <LoadingState label="Loading email automations..." /> : null}

      <div className="grid gap-4">
        {automations.map((automation) => (
          <Card className="space-y-4" key={automation.eventType}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-[var(--bb-charcoal)]">{automation.label}</h3>
                  <Badge tone={automation.enabled ? "success" : "neutral"}>{automation.enabled ? "ON" : "OFF"}</Badge>
                </div>
                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-muted)]">{automation.description}</p>
              </div>
              <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-3 text-sm font-black text-[var(--bb-charcoal)]">
                <input
                  checked={automation.enabled}
                  className="size-4 accent-[var(--bb-blaze)]"
                  onChange={(event) => updateLocal(automation.eventType, { enabled: event.target.checked })}
                  type="checkbox"
                />
                Enabled
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Input
                label="Subject"
                onChange={(event) => updateLocal(automation.eventType, { subjectTemplate: event.target.value })}
                value={automation.subjectTemplate}
              />
              <label className="grid gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--bb-muted)]">
                Recipients
                <select
                  className="min-h-12 rounded-2xl border border-[var(--bb-line)] bg-white px-4 text-base font-bold normal-case tracking-normal text-[var(--bb-charcoal)] outline-none transition focus:border-[var(--bb-green)]"
                  onChange={(event) => updateLocal(automation.eventType, { recipientMode: event.target.value as EmailRecipientMode })}
                  value={automation.recipientMode}
                >
                  <option value="customer">Customer</option>
                  <option value="internal">Internal team</option>
                  <option value="both">Customer and internal team</option>
                </select>
              </label>
              <Input
                label="From email"
                onChange={(event) => updateLocal(automation.eventType, { fromEmail: event.target.value })}
                placeholder="Optional; defaults to API email sender"
                value={automation.fromEmail}
              />
              <Input
                label="Reply-to"
                onChange={(event) => updateLocal(automation.eventType, { replyTo: event.target.value })}
                placeholder="Optional"
                value={automation.replyTo}
              />
            </div>

            <Input
              label="Internal recipient emails"
              onChange={(event) => updateLocal(automation.eventType, { internalRecipientsText: event.target.value })}
              placeholder="ops@bayblaze.net, support@bayblaze.net"
              value={automation.internalRecipientsText}
            />

            <Textarea
              label="Plain text"
              onChange={(event) => updateLocal(automation.eventType, { textTemplate: event.target.value })}
              value={automation.textTemplate}
            />
            <Textarea
              label="HTML"
              onChange={(event) => updateLocal(automation.eventType, { htmlTemplate: event.target.value })}
              value={automation.htmlTemplate}
            />

            <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--bb-charcoal)]">
              Variables: {"{{customerName}}"}, {"{{customerEmail}}"}, {"{{orderNumber}}"}, {"{{orderTotal}}"}, {"{{orderUrl}}"}
            </div>

            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input
                aria-label="Test recipient email"
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="test@example.com"
                type="email"
                value={testEmail}
              />
              <Button
                disabled={!testEmail.trim()}
                loading={testingEvent === automation.eventType}
                onClick={() => void sendTest(automation)}
                variant="secondary"
              >
                <Send size={17} aria-hidden="true" />
                Test
              </Button>
              <Button loading={savingEvent === automation.eventType} onClick={() => void saveAutomation(automation)}>
                <Save size={17} aria-hidden="true" />
                Save
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <div>
          <h3 className="text-lg font-black text-[var(--bb-charcoal)]">Recent Email Events</h3>
          <p className="text-sm font-semibold text-[var(--bb-muted)]">Latest automation sends, skips, and failures.</p>
        </div>
        {logs.length === 0 ? <EmptyState title="No email events yet">Automations will appear here after they run.</EmptyState> : null}
        <div className="grid gap-2">
          {logs.map((log) => (
            <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-3 py-2" key={log.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-[var(--bb-charcoal)]">{log.subject || log.eventType}</p>
                <Badge tone={getLogTone(log.status)}>{log.status || "event"}</Badge>
              </div>
              <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">
                {formatDate(log.createdAt)} · {log.recipientCount} sent · {log.message}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function toEditableAutomation(automation: EmailAutomation): EditableAutomation {
  return {
    ...automation,
    internalRecipientsText: automation.internalRecipientEmails.join(", "),
  };
}

function parseRecipientEmails(value: string) {
  return value
    .split(/[,\n]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getLogTone(status: string) {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  return "neutral";
}

function formatDate(value: string) {
  if (!value) return "No time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
