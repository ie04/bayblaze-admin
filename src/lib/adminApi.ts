import type {
  Account,
  AccountBadge,
  AccountRole,
  AdminPromoCode,
  AdminPromoCodeType,
  CoverageArea,
  CoverageAreaInput,
  DriverMapEntry,
  DriverRoute,
  IsochronePlot,
  MedusaOrder,
  Session,
} from "./types";

const apiBaseUrl = (import.meta.env.VITE_BAYBLAZE_API_URL || "https://api.bayblaze.net").replace(/\/$/, "");
const sessionKey = "bayblaze_admin_session";

type RequestOptions = {
  body?: unknown;
  method?: string;
  token?: string;
};

type AccountAuthResponse = {
  account: Account;
  session: { token: string };
};

type GoogleOAuthStartResponse = {
  authorizationUrl: string;
};

type PromoCodeInput = {
  code: string;
  codeType: AdminPromoCodeType;
  discountPercent?: number;
};

type PromoCodeUpdateInput = {
  code?: string;
  codeType?: AdminPromoCodeType;
  discountPercent?: number;
};

export function loadStoredSession(): Session | null {
  const raw = window.localStorage.getItem(sessionKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    window.localStorage.removeItem(sessionKey);
    return null;
  }
}

export function storeSession(session: Session | null) {
  if (!session) {
    window.localStorage.removeItem(sessionKey);
    return;
  }

  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

export async function login(email: string, password: string): Promise<Session> {
  const payload = await request<AccountAuthResponse>("/v1/auth/login", {
    body: { email: email.trim().toLowerCase(), password },
    method: "POST",
  });

  assertAdminAccount(payload.account);

  return {
    account: payload.account,
    token: payload.session.token,
  };
}

export async function startAdminGoogleLogin() {
  const result = await request<GoogleOAuthStartResponse>("/v1/auth/google/start", {
    body: {
      callbackUrl: getGoogleCallbackUrl(),
      redirectTo: "/",
    },
    method: "POST",
  });

  window.location.assign(result.authorizationUrl);
}

export async function completeAdminGoogleLogin(searchParams: URLSearchParams): Promise<Session> {
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    throw new Error("Google did not return a complete sign-in response.");
  }

  const payload = await request<AccountAuthResponse>("/v1/auth/google/callback", {
    body: {
      callbackUrl: getGoogleCallbackUrl(),
      code,
      state,
    },
    method: "POST",
  });
  assertAdminAccount(payload.account);

  return {
    account: payload.account,
    token: payload.session.token,
  };
}

function assertAdminAccount(account: Account) {
  if (!account.badges.includes("employee") || !account.roles.includes("admin")) {
    throw new Error("This BayBlaze account does not have admin access.");
  }
}

function getGoogleCallbackUrl() {
  return `${window.location.origin}/auth/google/callback`;
}

export function searchAccounts(token: string, query: string) {
  return request<{ accounts: Account[] }>(`/v1/admin/accounts?q=${encodeURIComponent(query)}&limit=50`, { token });
}

export function updateAccount(token: string, uid: string, input: {
  badges?: AccountBadge[];
  disabled?: boolean;
  roles?: AccountRole[];
  settings?: { ageVerificationDisabled?: boolean };
}) {
  return request<{ account: Account }>(`/v1/admin/accounts/${encodeURIComponent(uid)}`, {
    body: input,
    method: "PATCH",
    token,
  });
}

export function loadDriverMap(token: string) {
  return request<{ drivers: DriverMapEntry[] }>("/v1/admin/drivers/map", { token });
}

export function loadDriverRoutes(token: string) {
  return request<{ routes: DriverRoute[] }>("/v1/admin/drivers/routes", { token });
}

export function createIsochrone(token: string, input: {
  force?: boolean;
  origin: { address?: string; lat?: number; lng?: number };
  speedMph?: number;
  travelMinutes: number;
}) {
  return request<{ plot: IsochronePlot }>("/v1/admin/isochrones", {
    body: input,
    method: "POST",
    token,
  });
}

export function loadCoverageAreas(token: string) {
  return request<{ coverageAreas: CoverageArea[] }>("/v1/admin/coverage-areas", { token });
}

export function createCoverageArea(token: string, input: CoverageAreaInput) {
  return request<{ coverageArea: CoverageArea }>("/v1/admin/coverage-areas", {
    body: input,
    method: "POST",
    token,
  });
}

export function updateCoverageArea(token: string, coverageAreaId: string, input: CoverageAreaInput) {
  return request<{ coverageArea: CoverageArea }>(`/v1/admin/coverage-areas/${encodeURIComponent(coverageAreaId)}`, {
    body: input,
    method: "PATCH",
    token,
  });
}

export function deleteCoverageArea(token: string, coverageAreaId: string) {
  return request<{ ok: true }>(`/v1/admin/coverage-areas/${encodeURIComponent(coverageAreaId)}`, {
    method: "DELETE",
    token,
  });
}

export function regenerateCoverageArea(token: string, coverageAreaId: string) {
  return request<{ coverageArea: CoverageArea }>(`/v1/admin/coverage-areas/${encodeURIComponent(coverageAreaId)}/regenerate`, {
    method: "POST",
    token,
  });
}

export function regenerateDueCoverageAreas(token: string) {
  return request<{ failed: Array<{ id: string; message: string }>; regenerated: CoverageArea[] }>("/v1/admin/coverage-areas/regenerate-due", {
    method: "POST",
    token,
  });
}

export async function loadOrders(token: string) {
  const payload = await request<Record<string, unknown>>("/v1/admin/orders?limit=100&order=-created_at", { token });
  const orders = readOrderArray(payload);
  return { orders, raw: payload };
}

export function loadOrderDetail(token: string, orderId: string) {
  return request<Record<string, unknown>>(`/v1/admin/orders/${encodeURIComponent(orderId)}`, { token });
}

export function deleteOrder(token: string, orderId: string, input: { releaseStock: boolean }) {
  return request<{
    deleted: true;
    orderId: string;
    orderReference?: string;
    releasedItems?: Array<{ nextQuantity: number; quantity: number; variantId: string }>;
    releasedStock: boolean;
  }>(`/v1/admin/orders/${encodeURIComponent(orderId)}`, {
    body: input,
    method: "DELETE",
    token,
  });
}

export function loadPromoCodes(token: string) {
  return request<{ promoCodes: AdminPromoCode[] }>("/v1/admin/promo-codes", { token });
}

export function createPromoCode(token: string, input: PromoCodeInput) {
  return request<{ promoCode: AdminPromoCode }>("/v1/admin/promo-codes", {
    body: input,
    method: "POST",
    token,
  });
}

export function updatePromoCode(
  token: string,
  code: string,
  input: PromoCodeUpdateInput,
) {
  return request<{ promoCode: AdminPromoCode }>(`/v1/admin/promo-codes/${encodeURIComponent(code)}`, {
    body: input,
    method: "PATCH",
    token,
  });
}

export function deletePromoCode(token: string, code: string) {
  return request<{ ok: true }>(`/v1/admin/promo-codes/${encodeURIComponent(code)}`, {
    method: "DELETE",
    token,
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method || "GET",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, response.status));
  }

  return payload as T;
}

function readErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return `BayBlaze API request failed with HTTP ${status}.`;
}

function readOrderArray(payload: Record<string, unknown>): MedusaOrder[] {
  if (Array.isArray(payload.orders)) return payload.orders as MedusaOrder[];
  if (Array.isArray(payload.data)) return payload.data as MedusaOrder[];
  if (Array.isArray(payload.items)) return payload.items as MedusaOrder[];
  return [];
}
