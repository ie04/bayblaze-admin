import { useEffect, useState } from "react";
import { CircleOff, Save, Settings, ShieldCheck } from "lucide-react";

import { normalizeMoneyInput } from "./promoCreationModel";
import { loadStorefrontSettings, updateStorefrontSettings } from "./lib/adminApi";
import type { StorefrontSettings } from "./lib/types";
import { Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader } from "./components/ui";

export function SettingsView({ token }: { token: string }) {
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [amount, setAmount] = useState("0");
  const [loading, setLoading] = useState(true);
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingAge, setSavingAge] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const amountCents = normalizeMoneyCents(amount);
  const persistedCents = Math.max(0, Math.round(settings?.priceAdjustmentCents ?? 0));
  const dirty = amountCents !== persistedCents;
  const ageVerificationDisabled = settings?.ageVerificationDisabled === true;

  useEffect(() => {
    let cancelled = false;

    loadStorefrontSettings(token)
      .then((response) => {
        if (cancelled) return;
        setSettings(response.settings);
        setAmount(centsToMoneyInput(response.settings.priceAdjustmentCents));
        setError("");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load storefront settings.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function savePriceAdjustment() {
    try {
      setSavingPrice(true);
      setError("");
      setMessage("");
      const response = await updateStorefrontSettings(token, {
        priceAdjustmentCents: amountCents,
      });

      setSettings(response.settings);
      setAmount(centsToMoneyInput(response.settings.priceAdjustmentCents));
      setMessage(
        response.settings.priceAdjustmentCents > 0
          ? `Storefront prices are now adjusted by ${formatCents(response.settings.priceAdjustmentCents)}.`
          : "Storefront price adjustment is off.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save storefront pricing.");
    } finally {
      setSavingPrice(false);
    }
  }

  async function toggleAgeVerificationDisabled() {
    try {
      setSavingAge(true);
      setError("");
      setMessage("");
      const response = await updateStorefrontSettings(token, {
        ageVerificationDisabled: !ageVerificationDisabled,
      });

      setSettings(response.settings);
      setAmount(centsToMoneyInput(response.settings.priceAdjustmentCents));
      setMessage(
        response.settings.ageVerificationDisabled
          ? "Storefront age verification is disabled for testing."
          : "Storefront age verification is enabled.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save age verification setting.");
    } finally {
      setSavingAge(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Settings size={22} aria-hidden="true" />}
        title="Settings"
        subtitle="Manage storefront-wide controls that affect pricing and checkout."
      />

      {loading ? <LoadingState label="Loading storefront settings..." /> : null}
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? (
        <div aria-live="polite" className="rounded-2xl border border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] p-4 text-sm font-black text-[var(--bb-success-strong)]">
          {message}
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-4">
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Storefront pricing</p>
                <h2 className="mt-1 text-xl font-black text-[var(--bb-charcoal)]">Sitewide price adjustment</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
                  Subtract a fixed amount from every storefront item price before it reaches shop, cart, and checkout.
                </p>
              </div>
              <Badge tone={persistedCents > 0 ? "success" : "neutral"}>
                {persistedCents > 0 ? `${formatCents(persistedCents)} off` : "Off"}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto_auto] sm:items-end">
              <Input
                disabled={savingPrice}
                inputMode="decimal"
                label="Amount off"
                min="0"
                onChange={(event) => {
                  setAmount(normalizeMoneyInput(event.target.value));
                  setMessage("");
                }}
                placeholder="5.00"
                value={amount}
              />
              <Button disabled={savingPrice || !dirty} onClick={() => void savePriceAdjustment()} variant={dirty ? "primary" : "secondary"}>
                <Save size={17} aria-hidden="true" />
                {savingPrice ? "Saving" : "Save adjustment"}
              </Button>
              <Button
                disabled={savingPrice || amountCents === 0}
                onClick={() => {
                  setAmount("0");
                  setMessage("");
                }}
                variant="secondary"
              >
                <CircleOff size={17} aria-hidden="true" />
                Turn off
              </Button>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Checkout testing</p>
                <h2 className="mt-1 text-xl font-black text-[var(--bb-charcoal)]">Global age verification</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
                  Temporarily bypass AgeChecker across the storefront while testing checkout.
                </p>
              </div>
              <Badge tone={ageVerificationDisabled ? "warning" : "success"}>
                {ageVerificationDisabled ? "Disabled" : "Enabled"}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={savingAge}
                onClick={() => void toggleAgeVerificationDisabled()}
                variant={ageVerificationDisabled ? "secondary" : "danger"}
              >
                <ShieldCheck size={17} aria-hidden="true" />
                {ageVerificationDisabled ? "Enable age verification" : "Disable for testing"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
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
