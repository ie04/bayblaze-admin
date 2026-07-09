import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  CircleOff,
  Clock,
  ClipboardList,
  KeyRound,
  LogOut,
  MapPinned,
  Mail,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  X,
} from "lucide-react";

import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Textarea } from "./components/ui";
import {
  completeAdminGoogleLogin,
  createCoverageArea,
  deleteCoverageArea,
  deleteOrder,
  loadDriverMap,
  loadDriverRoutes,
  loadCoverageAreas,
  loadOrderDetail,
  loadOrders,
  loadStoredSession,
  login,
  regenerateCoverageArea,
  regenerateDueCoverageAreas,
  searchAccounts,
  startAdminGoogleLogin,
  storeSession,
  updateAccount,
  updateCoverageArea,
} from "./lib/adminApi";
import type { Account, AccountBadge, AccountRole, CoverageArea, CoverageAreaInput, DriverMapEntry, DriverRoute, LatLng, MedusaOrder, Session } from "./lib/types";
import { cx } from "./lib/classes";
import { hasGoogleMapsBrowserKey, loadGoogleMaps } from "./lib/googleMaps";
import { PromoToolsView } from "./PromoToolsView";

type View = "accounts" | "map" | "routes" | "orders" | "promo";
type OrderStatusDisplay = {
  cancelled: boolean;
  deleted: boolean;
  label: "FULFILLED" | "CANCELLED" | "DELETED";
  tone: "success" | "danger" | "neutral";
};

const views: Array<{ id: View; icon: ReactNode; label: string }> = [
  { id: "accounts", icon: <UserCog size={18} aria-hidden="true" />, label: "Accounts" },
  { id: "map", icon: <MapPinned size={18} aria-hidden="true" />, label: "Map" },
  { id: "routes", icon: <Route size={18} aria-hidden="true" />, label: "Routes" },
  { id: "orders", icon: <ClipboardList size={18} aria-hidden="true" />, label: "Orders" },
  { id: "promo", icon: <QrCode size={18} aria-hidden="true" />, label: "Promo" },
];

const roleOptions: AccountRole[] = ["admin", "driver", "inventory"];
const badgeOptions: AccountBadge[] = ["customer", "employee"];
const defaultCoverageForm: CoverageAreaForm = {
  active: true,
  binarySearchIterations: "5",
  description: "",
  intervalHours: "",
  label: "",
  maxDriveTimeMinutes: "30",
  nextRunAt: "",
  sampleBearings: "24",
  scheduleEnabled: false,
  speedMph: "30",
  warehouseAddress: "13702 42nd St Tampa, FL, 33613",
  warehouseId: "WH1",
  warehouseLabel: "BayBlaze Warehouse 1",
};

