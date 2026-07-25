import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, Plus, Printer, QrCode, RefreshCw, Save, Trash2 } from "lucide-react";
import QRCode from "qrcode";

import { PromoCreationWizard } from "./PromoCreationWizard";
import { createPromoCodeSuffix, normalizeMoneyInput, normalizePromoCode } from "./promoCreationModel";
import {
  createPromoCode,
  deletePromoCode,
  loadPromoCodes,
  searchAccounts,
  updatePromoCode,
} from "./lib/adminApi";
import type { Account, AdminPromoCode, AdminPromoCodeCategory, AdminPromoCodeType, ReferralPromoUse } from "./lib/types";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader } from "./components/ui";

type CopyState = "idle" | "copied" | "failed";

type PromoCard = {
  category: AdminPromoCodeCategory;
  code: string;
  codeType: AdminPromoCodeType;
  commissionPercent: string;
  discountPercent: string;
  id: string;
  minimumSpend: string;
  minimumSpendEnabled: boolean;
  originalCode?: string;
  originalCodeType?: AdminPromoCodeType;
  originalCommissionPercent?: string;
  originalDiscountPercent?: string;
  originalMinimumSpendCents?: number;
  originalOwnerUid?: string;
  originalSingleUsePerAccount?: boolean;
  persisted: boolean;
  ownerDisplayName?: string;
  ownerEmail?: string;
  ownerUid: string;
  referrals?: ReferralPromoUse[];
  singleUsePerAccount: boolean;
  usageLimit?: number;
  usedCount?: number;
  totalCommissionCents?: number;
  totalDiscountCents?: number;
  totalReferredSpendCents?: number;
  totalReferredSubtotalCents?: number;
  uniqueReferredCustomers?: number;
};

const defaultStorefrontOrigin = "https://bayblaze.net";
const defaultPromoCode = "FIRST30";
const hiddenStorageKey = "bayblaze_admin_hidden_promo_codes";
const qrCanvasSize = 1200;
const qrLogoMaxSize = 330;
const qrLogoHorizontalPadding = 12;
const qrLogoPath = "/icons/bayblaze-flame-qr.png";

export function PromoToolsView({ token }: { token: string }) {
  const [promos, setPromos] = useState<PromoCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creationMessage, setCreationMessage] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(() => loadHiddenCodes());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const newPromoButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadPromoCodes(token), searchAccounts(token, "")])
      .then(([response, accountResponse]) => {
        if (cancelled) return;
        setError("");
        setPromos(response.promoCodes.map(toPromoCard));
        setAccounts(accountResponse.accounts);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load promo codes.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    window.localStorage.setItem(hiddenStorageKey, JSON.stringify(Array.from(hiddenCodes)));
  }, [hiddenCodes]);

  function updateLocalPromo(id: string, input: Partial<PromoCard>) {
    setPromos((current) => current.map((promo) => (promo.id === id ? { ...promo, ...input } : promo)));
  }

  function removeLocalPromo(id: string) {
    setPromos((current) => current.filter((promo) => promo.id !== id));
  }

  function toggleHidden(code: string) {
    setHiddenCodes((current) => {
      const next = new Set(current);
      const normalizedCode = normalizePromoCode(code);

      if (next.has(normalizedCode)) {
        next.delete(normalizedCode);
      } else {
        next.add(normalizedCode);
      }

      return next;
    });
  }

  function reconcileSavedPromo(id: string, promoCode: AdminPromoCode) {
    setPromos((current) => current.map((promo) => (promo.id === id ? toPromoCard(promoCode) : promo)));
    setHiddenCodes((current) => removeHiddenCode(current, promoCode.code));
  }

  function closeCreationWizard() {
    setWizardOpen(false);
    window.requestAnimationFrame(() => newPromoButtonRef.current?.focus());
  }

  async function createPromotion(input: Parameters<typeof createPromoCode>[1]) {
    const response = await createPromoCode(token, input);
    const promoCard = toPromoCard(response.promoCode);

    setPromos((current) => [promoCard, ...current.filter((promo) => promo.originalCode !== response.promoCode.code)]);
    setHiddenCodes((current) => removeHiddenCode(current, response.promoCode.code));
    setCreationMessage(`${response.promoCode.code} was created successfully.`);
    closeCreationWizard();

    return response.promoCode;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button disabled={loading} onClick={() => { setCreationMessage(""); setWizardOpen(true); }} ref={newPromoButtonRef}>
            <Plus size={17} aria-hidden="true" />
            New promo
          </Button>
        }
        icon={<QrCode size={22} aria-hidden="true" />}
        title="Promo QR"
        subtitle="Create and organize checkout-valid promo links and QR assets."
      />

      {error ? <ErrorState>{error}</ErrorState> : null}
      {creationMessage ? (
        <div aria-live="polite" className="rounded-2xl border border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] p-4 text-sm font-black text-[var(--bb-success-strong)]">
          {creationMessage}
        </div>
      ) : null}
      {loading ? <LoadingState label="Loading promo codes..." /> : null}
      {!loading && promos.length === 0 ? <EmptyState title="No promo codes yet">Create a promo to generate its QR card.</EmptyState> : null}

      <div className="grid gap-3">
        {promos.map((promo) => {
          const normalizedCode = normalizePromoCode(promo.code) || defaultPromoCode;
          const hidden = hiddenCodes.has(normalizedCode);

          return (
            <PromoCodeCard
              key={promo.id}
              hidden={hidden}
              onDeleteLocal={() => removeLocalPromo(promo.id)}
              onReconcile={reconcileSavedPromo}
              onToggleHidden={() => toggleHidden(normalizedCode)}
              onUpdate={(input) => updateLocalPromo(promo.id, input)}
              promo={promo}
              accounts={accounts}
              token={token}
            />
          );
        })}
      </div>
      {wizardOpen ? <PromoCreationWizard accounts={accounts} onClose={closeCreationWizard} onCreate={createPromotion} /> : null}
    </div>
  );
}

