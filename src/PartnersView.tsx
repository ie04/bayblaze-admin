import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, Handshake, Plus, RefreshCw, Search, UserPlus, X } from "lucide-react";

import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader } from "./components/ui";
import { PromoCreationWizard } from "./PromoCreationWizard";
import {
  approveReferralPartner,
  loadReferralPartners,
  searchAccounts,
  updateReferralPartnerStatus,
  type PromoCodeInput,
  type ReferralPartnerApprovalInput,
} from "./lib/adminApi";
import type { Account, AdminPromoCode, ReferralPartner, ReferralPartnerStatus } from "./lib/types";

type PartnerFilter = "all" | ReferralPartnerStatus;

const filters: Array<{ label: string; value: PartnerFilter }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
];

export function PartnersView({ token }: { token: string }) {
  const [partners, setPartners] = useState<ReferralPartner[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<PartnerFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initialOwnerUid, setInitialOwnerUid] = useState("");
  const newPartnerButtonRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [partnerResult, accountResult] = await Promise.all([
        loadReferralPartners(token),
        searchAccounts(token, ""),
      ]);
      setPartners(partnerResult.partners);
      setAccounts(accountResult.accounts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load referral accounts.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const visiblePartners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return partners.filter((partner) => {
      if (filter !== "all" && partner.status !== filter) return false;
      if (!normalizedQuery) return true;
      return [partner.displayName, partner.email, partner.referralCode]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [filter, partners, query]);

  const wizardAccounts = useMemo(() => {
    const configuredUids = new Set(
      partners
        .filter((partner) => Boolean(partner.referralCode))
        .map((partner) => partner.uid),
    );
    return accounts.filter((account) => !configuredUids.has(account.uid) || account.uid === initialOwnerUid);
  }, [accounts, initialOwnerUid, partners]);

  function openNewPartnerWizard() {
    setError("");
    setMessage("");
    setInitialOwnerUid("");
    setWizardOpen(true);
  }

  async function openApplication(partner: ReferralPartner) {
    setError("");
    setMessage("");
    setBusyUid(partner.uid);

    try {
      let owner = accounts.find((account) => account.uid === partner.uid);

      if (!owner) {
        const result = await searchAccounts(token, partner.email);
        owner = result.accounts.find((account) => account.uid === partner.uid);
        if (owner) {
          setAccounts((current) => [...current.filter((account) => account.uid !== owner?.uid), owner!]);
        }
      }

      if (!owner) {
        throw new Error("The applicant's unified BayBlaze account could not be found.");
      }

      setInitialOwnerUid(partner.uid);
      setWizardOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this application.");
    } finally {
      setBusyUid("");
    }
  }

  function closeWizard() {
    setWizardOpen(false);
    setInitialOwnerUid("");
    window.requestAnimationFrame(() => newPartnerButtonRef.current?.focus());
  }

  async function searchEligibleAccounts(query: string) {
    const result = await searchAccounts(token, query);
    const configuredUids = new Set(
      partners
        .filter((partner) => Boolean(partner.referralCode))
        .map((partner) => partner.uid),
    );
    const eligible = result.accounts.filter(
      (account) => !configuredUids.has(account.uid) || account.uid === initialOwnerUid,
    );
    setAccounts((current) => mergeAccounts(current, eligible));
    return eligible;
  }

  async function createReferralAccount(input: PromoCodeInput): Promise<AdminPromoCode> {
    if (!input.ownerUid) {
      throw new Error("Select the BayBlaze account that will own this referral account.");
    }

    const owner = accounts.find((account) => account.uid === input.ownerUid);
    const response = await approveReferralPartner(token, input.ownerUid, toApprovalInput(input));
    setPartners((current) => upsertPartner(current, response.partner));
    setMessage(`${owner?.displayName || owner?.email || "Referral account"} is active with code ${response.partner.referralCode}.`);
    closeWizard();
    return response.promoCode;
  }

  async function changeStatus(partner: ReferralPartner, status: ReferralPartnerStatus) {
    const confirmationCopy = status === "suspended"
      ? `Suspend ${partner.displayName || partner.email}? Their referral link and promo will stop accepting new attribution.`
      : status === "rejected"
        ? `Reject ${partner.displayName || partner.email}'s referral application?`
        : "";

    if (confirmationCopy && !window.confirm(confirmationCopy)) return;

    setError("");
    setMessage("");
    setBusyUid(partner.uid);
    try {
      const response = await updateReferralPartnerStatus(token, partner.uid, status);
      setPartners((current) => upsertPartner(current, response.partner));
      setMessage(`${partner.displayName || partner.email} is now ${status}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this referral account.");
    } finally {
      setBusyUid("");
    }
  }

  const counts = countStatuses(partners);

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button disabled={loading} onClick={openNewPartnerWizard} ref={newPartnerButtonRef}>
            <Plus size={17} aria-hidden="true" />
            New referral account
          </Button>
        }
        icon={<Handshake size={22} aria-hidden="true" />}
        title="Referral Partners"
        subtitle="Review applications, create partner accounts from unified customer accounts, and control referral access."
      />

      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? (
        <div aria-live="polite" className="rounded-2xl border border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] p-4 text-sm font-black text-[var(--bb-success-strong)]">
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatusMetric label="Pending" value={counts.pending} />
        <StatusMetric label="Active" value={counts.active} />
        <StatusMetric label="Suspended" value={counts.suspended} />
        <StatusMetric label="Rejected" value={counts.rejected} />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            aria-label="Search referral accounts"
            className="w-full sm:max-w-sm"
            icon={<Search size={18} aria-hidden="true" />}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or code"
            value={query}
          />
          <Button aria-label="Refresh referral accounts" onClick={() => void refresh()} size="icon" variant="secondary">
            <RefreshCw size={18} aria-hidden="true" />
          </Button>
        </div>
        <div aria-label="Filter referral accounts by status" className="flex gap-2 overflow-x-auto pb-1" role="group">
          {filters.map((item) => (
            <Button
              key={item.value}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              size="sm"
              variant={filter === item.value ? "primary" : "secondary"}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Card>

      {loading ? <LoadingState label="Loading referral accounts" /> : null}
      {!loading && visiblePartners.length === 0 ? (
        <EmptyState title={partners.length === 0 ? "No referral accounts yet" : "No matching referral accounts"}>
          {partners.length === 0
            ? "Create one from an existing BayBlaze customer account or wait for a partner application."
            : "Try another search or status filter."}
        </EmptyState>
      ) : null}

      {!loading ? (
        <div className="grid gap-3">
          {visiblePartners.map((partner) => (
            <PartnerCard
              busy={busyUid === partner.uid}
              key={partner.uid}
              onApprove={() => void openApplication(partner)}
              onStatusChange={(status) => void changeStatus(partner, status)}
              partner={partner}
            />
          ))}
        </div>
      ) : null}

      {wizardOpen ? (
        <PromoCreationWizard
          accounts={wizardAccounts}
          initialOwnerUid={initialOwnerUid}
          mode="referral-account"
          onClose={closeWizard}
          onCreate={createReferralAccount}
          onSearchAccounts={searchEligibleAccounts}
        />
      ) : null}
    </div>
  );
}

function PartnerCard({
  busy,
  onApprove,
  onStatusChange,
  partner,
}: {
  busy: boolean;
  onApprove: () => void;
  onStatusChange: (status: ReferralPartnerStatus) => void;
  partner: ReferralPartner;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black text-[var(--bb-charcoal)]">{partner.displayName || partner.email}</h3>
          <p className="truncate text-sm font-semibold text-[var(--bb-muted)]">{partner.email}</p>
        </div>
        <Badge tone={statusTone(partner.status)}>{partner.status}</Badge>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        <PartnerDetail label="Referral code" value={partner.referralCode || "Not assigned"} />
        <PartnerDetail label="Applied" value={formatDate(partner.createdAt)} />
        <PartnerDetail
          label={partner.status === "active" ? "Approved" : "Last updated"}
          value={formatDate(partner.status === "active" ? partner.approvedAt : partner.updatedAt)}
        />
      </dl>

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--bb-line)] pt-3">
        {partner.status === "pending" ? (
          <>
            <Button disabled={busy} onClick={() => onStatusChange("rejected")} size="sm" variant="danger">
              <X size={15} aria-hidden="true" /> Reject
            </Button>
            <Button loading={busy} onClick={onApprove} size="sm">
              <Check size={15} aria-hidden="true" /> Approve & configure
            </Button>
          </>
        ) : null}
        {partner.status === "rejected" ? (
          <Button loading={busy} onClick={onApprove} size="sm">
            <UserPlus size={15} aria-hidden="true" /> Create referral account
          </Button>
        ) : null}
        {partner.status === "active" ? (
          <Button loading={busy} onClick={() => onStatusChange("suspended")} size="sm" variant="danger">
            <Ban size={15} aria-hidden="true" /> Suspend
          </Button>
        ) : null}
        {partner.status === "suspended" ? (
          <Button loading={busy} onClick={() => onStatusChange("active")} size="sm">
            <Check size={15} aria-hidden="true" /> Reactivate
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function PartnerDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-3 py-2">
      <dt className="text-[11px] font-black uppercase text-[var(--bb-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-black text-[var(--bb-charcoal)]">{value}</dd>
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-[var(--bb-line)] bg-white p-3 shadow-[var(--bb-shadow-soft)]">
      <p className="text-xs font-black uppercase text-[var(--bb-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[var(--bb-charcoal)]">{value}</p>
    </div>
  );
}

function toApprovalInput(input: PromoCodeInput): ReferralPartnerApprovalInput {
  return {
    code: input.code,
    commissionPercent: input.commissionPercent ?? 0,
    discountPercent: input.discountPercent ?? 0,
    minimumSpendCents: input.minimumSpendCents,
    singleUsePerAccount: input.singleUsePerAccount,
  };
}

function upsertPartner(partners: ReferralPartner[], next: ReferralPartner) {
  return [next, ...partners.filter((partner) => partner.uid !== next.uid)]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function mergeAccounts(...groups: Account[][]) {
  const accountsByUid = new Map<string, Account>();
  groups.flat().forEach((account) => accountsByUid.set(account.uid, account));
  return Array.from(accountsByUid.values());
}

function countStatuses(partners: ReferralPartner[]) {
  return {
    active: partners.filter((partner) => partner.status === "active").length,
    pending: partners.filter((partner) => partner.status === "pending").length,
    rejected: partners.filter((partner) => partner.status === "rejected").length,
    suspended: partners.filter((partner) => partner.status === "suspended").length,
  };
}

function statusTone(status: ReferralPartnerStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}
