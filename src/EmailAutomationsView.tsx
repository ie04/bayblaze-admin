import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Mail, Plus, RefreshCw, Save, Send } from "lucide-react";

import {
  createPromotionalEmail,
  loadEmailAutomations,
  loadPromotionalEmails,
  sendDuePromotionalEmails,
  sendEmailAutomationTest,
  sendPromotionalEmailTest,
  startPromotionalEmailSend,
  updateEmailAutomation,
  updatePromotionalEmail,
  type PromotionalEmailInput,
} from "./lib/adminApi";
import type {
  EmailAutomation,
  EmailAutomationLog,
  EmailRecipientMode,
  PromotionalEmailCampaign,
  PromotionalEmailRecipientMode,
} from "./lib/types";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Textarea } from "./components/ui";
import { cx } from "./lib/classes";

type Tab = "campaigns" | "automations";

type EditableAutomation = EmailAutomation & {
  internalRecipientsText: string;
};

type CampaignForm = {
  batchSize: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  fromEmail: string;
  headline: string;
  id: string;
  imageUrl: string;
  internalRecipientsText: string;
  intervalMinutes: string;
  manualRecipientsText: string;
  name: string;
  preheader: string;
  recipientMode: PromotionalEmailRecipientMode;
  replyTo: string;
  scheduleEnabled: boolean;
  startAt: string;
  subject: string;
};

const blankCampaign: CampaignForm = {
  batchSize: "50",
  body: "Tell customers what is new, what is on sale, or why now is a good time to order.",
  ctaLabel: "Shop BayBlaze",
  ctaUrl: "https://www.bayblaze.net/shop",
  fromEmail: "",
  headline: "Fresh BayBlaze deals are here",
  id: "",
  imageUrl: "",
  internalRecipientsText: "",
  intervalMinutes: "60",
  manualRecipientsText: "",
  name: "New promotional email",
  preheader: "A quick BayBlaze update for your next delivery.",
  recipientMode: "customers",
  replyTo: "",
  scheduleEnabled: false,
  startAt: "",
  subject: "A BayBlaze deal for you",
};