function PromoCodeCard({
  accounts,
  hidden,
  onDeleteLocal,
  onReconcile,
  onToggleHidden,
  onUpdate,
  promo,
  token,
}: {
  accounts: Account[];
  hidden: boolean;
  onDeleteLocal: () => void;
  onReconcile: (id: string, promoCode: AdminPromoCode) => void;
  onToggleHidden: () => void;
  onUpdate: (input: Partial<PromoCard>) => void;
  promo: PromoCard;
  token: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [renderError, setRenderError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const normalizedCode = normalizePromoCode(promo.code) || defaultPromoCode;
  const discountPercent = normalizeDiscountPercent(promo.discountPercent);
  const commissionPercent = normalizeDiscountPercent(promo.commissionPercent);
  const minimumSpendCents = promo.minimumSpendEnabled ? normalizeMoneyCents(promo.minimumSpend) : 0;
  const promoUrl = useMemo(() => buildPromoUrl(normalizedCode), [normalizedCode]);
  const isAdminManaged = promo.category === "admin_promo";
  const isReferralPartner = promo.category === "referral_partner";
  const canEdit = !promo.persisted || isAdminManaged || isReferralPartner;
  const hasTrackedReferralPurchases = isReferralPartner && (promo.usedCount ?? 0) > 0;
  const canChangeCode = canEdit && !hasTrackedReferralPurchases;
  const canDelete = canEdit && !hasTrackedReferralPurchases;
  const ownerInAccounts = accounts.some((account) => account.uid === promo.ownerUid);
  const dirty = canEdit && (
    !promo.persisted ||
    normalizedCode !== promo.originalCode ||
    promo.codeType !== (promo.originalCodeType ?? "discount") ||
    (promo.codeType === "discount" && String(discountPercent) !== (promo.originalDiscountPercent ?? promo.discountPercent.trim())) ||
    (isReferralPartner && String(commissionPercent) !== (promo.originalCommissionPercent ?? promo.commissionPercent.trim())) ||
    minimumSpendCents !== (promo.originalMinimumSpendCents ?? 0) ||
    (isReferralPartner && promo.ownerUid !== (promo.originalOwnerUid ?? "")) ||
    promo.singleUsePerAccount !== (promo.originalSingleUsePerAccount ?? false)
  );
  const promoTitle = getPromoTitle({ codeType: promo.codeType, discountPercent });
  const sourceLabel = getPromoSourceLabel(promo.category);
  const promoSummary = `${sourceLabel} · ${promoTitle}${isReferralPartner ? ` · ${commissionPercent}% commission` : ""}${minimumSpendCents > 0 ? ` over ${formatCents(minimumSpendCents)}` : ""}${promo.persisted ? "" : " draft"}`;

  useEffect(() => {
    if (hidden) {
      return;
    }

    renderPromoQr(canvasRef.current, promoUrl)
      .then(() => setRenderError(""))
      .catch((caught) => {
        setRenderError(caught instanceof Error ? caught.message : "Could not render the QR code.");
      });
  }, [hidden, promoUrl]);

  async function savePromo() {
    if (!canEdit) {
      return;
    }

    try {
      setSaving(true);
      setActionError("");
      const input = getPromoSaveInput({
        category: promo.category,
        code: normalizedCode,
        codeType: promo.codeType,
        commissionPercent,
        discountPercent,
        minimumSpendCents,
        ownerUid: promo.ownerUid,
        singleUsePerAccount: promo.singleUsePerAccount,
      });
      const response = promo.persisted && promo.originalCode
        ? await updatePromoCode(token, promo.originalCode, input)
        : await createPromoCode(token, input);

      onReconcile(promo.id, response.promoCode);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save that promo code.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePromo() {
    if (!canEdit) {
      return;
    }

    if (!promo.persisted || !promo.originalCode) {
      onDeleteLocal();
      return;
    }

    try {
      setDeleting(true);
      setActionError("");
      await deletePromoCode(token, promo.originalCode);
      onDeleteLocal();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not delete that promo code.");
    } finally {
      setDeleting(false);
    }
  }

  async function copyPromoUrl() {
    try {
      await navigator.clipboard.writeText(promoUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.download = `bayblaze-${normalizedCode.toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function generateReplacementCode() {
    if (!canEdit) {
      return;
    }

    onUpdate({ code: `BB${createPromoCodeSuffix()}` });
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onToggleHidden} type="button">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]">
            {hidden ? <ChevronRight size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xl font-black text-[var(--bb-charcoal)]">{normalizedCode}</span>
            <span className="block text-sm font-semibold text-[var(--bb-muted)]">
              {promoSummary}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={isAdminManaged || isReferralPartner ? "brand" : "neutral"}>{sourceLabel}</Badge>
          <Badge tone={promo.persisted ? "success" : "warning"}>{promo.persisted ? "PUBLISHED" : "DRAFT"}</Badge>
          {canDelete ? (
            <Button aria-label={`Delete ${normalizedCode}`} disabled={deleting || saving} onClick={() => void deletePromo()} size="icon" variant="danger">
              <Trash2 size={17} aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {!hidden ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                disabled={!canChangeCode}
                label="Promo code"
                onChange={(event) => onUpdate({ code: normalizePromoCode(event.target.value) })}
                value={promo.code}
              />
              <label className="grid gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--bb-muted)]">
                Promo type
                <select
                  className="min-h-12 rounded-2xl border border-[var(--bb-line)] bg-white px-4 text-base font-bold normal-case tracking-normal text-[var(--bb-charcoal)] outline-none transition focus:border-[var(--bb-green)] disabled:cursor-not-allowed disabled:bg-[var(--bb-surface)] disabled:text-[var(--bb-muted)]"
                  disabled={!canEdit}
                  onChange={(event) => onUpdate({ codeType: event.target.value as AdminPromoCodeType })}
                  value={promo.codeType}
                >
                  <option value="discount">Percent off</option>
                  {!isReferralPartner ? <option value="bogo">Buy 1 get 1 free</option> : null}
                </select>
              </label>
              {promo.codeType === "discount" ? (
                <Input
                  disabled={!canEdit}
                  label="Discount percent"
                  max="100"
                  min="1"
                  onChange={(event) => onUpdate({ discountPercent: event.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
                  type="number"
                  value={promo.discountPercent}
                />
              ) : (
                <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--bb-charcoal)] sm:col-span-2">
                  BOGO applies one free item for every two qualifying cart items. At checkout, the lowest-priced item in each pair is discounted.
                </div>
              )}
            </div>

            {isReferralPartner ? (
              <div className="grid gap-3 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--bb-muted)]">
                  Referral account
                  <select
                    className="min-h-12 rounded-2xl border border-[var(--bb-line)] bg-white px-4 text-base font-bold normal-case tracking-normal text-[var(--bb-charcoal)] outline-none transition focus:border-[var(--bb-green)] disabled:cursor-not-allowed disabled:bg-[var(--bb-surface)] disabled:text-[var(--bb-muted)]"
                    disabled={!canEdit || promo.persisted}
                    onChange={(event) => onUpdate({ ownerUid: event.target.value })}
                    value={promo.ownerUid}
                  >
                    <option value="">Select an account</option>
                    {!ownerInAccounts && promo.ownerUid ? (
                      <option value={promo.ownerUid}>{promo.ownerDisplayName || promo.ownerEmail || promo.ownerUid}</option>
                    ) : null}
                    {accounts.map((account) => (
                      <option key={account.uid} value={account.uid}>
                        {account.displayName || account.email} ({account.email})
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  disabled={!canEdit}
                  label="Commission percent"
                  max="100"
                  min="1"
                  onChange={(event) => onUpdate({ commissionPercent: event.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
                  type="number"
                  value={promo.commissionPercent}
                />
                <p className="text-sm font-semibold leading-6 text-[var(--bb-charcoal)] sm:col-span-2">
                  {promo.ownerDisplayName || promo.ownerEmail || "This partner"} earns {commissionPercent}% of the customer product total after the {discountPercent}% discount on every qualifying order.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
              <label className="flex min-w-0 items-start gap-3 text-sm font-bold leading-6 text-[var(--bb-charcoal)]">
                <input
                  checked={promo.minimumSpendEnabled}
                  className="mt-1 size-5 accent-[var(--bb-blaze)]"
                  disabled={!canEdit}
                  onChange={(event) =>
                    onUpdate({
                      minimumSpend: event.target.checked && !promo.minimumSpend ? "50" : promo.minimumSpend,
                      minimumSpendEnabled: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>
                  <span className="block text-xs font-black uppercase text-[var(--bb-muted)]">Minimum basket before tax</span>
                  <span className="block">Require a basket amount before this promo applies.</span>
                </span>
              </label>
              <Input
                disabled={!canEdit || !promo.minimumSpendEnabled}
                inputMode="decimal"
                label="Minimum"
                min="0"
                onChange={(event) => onUpdate({ minimumSpend: normalizeMoneyInput(event.target.value) })}
                placeholder="50.00"
                value={promo.minimumSpend}
              />
            </div>

            <label className="flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 text-sm font-bold leading-6 text-[var(--bb-charcoal)]">
              <input
                checked={promo.singleUsePerAccount}
                className="mt-1 size-5 accent-[var(--bb-blaze)]"
                disabled={!canEdit}
                onChange={(event) => onUpdate({ singleUsePerAccount: event.target.checked })}
                type="checkbox"
              />
              <span>
                <span className="block text-xs font-black uppercase text-[var(--bb-muted)]">Single use per account</span>
                <span className="block">Restrict each signed-in customer account to one successful checkout with this promo.</span>
              </span>
            </label>

            <div className="grid gap-2">
              <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Promo link</p>
              <div className="break-all rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-4 py-3 text-sm font-bold leading-6 text-[var(--bb-charcoal)]">
                {promoUrl}
              </div>
            </div>

            {promo.persisted ? (
              <div className="text-xs font-black uppercase text-[var(--bb-muted)]">
                Used {promo.usedCount ?? 0} times
                {!isAdminManaged && promo.usageLimit ? ` of ${promo.usageLimit}` : ""}
                {promo.singleUsePerAccount ? " · single use per account" : ""}
              </div>
            ) : null}

            {isReferralPartner && promo.persisted ? <ReferralCommissionReport promo={promo} /> : null}

            {renderError ? <ErrorState>{renderError}</ErrorState> : null}
            {actionError ? <ErrorState>{actionError}</ErrorState> : null}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {canEdit ? (
                <>
                  <Button disabled={saving || deleting} onClick={() => void savePromo()} variant={dirty ? "primary" : "secondary"}>
                    <Save size={17} aria-hidden="true" />
                    {saving ? "Saving" : promo.persisted ? "Save" : "Create"}
                  </Button>
                  <Button disabled={!canChangeCode} onClick={generateReplacementCode} variant="secondary">
                    <RefreshCw size={17} aria-hidden="true" />
                    Generate
                  </Button>
                </>
              ) : null}
              <Button onClick={() => void copyPromoUrl()} variant="secondary">
                <Copy size={17} aria-hidden="true" />
                {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy link"}
              </Button>
              <Button onClick={downloadPng} variant="secondary">
                <Download size={17} aria-hidden="true" />
                PNG
              </Button>
              <Button onClick={() => window.print()} variant="secondary">
                <Printer size={17} aria-hidden="true" />
                Print
              </Button>
            </div>
          </div>

          <div className="bayblaze-promo-qr-print grid place-items-center rounded-2xl border border-[var(--bb-line)] bg-white p-4 text-center">
            <div>
              <Badge tone="brand">BayBlaze</Badge>
              <h3 className="mt-3 text-2xl font-black leading-tight">{promoTitle}</h3>
              <p className="text-sm font-semibold text-[var(--bb-muted)]">Promo code {normalizedCode}</p>
              <div className="mx-auto mt-4 grid h-[220px] w-[220px] max-w-full place-items-center overflow-hidden bg-white">
                <canvas
                  aria-label="BayBlaze promo QR code"
                  className="bayblaze-promo-qr-canvas block max-w-full"
                  height={qrCanvasSize}
                  ref={canvasRef}
                  style={{ height: 220, width: 220 }}
                  width={qrCanvasSize}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function ReferralCommissionReport({ promo }: { promo: PromoCard }) {
  const referrals = promo.referrals ?? [];

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--bb-line)] bg-white p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--bb-muted)]">Referral performance</p>
        <p className="mt-1 text-sm font-semibold text-[var(--bb-charcoal)]">
          Commission is locked per completed order from product spend after the coupon discount.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <ReferralMetric label="Customers" value={String(promo.uniqueReferredCustomers ?? 0)} />
        <ReferralMetric label="Purchases" value={String(promo.usedCount ?? 0)} />
        <ReferralMetric label="Customer spend" value={formatCents(promo.totalReferredSpendCents ?? 0)} />
        <ReferralMetric label="Commission" value={formatCents(promo.totalCommissionCents ?? 0)} />
      </div>
      {referrals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-3 py-2 text-sm font-semibold text-[var(--bb-muted)]">
          No qualifying referral purchases yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--bb-line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--bb-surface-warm)] text-xs font-black uppercase text-[var(--bb-muted)]">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Spent</th>
                <th className="px-3 py-2">Commission</th>
                <th className="px-3 py-2">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr className="border-t border-[var(--bb-line)] font-semibold text-[var(--bb-charcoal)]" key={referral.orderId}>
                  <td className="px-3 py-2">{referral.customerEmail || referral.uid || "Unknown"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{referral.orderId}</td>
                  <td className="px-3 py-2">{formatCents(referral.referredSpendCents)}</td>
                  <td className="px-3 py-2">{formatCents(referral.commissionCents)} ({referral.commissionPercent}%)</td>
                  <td className="px-3 py-2">{formatPromoDate(referral.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReferralMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--bb-muted)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--bb-charcoal)]">{value}</p>
    </div>
  );
}

function toPromoCard(promoCode: AdminPromoCode): PromoCard {
  const codeType = promoCode.codeType === "bogo" ? "bogo" : "discount";
  const commissionPercent = String(promoCode.commissionPercent || 30);
  const discountPercent = String(promoCode.discountPercent || 30);
  const minimumSpendCents = Math.max(0, Math.round(promoCode.minimumSpendCents || 0));
  const category = promoCode.category === "win_referral"
    ? "win_referral"
    : promoCode.category === "referral_partner"
      ? "referral_partner"
      : "admin_promo";

  return {
    category,
    code: promoCode.code,
    codeType,
    commissionPercent,
    discountPercent,
    id: promoCode.code,
    minimumSpend: minimumSpendCents > 0 ? centsToMoneyInput(minimumSpendCents) : "50",
    minimumSpendEnabled: minimumSpendCents > 0,
    originalCode: promoCode.code,
    originalCodeType: codeType,
    originalCommissionPercent: commissionPercent,
    originalDiscountPercent: discountPercent,
    originalMinimumSpendCents: minimumSpendCents,
    originalOwnerUid: promoCode.ownerUid ?? "",
    originalSingleUsePerAccount: promoCode.singleUsePerAccount === true,
    persisted: true,
    ownerDisplayName: promoCode.ownerDisplayName,
    ownerEmail: promoCode.ownerEmail,
    ownerUid: promoCode.ownerUid ?? "",
    referrals: promoCode.referrals,
    singleUsePerAccount: promoCode.singleUsePerAccount === true,
    usageLimit: promoCode.usageLimit,
    usedCount: promoCode.usedCount,
    totalCommissionCents: promoCode.totalCommissionCents,
    totalDiscountCents: promoCode.totalDiscountCents,
    totalReferredSpendCents: promoCode.totalReferredSpendCents,
    totalReferredSubtotalCents: promoCode.totalReferredSubtotalCents,
    uniqueReferredCustomers: promoCode.uniqueReferredCustomers,
  };
}

function getPromoSaveInput({
  category,
  code,
  codeType,
  commissionPercent,
  discountPercent,
  minimumSpendCents,
  ownerUid,
  singleUsePerAccount,
}: {
  category: AdminPromoCodeCategory;
  code: string;
  codeType: AdminPromoCodeType;
  commissionPercent: number;
  discountPercent: number;
  minimumSpendCents: number;
  ownerUid: string;
  singleUsePerAccount: boolean;
}) {
  if (category === "referral_partner") {
    return {
      category,
      code,
      codeType: "discount" as const,
      commissionPercent,
      discountPercent,
      minimumSpendCents,
      ownerUid,
      singleUsePerAccount,
    };
  }

  if (codeType === "bogo") {
    return { category: "admin_promo" as const, code, codeType, minimumSpendCents, singleUsePerAccount };
  }

  return { category: "admin_promo" as const, code, codeType, discountPercent, minimumSpendCents, singleUsePerAccount };
}

function getPromoTitle({
  codeType,
  discountPercent,
}: {
  codeType: AdminPromoCodeType;
  discountPercent: number;
}) {
  return codeType === "bogo" ? "Buy 1 Get 1 Free" : `${discountPercent}% Off`;
}

function getPromoSourceLabel(category: AdminPromoCodeCategory) {
  if (category === "win_referral") {
    return "Win Referral";
  }

  return category === "referral_partner" ? "Referral Partner" : "Admin Promo";
}

function loadHiddenCodes() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(hiddenStorageKey) || "[]");

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.map((code) => normalizePromoCode(String(code))).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function removeHiddenCode(current: Set<string>, code: string) {
  const next = new Set(current);
  next.delete(normalizePromoCode(code));
  return next;
}

function buildPromoUrl(code: string) {
  const url = new URL("/", defaultStorefrontOrigin);
  url.searchParams.set("promo", code);
  return url.toString();
}

function normalizeDiscountPercent(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 30;
  }

  return Math.min(Math.max(Math.round(number * 100) / 100, 1), 100);
}

function normalizeMoneyCents(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return Math.min(Math.round(number * 100), 1_000_000_00);
}

function centsToMoneyInput(cents: number) {
  const amount = cents / 100;

  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

function formatPromoDate(value: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function renderPromoQr(canvas: HTMLCanvasElement | null, promoUrl: string) {
  if (!canvas) {
    return;
  }

  await QRCode.toCanvas(canvas, promoUrl, {
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
    margin: 0,
    width: qrCanvasSize,
  });

  setCanvasDisplaySize(canvas);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the QR canvas.");
  }

  const centeredLogo = await buildCenteredLogoCanvas(qrLogoPath);
  const logoX = (qrCanvasSize - centeredLogo.width) / 2;
  const logoY = (qrCanvasSize - centeredLogo.height) / 2;

  context.drawImage(centeredLogo, logoX, logoY);
  setCanvasDisplaySize(canvas);
}

function setCanvasDisplaySize(canvas: HTMLCanvasElement) {
  canvas.style.setProperty("height", "220px", "important");
  canvas.style.setProperty("width", "220px", "important");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the QR logo."));
    image.src = src;
  });
}

async function buildCenteredLogoCanvas(src: string) {
  const logo = await loadImage(src);
  const scale = Math.min(qrLogoMaxSize / logo.naturalWidth, qrLogoMaxSize / logo.naturalHeight);
  const logoWidth = Math.round(logo.naturalWidth * scale);
  const logoHeight = Math.round(logo.naturalHeight * scale);
  const logoCanvas = document.createElement("canvas");
  const logoContext = logoCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!logoContext) {
    throw new Error("Could not prepare the QR logo.");
  }

  logoCanvas.width = logoWidth;
  logoCanvas.height = logoHeight;
  logoContext.drawImage(logo, 0, 0, logoWidth, logoHeight);

  const imageData = logoContext.getImageData(0, 0, logoWidth, logoHeight);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 255;
    const green = data[index + 1] ?? 255;
    const blue = data[index + 2] ?? 255;
    const alpha = data[index + 3] ?? 0;
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
    data[index + 3] = alpha > 0 && luminance < 200 ? 255 : 0;
  }

  logoContext.putImageData(imageData, 0, 0);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the QR logo frame.");
  }

  canvas.width = logoWidth + qrLogoHorizontalPadding * 2;
  canvas.height = logoHeight;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(logoCanvas, qrLogoHorizontalPadding, 0);

  return canvas;
}
