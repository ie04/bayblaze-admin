import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Tag, Users, X } from "lucide-react";

import { Badge, Button, ErrorState, Input } from "./components/ui";
import type { PromoCodeInput } from "./lib/adminApi";
import type { Account, AdminPromoCode } from "./lib/types";
import {
  buildPromotionCreateInput,
  createDefaultPromotionForm,
  createPromoCodeSuffix,
  normalizeMoneyInput,
  normalizePercentInput,
  normalizePromoCode,
  validatePromotionForm,
  type PromotionForm,
  type PromotionFormErrors,
  type PromotionType,
} from "./promoCreationModel";

type WizardStep = 1 | 2 | 3 | 4;
type WizardMode = "promotion" | "referral-account";

const stepLabels = ["Promotion type", "Promotion details", "Review", "Create"] as const;
const referralAccountStepLabels = ["Account & terms", "Review", "Create"] as const;
const selectClasses = "min-h-12 w-full rounded-2xl border border-[var(--bb-line)] bg-white px-4 text-base font-bold text-[var(--bb-charcoal)] outline-none transition focus:border-[var(--bb-green)] focus-visible:ring-2 focus-visible:ring-[var(--bb-focus)] focus-visible:ring-offset-2";

export function PromoCreationWizard({
  accounts,
  initialOwnerUid = "",
  mode = "promotion",
  onClose,
  onCreate,
  onSearchAccounts,
}: {
  accounts: Account[];
  initialOwnerUid?: string;
  mode?: WizardMode;
  onClose: () => void;
  onCreate: (input: PromoCodeInput) => Promise<AdminPromoCode>;
  onSearchAccounts?: (query: string) => Promise<Account[]>;
}) {
  const referralAccountMode = mode === "referral-account";
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<PromotionForm | null>(() => {
    if (!referralAccountMode) return null;
    return {
      ...createDefaultPromotionForm("referral"),
      ownerUid: initialOwnerUid,
    };
  });
  const [errors, setErrors] = useState<PromotionFormErrors>({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discardWarning, setDiscardWarning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [searchedAccounts, setSearchedAccounts] = useState<Account[]>([]);
  const [accountQuery, setAccountQuery] = useState("");
  const [accountSearching, setAccountSearching] = useState(false);
  const [accountSearchError, setAccountSearchError] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (discardWarning) {
      dialogRef.current?.querySelector<HTMLElement>("[data-keep-editing]")?.focus();
      return;
    }

    titleRef.current?.focus();
  }, [discardWarning, step]);

  function choosePromotionType(type: PromotionType) {
    setForm((current) => current?.promotionType === type ? current : createDefaultPromotionForm(type));
    setErrors({});
    setApiError("");
    setDirty(true);
  }

  function updateForm(updates: Partial<PromotionForm>, clearError?: keyof PromotionFormErrors) {
    setForm((current) => current ? { ...current, ...updates } as PromotionForm : current);
    setDirty(true);

    if (clearError) {
      setErrors((current) => ({ ...current, [clearError]: undefined }));
    }
  }

  function requestClose() {
    if (submitting) {
      return;
    }

    if (dirty) {
      setDiscardWarning(true);
      return;
    }

    onClose();
  }

  function continueWizard() {
    setApiError("");

    if (referralAccountMode) {
      if (step === 1 && form) {
        const nextErrors = validatePromotionForm(form, selectableAccounts);
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length === 0) {
          setStep(2);
        }
        return;
      }

      if (step === 2) {
        setStep(3);
      }
      return;
    }

    if (step === 1) {
      if (form) setStep(2);
      return;
    }

    if (step === 2 && form) {
      const nextErrors = validatePromotionForm(form, selectableAccounts);
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length === 0) {
        setStep(3);
      }
      return;
    }

    if (step === 3) {
      setStep(4);
    }
  }

  function goBack() {
    if (submitting || step === 1) return;
    setApiError("");
    setDiscardWarning(false);
    setStep((current) => Math.max(1, current - 1) as WizardStep);
  }

  async function createPromotion() {
    const finalStep = referralAccountMode ? 3 : 4;
    if (!form || submitting || step !== finalStep) {
      return;
    }

    const nextErrors = validatePromotionForm(form, selectableAccounts);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStep(2);
      return;
    }

    try {
      setSubmitting(true);
      setApiError("");
      await onCreate(buildPromotionCreateInput(form));
    } catch (caught) {
      setApiError(caught instanceof Error ? caught.message : "Could not create that promotion.");
      setSubmitting(false);
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();

      if (discardWarning) {
        setDiscardWarning(false);
      } else {
        requestClose();
      }
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(dialogRef.current);

    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function searchReferralAccounts() {
    if (!onSearchAccounts || accountSearching) return;
    const query = accountQuery.trim();

    if (!query) {
      setAccountSearchError("Enter the customer's name or email.");
      return;
    }

    setAccountSearching(true);
    setAccountSearchError("");
    try {
      const results = await onSearchAccounts(query);
      setSearchedAccounts((current) => mergeAccounts(current, results));
      if (results.length === 0) {
        setAccountSearchError("No eligible customer account matched that search.");
      }
    } catch (caught) {
      setAccountSearchError(caught instanceof Error ? caught.message : "Account search failed.");
    } finally {
      setAccountSearching(false);
    }
  }

  const selectableAccounts = mergeAccounts(accounts, searchedAccounts);
  const activeStepLabels = referralAccountMode ? referralAccountStepLabels : stepLabels;
  const finalStep = activeStepLabels.length;
  const title = activeStepLabels[step - 1];
  const entityLabel = referralAccountMode ? "referral account" : "promotion";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-2 backdrop-blur-sm sm:place-items-center sm:p-6"
      data-testid="promo-wizard-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        aria-describedby="promo-wizard-description"
        aria-labelledby="promo-wizard-title"
        aria-modal="true"
        className="flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] border border-[var(--bb-line)] bg-white shadow-[var(--bb-shadow-card)] sm:h-auto sm:max-h-[calc(100svh-3rem)]"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header className="shrink-0 border-b border-[var(--bb-line)] bg-white p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--bb-blaze)]">
                {referralAccountMode ? "New Referral Account" : "New Promo"}
              </p>
              <h3 className="mt-1 text-xl font-black text-[var(--bb-charcoal)]" id="promo-wizard-title" ref={titleRef} tabIndex={-1}>
                {title}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]" id="promo-wizard-description">
                Step {step} of {finalStep} · Configure and review before anything is created.
              </p>
            </div>
            <Button
              aria-label={referralAccountMode ? "Close referral account wizard" : "Close promotion wizard"}
              disabled={submitting}
              onClick={requestClose}
              size="icon"
              variant="ghost"
            >
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
          <ol
            aria-label={referralAccountMode ? "Referral account creation progress" : "Promotion creation progress"}
            className={`mt-4 grid gap-1.5 ${referralAccountMode ? "grid-cols-3" : "grid-cols-4"}`}
          >
            {activeStepLabels.map((label, index) => {
              const number = index + 1;
              const complete = number < step;
              const current = number === step;

              return (
                <li aria-current={current ? "step" : undefined} className="min-w-0" key={label}>
                  <div className={`h-1.5 rounded-full ${complete || current ? "bg-[var(--bb-blaze)]" : "bg-[var(--bb-line)]"}`} />
                  <span className={`mt-1 hidden truncate text-[10px] font-black uppercase sm:block ${current ? "text-[var(--bb-charcoal)]" : "text-[var(--bb-muted)]"}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-5" data-testid="wizard-scroll-region">
          {!referralAccountMode && step === 1 ? <PromotionTypeStep form={form} onChoose={choosePromotionType} /> : null}
          {((referralAccountMode && step === 1) || (!referralAccountMode && step === 2)) && form ? (
            <div className="space-y-4">
              {referralAccountMode && onSearchAccounts ? (
                <form
                  className="grid gap-2 rounded-[20px] border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void searchReferralAccounts();
                  }}
                >
                  <Input
                    label="Find a unified customer account"
                    onChange={(event) => {
                      setAccountQuery(event.target.value);
                      setAccountSearchError("");
                    }}
                    placeholder="Name or email"
                    value={accountQuery}
                  />
                  <Button loading={accountSearching} type="submit" variant="secondary">Search accounts</Button>
                  {accountSearchError ? (
                    <p className="text-sm font-bold text-[var(--bb-danger-strong)] sm:col-span-2" role="alert">{accountSearchError}</p>
                  ) : null}
                </form>
              ) : null}
              <PromotionDetailsStep accounts={selectableAccounts} errors={errors} form={form} onChange={updateForm} />
            </div>
          ) : null}
          {((referralAccountMode && step === 2) || (!referralAccountMode && step === 3)) && form ? (
            <PromotionReview form={form} accounts={selectableAccounts} />
          ) : null}
          {step === finalStep && form ? (
            <div className="space-y-4">
              <div className="rounded-[20px] border border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] p-4">
                <Badge tone="success">Ready to publish</Badge>
                <h4 className="mt-3 text-xl font-black text-[var(--bb-charcoal)]">
                  {referralAccountMode ? "Create referral account" : `Create ${normalizePromoCode(form.code)}`}
                </h4>
                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-success-strong)]">
                  This is the only step that sends the {entityLabel} to BayBlaze. Confirm the summary, then create it once.
                </p>
              </div>
              <PromotionReview accounts={selectableAccounts} compact form={form} />
              {apiError ? <ErrorState>{apiError}</ErrorState> : null}
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-[var(--bb-line)] bg-white p-3 md:p-4">
          {discardWarning ? (
            <div aria-live="assertive" className="rounded-2xl border border-[var(--bb-warning-soft)] bg-[var(--bb-warning-soft)] p-3">
              <p className="font-black text-[var(--bb-warning-strong)]">Discard this unsaved {entityLabel}?</p>
              <p className="mt-1 text-sm font-semibold text-[var(--bb-warning-strong)]">Nothing has been created yet, but your entries will be lost.</p>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button onClick={onClose} variant="danger">Discard</Button>
                <Button data-keep-editing onClick={() => setDiscardWarning(false)} variant="secondary">Keep editing</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button disabled={submitting} onClick={requestClose} variant="ghost">Cancel</Button>
              <div className="grid gap-2 sm:flex">
                {step > 1 ? (
                  <Button disabled={submitting} onClick={goBack} variant="secondary">
                    <ArrowLeft size={17} aria-hidden="true" /> Back
                  </Button>
                ) : null}
                {step < finalStep ? (
                  <Button disabled={step === 1 && !form} onClick={continueWizard}>
                    Continue <ArrowRight size={17} aria-hidden="true" />
                  </Button>
                ) : (
                  <Button loading={submitting} onClick={() => void createPromotion()}>
                    <Check size={17} aria-hidden="true" /> {referralAccountMode ? "Create Referral Account" : "Create Promotion"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}

function PromotionTypeStep({ form, onChoose }: { form: PromotionForm | null; onChoose: (type: PromotionType) => void }) {
  const choices: Array<{ description: string; icon: typeof Tag; label: string; type: PromotionType }> = [
    {
      description: "A reusable percent-off or buy-one-get-one offer for customers, with optional basket and account limits.",
      icon: Tag,
      label: "Standard promo",
      type: "standard",
    },
    {
      description: "A percent-off code owned by a BayBlaze account that also earns commission on qualifying purchases.",
      icon: Users,
      label: "Referral promo",
      type: "referral",
    },
  ];

  return (
    <fieldset>
      <legend className="text-base font-black text-[var(--bb-charcoal)]">What kind of promotion are you creating?</legend>
      <p className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-muted)]">Choose a type to show only the settings that apply.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const selected = form?.promotionType === choice.type;
          const Icon = choice.icon;

          return (
            <label className="group cursor-pointer" key={choice.type}>
              <input checked={selected} className="peer sr-only" name="promotion-type" onChange={() => onChoose(choice.type)} type="radio" value={choice.type} />
              <span className="block min-h-full rounded-[20px] border border-[var(--bb-line)] bg-white p-4 shadow-[var(--bb-shadow-soft)] transition group-hover:border-[var(--bb-blaze)] peer-checked:border-[var(--bb-blaze)] peer-checked:bg-[var(--bb-blaze-soft)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--bb-focus)] peer-focus-visible:ring-offset-2">
                <span className="grid size-10 place-items-center rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]"><Icon size={20} aria-hidden="true" /></span>
                <span className="mt-3 block text-lg font-black text-[var(--bb-charcoal)]">{choice.label}</span>
                <span className="mt-1 block text-sm font-semibold leading-6 text-[var(--bb-muted)]">{choice.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PromotionDetailsStep({
  accounts,
  errors,
  form,
  onChange,
}: {
  accounts: Account[];
  errors: PromotionFormErrors;
  form: PromotionForm;
  onChange: (updates: Partial<PromotionForm>, clearError?: keyof PromotionFormErrors) => void;
}) {
  const eligibleAccounts = accounts.filter((account) => !account.disabled && account.badges.includes("customer"));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldError error={errors.code} errorId="promo-code-error">
          <Input
            aria-describedby={errors.code ? "promo-code-error" : undefined}
            aria-invalid={Boolean(errors.code)}
            label="Promo code"
            onChange={(event) => onChange({ code: normalizePromoCode(event.target.value) }, "code")}
            value={form.code}
          />
        </FieldError>
        <div className="flex items-end">
          <Button fullWidth onClick={() => onChange({ code: `BB${createPromoCodeSuffix()}` }, "code")} variant="secondary">Generate new code</Button>
        </div>

        {form.promotionType === "standard" ? (
          <label className="grid gap-2 text-xs font-black uppercase text-[var(--bb-muted)]">
            Customer reward
            <select className={selectClasses} onChange={(event) => onChange({ codeType: event.target.value as "discount" | "bogo" })} value={form.codeType}>
              <option value="discount">Percent off</option>
              <option value="bogo">Buy 1 get 1 free</option>
            </select>
          </label>
        ) : (
          <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3">
            <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Customer reward</p>
            <p className="mt-1 font-black text-[var(--bb-charcoal)]">Percent off</p>
            <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">Referral promos cannot use BOGO.</p>
          </div>
        )}

        {form.codeType === "discount" ? (
          <FieldError error={errors.discountPercent} errorId="promo-discount-error">
            <Input
              aria-describedby={errors.discountPercent ? "promo-discount-error" : undefined}
              aria-invalid={Boolean(errors.discountPercent)}
              label="Discount percent"
              max="100"
              min="1"
              onChange={(event) => onChange({ discountPercent: normalizePercentInput(event.target.value) }, "discountPercent")}
              type="number"
              value={form.discountPercent}
            />
          </FieldError>
        ) : (
          <div className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3 text-sm font-semibold leading-6 text-[var(--bb-charcoal)]">
            The lowest-priced item in every qualifying pair is free.
          </div>
        )}
      </div>

      {form.promotionType === "referral" ? (
        <div className="grid gap-3 rounded-[20px] border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 sm:grid-cols-2">
          <FieldError error={errors.ownerUid} errorId="promo-owner-error">
            <label className="grid gap-2 text-xs font-black uppercase text-[var(--bb-muted)]">
              Referral account
              <select aria-describedby={errors.ownerUid ? "promo-owner-error" : undefined} aria-invalid={Boolean(errors.ownerUid)} className={selectClasses} onChange={(event) => onChange({ ownerUid: event.target.value }, "ownerUid")} value={form.ownerUid}>
                <option value="">Select an account</option>
                {eligibleAccounts.map((account) => (
                  <option key={account.uid} value={account.uid}>{account.displayName || account.email} ({account.email})</option>
                ))}
              </select>
            </label>
          </FieldError>
          <FieldError error={errors.commissionPercent} errorId="promo-commission-error">
            <Input
              aria-describedby={errors.commissionPercent ? "promo-commission-error" : undefined}
              aria-invalid={Boolean(errors.commissionPercent)}
              label="Commission percent"
              max="100"
              min="1"
              onChange={(event) => onChange({ commissionPercent: normalizePercentInput(event.target.value) }, "commissionPercent")}
              type="number"
              value={form.commissionPercent}
            />
          </FieldError>
          <p className="text-sm font-semibold leading-6 text-[var(--bb-charcoal)] sm:col-span-2">
            The account earns this percentage of each customer’s product total after the referral discount.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-[20px] border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
        <label className="flex items-start gap-3 text-sm font-bold leading-6 text-[var(--bb-charcoal)]">
          <input checked={form.minimumSpendEnabled} className="mt-1 size-5 accent-[var(--bb-blaze)]" onChange={(event) => onChange({ minimumSpendEnabled: event.target.checked }, "minimumSpend")} type="checkbox" />
          <span><span className="block text-xs font-black uppercase text-[var(--bb-muted)]">Minimum basket before tax</span>Require a product subtotal before this promo applies.</span>
        </label>
        <FieldError error={errors.minimumSpend} errorId="promo-minimum-error">
          <Input
            aria-describedby={errors.minimumSpend ? "promo-minimum-error" : undefined}
            aria-invalid={Boolean(errors.minimumSpend)}
            disabled={!form.minimumSpendEnabled}
            inputMode="decimal"
            label="Minimum"
            min="0"
            onChange={(event) => onChange({ minimumSpend: normalizeMoneyInput(event.target.value) }, "minimumSpend")}
            placeholder="50.00"
            value={form.minimumSpend}
          />
        </FieldError>
      </div>

      <label className="flex items-start gap-3 rounded-[20px] border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 text-sm font-bold leading-6 text-[var(--bb-charcoal)]">
        <input checked={form.singleUsePerAccount} className="mt-1 size-5 accent-[var(--bb-blaze)]" onChange={(event) => onChange({ singleUsePerAccount: event.target.checked })} type="checkbox" />
        <span><span className="block text-xs font-black uppercase text-[var(--bb-muted)]">Single use per account</span>Restrict each signed-in customer account to one successful checkout with this promo.</span>
      </label>
    </div>
  );
}

function PromotionReview({ accounts, compact = false, form }: { accounts: Account[]; compact?: boolean; form: PromotionForm }) {
  const owner = form.promotionType === "referral" ? accounts.find((account) => account.uid === form.ownerUid) : null;
  const rows = [
    ["Promotion", form.promotionType === "referral" ? "Referral promo" : "Standard promo"],
    ["Promo code", normalizePromoCode(form.code)],
    ["Customer reward", form.codeType === "bogo" ? "Buy 1 get 1 free" : `${form.discountPercent}% off`],
    ["Eligibility", form.minimumSpendEnabled ? `${formatMoney(form.minimumSpend)} minimum before tax` : "No minimum purchase"],
    ["Usage", form.singleUsePerAccount ? "Once per signed-in account" : "Reusable per account; 1,000,000 total-use cap"],
    ["Dates", "Active immediately; no expiration configured"],
    ...(form.promotionType === "referral" ? [
      ["Referral owner", owner ? `${owner.displayName || owner.email} (${owner.email})` : form.ownerUid],
      ["Referral reward", `${form.commissionPercent}% of post-discount product spend per qualifying purchase`],
    ] : []),
  ];

  return (
    <section className={compact ? "" : "rounded-[20px] border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4"}>
      {!compact ? <h4 className="text-lg font-black text-[var(--bb-charcoal)]">Promotion summary</h4> : null}
      <dl className={`${compact ? "" : "mt-3"} grid gap-2 sm:grid-cols-2`}>
        {rows.map(([label, value]) => (
          <div className="rounded-2xl border border-[var(--bb-line)] bg-white px-3 py-2" key={label}>
            <dt className="text-[11px] font-black uppercase text-[var(--bb-muted)]">{label}</dt>
            <dd className="mt-1 text-sm font-black leading-5 text-[var(--bb-charcoal)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FieldError({ children, error, errorId }: { children: ReactNode; error?: string; errorId: string }) {
  return (
    <div>
      {children}
      {error ? <p className="mt-1 text-sm font-bold text-[var(--bb-danger-strong)]" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

function formatMoney(value: string) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(Number.isFinite(amount) ? amount : 0);
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];

  return Array.from(container.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
  )).filter((element) => !element.hasAttribute("hidden"));
}

function mergeAccounts(...groups: Account[][]) {
  const accountsByUid = new Map<string, Account>();
  groups.flat().forEach((account) => accountsByUid.set(account.uid, account));
  return Array.from(accountsByUid.values());
}
