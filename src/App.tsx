import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  CircleOff,
  ClipboardList,
  KeyRound,
  LogOut,
  MapPinned,
  Mail,
  Navigation,
  QrCode,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader } from "./components/ui";
import {
  completeAdminGoogleLogin,
  createIsochrone,
  loadDriverMap,
  loadDriverRoutes,
  loadOrderDetail,
  loadOrders,
  loadStoredSession,
  login,
  searchAccounts,
  startAdminGoogleLogin,
  storeSession,
  updateAccount,
} from "./lib/adminApi";
import type { Account, AccountBadge, AccountRole, DriverMapEntry, DriverRoute, IsochronePlot, LatLng, MedusaOrder, Session } from "./lib/types";
import { cx } from "./lib/classes";
import { hasGoogleMapsBrowserKey, loadGoogleMaps } from "./lib/googleMaps";
import { PromoToolsView } from "./PromoToolsView";

type View = "accounts" | "drivers" | "routes" | "orders" | "promo";

const views: Array<{ id: View; icon: ReactNode; label: string }> = [
  { id: "accounts", icon: <UserCog size={18} aria-hidden="true" />, label: "Accounts" },
  { id: "drivers", icon: <MapPinned size={18} aria-hidden="true" />, label: "Drivers" },
  { id: "routes", icon: <Route size={18} aria-hidden="true" />, label: "Routes" },
  { id: "orders", icon: <ClipboardList size={18} aria-hidden="true" />, label: "Orders" },
  { id: "promo", icon: <QrCode size={18} aria-hidden="true" />, label: "Promo" },
];

const roleOptions: AccountRole[] = ["admin", "driver", "inventory"];
const badgeOptions: AccountBadge[] = ["customer", "employee"];
const warehouseAddress = "13702 42nd St Tampa, FL, 33613";
const defaultRoundTripHours = 1;
const minRoundTripHours = 0.25;
const maxRoundTripHours = 3;
const isochroneSpeedMph = 30;

function App() {
  const [session, setSession] = useState<Session | null>(() => loadStoredSession());
  const [activeView, setActiveView] = useState<View>("accounts");

  function applySession(nextSession: Session | null) {
    setSession(nextSession);
    storeSession(nextSession);
  }

  if (!session) {
    return <LoginScreen onLogin={applySession} />;
  }

  return (
    <main className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-[var(--bb-line)] bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-[18px] bg-[var(--bb-charcoal)] text-[var(--bb-blaze)]">
              <ShieldCheck size={23} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">BayBlaze</p>
              <h1 className="truncate text-2xl font-black uppercase leading-tight">Admin</h1>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Badge tone="success">Admin</Badge>
            <Button aria-label="Sign out" size="icon" variant="secondary" onClick={() => applySession(null)}>
              <LogOut size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 md:grid-cols-[190px_minmax(0,1fr)] md:px-6 md:py-6">
        <aside className="hidden md:block">
          <nav className="sticky top-24 space-y-2" aria-label="Admin sections">
            {views.map((item) => (
              <button
                key={item.id}
                className={cx(
                  "flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-black transition",
                  activeView === item.id
                    ? "bg-white text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-soft)]"
                    : "text-[var(--bb-muted)] hover:bg-white/70",
                )}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-24">
          {activeView === "accounts" ? <AccountsView token={session.token} /> : null}
          {activeView === "drivers" ? <DriversView token={session.token} /> : null}
          {activeView === "routes" ? <RoutesView token={session.token} /> : null}
          {activeView === "orders" ? <OrdersView token={session.token} /> : null}
          {activeView === "promo" ? <PromoToolsView token={session.token} /> : null}
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--bb-line)] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(17,24,39,0.08)] backdrop-blur md:hidden">
        <nav className="grid grid-cols-5 gap-1" aria-label="Admin navigation">
          {views.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              className={cx(
                "grid min-h-13 place-items-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-black transition",
                activeView === item.id
                  ? "bg-[var(--bb-blaze-soft)] text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-soft)]"
                  : "text-[var(--bb-muted)]",
              )}
              onClick={() => setActiveView(item.id)}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </footer>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(() => window.location.pathname === "/auth/google/callback");
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.location.pathname !== "/auth/google/callback") {
      return;
    }

    completeAdminGoogleLogin(new URLSearchParams(window.location.search))
      .then((session) => {
        window.history.replaceState({}, "", "/");
        onLogin(session);
      })
      .catch((caught) => {
        window.history.replaceState({}, "", "/");
        setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
      })
      .finally(() => setGoogleLoading(false));
  }, [onLogin]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      onLogin(await login(email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle() {
    setGoogleLoading(true);
    setError("");

    try {
      await startAdminGoogleLogin();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center px-4 py-8">
      <Card elevated className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-[20px] bg-[var(--bb-charcoal)] text-[var(--bb-blaze)]">
            <ShieldCheck size={26} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">BayBlaze</p>
            <h1 className="text-3xl font-black uppercase leading-tight">Admin</h1>
          </div>
        </div>
        <p className="text-sm font-semibold leading-6 text-[var(--bb-muted)]">
          Use a BayBlaze employee account with the admin role.
        </p>

        {error ? <ErrorState>{error}</ErrorState> : null}

        <Button fullWidth loading={googleLoading} onClick={() => void loginWithGoogle()} variant="secondary">
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--bb-muted)]">
          <span className="h-px flex-1 bg-[var(--bb-line)]" />
          <span>Email</span>
          <span className="h-px flex-1 bg-[var(--bb-line)]" />
        </div>

        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <Input
            autoComplete="email"
            icon={<Mail size={18} aria-hidden="true" />}
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            required
            type="email"
            value={email}
          />
          <Input
            autoComplete="current-password"
            icon={<KeyRound size={18} aria-hidden="true" />}
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
          <Button fullWidth loading={loading} type="submit">
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}

function GoogleIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid size-5 place-items-center rounded-full border border-[var(--bb-line)] bg-white text-xs font-black text-[var(--bb-charcoal)]"
    >
      G
    </span>
  );
}

