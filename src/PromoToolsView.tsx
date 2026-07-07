import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, Plus, Printer, QrCode, RefreshCw, Save, Trash2 } from "lucide-react";
import QRCode from "qrcode";

import { createPromoCode, deletePromoCode, loadPromoCodes, updatePromoCode } from "./lib/adminApi";
import type { AdminPromoCode } from "./lib/types";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader } from "./components/ui";

type CopyState = "idle" | "copied" | "failed";

type PromoCard = {
  code: string;
  discountPercent: string;
  id: string;
  originalCode?: string;
  persisted: boolean;
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
        code,
        discountPercent: "30",
        id: crypto.randomUUID(),
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
        eyebrow="Growth"
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
  const promoUrl = useMemo(() => buildPromoUrl(normalizedCode), [normalizedCode]);
  const dirty = !promo.persisted || normalizedCode !== promo.originalCode || String(discountPercent) !== promo.discountPercent.trim();

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
    try {
      setSaving(true);
      setActionError("");
      const input = { code: normalizedCode, discountPercent };
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
              {hidden ? "Details hidden" : `${discountPercent}% off${promo.persisted ? "" : " draft"}`}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={hidden ? "neutral" : promo.persisted ? "brand" : "warning"}>{hidden ? "Hidden" : promo.persisted ? "Saved" : "Draft"}</Badge>
          <Button aria-label={`Delete ${normalizedCode}`} disabled={deleting || saving} onClick={() => void deletePromo()} size="icon" variant="danger">
            <Trash2 size={17} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!hidden ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Promo code"
                onChange={(event) => onUpdate({ code: normalizePromoCode(event.target.value) })}
                value={promo.code}
              />
              <Input
                label="Discount percent"
                max="100"
                min="1"
                onChange={(event) => onUpdate({ discountPercent: event.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
                type="number"
                value={promo.discountPercent}
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
              </div>
            ) : null}

            {renderError ? <ErrorState>{renderError}</ErrorState> : null}
            {actionError ? <ErrorState>{actionError}</ErrorState> : null}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <Button disabled={saving || deleting} onClick={() => void savePromo()} variant={dirty ? "primary" : "secondary"}>
                <Save size={17} aria-hidden="true" />
                {saving ? "Saving" : promo.persisted ? "Save" : "Create"}
              </Button>
              <Button onClick={generateReplacementCode} variant="secondary">
                <RefreshCw size={17} aria-hidden="true" />
                Generate
              </Button>
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
              <h3 className="mt-3 text-2xl font-black leading-tight">{discountPercent}% Off</h3>
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
  return {
    code: promoCode.code,
    discountPercent: String(promoCode.discountPercent),
    id: promoCode.code,
    originalCode: promoCode.code,
    persisted: true,
    usedCount: promoCode.usedCount,
  };
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