type CoverageAreaForm = {
  active: boolean;
  binarySearchIterations: string;
  description: string;
  intervalHours: string;
  label: string;
  maxDriveTimeMinutes: string;
  nextRunAt: string;
  sampleBearings: string;
  scheduleEnabled: boolean;
  speedMph: string;
  warehouseAddress: string;
  warehouseId: string;
  warehouseLabel: string;
};

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
          {activeView === "map" ? <MapView token={session.token} /> : null}
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
  const [expandedAccountUids, setExpandedAccountUids] = useState<Set<string>>(() => new Set());
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

  function toggleExpandedAccount(uid: string) {
    setExpandedAccountUids((current) => {
      const next = new Set(current);

      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }

      return next;
    });
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
        icon={<UserCog size={22} aria-hidden="true" />}
        title="Accounts"
        subtitle="Search BayBlaze accounts, set customer or employee badges, and grant employee roles."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {loading ? <LoadingState label="Loading accounts" /> : null}
      {!loading && accounts.length === 0 ? <EmptyState>No matching accounts.</EmptyState> : null}
      <div className="grid gap-3">
        {accounts.map((account) => {
          const expanded = expandedAccountUids.has(account.uid);
          const roleSummary = account.roles.length > 0 ? account.roles.join(", ") : "No employee roles";

          return (
            <Card key={account.uid} className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleExpandedAccount(account.uid)} type="button">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]">
                    {expanded ? <ChevronDown size={20} aria-hidden="true" /> : <ChevronRight size={20} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xl font-black text-[var(--bb-charcoal)]">{account.displayName || account.email}</span>
                    <span className="block truncate text-sm font-semibold text-[var(--bb-muted)]">{account.email}</span>
                  </span>
                </button>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge tone={account.disabled ? "danger" : "success"}>{account.disabled ? "Disabled" : "Active"}</Badge>
                  {account.badges.map((badge) => <Badge key={badge} tone="info">{badge}</Badge>)}
                </div>
              </div>

              {!expanded ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric label="Roles" value={roleSummary} />
                  <Metric label="Age Check" value={account.settings.ageVerificationDisabled ? "Off" : "On"} />
                  <Metric label="Status" value={account.disabled ? "Disabled" : "Active"} />
                </div>
              ) : null}

              {expanded ? (
                <div className="space-y-3 border-t border-[var(--bb-line)] pt-3">
                  <div className="flex flex-wrap gap-2">
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
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MapView({ token }: { token: string }) {
  const [drivers, setDrivers] = useState<DriverMapEntry[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [selectedCoverageAreaId, setSelectedCoverageAreaId] = useState<string | null>(null);
  const [coverageForm, setCoverageForm] = useState<CoverageAreaForm>(defaultCoverageForm);
  const [coverageEditorOpen, setCoverageEditorOpen] = useState(false);
  const [showCoverage, setShowCoverage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [coverageError, setCoverageError] = useState("");
  const selectedCoverageArea = coverageAreas.find((coverageArea) => coverageArea.id === selectedCoverageAreaId) ?? null;

  const refresh = useCallback(async (preferredCoverageAreaId?: string | null) => {
    setError("");
    setLoading(true);
    try {
      const [driverMapPayload, coveragePayload] = await Promise.all([
        loadDriverMap(token),
        loadCoverageAreas(token),
      ]);
      setDrivers(driverMapPayload.drivers);
      setCoverageAreas(coveragePayload.coverageAreas);
      const nextSelectedCoverageArea =
        coveragePayload.coverageAreas.find((coverageArea) => coverageArea.id === preferredCoverageAreaId) ??
        coveragePayload.coverageAreas[0] ??
        null;
      setSelectedCoverageAreaId(nextSelectedCoverageArea?.id ?? null);
      setCoverageForm(nextSelectedCoverageArea ? formFromCoverageArea(nextSelectedCoverageArea) : defaultCoverageForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Map failed.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function updateCoverageForm(field: keyof CoverageAreaForm, value: string | boolean) {
    setCoverageForm((current) => ({ ...current, [field]: value }));
  }

  function openCoverageEditor(coverageArea: CoverageArea | null) {
    setSelectedCoverageAreaId(coverageArea?.id ?? null);
    setCoverageForm(coverageArea ? formFromCoverageArea(coverageArea) : defaultCoverageForm);
    setCoverageEditorOpen(true);
  }

  async function saveCoverageArea() {
    setCoverageError("");
    setCoverageLoading(true);
    try {
      const input = coverageInputFromForm(coverageForm);
      const payload = selectedCoverageArea
        ? await updateCoverageArea(token, selectedCoverageArea.id, input)
        : await createCoverageArea(token, input);
      await refresh(payload.coverageArea.id);
      setSelectedCoverageAreaId(payload.coverageArea.id);
      setCoverageEditorOpen(false);
      setShowCoverage(true);
    } catch (caught) {
      setCoverageError(caught instanceof Error ? caught.message : "Coverage area save failed.");
    } finally {
      setCoverageLoading(false);
    }
  }

  async function regenerateSelectedCoverageArea(coverageAreaId: string) {
    setCoverageError("");
    setRegeneratingId(coverageAreaId);
    try {
      const payload = await regenerateCoverageArea(token, coverageAreaId);
      setCoverageAreas((current) => current.map((coverageArea) => coverageArea.id === coverageAreaId ? payload.coverageArea : coverageArea));
      if (selectedCoverageAreaId === coverageAreaId) {
        setCoverageForm(formFromCoverageArea(payload.coverageArea));
      }
      setShowCoverage(true);
    } catch (caught) {
      setCoverageError(caught instanceof Error ? caught.message : "Coverage regeneration failed.");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function regenerateDueCoverage() {
    setCoverageError("");
    setCoverageLoading(true);
    try {
      const payload = await regenerateDueCoverageAreas(token);
      await refresh();
      if (payload.failed.length > 0) {
        setCoverageError(`${payload.failed.length} scheduled coverage area could not regenerate.`);
      }
    } catch (caught) {
      setCoverageError(caught instanceof Error ? caught.message : "Scheduled regeneration failed.");
    } finally {
      setCoverageLoading(false);
    }
  }

  async function removeSelectedCoverageArea() {
    if (!selectedCoverageArea) return;

    setCoverageError("");
    setCoverageLoading(true);
    try {
      await deleteCoverageArea(token, selectedCoverageArea.id);
      setSelectedCoverageAreaId(null);
      setCoverageForm(defaultCoverageForm);
      setCoverageEditorOpen(false);
      await refresh(null);
    } catch (caught) {
      setCoverageError(caught instanceof Error ? caught.message : "Coverage area delete failed.");
    } finally {
      setCoverageLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[34rem]">
            <Button loading={coverageLoading} onClick={() => void regenerateDueCoverage()} variant="secondary">
              <Clock size={18} aria-hidden="true" />
              Due
            </Button>
            <Button loading={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw size={18} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
        icon={<MapPinned size={22} aria-hidden="true" />}
        title="Map"
        subtitle="Live drivers, delivery queues, and operational coverage zones."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {coverageError ? <ErrorState>{coverageError}</ErrorState> : null}
      {loading ? <LoadingState label="Loading map" /> : (
        <DriverMap
          coverageAreas={coverageAreas.filter((coverageArea) => coverageArea.active)}
          drivers={drivers}
          onShowCoverageChange={setShowCoverage}
          showCoverage={showCoverage}
        />
      )}
      <div className="grid gap-4">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Coverage Areas</h3>
              <p className="text-sm font-semibold text-[var(--bb-muted)]">{coverageAreas.length} configured zones</p>
            </div>
            <Button
              onClick={() => openCoverageEditor(null)}
              variant="secondary"
            >
              <Plus size={18} aria-hidden="true" />
              New
            </Button>
          </div>
          {coverageAreas.length === 0 ? <EmptyState title="No coverage areas">Create the first delivery zone.</EmptyState> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {coverageAreas.map((coverageArea) => (
              <section
                key={coverageArea.id}
                className={cx(
                  "rounded-2xl border bg-[var(--bb-surface-warm)] p-3 text-left transition",
                  selectedCoverageAreaId === coverageArea.id && coverageEditorOpen ? "border-[var(--bb-blaze)]" : "border-[var(--bb-line)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black">{coverageArea.label}</p>
                    <p className="truncate text-sm font-semibold text-[var(--bb-muted)]">{coverageArea.warehouse.label}</p>
                  </div>
                  <Badge tone={coverageArea.active ? "success" : "neutral"}>{coverageArea.active ? "Active" : "Off"}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Metric label="Drive" value={`${coverageArea.maxDriveTimeMinutes} min`} />
                  <Metric label="Points" value={String(Math.max(coverageArea.polygon.length - 1, 0))} />
                  <Metric label="Radius" value={formatMiles(coverageArea.radiusMeters)} />
                </div>
                {coverageArea.lastGenerationError ? (
                  <p className="mt-3 rounded-2xl border border-[var(--bb-danger-soft)] bg-white px-3 py-2 text-sm font-bold text-[var(--bb-danger-strong)]">
                    {coverageArea.lastGenerationError}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => openCoverageEditor(coverageArea)} size="sm" variant="secondary">
                    <Pencil size={16} aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    loading={regeneratingId === coverageArea.id}
                    onClick={() => void regenerateSelectedCoverageArea(coverageArea.id)}
                    size="sm"
                    variant="quiet"
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Regenerate
                  </Button>
                </div>
              </section>
            ))}
          </div>
        </Card>
      </div>
      {coverageEditorOpen ? (
        <CoverageEditorDialog
          coverageArea={selectedCoverageArea}
          form={coverageForm}
          loading={coverageLoading}
          onChange={updateCoverageForm}
          onClose={() => setCoverageEditorOpen(false)}
          onDelete={() => void removeSelectedCoverageArea()}
          onRegenerate={() => selectedCoverageArea ? void regenerateSelectedCoverageArea(selectedCoverageArea.id) : undefined}
          onSave={() => void saveCoverageArea()}
          regenerating={regeneratingId === selectedCoverageArea?.id}
        />
      ) : null}
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

function CoverageAreaFormFields({
  form,
  onChange,
}: {
  form: CoverageAreaForm;
  onChange: (field: keyof CoverageAreaForm, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-3 text-sm font-black">
        <input
          checked={form.active}
          className="size-4 accent-[var(--bb-blaze)]"
          onChange={(event) => onChange("active", event.target.checked)}
          type="checkbox"
        />
        Active
      </label>
      <Input label="Label" onChange={(event) => onChange("label", event.target.value)} value={form.label} />
      <Textarea label="Description" onChange={(event) => onChange("description", event.target.value)} value={form.description} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Warehouse ID" onChange={(event) => onChange("warehouseId", event.target.value)} value={form.warehouseId} />
        <Input label="Warehouse Label" onChange={(event) => onChange("warehouseLabel", event.target.value)} value={form.warehouseLabel} />
      </div>
      <Input label="Warehouse Address" onChange={(event) => onChange("warehouseAddress", event.target.value)} value={form.warehouseAddress} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Max Drive Minutes" min="1" onChange={(event) => onChange("maxDriveTimeMinutes", event.target.value)} type="number" value={form.maxDriveTimeMinutes} />
        <Input label="Speed MPH" min="5" onChange={(event) => onChange("speedMph", event.target.value)} type="number" value={form.speedMph} />
        <Input label="Polygon Points" min="8" onChange={(event) => onChange("sampleBearings", event.target.value)} type="number" value={form.sampleBearings} />
        <Input label="Street Detail" min="3" onChange={(event) => onChange("binarySearchIterations", event.target.value)} type="number" value={form.binarySearchIterations} />
      </div>
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-3 text-sm font-black">
        <input
          checked={form.scheduleEnabled}
          className="size-4 accent-[var(--bb-blaze)]"
          onChange={(event) => onChange("scheduleEnabled", event.target.checked)}
          type="checkbox"
        />
        Auto Regenerate
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Interval Hours" min="1" onChange={(event) => onChange("intervalHours", event.target.value)} type="number" value={form.intervalHours} />
        <Input label="Next Run ISO" onChange={(event) => onChange("nextRunAt", event.target.value)} placeholder="2026-07-09T20:00:00Z" value={form.nextRunAt} />
      </div>
    </div>
  );
}

function CoverageEditorDialog({
  coverageArea,
  form,
  loading,
  onChange,
  onClose,
  onDelete,
  onRegenerate,
  onSave,
  regenerating,
}: {
  coverageArea: CoverageArea | null;
  form: CoverageAreaForm;
  loading: boolean;
  onChange: (field: keyof CoverageAreaForm, value: string | boolean) => void;
  onClose: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  regenerating: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 backdrop-blur-sm sm:place-items-center sm:p-6">
      <section className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-auto rounded-[20px] border border-[var(--bb-line)] bg-white p-4 shadow-[var(--bb-shadow-card)] md:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-black">{coverageArea ? "Edit Coverage" : "Create Coverage"}</h3>
            <p className="truncate text-sm font-semibold text-[var(--bb-muted)]">{coverageArea ? coverageArea.id : "New zone"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={form.active ? "success" : "neutral"}>{form.active ? "Active" : "Off"}</Badge>
            <Button aria-label="Close coverage editor" onClick={onClose} size="icon" variant="ghost">
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>
        <CoverageAreaFormFields form={form} onChange={onChange} />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button loading={loading} onClick={onSave}>
            <Save size={18} aria-hidden="true" />
            Save
          </Button>
          <Button disabled={!coverageArea} loading={regenerating} onClick={onRegenerate} variant="secondary">
            <RefreshCw size={18} aria-hidden="true" />
            Regenerate
          </Button>
          <Button disabled={!coverageArea} onClick={onDelete} variant="danger">
            <Trash2 size={18} aria-hidden="true" />
            Delete
          </Button>
        </div>
      </section>
    </div>
  );
}

function formFromCoverageArea(coverageArea: CoverageArea): CoverageAreaForm {
  return {
    active: coverageArea.active,
    binarySearchIterations: String(coverageArea.granularity.binarySearchIterations),
    description: coverageArea.description,
    intervalHours: coverageArea.schedule.intervalHours === null ? "" : String(coverageArea.schedule.intervalHours),
    label: coverageArea.label,
    maxDriveTimeMinutes: String(coverageArea.maxDriveTimeMinutes),
    nextRunAt: coverageArea.schedule.nextRunAt ?? "",
    sampleBearings: String(coverageArea.granularity.sampleBearings),
    scheduleEnabled: coverageArea.schedule.enabled,
    speedMph: String(coverageArea.speedMph),
    warehouseAddress: coverageArea.warehouse.address,
    warehouseId: coverageArea.warehouse.warehouseId,
    warehouseLabel: coverageArea.warehouse.label,
  };
}

function coverageInputFromForm(form: CoverageAreaForm): CoverageAreaInput {
  return {
    active: form.active,
    description: form.description,
    granularity: {
      binarySearchIterations: readPositiveInteger(form.binarySearchIterations, 5),
      sampleBearings: readPositiveInteger(form.sampleBearings, 24),
    },
    label: form.label,
    maxDriveTimeMinutes: readPositiveNumber(form.maxDriveTimeMinutes, 30),
    schedule: {
      enabled: form.scheduleEnabled,
      intervalHours: form.intervalHours.trim() ? readPositiveInteger(form.intervalHours, 24) : null,
      nextRunAt: form.nextRunAt.trim() || null,
    },
    speedMph: readPositiveNumber(form.speedMph, 30),
    warehouse: {
      address: form.warehouseAddress,
      label: form.warehouseLabel,
      warehouseId: form.warehouseId,
    },
  };
}

function readPositiveNumber(value: string, fallback: number) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readPositiveInteger(value: string, fallback: number) {
  return Math.round(readPositiveNumber(value, fallback));
}

function formatMiles(radiusMeters: number) {
  if (!radiusMeters) return "n/a";

  return `${(radiusMeters / 1609.344).toFixed(1)} mi`;
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
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<MedusaOrder | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [showDeletedOrders, setShowDeletedOrders] = useState(false);
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

  async function confirmDeleteOrder(releaseStock: boolean) {
    if (!deleteTargetOrder?.id) return;

    const orderId = String(deleteTargetOrder.id);
    setDeletingOrderId(orderId);
    setError("");
    try {
      await deleteOrder(token, orderId, { releaseStock });
      setDeleteTargetOrder(null);
      setShowDeletedOrders(true);
      if (selectedOrder && String(readOrderDetail(selectedOrder).id || "") === orderId) {
        setSelectedOrder(null);
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order delete failed.");
    } finally {
      setDeletingOrderId(null);
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

  const activeOrders = orders.filter((order) => !isDeletedOrder(order));
  const deletedOrders = orders.filter(isDeletedOrder);
  const selectedOrderSummary = selectedOrder ? readOrderDetail(selectedOrder) as MedusaOrder : null;

  return (
    <div className="space-y-4">
      <PageHeader
        actions={<Button loading={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw size={18} aria-hidden="true" />Refresh</Button>}
        icon={<ClipboardList size={22} aria-hidden="true" />}
        title="Live Orders"
        subtitle="Newest orders and details through BayBlaze API."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {loading ? <LoadingState label="Loading orders" /> : null}
      {deleteTargetOrder ? (
        <OrderDeleteDialog
          deleting={deletingOrderId === String(deleteTargetOrder.id || "")}
          order={deleteTargetOrder}
          onCancel={() => setDeleteTargetOrder(null)}
          onDeleteOnly={() => void confirmDeleteOrder(false)}
          onReleaseAndDelete={() => void confirmDeleteOrder(true)}
        />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3">
          {!loading && orders.length === 0 ? <EmptyState>No orders returned.</EmptyState> : null}
          {activeOrders.map((order, index) => (
            <OrderCard
              key={String(order.id || index)}
              onDelete={() => setDeleteTargetOrder(order)}
              onOpen={() => void openOrder(order)}
              order={order}
            />
          ))}
          {deletedOrders.length > 0 ? (
            <section className="rounded-[20px] border border-[var(--bb-line)] bg-white shadow-[var(--bb-shadow-soft)]">
              <button
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left font-black"
                onClick={() => setShowDeletedOrders((current) => !current)}
                type="button"
              >
                <span>Deleted</span>
                <span className="inline-flex items-center gap-2 text-sm text-[var(--bb-muted)]">
                  {deletedOrders.length}
                  {showDeletedOrders ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                </span>
              </button>
              {showDeletedOrders ? (
                <div className="grid gap-3 border-t border-[var(--bb-line)] p-3">
                  {deletedOrders.map((order, index) => (
                    <OrderCard
                      deleted
                      key={String(order.id || index)}
                      onDelete={() => undefined}
                      onOpen={() => void openOrder(order)}
                      order={order}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
        <Card className="h-fit space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black">Order Details</h3>
            <div className="flex items-center gap-2">
              {selectedOrderSummary && !isDeletedOrder(selectedOrderSummary) ? (
                <Button onClick={() => setDeleteTargetOrder(selectedOrderSummary)} size="sm" variant="danger">
                  <Trash2 size={16} aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
              {detailLoading ? <RefreshCw className="size-5 animate-spin text-[var(--bb-muted)]" aria-hidden="true" /> : null}
            </div>
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

function OrderCard({
  deleted = false,
  onDelete,
  onOpen,
  order,
}: {
  deleted?: boolean;
  onDelete: () => void;
  onOpen: () => void;
  order: MedusaOrder;
}) {
  const orderStatus = getOrderStatusDisplay(order);
  const cancellationReason = getCancellationReason(order);

  return (
    <Card className="cursor-pointer transition hover:border-[var(--bb-blaze)]" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black">{readOrderLabel(order)}</h3>
          <p className="truncate text-sm font-semibold text-[var(--bb-muted)]">{order.email || "No customer email"}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Badge tone={orderStatus.tone}>{orderStatus.label}</Badge>
        </div>
      </div>
      {orderStatus.cancelled && cancellationReason ? (
        <p className="mt-3 rounded-2xl border border-[var(--bb-danger-soft)] bg-[var(--bb-danger-soft)] px-3 py-2 text-sm font-bold text-[var(--bb-danger-strong)]">
          Cancellation reason: {cancellationReason}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="Payment" value={getPaymentMethodDisplay(order)} />
        <Metric label="Total" value={formatOrderTotal(order)} />
        <Metric label="Created" value={formatDate(order.created_at)} />
      </div>
      {!deleted ? (
        <div className="mt-3 border-t border-[var(--bb-line)] pt-3">
          <Button
            fullWidth
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            variant="danger"
          >
            <Trash2 size={18} aria-hidden="true" />
            Delete Order
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function OrderDeleteDialog({
  deleting,
  onCancel,
  onDeleteOnly,
  onReleaseAndDelete,
  order,
}: {
  deleting: boolean;
  onCancel: () => void;
  onDeleteOnly: () => void;
  onReleaseAndDelete: () => void;
  order: MedusaOrder;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 backdrop-blur-sm sm:place-items-center sm:p-6">
      <section className="w-full max-w-lg rounded-[20px] border border-[var(--bb-line)] bg-white p-4 shadow-[var(--bb-shadow-card)] md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">Delete Order</h3>
            <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">{readOrderLabel(order)}</p>
          </div>
          <Button aria-label="Cancel delete" onClick={onCancel} size="icon" variant="ghost">
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
          Would you like to release the products back to stock before marking this order deleted?
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button loading={deleting} onClick={onReleaseAndDelete}>
            <Check size={18} aria-hidden="true" />
            Yes
          </Button>
          <Button disabled={deleting} onClick={onDeleteOnly} variant="secondary">
            No
          </Button>
          <Button disabled={deleting} onClick={onCancel} variant="ghost">
            Cancel
          </Button>
        </div>
      </section>
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
  const orderStatus = getOrderStatusDisplay(order);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Metric label="Customer" value={readText(order.email, "No email")} />
        <Metric label="Total" value={formatOrderTotal(order)} />
        <Metric label="Payment" value={getPaymentMethodDisplay(order)} />
        <Metric label="Order" value={orderStatus.label} />
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
  coverageAreas,
  drivers,
  onShowCoverageChange,
  showCoverage,
}: {
  coverageAreas: CoverageArea[];
  drivers: DriverMapEntry[];
  onShowCoverageChange: (show: boolean) => void;
  showCoverage: boolean;
}) {
  const mapRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;

    void renderGoogleDriverMap(node, drivers, coverageAreas, showCoverage);
  }, [coverageAreas, drivers, showCoverage]);
  const positioned = drivers.filter((driver) => driver.location) as Array<DriverMapEntry & { location: LatLng }>;
  const generatedCoverageAreas = coverageAreas.filter((coverageArea) => coverageArea.polygon.length > 0);
  const visibleCoverageAreas = showCoverage ? generatedCoverageAreas : [];

  if (positioned.length === 0 && coverageAreas.length === 0) {
    return <EmptyState title="No map geometry">Clocked-in driver locations and coverage polygons will appear here.</EmptyState>;
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
        <label className="absolute right-4 top-4 flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3 text-sm font-black shadow-[var(--bb-shadow-soft)]">
          <input
            checked={showCoverage}
            className="size-4 accent-[var(--bb-blaze)]"
            onChange={(event) => onShowCoverageChange(event.target.checked)}
            type="checkbox"
          />
          Coverage
        </label>
        {generatedCoverageAreas.length > 0 ? (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl bg-white px-3 py-2 text-sm font-black shadow-[var(--bb-shadow-soft)]">
            {showCoverage ? visibleCoverageAreas.length : 0} / {generatedCoverageAreas.length} coverage {generatedCoverageAreas.length === 1 ? "zone" : "zones"}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

async function renderGoogleDriverMap(
  container: HTMLDivElement,
  drivers: DriverMapEntry[],
  coverageAreas: CoverageArea[],
  showCoverage: boolean,
) {
  const maps = await loadGoogleMaps();
  const positioned = drivers.filter((driver) => driver.location) as Array<DriverMapEntry & { location: LatLng }>;
  const generatedCoverageAreas = coverageAreas.filter((coverageArea) => coverageArea.polygon.length > 0);
  const plottedCoverageAreas = showCoverage ? generatedCoverageAreas : [];

  if (positioned.length === 0 && coverageAreas.length === 0) {
    return;
  }

  const center = averageLatLng([
    ...positioned.map((driver) => driver.location),
    ...coverageAreas.map((coverageArea) => coverageArea.warehouse.location),
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
  const DriverLocationOverlay = createDriverLocationOverlay(maps);

  coverageAreas.forEach((coverageArea) => {
    bounds.extend({ lat: coverageArea.warehouse.location.lat, lng: coverageArea.warehouse.location.lng });
  });

  plottedCoverageAreas.forEach((coverageArea, index) => {
    const color = coverageColor(index);
    const polygonPath = coverageArea.polygon.map((point) => ({ lat: point.lat, lng: point.lng }));
    new maps.Polygon({
      clickable: false,
      fillColor: color.fill,
      fillOpacity: 0.13,
      map,
      paths: polygonPath,
      strokeColor: color.stroke,
      strokeOpacity: 0.9,
      strokeWeight: 2,
    });
    polygonPath.forEach((point) => bounds.extend(point));
    bounds.extend({ lat: coverageArea.warehouse.location.lat, lng: coverageArea.warehouse.location.lng });

    new maps.Marker({
      icon: {
        anchor: new maps.Point(8, 8),
        path: maps.SymbolPath.CIRCLE,
        fillColor: color.stroke,
        fillOpacity: 1,
        scale: 6,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      map,
      position: { lat: coverageArea.warehouse.location.lat, lng: coverageArea.warehouse.location.lng },
      title: coverageArea.label,
    });
  });

  positioned.forEach((driver) => {
    const position = { lat: driver.location.lat, lng: driver.location.lng };
    const marker = new DriverLocationOverlay({
      onClick: () => {
        infoWindow.setContent([
          `<div style="font-family:Jost,Arial,sans-serif;min-width:190px;color:#111">`,
          `<strong style="font-size:15px">${escapeHtml(driver.displayName)}</strong>`,
          `<div style="margin-top:4px;color:#6d716b;font-weight:700">${escapeHtml(driver.email)}</div>`,
          `<div style="margin-top:8px;font-weight:800">${driver.clockedIn ? "Clocked in" : "Offline"}</div>`,
          `<div style="color:#6d716b;font-weight:700">Vehicle: ${escapeHtml(driver.activeVehicle?.label || "None")}</div>`,
          `<div style="color:#6d716b;font-weight:700">Stops: ${driver.queue?.stopCount ?? 0}</div>`,
          `</div>`,
        ].join(""));
        infoWindow.setPosition(position);
        infoWindow.open({ map });
      },
      position,
      title: driver.displayName,
      tone: driver.clockedIn ? "active" : "offline",
      text: driver.displayName.slice(0, 1).toUpperCase(),
    });

    marker.setMap(map);
    bounds.extend(position);
  });

  if (positioned.length > 1 || coverageAreas.length > 0) {
    map.fitBounds(bounds, 72);
  }
}

function createDriverLocationOverlay(maps: typeof google.maps) {
  return class DriverLocationOverlay extends maps.OverlayView {
    private readonly element: HTMLButtonElement;
    private readonly position: google.maps.LatLngLiteral;

    constructor({
      onClick,
      position,
      text,
      title,
      tone,
    }: {
      onClick: () => void;
      position: google.maps.LatLngLiteral;
      text: string;
      title: string;
      tone: "active" | "offline";
    }) {
      super();

      this.position = position;
      this.element = document.createElement("button");
      this.element.type = "button";
      this.element.title = title;
      this.element.textContent = text;
      this.element.setAttribute("aria-label", title);
      this.element.style.alignItems = "center";
      this.element.style.background = tone === "active" ? "#2f8f46" : "#6d716b";
      this.element.style.border = "4px solid #ffffff";
      this.element.style.borderRadius = "999px";
      this.element.style.boxShadow = "0 8px 16px rgba(17,17,17,0.24)";
      this.element.style.color = "#ffffff";
      this.element.style.cursor = "pointer";
      this.element.style.display = "flex";
      this.element.style.font = "800 11px Jost, Arial, sans-serif";
      this.element.style.height = "28px";
      this.element.style.justifyContent = "center";
      this.element.style.left = "0";
      this.element.style.lineHeight = "1";
      this.element.style.padding = "0";
      this.element.style.position = "absolute";
      this.element.style.top = "0";
      this.element.style.transform = "translate(-50%, -50%)";
      this.element.style.width = "28px";
      this.element.addEventListener("click", (event) => {
        event.stopPropagation();
        onClick();
      });
    }

    override onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.element);
    }

    override draw() {
      const point = this.getProjection().fromLatLngToDivPixel(new maps.LatLng(this.position));

      if (!point) return;

      this.element.style.left = `${point.x}px`;
      this.element.style.top = `${point.y}px`;
    }

    override onRemove() {
      this.element.remove();
    }
  };
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

function coverageColor(index: number) {
  const colors = [
    { fill: "#f26a1b", stroke: "#c94d12" },
    { fill: "#2563eb", stroke: "#1d4ed8" },
    { fill: "#2f8f46", stroke: "#1f6631" },
    { fill: "#d9961d", stroke: "#855b0e" },
  ];

  return colors[index % colors.length];
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

function getOrderStatusDisplay(order: Record<string, unknown>): OrderStatusDisplay {
  const deleted = isDeletedOrder(order);
  if (deleted) {
    return { cancelled: false, deleted, label: "DELETED", tone: "neutral" };
  }

  const cancelled = isCancelledOrder(order);

  return cancelled
    ? { cancelled, deleted, label: "CANCELLED", tone: "danger" }
    : { cancelled, deleted, label: "FULFILLED", tone: "success" };
}

function isDeletedOrder(order: Record<string, unknown>) {
  const metadata = readRecord(order.metadata);
  const statusValues = [
    order.status,
    order.fulfillment_status,
    metadata.bayblaze_order_status,
    metadata.order_status,
  ].map(normalizeStatus);

  return metadata.bayblaze_deleted === true ||
    metadata.deleted === true ||
    statusValues.some((value) => value === "deleted") ||
    Boolean(readText(metadata.bayblaze_deleted_at, metadata.deleted_at));
}

function isCancelledOrder(order: Record<string, unknown>) {
  const metadata = readRecord(order.metadata);
  const statusValues = [
    order.status,
    order.fulfillment_status,
    metadata.bayblaze_delivery_status,
    metadata.delivery_status,
    metadata.driver_delivery_status,
    metadata.order_status,
  ].map(normalizeStatus);

  return statusValues.some((value) => value === "cancelled" || value === "canceled") ||
    Boolean(readText(order.canceled_at, order.cancelled_at, metadata.canceled_at, metadata.cancelled_at));
}

function getCancellationReason(order: Record<string, unknown>) {
  const metadata = readRecord(order.metadata);

  return readText(
    order.cancellation_reason,
    order.cancellationReason,
    order.cancel_reason,
    order.cancelReason,
    order.canceled_reason,
    order.canceledReason,
    order.cancelled_reason,
    order.cancelledReason,
    metadata.cancellation_reason,
    metadata.cancellationReason,
    metadata.cancel_reason,
    metadata.cancelReason,
    metadata.canceled_reason,
    metadata.canceledReason,
    metadata.cancelled_reason,
    metadata.cancelledReason,
    metadata.bayblaze_cancellation_reason,
    metadata.bayblazeCancellationReason,
    metadata.delivery_cancellation_reason,
    metadata.deliveryCancellationReason,
    metadata.driver_delivery_cancellation_reason,
    metadata.driverDeliveryCancellationReason,
  );
}

function normalizeStatus(value: unknown) {
  return readText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function formatOrderTotal(order: Record<string, unknown>) {
  const total = getOrderTotalMajorUnits(order);

  if (total === null) return "Total n/a";

  return new Intl.NumberFormat("en-US", {
    currency: readText(order.currency_code).toUpperCase() || "USD",
    style: "currency",
  }).format(total);
}

function getOrderTotalMajorUnits(order: Record<string, unknown>): number | null {
  const metadata = readRecord(order.metadata);
  const discountAdjustedTotal = readNumber(
    metadata.checkout_promo_total_after_discount,
    metadata.first_order_offer_total_after_discount,
  );

  if (discountAdjustedTotal !== null) {
    return discountAdjustedTotal;
  }

  const explicitCents = readNumber(
    metadata.order_total_cents,
    metadata.checkout_total_cents,
    metadata.total_cents,
  );

  if (explicitCents !== null) {
    return explicitCents / 100;
  }

  const requestedItemsCents = sumRequestedItemCents(metadata.requested_items);

  if (requestedItemsCents !== null) {
    return requestedItemsCents / 100;
  }

  const summary = readRecord(order.summary);
  const medusaTotal = readNumber(
    order.total,
    summary.current_order_total,
    summary.paid_total,
    readRecord(summary.raw_current_order_total).value,
  );

  if (medusaTotal === null) {
    return null;
  }

  return Number.isInteger(medusaTotal) && Math.abs(medusaTotal) >= 1000
    ? medusaTotal / 100
    : medusaTotal;
}

function sumRequestedItemCents(value: unknown): number | null {
  const cents = readArray(value).reduce<number>((sum, item) => {
    const record = readRecord(item);
    const totalCents = readNumber(record.total_cents, record.totalCents);

    return totalCents === null ? sum : sum + totalCents;
  }, 0);

  return cents > 0 ? cents : null;
}

function getPaymentMethodDisplay(order: Record<string, unknown>) {
  const metadata = readRecord(order.metadata);
  const paymentCollections = readArray(order.payment_collections);
  const paymentCollectionMethod = paymentCollections
    .map((item) => readPaymentCollectionMethod(readRecord(item)))
    .find(Boolean);
  const label = readText(
    metadata.payment_method,
    metadata.paymentMethod,
    metadata.checkout_payment_method,
    metadata.checkoutPaymentMethod,
    metadata.payment_label,
    metadata.paymentLabel,
    metadata.payment_note,
    order.payment_method,
    order.paymentMethod,
    paymentCollectionMethod,
    order.payment_status,
  );

  return normalizePaymentMethodLabel(label) || "unknown";
}

function readPaymentCollectionMethod(paymentCollection: Record<string, unknown>) {
  const paymentSessions = readArray(paymentCollection.payment_sessions);
  const payments = readArray(paymentCollection.payments);

  return readText(
    paymentCollection.provider_id,
    paymentSessions.map((session) => readRecord(session).provider_id).find(Boolean),
    payments.map((payment) => readRecord(payment).provider_id).find(Boolean),
  );
}

function normalizePaymentMethodLabel(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");

  if (!normalized) {
    return "";
  }

  if (
    normalized.includes("p2p") ||
    normalized.includes("pay on delivery") ||
    normalized.includes("payment due on delivery") ||
    normalized.includes("manual") ||
    normalized.includes("system")
  ) {
    return "P2P";
  }

  return value.trim();
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function formatDate(value: unknown) {
  if (typeof value !== "string") return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default App;