function AccountsView({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (search = query) => {
    setError("");
    setLoading(true);
    try {
      setAccounts((await searchAccounts(token, search)).accounts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account search failed.");
    } finally {
      setLoading(false);
    }
  }, [query, token]);

  async function patchAccount(account: Account, input: Parameters<typeof updateAccount>[2]) {
    setError("");
    setBusyUid(account.uid);
    try {
      const updated = (await updateAccount(token, account.uid, input)).account;
      setAccounts((items) => items.map((item) => (item.uid === updated.uid ? updated : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account update failed.");
    } finally {
      setBusyUid("");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(""), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void refresh(query); }}>
            <Input aria-label="Search accounts" icon={<Search size={18} aria-hidden="true" />} onChange={(event) => setQuery(event.target.value)} placeholder="Search email" value={query} />
            <Button aria-label="Search" size="icon" type="submit" variant="secondary">
              <Search size={18} aria-hidden="true" />
            </Button>
          </form>
        }
        eyebrow="Access"
        icon={<UserCog size={22} aria-hidden="true" />}
        title="Accounts"
        subtitle="Search BayBlaze accounts, set customer or employee badges, and grant employee roles."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {loading ? <LoadingState label="Loading accounts" /> : null}
      {!loading && accounts.length === 0 ? <EmptyState>No matching accounts.</EmptyState> : null}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.uid} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{account.displayName || account.email}</h3>
                <p className="truncate text-sm font-semibold text-[var(--bb-muted)]">{account.email}</p>
              </div>
              <Badge tone={account.disabled ? "danger" : "success"}>{account.disabled ? "Disabled" : "Active"}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-[var(--bb-line)] pt-3">
              {badgeOptions.map((badge) => {
                const active = account.badges.includes(badge);
                return (
                  <Button
                    key={badge}
                    loading={busyUid === account.uid}
                    onClick={() => {
                      const nextBadges: AccountBadge[] = [badge];
                      const nextRoles = badge === "employee" ? account.roles : [];
                      void patchAccount(account, { badges: nextBadges, roles: nextRoles });
                    }}
                    size="sm"
                    variant={active ? "primary" : "secondary"}
                  >
                    {active ? <Check size={15} aria-hidden="true" /> : null}
                    {badge}
                  </Button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((role) => {
                const active = account.roles.includes(role);
                const employee = account.badges.includes("employee");
                return (
                  <Button
                    key={role}
                    disabled={!employee}
                    loading={busyUid === account.uid}
                    onClick={() => {
                      const roles = active ? account.roles.filter((item) => item !== role) : [...account.roles, role];
                      void patchAccount(account, { badges: ["employee"], roles });
                    }}
                    size="sm"
                    variant={active ? "primary" : "secondary"}
                  >
                    {active ? <Check size={15} aria-hidden="true" /> : null}
                    {role}
                  </Button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                loading={busyUid === account.uid}
                onClick={() => void patchAccount(account, { settings: { ageVerificationDisabled: !account.settings.ageVerificationDisabled } })}
                variant={account.settings.ageVerificationDisabled ? "danger" : "quiet"}
              >
                <CircleOff size={16} aria-hidden="true" />
                Age check {account.settings.ageVerificationDisabled ? "off" : "on"}
              </Button>
              <Button
                loading={busyUid === account.uid}
                onClick={() => void patchAccount(account, { disabled: !account.disabled })}
                variant={account.disabled ? "secondary" : "danger"}
              >
                {account.disabled ? "Enable" : "Disable"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DriversView({ token }: { token: string }) {
  const [drivers, setDrivers] = useState<DriverMapEntry[]>([]);
  const [isochronePlot, setIsochronePlot] = useState<IsochronePlot | null>(null);
  const [isochroneHoursInput, setIsochroneHoursInput] = useState(String(defaultRoundTripHours));
  const [showIsochrone, setShowIsochrone] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isochroneLoading, setIsochroneLoading] = useState(false);
  const [error, setError] = useState("");
  const [isochroneError, setIsochroneError] = useState("");
  const parsedIsochroneHours = Number(isochroneHoursInput);
  const hasValidIsochroneHours = Number.isFinite(parsedIsochroneHours) && parsedIsochroneHours > 0;
  const isochroneHours = hasValidIsochroneHours
    ? clampNumber(parsedIsochroneHours, minRoundTripHours, maxRoundTripHours)
    : defaultRoundTripHours;
  const isochroneTravelMinutes = Math.round(isochroneHours * 60);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setDrivers((await loadDriverMap(token)).drivers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Driver map failed.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const recalculateIsochrone = useCallback(async (force = false) => {
    setIsochroneError("");
    if (!hasValidIsochroneHours) {
      return;
    }

    setIsochroneLoading(true);
    try {
      const payload = await createIsochrone(token, {
        force,
        origin: { address: warehouseAddress },
        speedMph: isochroneSpeedMph,
        travelMinutes: isochroneTravelMinutes,
      });
      setIsochronePlot(payload.plot);
      setShowIsochrone(true);
    } catch (caught) {
      setIsochroneError(caught instanceof Error ? caught.message : "Isochrone recalculation failed.");
    } finally {
      setIsochroneLoading(false);
    }
  }, [hasValidIsochroneHours, isochroneTravelMinutes, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => void recalculateIsochrone(), 600);
    return () => window.clearTimeout(timer);
  }, [recalculateIsochrone]);

  const radiusMiles = isochronePlot ? Math.round(isochronePlot.radiusMeters / 1609.344) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <div className="grid w-full gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] lg:w-[42rem]">
            <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--bb-line)] bg-white px-3 text-sm font-black shadow-[var(--bb-shadow-soft)]">
              <input
                checked={showIsochrone}
                className="size-4 accent-[var(--bb-blaze)]"
                onChange={(event) => setShowIsochrone(event.target.checked)}
                type="checkbox"
              />
              Isochrone
            </label>
            <label className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-[var(--bb-line)] bg-white px-3 text-sm font-black shadow-[var(--bb-shadow-soft)]">
              <span className="shrink-0">Round trip</span>
              <input
                aria-label="Isochrone round trip hours"
                className="min-w-0 flex-1 accent-[var(--bb-blaze)]"
                max={maxRoundTripHours}
                min={minRoundTripHours}
                onChange={(event) => setIsochroneHoursInput(event.target.value)}
                step={0.25}
                type="range"
                value={isochroneHours}
              />
              <input
                aria-label="Isochrone round trip hours value"
                className="h-9 w-18 rounded-xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-2 text-right text-sm font-black outline-none focus:border-[var(--bb-blaze)]"
                max={maxRoundTripHours}
                min={minRoundTripHours}
                onBlur={() => setIsochroneHoursInput(formatHours(isochroneHours))}
                onChange={(event) => setIsochroneHoursInput(event.target.value)}
                step="any"
                type="number"
                value={isochroneHoursInput}
              />
              <span className="shrink-0 text-xs uppercase text-[var(--bb-muted)]">hr</span>
              <span className="w-16 shrink-0 text-right text-xs uppercase text-[var(--bb-muted)]">
                {radiusMiles === null ? `${isochroneTravelMinutes} min` : `~${radiusMiles} mi`}
              </span>
            </label>
            <Button disabled={!hasValidIsochroneHours} loading={isochroneLoading} onClick={() => void recalculateIsochrone(true)} variant="secondary">
              <Navigation size={18} aria-hidden="true" />
              Recalculate
            </Button>
            <Button loading={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw size={18} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
        eyebrow="Live ops"
        icon={<MapPinned size={22} aria-hidden="true" />}
        title="Driver Map"
        subtitle="Live driver locations, vehicles, queues, and WH1 coverage."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {isochroneError ? <ErrorState>{isochroneError}</ErrorState> : null}
      {loading ? <LoadingState label="Loading drivers" /> : <DriverMap drivers={drivers} isochronePlot={isochronePlot} showIsochrone={showIsochrone} />}
      <div className="grid gap-3 lg:grid-cols-3">
        {drivers.map((driver) => (
          <Card key={driver.uid} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{driver.displayName}</h3>
                <p className="truncate text-sm font-semibold text-[var(--bb-muted)]">{driver.email}</p>
              </div>
              <Badge tone={driver.clockedIn ? "success" : "neutral"}>{driver.clockedIn ? "Clocked in" : "Offline"}</Badge>
            </div>
            <Metric label="Vehicle" value={driver.activeVehicle?.label || "None"} />
            <Metric label="Stops" value={String(driver.queue?.stopCount ?? 0)} />
            <Metric label="Location" value={driver.location ? `${driver.location.lat.toFixed(4)}, ${driver.location.lng.toFixed(4)}` : "No fix"} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function RoutesView({ token }: { token: string }) {
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setRoutes((await loadDriverRoutes(token)).routes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Driver routes failed.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <div className="space-y-4">
      <PageHeader
        actions={<Button loading={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw size={18} aria-hidden="true" />Refresh</Button>}
        eyebrow="Dispatch"
        icon={<Route size={22} aria-hidden="true" />}
        title="Driver Routes"
        subtitle="Queue order and route geometry resolved by the API."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {loading ? <LoadingState label="Loading routes" /> : null}
      {!loading && routes.length === 0 ? <EmptyState>No driver queues are available.</EmptyState> : null}
      <div className={cx("grid gap-4", routes.length === 1 ? "max-w-3xl" : "2xl:grid-cols-2")}>
        {routes.map((route) => (
          <Card key={route.uid} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">Driver route</h3>
                <p className="text-sm font-semibold text-[var(--bb-muted)]">{route.stops.length} stops</p>
              </div>
              <Badge tone="info">{route.activeOrderId || "No active order"}</Badge>
            </div>
            <RoutePlot points={route.stops.map((stop) => stop.position).filter(Boolean) as LatLng[]} />
            <div className="space-y-2">
              {route.stops.map((stop) => (
                <div key={`${route.uid}-${stop.orderId}`} className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">#{stop.index + 1} {stop.orderReference || stop.orderId}</p>
                    <Badge tone={stop.locked ? "warning" : "neutral"}>{stop.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">{stop.customerName}</p>
                  <p className="text-sm font-semibold text-[var(--bb-muted)]">{stop.customerAddress}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrdersView({ token }: { token: string }) {
  const [orders, setOrders] = useState<MedusaOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setOrders((await loadOrders(token)).orders);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Orders failed.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  async function openOrder(order: MedusaOrder) {
    const orderId = String(order.id || "");
    if (!orderId) return;

    setDetailLoading(true);
    setError("");
    try {
      setSelectedOrder(await loadOrderDetail(token, orderId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order detail failed.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <div className="space-y-4">
      <PageHeader
        actions={<Button loading={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw size={18} aria-hidden="true" />Refresh</Button>}
        eyebrow="Commerce"
        icon={<ClipboardList size={22} aria-hidden="true" />}
        title="Live Orders"
        subtitle="Newest orders and details through BayBlaze API."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {loading ? <LoadingState label="Loading orders" /> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3">
          {!loading && orders.length === 0 ? <EmptyState>No orders returned.</EmptyState> : null}
          {orders.map((order, index) => (
            <Card key={String(order.id || index)} className="cursor-pointer transition hover:border-[var(--bb-blaze)]" onClick={() => void openOrder(order)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-black">{readOrderLabel(order)}</h3>
                  <p className="truncate text-sm font-semibold text-[var(--bb-muted)]">{order.email || "No customer email"}</p>
                </div>
                <Badge tone="info">{formatMinorUnitMoney(order.total, order.currency_code)}</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Metric label="Payment" value={String(order.payment_status || "unknown")} />
                <Metric label="Fulfillment" value={String(order.fulfillment_status || "unknown")} />
                <Metric label="Created" value={formatDate(order.created_at)} />
              </div>
            </Card>
          ))}
        </div>
        <Card className="h-fit space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">Order Details</h3>
            {detailLoading ? <RefreshCw className="size-5 animate-spin text-[var(--bb-muted)]" aria-hidden="true" /> : null}
          </div>
          {selectedOrder ? (
            <OrderDetailSummary detail={selectedOrder} />
          ) : (
            <EmptyState title="Select an order">Details load from the API.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

function OrderDetailSummary({ detail }: { detail: Record<string, unknown> }) {
  const order = readOrderDetail(detail);
  const metadata = readRecord(order.metadata);
  const shippingAddress = readRecord(order.shipping_address);
  const items = readArray(order.items);
  const deliveryStatus = readText(
    metadata.bayblaze_delivery_status,
    metadata.delivery_status,
    metadata.driver_delivery_status,
    "Not started",
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Metric label="Customer" value={readText(order.email, "No email")} />
        <Metric label="Total" value={formatMinorUnitMoney(order.total, order.currency_code)} />
        <Metric label="Payment" value={readText(order.payment_status, "unknown")} />
        <Metric label="Fulfillment" value={readText(order.fulfillment_status, "unknown")} />
        <Metric label="Delivery" value={deliveryStatus} />
        <Metric label="Created" value={formatDate(order.created_at)} />
      </div>

      <section className="rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3">
        <p className="text-[11px] font-black uppercase text-[var(--bb-muted)]">Ship to</p>
        <p className="mt-1 text-sm font-black text-[var(--bb-charcoal)]">
          {formatRecipientName(shippingAddress, order.email)}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-5 text-[var(--bb-muted)]">
          {formatAddress(shippingAddress)}
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-black uppercase text-[var(--bb-muted)]">Items</p>
        {items.length === 0 ? (
          <EmptyState title="No items">This order detail did not include line items.</EmptyState>
        ) : (
          items.map((item, index) => {
            const record = readRecord(item);
            const title = readText(record.product_title, record.title, "Product");
            const variant = readText(record.variant_title, "Default");
            const quantity = typeof record.quantity === "number" ? record.quantity : 1;

            return (
              <div key={`${title}-${variant}-${index}`} className="rounded-2xl border border-[var(--bb-line)] bg-white px-3 py-2">
                <p className="font-black text-[var(--bb-charcoal)]">{title}</p>
                <p className="text-sm font-semibold text-[var(--bb-muted)]">
                  {variant} · Qty {quantity}
                </p>
              </div>
            );
          })
        )}
      </section>
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

function readOrderDetail(detail: Record<string, unknown>) {
  const nestedOrder = readRecord(detail.order);
  const nestedData = readRecord(detail.data);

  return Object.keys(nestedOrder).length > 0
    ? nestedOrder
    : Object.keys(nestedData).length > 0
      ? nestedData
      : detail;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function formatRecipientName(address: Record<string, unknown>, fallback: unknown) {
  const name = [address.first_name, address.last_name]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");

  return name || readText(fallback, "No recipient");
}

function formatAddress(address: Record<string, unknown>) {
  const line1 = readText(address.address_1);
  const line2 = readText(address.address_2);
  const cityStateZip = [
    readText(address.city),
    readText(address.province),
    readText(address.postal_code),
  ].filter(Boolean).join(", ");
  const country = readText(address.country_code).toUpperCase();
  const parts = [line1, line2, cityStateZip, country].filter(Boolean);

  return parts.length > 0 ? parts.join("\n") : "No shipping address";
}

function DriverMap({
  drivers,
  isochronePlot,
  showIsochrone,
}: {
  drivers: DriverMapEntry[];
  isochronePlot: IsochronePlot | null;
  showIsochrone: boolean;
}) {
  const mapRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;

    void renderGoogleDriverMap(node, drivers, showIsochrone ? isochronePlot : null);
  }, [drivers, isochronePlot, showIsochrone]);
  const positioned = drivers.filter((driver) => driver.location) as Array<DriverMapEntry & { location: LatLng }>;
  const visibleIsochrone = showIsochrone ? isochronePlot : null;

  if (positioned.length === 0 && !visibleIsochrone) {
    return <EmptyState title="No map geometry">Clocked-in driver locations and the isochrone polygon will appear here.</EmptyState>;
  }

  if (!hasGoogleMapsBrowserKey()) {
    return (
      <ErrorState>
        Set VITE_GOOGLE_MAPS_BROWSER_API_KEY on the admin app to render the Google Maps driver widget.
      </ErrorState>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative min-h-[420px]">
        <div ref={mapRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-4 top-4 rounded-2xl bg-white px-3 py-2 text-sm font-black shadow-[var(--bb-shadow-soft)]">
          {positioned.length} live
        </div>
        {visibleIsochrone ? (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl bg-white px-3 py-2 text-sm font-black shadow-[var(--bb-shadow-soft)]">
            {visibleIsochrone.travelMinutes} min round trip
          </div>
        ) : null}
      </div>
    </Card>
  );
}

async function renderGoogleDriverMap(container: HTMLDivElement, drivers: DriverMapEntry[], isochronePlot: IsochronePlot | null) {
  const maps = await loadGoogleMaps();
  const positioned = drivers.filter((driver) => driver.location) as Array<DriverMapEntry & { location: LatLng }>;

  if (positioned.length === 0 && !isochronePlot) {
    return;
  }

  const center = averageLatLng([
    ...positioned.map((driver) => driver.location),
    ...(isochronePlot ? [isochronePlot.center] : []),
  ]);
  const map = new maps.Map(container, {
    center,
    clickableIcons: false,
    fullscreenControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    zoom: positioned.length === 1 ? 14 : 11,
  });
  const bounds = new maps.LatLngBounds();
  const infoWindow = new maps.InfoWindow();

  if (isochronePlot) {
    const polygonPath = isochronePlot.polygon.map((point) => ({ lat: point.lat, lng: point.lng }));
    new maps.Polygon({
      clickable: false,
      fillColor: "#f26a1b",
      fillOpacity: 0.16,
      map,
      paths: polygonPath,
      strokeColor: "#c94d12",
      strokeOpacity: 0.9,
      strokeWeight: 2,
    });
    polygonPath.forEach((point) => bounds.extend(point));
    bounds.extend({ lat: isochronePlot.center.lat, lng: isochronePlot.center.lng });

    new maps.Marker({
      icon: {
        anchor: new maps.Point(8, 8),
        path: maps.SymbolPath.CIRCLE,
        fillColor: "#111111",
        fillOpacity: 1,
        scale: 6,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      map,
      position: { lat: isochronePlot.center.lat, lng: isochronePlot.center.lng },
      title: isochronePlot.center.address || "Isochrone origin",
    });
  }

  positioned.forEach((driver) => {
    const position = { lat: driver.location.lat, lng: driver.location.lng };
    const marker = new maps.Marker({
      icon: {
        anchor: new maps.Point(18, 18),
        path: maps.SymbolPath.CIRCLE,
        fillColor: driver.clockedIn ? "#2f8f46" : "#6d716b",
        fillOpacity: 1,
        scale: 10,
        strokeColor: "#ffffff",
        strokeWeight: 4,
      },
      label: {
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: "800",
        text: driver.displayName.slice(0, 1).toUpperCase(),
      },
      map,
      position,
      title: driver.displayName,
    });

    marker.addListener("click", () => {
      infoWindow.setContent([
        `<div style="font-family:Jost,Arial,sans-serif;min-width:190px;color:#111">`,
        `<strong style="font-size:15px">${escapeHtml(driver.displayName)}</strong>`,
        `<div style="margin-top:4px;color:#6d716b;font-weight:700">${escapeHtml(driver.email)}</div>`,
        `<div style="margin-top:8px;font-weight:800">${driver.clockedIn ? "Clocked in" : "Offline"}</div>`,
        `<div style="color:#6d716b;font-weight:700">Vehicle: ${escapeHtml(driver.activeVehicle?.label || "None")}</div>`,
        `<div style="color:#6d716b;font-weight:700">Stops: ${driver.queue?.stopCount ?? 0}</div>`,
        `</div>`,
      ].join(""));
      infoWindow.open({ anchor: marker, map });
    });

    bounds.extend(position);
  });

  if (positioned.length > 1 || isochronePlot) {
    map.fitBounds(bounds, 72);
  }
}

function averageLatLng(points: LatLng[]) {
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function RoutePlot({ points }: { points: LatLng[] }) {
  if (points.length === 0) {
    return <EmptyState title="No geocoded stops">The API could not resolve route geometry.</EmptyState>;
  }

  const bounds = getBounds(points);
  const projected = points.map((point) => project(point, bounds));

  return (
    <svg className="h-72 w-full rounded-[20px] border border-[var(--bb-line)] bg-[var(--bb-surface-warm)]" viewBox="0 0 100 100" role="img" aria-label="Driver route plot">
      <polyline points={projected.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#f26a1b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {projected.map((point, index) => (
        <g key={`${point.x}-${point.y}-${index}`}>
          <circle cx={point.x} cy={point.y} r="4" fill={index === 0 ? "#2f8f46" : "#111111"} stroke="#fff" strokeWidth="1.5" />
          <text x={point.x + 5} y={point.y + 1} fontSize="4" fontWeight="800" fill="#111111">{index + 1}</text>
        </g>
      ))}
    </svg>
  );
}

function getBounds(points: LatLng[]) {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPadding = Math.max((maxLat - minLat) * 0.18, 0.01);
  const lngPadding = Math.max((maxLng - minLng) * 0.18, 0.01);

  return {
    maxLat: maxLat + latPadding,
    maxLng: maxLng + lngPadding,
    minLat: minLat - latPadding,
    minLng: minLng - lngPadding,
  };
}

function project(point: LatLng, bounds: ReturnType<typeof getBounds>) {
  const width = bounds.maxLng - bounds.minLng || 1;
  const height = bounds.maxLat - bounds.minLat || 1;

  return {
    x: ((point.lng - bounds.minLng) / width) * 100,
    y: (1 - (point.lat - bounds.minLat) / height) * 100,
  };
}

function readOrderLabel(order: MedusaOrder) {
  const metadata = readRecord(order.metadata);
  const bayblazeReference = readText(
    order.orderReference,
    order.order_reference,
    order.reference,
    metadata.orderReference,
    metadata.order_reference,
    metadata.reference,
  );

  if (bayblazeReference) return bayblazeReference;
  if (order.display_id) return `Order #${order.display_id}`;
  if (order.id) return String(order.id);
  return "Order";
}

function formatMinorUnitMoney(value: unknown, currency: unknown) {
  if (typeof value !== "number") return "Total n/a";
  return new Intl.NumberFormat("en-US", {
    currency: typeof currency === "string" ? currency.toUpperCase() : "USD",
    style: "currency",
  }).format(value / 100);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatDate(value: unknown) {
  if (typeof value !== "string") return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default App;
