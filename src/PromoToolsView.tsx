import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, Plus, Printer, QrCode, RefreshCw, Save, Trash2 } from "lucide-react";
import QRCode from "qrcode";

import { createPromoCode, deletePromoCode, loadPromoCodes, updatePromoCode } from "./lib/adminApi";
import type { AdminPromoCode, AdminPromoCodeCategory, AdminPromoCodeType } from "./lib/types";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader } from "./components/ui";

type CopyState = "idle" | "copied" | "failed";

type PromoCard = {
  category: AdminPromoCodeCategory;
  code: string;
  codeType: AdminPromoCodeType;
  discountPercent: string;
  id: string;
  minimumSpend: string;
  minimumSpendEnabled: boolean;
  originalCode?: string;
  originalCodeType?: AdminPromoCodeType;
  originalDiscountPercent?: string;
  originalMinimumSpendCents?: number;
  persisted: boolean;
  usageLimit?: number;
  usedCount?: number;
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
  const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(() => loadHiddenCodes());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadPromoCodes(token)
      .then((response) => {
        if (cancelled) return;
        setError("");
        setPromos(response.promoCodes.map(toPromoCard));
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

  function addPromo() {
    const code = `BB${createPromoCodeSuffix()}`;
    setPromos((current) => [
      {
        category: "admin_promo",
        code,
        codeType: "discount",
        discountPercent: "30",
        id: crypto.randomUUID(),
        minimumSpend: "50",
        minimumSpendEnabled: false,
        persisted: false,
      },
      ...current,
    ]);
    setHiddenCodes((current) => removeHiddenCode(current, code));
  }

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

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={addPromo} variant="secondary">
            <Plus size={17} aria-hidden="true" />
            New promo
          </Button>
        }
        icon={<QrCode size={22} aria-hidden="true" />}
        title="Promo QR"
        subtitle="Create and organize checkout-valid promo links and QR assets."
      />

      {error ? <ErrorState>{error}</ErrorState> : null}
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
              token={token}
            />
          );
        })}
      </div>
    </div>
  );
}

function PromoCodeCard({
  hidden,
  onDeleteLocal,
  onReconcile,
  onToggleHidden,
  onUpdate,
  promo,
  token,
}: {
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
  const minimumSpendCents = promo.minimumSpendEnabled ? normalizeMoneyCents(promo.minimumSpend) : 0;
  const promoUrl = useMemo(() => buildPromoUrl(normalizedCode), [normalizedCode]);
  const isAdminManaged = promo.category === "admin_promo";
  const canEdit = !promo.persisted || isAdminManaged;
  const dirty = canEdit && (
    !promo.persisted ||
    normalizedCode !== promo.originalCode ||
    promo.codeType !== (promo.originalCodeType ?? "discount") ||
    (promo.codeType === "discount" && String(discountPercent) !== (promo.originalDiscountPercent ?? promo.discountPercent.trim())) ||
    minimumSpendCents !== (promo.originalMinimumSpendCents ?? 0)
  );
  const promoTitle = getPromoTitle({ codeType: promo.codeType, discountPercent });
  const sourceLabel = getPromoSourceLabel(promo.category);
  const promoSummary = `${sourceLabel} · ${promoTitle}${minimumSpendCents > 0 ? ` over ${formatCents(minimumSpendCents)}` : ""}${promo.persisted ? "" : " draft"}`;

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
        code: normalizedCode,
        codeType: promo.codeType,
        discountPercent,
        minimumSpendCents,
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
          <Badge tone={isAdminManaged ? "brand" : "neutral"}>{sourceLabel}</Badge>
          <Badge tone={promo.persisted ? "success" : "warning"}>{promo.persisted ? "PUBLISHED" : "DRAFT"}</Badge>
          {canEdit ? (
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
                disabled={!canEdit}
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
                  <option value="bogo">Buy 1 get 1 free</option>
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
              </div>
            ) : null}

            {renderError ? <ErrorState>{renderError}</ErrorState> : null}
            {actionError ? <ErrorState>{actionError}</ErrorState> : null}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {canEdit ? (
                <>
                  <Button disabled={saving || deleting} onClick={() => void savePromo()} variant={dirty ? "primary" : "secondary"}>
                    <Save size={17} aria-hidden="true" />
                    {saving ? "Saving" : promo.persisted ? "Save" : "Create"}
                  </Button>
                  <Button onClick={generateReplacementCode} variant="secondary">
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

function toPromoCard(promoCode: AdminPromoCode): PromoCard {
  const codeType = promoCode.codeType === "bogo" ? "bogo" : "discount";
  const discountPercent = String(promoCode.discountPercent || 30);
  const minimumSpendCents = Math.max(0, Math.round(promoCode.minimumSpendCents || 0));
  const category = promoCode.category === "win_referral" ? "win_referral" : "admin_promo";

  return {
    category,
    code: promoCode.code,
    codeType,
    discountPercent,
    id: promoCode.code,
    minimumSpend: minimumSpendCents > 0 ? centsToMoneyInput(minimumSpendCents) : "50",
    minimumSpendEnabled: minimumSpendCents > 0,
    originalCode: promoCode.code,
    originalCodeType: codeType,
    originalDiscountPercent: discountPercent,
    originalMinimumSpendCents: minimumSpendCents,
    persisted: true,
    usageLimit: promoCode.usageLimit,
    usedCount: promoCode.usedCount,
  };
}

function getPromoSaveInput({
  code,
  codeType,
  discountPercent,
  minimumSpendCents,
}: {
  code: string;
  codeType: AdminPromoCodeType;
  discountPercent: number;
  minimumSpendCents: number;
}) {
  if (codeType === "bogo") {
    return { code, codeType, minimumSpendCents };
  }

  return { code, codeType, discountPercent, minimumSpendCents };
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
  return category === "win_referral" ? "Win Referral" : "Admin Promo";
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

function normalizePromoCode(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80).toUpperCase();
}

function normalizeDiscountPercent(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 30;
  }

  return Math.min(Math.max(Math.round(number * 100) / 100, 1), 100);
}

function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [dollars = "", ...rest] = cleaned.split(".");
  const cents = rest.join("").slice(0, 2);

  return rest.length ? `${dollars.slice(0, 6)}.${cents}` : dollars.slice(0, 6);
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

function createPromoCodeSuffix() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
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
