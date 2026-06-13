export type AccountRole = "admin" | "driver" | "inventory";
export type AccountBadge = "customer" | "employee";

export type Account = {
  disabled: boolean;
  displayName: string;
  email: string;
  badges: AccountBadge[];
  roles: AccountRole[];
  settings: {
    ageVerificationDisabled: boolean;
  };
  uid: string;
};

export type Session = {
  account: Account;
  token: string;
};

export type LatLng = {
  lat: number;
  lng: number;
};

export type DriverMapEntry = {
  activeVehicle: { label?: string; vehicleId?: string; plateNumber?: string } | null;
  clockedIn: boolean;
  displayName: string;
  email: string;
  location: (LatLng & { accuracy?: number; clientCapturedAt?: number; updatedAt?: unknown }) | null;
  onboardingComplete: boolean;
  queue: { activeOrderId: string | null; stopCount: number; updatedAt?: unknown } | null;
  uid: string;
};

export type DriverRoute = {
  activeOrderId: string | null;
  stops: Array<{
    customerAddress: string;
    customerName: string;
    index: number;
    locked: boolean;
    orderId: string;
    orderReference: string;
    position: LatLng | null;
    score: number | null;
    status: string;
  }>;
  uid: string;
  updatedAt?: unknown;
};

export type IsochronePlot = {
  center: LatLng & { address?: string };
  method: string;
  polygon: LatLng[];
  radiusMeters: number;
  speedMph: number;
  travelMinutes: number;
};

export type MedusaOrder = Record<string, unknown> & {
  id?: string;
  display_id?: number;
  email?: string;
  created_at?: string;
  total?: number;
  currency_code?: string;
  fulfillment_status?: string;
  payment_status?: string;
  metadata?: Record<string, unknown>;
};
