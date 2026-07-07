import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Printer, QrCode, RefreshCw } from "lucide-react";
import QRCode from "qrcode";

import { Badge, Button, Card, ErrorState, Input, PageHeader } from "./components/ui";

type CopyState = "idle" | "copied" | "failed";

const defaultStorefrontOrigin = "https://bayblaze.net";
const defaultPromoCode = "first30";
const qrCanvasSize = 1200;
const qrBorderRadius = 28;
const qrLogoMaxSize = 330;
const qrLogoHorizontalPadding = 12;
const qrLogoPath = "/icons/bayblaze-flame-qr.png";

export function PromoToolsView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [code, setCode] = useState(defaultPromoCode);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [discountPercent, setDiscountPercent] = useState("30");
  const [landingPath, setLandingPath] = useState("/");
  const [origin, setOrigin] = useState(defaultStorefrontOrigin);
  const [renderError, setRenderError] = useState("");

  const normalizedCode = normalizePromoCode(code) || defaultPromoCode;
  const promoUrl = useMemo(() => {
    return buildPromoUrl({ code: normalizedCode, landingPath, origin });
  }, [landingPath, normalizedCode, origin]);

  useEffect(() => {
    renderPromoQr(canvasRef.current, promoUrl)
      .then(() => setRenderError(""))
      .catch((caught) => {
        setRenderError(caught instanceof Error ? caught.message : "Could not render the QR code.");
      });
  }, [promoUrl]);

  function generateCode() {
    setCode(`BB${createPromoCodeSuffix()}`);
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

  function printQr() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Growth"
        icon={<QrCode size={22} aria-hidden="true" />}
        title="Promo QR"
        subtitle="Generate storefront promo links and QR assets for BayBlaze campaigns."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              label="Storefront origin"
              onChange={(event) => setOrigin(event.target.value)}
              value={origin}
            />
            <Input
              label="Landing path"
              onChange={(event) => setLandingPath(event.target.value)}
              value={landingPath}
            />
            <Input
              label="Promo code"
              onChange={(event) => setCode(normalizePromoCode(event.target.value))}
              value={code}
            />
            <Input
              label="Discount percent"
              min="0"
              onChange={(event) => setDiscountPercent(event.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
              type="number"
              value={discountPercent}
            />
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Promo link</p>
            <div className="break-all rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-4 py-3 text-sm font-bold leading-6 text-[var(--bb-charcoal)]">
              {promoUrl}
            </div>
          </div>

          {renderError ? <ErrorState>{renderError}</ErrorState> : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button onClick={generateCode} variant="secondary">
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
            <Button onClick={printQr} variant="secondary">
              <Printer size={17} aria-hidden="true" />
              Print
            </Button>
          </div>

          <div className="grid gap-3 border-t border-[var(--bb-line)] pt-4 sm:grid-cols-3">
            <Metric label="Query" value={`?promo=${normalizedCode}`} />
            <Metric label="QR size" value="1200px PNG" />
            <Metric label="Campaign" value={`${discountPercent || "0"}% off`} />
          </div>
        </Card>

        <Card className="bayblaze-promo-qr-print h-fit space-y-4 text-center xl:sticky xl:top-24">
          <div>
            <Badge tone="brand">BayBlaze</Badge>
            <h3 className="mt-3 text-2xl font-black leading-tight">
              {discountPercent || "0"}% Off
            </h3>
            <p className="text-sm font-semibold text-[var(--bb-muted)]">
              Promo code {normalizedCode}
            </p>
          </div>

          <div className="mx-auto grid h-[220px] w-[220px] max-w-full place-items-center overflow-hidden bg-white">
            <canvas
              aria-label="BayBlaze promo QR code"
              className="block h-[220px] w-[220px] max-w-full rounded-[28px]"
              height={qrCanvasSize}
              ref={canvasRef}
              width={qrCanvasSize}
            />
          </div>

          <p className="mx-auto max-w-72 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
            Scan to open the BayBlaze storefront with this promo applied.
          </p>
          <p className="break-all text-[11px] font-semibold leading-5 text-[var(--bb-muted)]">
            {promoUrl}
          </p>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--bb-line)] bg-white px-3 py-2">
      <p className="text-[11px] font-black uppercase text-[var(--bb-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function buildPromoUrl({ code, landingPath, origin }: { code: string; landingPath: string; origin: string }) {
  const url = new URL(normalizeLandingPath(landingPath), normalizeOrigin(origin));
  url.searchParams.set("promo", code);
  return url.toString();
}

function normalizePromoCode(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function normalizeLandingPath(path: string) {
  const trimmedPath = path.trim();

  if (!trimmedPath || trimmedPath.startsWith("//")) {
    return "/";
  }

  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    try {
      const url = new URL(trimmedPath);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return "/";
    }
  }

  return trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
}

function normalizeOrigin(origin: string) {
  const trimmedOrigin = origin.trim();

  if (!trimmedOrigin) {
    return defaultStorefrontOrigin;
  }

  try {
    return new URL(trimmedOrigin).origin;
  } catch {
    try {
      return new URL(`https://${trimmedOrigin}`).origin;
    } catch {
      return defaultStorefrontOrigin;
    }
  }
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

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the QR canvas.");
  }

  applyCanvasBorderRadius(canvas, context, qrBorderRadius);

  const centeredLogo = await buildCenteredLogoCanvas(qrLogoPath);
  const logoX = (qrCanvasSize - centeredLogo.width) / 2;
  const logoY = (qrCanvasSize - centeredLogo.height) / 2;

  context.drawImage(centeredLogo, logoX, logoY);
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

function applyCanvasBorderRadius(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, radius: number) {
  const sourceCanvas = document.createElement("canvas");
  const sourceContext = sourceCanvas.getContext("2d");

  if (!sourceContext) {
    return;
  }

  sourceCanvas.width = canvas.width;
  sourceCanvas.height = canvas.height;
  sourceContext.drawImage(canvas, 0, 0);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.beginPath();
  context.roundRect(0, 0, canvas.width, canvas.height, radius);
  context.clip();
  context.drawImage(sourceCanvas, 0, 0);
  context.restore();
}
