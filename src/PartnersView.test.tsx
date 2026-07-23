import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PartnersView } from "./PartnersView";
import type { Account, AdminPromoCode, ReferralPartner } from "./lib/types";

const apiMocks = vi.hoisted(() => ({
  approveReferralPartner: vi.fn(),
  loadReferralPartners: vi.fn(),
  searchAccounts: vi.fn(),
  updateReferralPartnerStatus: vi.fn(),
}));

vi.mock("./lib/adminApi", () => apiMocks);

const account: Account = {
  badges: ["customer"],
  disabled: false,
  displayName: "Taylor Partner",
  email: "taylor@example.com",
  roles: [],
  settings: { ageVerificationDisabled: false },
  uid: "partner-uid",
};

beforeEach(() => {
  apiMocks.approveReferralPartner.mockReset();
  apiMocks.loadReferralPartners.mockReset().mockResolvedValue({ partners: [] });
  apiMocks.searchAccounts.mockReset().mockResolvedValue({ accounts: [account] });
  apiMocks.updateReferralPartnerStatus.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("referral partner administration", () => {
  it("creates a referral account only after final confirmation", async () => {
    const user = userEvent.setup();
    const activePartner = partnerRecord({ referralCode: "TAYLOR20", status: "active" });
    apiMocks.approveReferralPartner.mockResolvedValue({
      partner: activePartner,
      promoCode: promoRecord("TAYLOR20"),
    });
    render(<PartnersView token="token" />);

    const newAccount = await screen.findByRole("button", { name: "New referral account" });
    await user.click(newAccount);

    expect(screen.getByRole("dialog", { name: "Account & terms" })).toBeInTheDocument();
    expect(apiMocks.approveReferralPartner).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText("Referral account"), account.uid);
    await user.clear(screen.getByLabelText("Promo code"));
    await user.type(screen.getByLabelText("Promo code"), "TAYLOR20");
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(apiMocks.approveReferralPartner).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("heading", { name: "Create" })).toBeInTheDocument();
    expect(apiMocks.approveReferralPartner).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Create Referral Account" }));

    await waitFor(() => expect(apiMocks.approveReferralPartner).toHaveBeenCalledWith(
      "token",
      account.uid,
      expect.objectContaining({
        code: "TAYLOR20",
        commissionPercent: 30,
        discountPercent: 30,
      }),
    ));
    expect(await screen.findByText("Taylor Partner is active with code TAYLOR20.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a pending application with its unified account selected", async () => {
    const user = userEvent.setup();
    apiMocks.loadReferralPartners.mockResolvedValue({
      partners: [partnerRecord({ status: "pending" })],
    });
    render(<PartnersView token="token" />);

    await user.click(await screen.findByRole("button", { name: "Approve & configure" }));

    expect(screen.getByRole("dialog", { name: "Account & terms" })).toBeInTheDocument();
    expect(screen.getByLabelText("Referral account")).toHaveValue(account.uid);
    expect(apiMocks.approveReferralPartner).not.toHaveBeenCalled();
  });

  it("can find an eligible unified account from inside the creation wizard", async () => {
    const user = userEvent.setup();
    apiMocks.searchAccounts
      .mockResolvedValueOnce({ accounts: [] })
      .mockResolvedValueOnce({ accounts: [account] });
    render(<PartnersView token="token" />);

    await user.click(await screen.findByRole("button", { name: "New referral account" }));
    await user.type(screen.getByLabelText("Find a unified customer account"), account.email);
    await user.click(screen.getByRole("button", { name: "Search accounts" }));

    await waitFor(() => expect(apiMocks.searchAccounts).toHaveBeenLastCalledWith("token", account.email));
    expect(await screen.findByRole("option", { name: /Taylor Partner/ })).toBeInTheDocument();
  });

  it("can suspend an active referral account and updates the displayed status", async () => {
    const user = userEvent.setup();
    const activePartner = partnerRecord({ referralCode: "TAYLOR20", status: "active" });
    const suspendedPartner = partnerRecord({ referralCode: "TAYLOR20", status: "suspended" });
    apiMocks.loadReferralPartners.mockResolvedValue({ partners: [activePartner] });
    apiMocks.updateReferralPartnerStatus.mockResolvedValue({ partner: suspendedPartner });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PartnersView token="token" />);

    await user.click(await screen.findByRole("button", { name: "Suspend" }));

    await waitFor(() => expect(apiMocks.updateReferralPartnerStatus).toHaveBeenCalledWith(
      "token",
      account.uid,
      "suspended",
    ));
    expect(await screen.findByText("Taylor Partner is now suspended.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
  });

  it("closes an untouched creation flow without an unsaved-change warning", async () => {
    const user = userEvent.setup();
    render(<PartnersView token="token" />);

    await user.click(await screen.findByRole("button", { name: "New referral account" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Discard this unsaved referral account/)).not.toBeInTheDocument();
    expect(apiMocks.approveReferralPartner).not.toHaveBeenCalled();
  });
});

function partnerRecord(input: Partial<ReferralPartner> = {}): ReferralPartner {
  return {
    approvedAt: "",
    createdAt: "2026-07-22T00:00:00.000Z",
    displayName: account.displayName,
    email: account.email,
    referralCode: "",
    rejectedAt: "",
    status: "pending",
    suspendedAt: "",
    uid: account.uid,
    updatedAt: "2026-07-22T00:00:00.000Z",
    ...input,
  };
}

function promoRecord(code: string): AdminPromoCode {
  return {
    category: "referral_partner",
    code,
    codeType: "discount",
    commissionPercent: 30,
    createdAt: "2026-07-22T00:00:00.000Z",
    discountPercent: 30,
    minimumSpendCents: 0,
    ownerUid: account.uid,
    singleUsePerAccount: false,
    status: "active",
    totalCommissionCents: 0,
    totalDiscountCents: 0,
    totalReferredSpendCents: 0,
    totalReferredSubtotalCents: 0,
    uniqueReferredCustomers: 0,
    updatedAt: "2026-07-22T00:00:00.000Z",
    usageLimit: 1_000_000,
    usedCount: 0,
  };
}