export function EmailAutomationsView({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [automations, setAutomations] = useState<EditableAutomation[]>([]);
  const [campaigns, setCampaigns] = useState<PromotionalEmailCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(blankCampaign);
  const [logs, setLogs] = useState<EmailAutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [automationResponse, campaignResponse] = await Promise.all([
        loadEmailAutomations(token),
        loadPromotionalEmails(token),
      ]);
      setAutomations(automationResponse.automations.map(toEditableAutomation));
      setLogs(automationResponse.logs);
      setCampaigns(campaignResponse.campaigns);
      const selected = campaignResponse.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaignResponse.campaigns[0];
      if (selected) {
        setSelectedCampaignId(selected.id);
        setCampaignForm(toCampaignForm(selected));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load email tools.");
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignId, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  function updateCampaign(input: Partial<CampaignForm>) {
    setCampaignForm((current) => ({ ...current, ...input }));
  }

  function updateLocal(eventType: EmailAutomation["eventType"], input: Partial<EditableAutomation>) {
    setAutomations((current) =>
      current.map((automation) => automation.eventType === eventType ? { ...automation, ...input } : automation),
    );
  }

  async function saveCampaign() {
    setBusy("campaign-save");
    setError("");
    setNotice("");
    try {
      const input = toCampaignInput(campaignForm);
      const response = campaignForm.id
        ? await updatePromotionalEmail(token, campaignForm.id, input)
        : await createPromotionalEmail(token, input);
      setCampaigns((current) => reconcileCampaign(current, response.campaign));
      setSelectedCampaignId(response.campaign.id);
      setCampaignForm(toCampaignForm(response.campaign));
      setNotice(`${response.campaign.name} saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save promotional email.");
    } finally {
      setBusy("");
    }
  }

  async function sendCampaignTest() {
    if (!campaignForm.id) {
      setError("Save the promotional email before sending a test.");
      return;
    }
    setBusy("campaign-test");
    setError("");
    setNotice("");
    try {
      await sendPromotionalEmailTest(token, campaignForm.id, { recipientEmail: testEmail });
      setNotice(`Test email sent to ${testEmail}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send test email.");
    } finally {
      setBusy("");
    }
  }

  async function sendCampaign(scheduled: boolean) {
    if (!campaignForm.id) {
      setError("Save the promotional email before sending.");
      return;
    }
    setBusy(scheduled ? "campaign-schedule" : "campaign-send");
    setError("");
    setNotice("");
    try {
      const response = await startPromotionalEmailSend(token, campaignForm.id, { scheduled });
      setCampaigns((current) => reconcileCampaign(current, response.campaign));
      setNotice(
        scheduled
          ? `Scheduled ${response.queuedRecipients} recipients across ${response.queuedBatches} batches.`
          : `Queued ${response.queuedRecipients} recipients and sent ${response.sent}.`,
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start promotional send.");
    } finally {
      setBusy("");
    }
  }

  async function processDue() {
    setBusy("campaign-due");
    setError("");
    setNotice("");
    try {
      const response = await sendDuePromotionalEmails(token, { limit: 10 });
      setNotice(`Processed ${response.processedBatches} due batches and sent ${response.sent}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send due promotional emails.");
    } finally {
      setBusy("");
    }
  }

  async function saveAutomation(automation: EditableAutomation) {
    setBusy(`automation-save-${automation.eventType}`);
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
      setBusy("");
    }
  }

  async function sendAutomationTest(automation: EditableAutomation) {
    setBusy(`automation-test-${automation.eventType}`);
    setError("");
    setNotice("");
    try {
      await sendEmailAutomationTest(token, automation.eventType, { recipientEmail: testEmail });
      setNotice(`Test email sent to ${testEmail}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send test email.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setSelectedCampaignId(""); setCampaignForm(blankCampaign); }} variant="secondary">
              <Plus size={17} aria-hidden="true" />
              New campaign
            </Button>
            <Button loading={busy === "campaign-due"} onClick={() => void processDue()} variant="secondary">
              <CalendarClock size={17} aria-hidden="true" />
              Send due
            </Button>
            <Button loading={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw size={17} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
        icon={<Mail size={22} aria-hidden="true" />}
        title="Email"
        subtitle="Create promotional campaigns, preview customer emails, schedule drip sends, and manage transactional email automations."
      />

      <div className="flex gap-2 overflow-x-auto">
        <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")}>Promotional emails</TabButton>
        <TabButton active={tab === "automations"} onClick={() => setTab("automations")}>Automations</TabButton>
      </div>

      {error ? <ErrorState>{error}</ErrorState> : null}
      {notice ? (
        <div className="rounded-2xl border border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] px-4 py-3 text-sm font-black text-[var(--bb-success-strong)]">
          {notice}
        </div>
      ) : null}
      {loading ? <LoadingState label="Loading email tools..." /> : null}

      {!loading && tab === "campaigns" ? (
        <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="space-y-3">
            <div>
              <h3 className="text-lg font-black text-[var(--bb-charcoal)]">Saved Campaigns</h3>
              <p className="text-sm font-semibold text-[var(--bb-muted)]">Draft, scheduled, and sent promotional emails.</p>
            </div>
            {campaigns.length === 0 ? <EmptyState title="No campaigns yet">Create the first promotional email.</EmptyState> : null}
            <div className="grid gap-2">
              {campaigns.map((campaign) => (
                <button
                  className={cx(
                    "rounded-2xl border px-3 py-3 text-left transition",
                    campaign.id === selectedCampaignId
                      ? "border-[var(--bb-blaze)] bg-[var(--bb-blaze-soft)]"
                      : "border-[var(--bb-line)] bg-[var(--bb-surface-warm)] hover:border-[var(--bb-blaze)]",
                  )}
                  key={campaign.id}
                  onClick={() => {
                    setSelectedCampaignId(campaign.id);
                    setCampaignForm(toCampaignForm(campaign));
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-black text-[var(--bb-charcoal)]">{campaign.name}</span>
                    <Badge tone={getCampaignTone(campaign.status)}>{campaign.status}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--bb-muted)]">{campaign.subject}</p>
                  <p className="mt-2 text-xs font-black uppercase text-[var(--bb-muted)]">
                    {campaign.sentCount} sent · {campaign.queuedRecipientCount} queued
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(23rem,0.85fr)]">
            <CampaignEditor
              busy={busy}
              form={campaignForm}
              onChange={updateCampaign}
              onSave={() => void saveCampaign()}
              onSend={() => void sendCampaign(false)}
              onSchedule={() => void sendCampaign(true)}
              onSendTest={() => void sendCampaignTest()}
              setTestEmail={setTestEmail}
              testEmail={testEmail}
            />
            <EmailPreview html={renderCampaignPreview(campaignForm)} subject={campaignForm.subject} />
          </div>
        </div>
      ) : null}

      {!loading && tab === "automations" ? (
        <div className="grid gap-4">
          {automations.map((automation) => (
            <AutomationCard
              automation={automation}
              busy={busy}
              key={automation.eventType}
              onChange={(input) => updateLocal(automation.eventType, input)}
              onSave={() => void saveAutomation(automation)}
              onSendTest={() => void sendAutomationTest(automation)}
              setTestEmail={setTestEmail}
              testEmail={testEmail}
            />
          ))}
          <EmailLogs logs={logs} />
        </div>
      ) : null}
    </div>
  );
}

function CampaignEditor({
  busy,
  form,
  onChange,
  onSave,
  onSchedule,
  onSend,
  onSendTest,
  setTestEmail,
  testEmail,
}: {
  busy: string;
  form: CampaignForm;
  onChange: (input: Partial<CampaignForm>) => void;
  onSave: () => void;
  onSchedule: () => void;
  onSend: () => void;
  onSendTest: () => void;
  setTestEmail: (value: string) => void;
  testEmail: string;
}) {
  return (
    <Card className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <Input label="Campaign name" onChange={(event) => onChange({ name: event.target.value })} value={form.name} />
        <Input label="Subject" onChange={(event) => onChange({ subject: event.target.value })} value={form.subject} />
        <Input label="Headline" onChange={(event) => onChange({ headline: event.target.value })} value={form.headline} />
        <Input label="Preheader" onChange={(event) => onChange({ preheader: event.target.value })} value={form.preheader} />
      </div>
      <Textarea label="Message" onChange={(event) => onChange({ body: event.target.value })} rows={8} value={form.body} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Input label="Button text" onChange={(event) => onChange({ ctaLabel: event.target.value })} value={form.ctaLabel} />
        <Input label="Button URL" onChange={(event) => onChange({ ctaUrl: event.target.value })} value={form.ctaUrl} />
        <Input label="Image URL" onChange={(event) => onChange({ imageUrl: event.target.value })} value={form.imageUrl} />
        <label className="grid gap-2 text-xs font-black uppercase text-[var(--bb-muted)]">
          Recipients
          <select
            className="min-h-12 rounded-2xl border border-[var(--bb-line)] bg-white px-4 text-base font-bold normal-case text-[var(--bb-charcoal)] outline-none focus:border-[var(--bb-blaze)]"
            onChange={(event) => onChange({ recipientMode: event.target.value as PromotionalEmailRecipientMode })}
            value={form.recipientMode}
          >
            <option value="customers">All customer accounts</option>
            <option value="manual">Manual list</option>
            <option value="internal">Internal team</option>
            <option value="combined">Customers, manual, and internal</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Textarea label="Manual recipient emails" onChange={(event) => onChange({ manualRecipientsText: event.target.value })} rows={4} value={form.manualRecipientsText} />
        <Textarea label="Internal recipient emails" onChange={(event) => onChange({ internalRecipientsText: event.target.value })} rows={4} value={form.internalRecipientsText} />
        <Input label="From email" onChange={(event) => onChange({ fromEmail: event.target.value })} placeholder="Defaults to API sender" value={form.fromEmail} />
        <Input label="Reply-to" onChange={(event) => onChange({ replyTo: event.target.value })} value={form.replyTo} />
      </div>
      <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4">
        <label className="mb-3 flex min-h-11 items-center gap-2 text-sm font-black text-[var(--bb-charcoal)]">
          <input checked={form.scheduleEnabled} className="size-4 accent-[var(--bb-blaze)]" onChange={(event) => onChange({ scheduleEnabled: event.target.checked })} type="checkbox" />
          Schedule as drip batches
        </label>
        <div className="grid gap-3 lg:grid-cols-3">
          <Input disabled={!form.scheduleEnabled} label="Batch size" min="1" max="100" onChange={(event) => onChange({ batchSize: event.target.value })} type="number" value={form.batchSize} />
          <Input disabled={!form.scheduleEnabled} label="Minutes between batches" min="1" onChange={(event) => onChange({ intervalMinutes: event.target.value })} type="number" value={form.intervalMinutes} />
          <Input disabled={!form.scheduleEnabled} label="Start at" onChange={(event) => onChange({ startAt: event.target.value })} type="datetime-local" value={form.startAt} />
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
        <Input aria-label="Test recipient email" onChange={(event) => setTestEmail(event.target.value)} placeholder="test@example.com" type="email" value={testEmail} />
        <Button loading={busy === "campaign-test"} onClick={onSendTest} variant="secondary" disabled={!testEmail.trim()}>
          <Send size={17} aria-hidden="true" />
          Test
        </Button>
        <Button loading={busy === "campaign-save"} onClick={onSave}>
          <Save size={17} aria-hidden="true" />
          Save
        </Button>
        <Button loading={busy === "campaign-send"} onClick={onSend} variant="secondary">
          <Send size={17} aria-hidden="true" />
          Send now
        </Button>
        <Button loading={busy === "campaign-schedule"} onClick={onSchedule} variant="secondary">
          <CalendarClock size={17} aria-hidden="true" />
          Schedule
        </Button>
      </div>
    </Card>
  );
}

function AutomationCard({
  automation,
  busy,
  onChange,
  onSave,
  onSendTest,
  setTestEmail,
  testEmail,
}: {
  automation: EditableAutomation;
  busy: string;
  onChange: (input: Partial<EditableAutomation>) => void;
  onSave: () => void;
  onSendTest: () => void;
  setTestEmail: (value: string) => void;
  testEmail: string;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-[var(--bb-charcoal)]">{automation.label}</h3>
            <Badge tone={automation.enabled ? "success" : "neutral"}>{automation.enabled ? "ON" : "OFF"}</Badge>
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-muted)]">{automation.description}</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-3 text-sm font-black text-[var(--bb-charcoal)]">
          <input checked={automation.enabled} className="size-4 accent-[var(--bb-blaze)]" onChange={(event) => onChange({ enabled: event.target.checked })} type="checkbox" />
          Enabled
        </label>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(23rem,0.8fr)]">
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input label="Subject" onChange={(event) => onChange({ subjectTemplate: event.target.value })} value={automation.subjectTemplate} />
            <label className="grid gap-2 text-xs font-black uppercase text-[var(--bb-muted)]">
              Recipients
              <select className="min-h-12 rounded-2xl border border-[var(--bb-line)] bg-white px-4 text-base font-bold normal-case text-[var(--bb-charcoal)] outline-none focus:border-[var(--bb-blaze)]" onChange={(event) => onChange({ recipientMode: event.target.value as EmailRecipientMode })} value={automation.recipientMode}>
                <option value="customer">Customer</option>
                <option value="internal">Internal team</option>
                <option value="both">Customer and internal team</option>
              </select>
            </label>
            <Input label="From email" onChange={(event) => onChange({ fromEmail: event.target.value })} placeholder="Defaults to API sender" value={automation.fromEmail} />
            <Input label="Reply-to" onChange={(event) => onChange({ replyTo: event.target.value })} value={automation.replyTo} />
          </div>
          <Input label="Internal recipient emails" onChange={(event) => onChange({ internalRecipientsText: event.target.value })} placeholder="ops@bayblaze.net, support@bayblaze.net" value={automation.internalRecipientsText} />
          <Textarea label="Plain text fallback" onChange={(event) => onChange({ textTemplate: event.target.value })} value={automation.textTemplate} />
          <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--bb-charcoal)]">
            Preview uses sample order data. Supported variables: {"{{customerName}}"}, {"{{customerEmail}}"}, {"{{orderNumber}}"}, {"{{orderTotal}}"}, {"{{orderUrl}}"}.
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input aria-label="Test recipient email" onChange={(event) => setTestEmail(event.target.value)} placeholder="test@example.com" type="email" value={testEmail} />
            <Button disabled={!testEmail.trim()} loading={busy === `automation-test-${automation.eventType}`} onClick={onSendTest} variant="secondary">
              <Send size={17} aria-hidden="true" />
              Test
            </Button>
            <Button loading={busy === `automation-save-${automation.eventType}`} onClick={onSave}>
              <Save size={17} aria-hidden="true" />
              Save
            </Button>
          </div>
        </div>
        <EmailPreview html={renderAutomationPreview(automation)} subject={automation.subjectTemplate} />
      </div>
    </Card>
  );
}

function EmailPreview({ html, subject }: { html: string; subject: string }) {
  return (
    <Card className="space-y-3">
      <div>
        <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Preview</p>
        <h3 className="text-lg font-black text-[var(--bb-charcoal)]">{subject || "Untitled email"}</h3>
      </div>
      <iframe
        className="h-[620px] w-full rounded-2xl border border-[var(--bb-line)] bg-white"
        sandbox=""
        srcDoc={html}
        title="Email preview"
      />
    </Card>
  );
}

function EmailLogs({ logs }: { logs: EmailAutomationLog[] }) {
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-lg font-black text-[var(--bb-charcoal)]">Recent Email Events</h3>
        <p className="text-sm font-semibold text-[var(--bb-muted)]">Latest automation and promotional sends, skips, and failures.</p>
      </div>
      {logs.length === 0 ? <EmptyState title="No email events yet">Email sends will appear here after they run.</EmptyState> : null}
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
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      className={cx(
        "min-h-11 rounded-2xl border px-4 text-sm font-black transition",
        active
          ? "border-[var(--bb-blaze)] bg-[var(--bb-blaze-soft)] text-[var(--bb-charcoal)]"
          : "border-[var(--bb-line)] bg-white text-[var(--bb-muted)] hover:border-[var(--bb-blaze)]",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function toEditableAutomation(automation: EmailAutomation): EditableAutomation {
  return {
    ...automation,
    internalRecipientsText: automation.internalRecipientEmails.join(", "),
  };
}

function toCampaignForm(campaign: PromotionalEmailCampaign): CampaignForm {
  return {
    batchSize: String(campaign.schedule.batchSize || 50),
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    fromEmail: campaign.fromEmail,
    headline: campaign.headline,
    id: campaign.id,
    imageUrl: campaign.imageUrl,
    internalRecipientsText: campaign.internalRecipientEmails.join(", "),
    intervalMinutes: String(campaign.schedule.intervalMinutes || 60),
    manualRecipientsText: campaign.manualRecipientEmails.join(", "),
    name: campaign.name,
    preheader: campaign.preheader,
    recipientMode: campaign.recipientMode,
    replyTo: campaign.replyTo,
    scheduleEnabled: campaign.schedule.enabled,
    startAt: toDateTimeLocal(campaign.schedule.startAt),
    subject: campaign.subject,
  };
}

function toCampaignInput(form: CampaignForm): PromotionalEmailInput {
  return {
    body: form.body,
    ctaLabel: form.ctaLabel,
    ctaUrl: form.ctaUrl,
    fromEmail: form.fromEmail,
    headline: form.headline,
    imageUrl: form.imageUrl,
    internalRecipientEmails: parseRecipientEmails(form.internalRecipientsText),
    manualRecipientEmails: parseRecipientEmails(form.manualRecipientsText),
    name: form.name,
    preheader: form.preheader,
    recipientMode: form.recipientMode,
    replyTo: form.replyTo,
    schedule: {
      batchSize: readInteger(form.batchSize, 50),
      enabled: form.scheduleEnabled,
      intervalMinutes: readInteger(form.intervalMinutes, 60),
      startAt: form.startAt ? new Date(form.startAt).toISOString() : "",
    },
    subject: form.subject,
  };
}

function reconcileCampaign(campaigns: PromotionalEmailCampaign[], campaign: PromotionalEmailCampaign) {
  const without = campaigns.filter((item) => item.id !== campaign.id);
  return [campaign, ...without].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function renderCampaignPreview(form: CampaignForm) {
  const paragraphs = form.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#11130f;font-size:16px;line-height:1.65">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const image = form.imageUrl.trim()
    ? `<img src="${escapeHtml(form.imageUrl.trim())}" alt="" style="display:block;width:100%;max-height:260px;object-fit:cover">`
    : "";
  const cta = form.ctaLabel.trim() && form.ctaUrl.trim()
    ? `<a href="${escapeHtml(form.ctaUrl.trim())}" style="display:inline-block;background:#c94d12;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:13px 18px;border-radius:999px">${escapeHtml(form.ctaLabel.trim())}</a>`
    : "";

  return [
    "<div style=\"margin:0;padding:28px 18px;background:#f6f8f5;color:#000000;font-family:Jost,Avenir,Montserrat,Arial,sans-serif;line-height:1.6\">",
    `<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(form.preheader)}</span>`,
    "<div style=\"max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #d8ded2;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px rgba(17,19,15,0.12)\">",
    image,
    "<div style=\"padding:26px 26px 30px\">",
    "<p style=\"margin:0 0 10px;color:#2c541d;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase\">BayBlaze</p>",
    `<h1 style="margin:0 0 16px;color:#000000;font-size:30px;line-height:1.08;font-weight:800">${escapeHtml(form.headline || form.subject)}</h1>`,
    paragraphs,
    cta ? `<div style="margin-top:22px">${cta}</div>` : "",
    "<p style=\"margin:26px 0 0;color:#6d716b;font-size:12px;line-height:1.5\">You are receiving this because you have a BayBlaze account or were added by the BayBlaze team.</p>",
    "</div>",
    "</div>",
    "</div>",
  ].join("");
}

function renderAutomationPreview(automation: EditableAutomation) {
  return renderTemplate(automation.htmlTemplate, {
    customerEmail: "customer@example.com",
    customerName: "BayBlaze Customer",
    orderNumber: "BB-1001",
    orderTotal: "$42.00",
    orderUrl: "https://www.bayblaze.net/orders/BB-1001",
  });
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "");
}

function parseRecipientEmails(value: string) {
  return value
    .split(/[,\n]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getCampaignTone(status: string) {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  if (status === "scheduled" || status === "queued") return "info";
  return "neutral";
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

function toDateTimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function readInteger(value: string, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
