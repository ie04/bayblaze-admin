import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PromoCreationWizard } from "./PromoCreationWizard";
import { PromoToolsView } from "./PromoToolsView";
import type { PromoCodeInput } from "./lib/adminApi";
import type { Account, AdminPromoCode } from "./lib/types";

const apiMocks = vi.hoisted(() => ({
  createPromoCode: vi.fn(),
  deletePromoCode: vi.fn(),
  loadPromoCodes: vi.fn(),
  loadStorefrontSettings: vi.fn(),
  searchAccounts: vi.fn(),
  updatePromoCode: vi.fn(),
  updateStorefrontSettings: vi.fn(),
}));

vi.mock("./lib/adminApi", () => apiMocks);
vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

const referralAccount: Account = {
  badges: ["customer"],
  disabled: false,
  displayName: "Taylor Partner",
  email: "taylor@example.com",
  roles: [],
  settings: { ageVerificationDisabled: false },
  uid: "account-referral",
};

beforeEach(() => {
  apiMocks.createPromoCode.mockReset();
  apiMocks.deletePromoCode.mockReset();
  apiMocks.loadPromoCodes.mockReset().mockResolvedValue({ promoCodes: [] });
  apiMocks.loadStorefrontSettings.mockReset().mockResolvedValue({
    settings: { ageVerificationDisabled: false, priceAdjustmentCents: 0, updatedAt: "" },
  });
  apiMocks.searchAccounts.mockReset().mockResolvedValue({ accounts: [referralAccount] });
  apiMocks.updatePromoCode.mockReset();
  apiMocks.updateStorefrontSettings.mockReset();
});

afterEach(() => cleanup());

describe("promotion creation wizard", () => {
  it("opens from the single New Promo action and closes without creating anything", async () => {
    const user = userEvent.setup();
    render(<PromoToolsView token="token" />);

    const newPromo = await screen.findByRole("button", { name: "New promo" });
    await waitFor(() => expect(newPromo).toBeEnabled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(newPromo);
    expect(screen.getByRole("dialog", { name: "Promotion type" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Promotion type" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMocks.createPromoCode).not.toHaveBeenCalled();
    await waitFor(() => expect(newPromo).toHaveFocus());
  });

  it("offers standard promo fields without referral-only settings", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("radio", { name: /Standard promo/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByLabelText("Customer reward")).toHaveValue("discount");
    expect(screen.getByRole("option", { name: "Buy 1 get 1 free" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Referral account")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Commission percent")).not.toBeInTheDocument();
  });

  it("offers referral owner and commission fields while hiding BOGO", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("radio", { name: /Referral promo/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByLabelText("Referral account")).toBeInTheDocument();
    expect(screen.getByLabelText("Commission percent")).toHaveValue("30");
    expect(screen.queryByRole("option", { name: "Buy 1 get 1 free" })).not.toBeInTheDocument();
  });

  it("preserves type-specific entries when navigating forward and backward", async () => {
    const user = userEvent.setup();
    renderWizard();
    await openDetails(user, "referral");

    const codeInput = screen.getByLabelText("Promo code");
    await user.clear(codeInput);
    await user.type(codeInput, "PARTNER25");
    await user.selectOptions(screen.getByLabelText("Referral account"), referralAccount.uid);
    const commissionInput = screen.getByLabelText("Commission percent");
    await user.clear(commissionInput);
    await user.type(commissionInput, "35");
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByText("PARTNER25")).toBeInTheDocument();
    expect(screen.getByText(/35% of post-discount product spend/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Back/i }));

    expect(screen.getByLabelText("Promo code")).toHaveValue("PARTNER25");
    expect(screen.getByLabelText("Referral account")).toHaveValue(referralAccount.uid);
    expect(screen.getByLabelText("Commission percent")).toHaveValue("35");
  });

  it("shows referral-specific validation beside invalid fields", async () => {
    const user = userEvent.setup();
    renderWizard();
    await openDetails(user, "referral");

    await user.clear(screen.getByLabelText("Promo code"));
    await user.clear(screen.getByLabelText("Discount percent"));
    await user.clear(screen.getByLabelText("Commission percent"));
    await user.click(screen.getByText("Minimum basket before tax"));
    await user.clear(screen.getByLabelText("Minimum"));
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByText("Enter a promotion code.")).toBeInTheDocument();
    expect(screen.getByText("Discount must be between 1% and 100%.")).toBeInTheDocument();
    expect(screen.getByText("Commission must be between 1% and 100%.")).toBeInTheDocument();
    expect(screen.getByText("Select the BayBlaze account that owns this referral promo.")).toBeInTheDocument();
    expect(screen.getByText("Enter a minimum purchase greater than $0.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Promotion details" })).toBeInTheDocument();
  });

  it("applies standard BOGO validation without requiring a discount percentage", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(promoRecord("BOGO", { codeType: "bogo" }));
    renderWizard(onCreate);
    await openDetails(user, "standard");
    await user.selectOptions(screen.getByLabelText("Customer reward"), "bogo");

    expect(screen.queryByLabelText("Discount percent")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByText("Buy 1 get 1 free")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.click(screen.getByRole("button", { name: /Create Promotion/i }));

    expect(onCreate).toHaveBeenCalledWith(expect.not.objectContaining({ discountPercent: expect.anything() }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ category: "admin_promo", codeType: "bogo" }));
  });

  it("does not call the API until the final confirmation", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(promoRecord("STANDARD30"));
    renderWizard(onCreate);

    await openDetails(user, "standard");
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    expect(onCreate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("heading", { name: "Create" })).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions while creation is pending", async () => {
    const user = userEvent.setup();
    let resolveCreate: ((promo: AdminPromoCode) => void) | undefined;
    const onCreate = vi.fn(() => new Promise<AdminPromoCode>((resolve) => { resolveCreate = resolve; }));
    renderWizard(onCreate);
    await advanceToCreate(user, "standard");

    const createButton = screen.getByRole("button", { name: /Create Promotion/i });
    await user.click(createButton);
    await user.click(createButton);

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(createButton).toBeDisabled();
    resolveCreate?.(promoRecord("STANDARD30"));
  });

  it("adds a promotion to the list only after the backend confirms creation", async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: { promoCode: AdminPromoCode }) => void) | undefined;
    apiMocks.createPromoCode.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    render(<PromoToolsView token="token" />);
    const newPromo = await screen.findByRole("button", { name: "New promo" });
    await waitFor(() => expect(newPromo).toBeEnabled());
    await user.click(newPromo);
    await user.click(screen.getByRole("radio", { name: /Standard promo/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.click(screen.getByRole("button", { name: /Create Promotion/i }));

    expect(screen.queryByText("CONFIRMED30")).not.toBeInTheDocument();
    resolveCreate?.({ promoCode: promoRecord("CONFIRMED30") });

    expect(await screen.findByText("CONFIRMED30 was created successfully.")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED30")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("recovers from an API failure without losing the form or locking submission", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn()
      .mockRejectedValueOnce(new Error("Promo code already exists."))
      .mockResolvedValueOnce(promoRecord("RETRY30"));
    renderWizard(onCreate);
    await advanceToCreate(user, "standard");

    await user.click(screen.getByRole("button", { name: /Create Promotion/i }));
    expect(await screen.findByText("Promo code already exists.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Promotion/i })).toBeEnabled();
    expect(screen.getByText(/30% off/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Create Promotion/i }));
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it("warns before discarding entered data and supports Escape behavior", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PromoCreationWizard accounts={[referralAccount]} onClose={onClose} onCreate={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /Standard promo/i }));

    await user.keyboard("{Escape}");
    expect(screen.getByText("Discard this unsaved promotion?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Discard this unsaved promotion?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the wizard within the mobile viewport with separate scrolling content and visible navigation", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 667 });
    renderWizard();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("h-[calc(100svh-1rem)]", "max-h-[calc(100svh-1rem)]", "overflow-hidden");
    expect(screen.getByTestId("wizard-scroll-region")).toHaveClass("overflow-y-auto", "min-h-0");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue/i })).toBeInTheDocument();
  });
});

function renderWizard(onCreate = vi.fn().mockResolvedValue(promoRecord("PROMO30"))) {
  return render(<PromoCreationWizard accounts={[referralAccount]} onClose={vi.fn()} onCreate={onCreate} />);
}

async function openDetails(user: ReturnType<typeof userEvent.setup>, type: "standard" | "referral") {
  await user.click(screen.getByRole("radio", { name: new RegExp(type, "i") }));
  await user.click(screen.getByRole("button", { name: /Continue/i }));
}

async function advanceToCreate(user: ReturnType<typeof userEvent.setup>, type: "standard" | "referral") {
  await openDetails(user, type);
  if (type === "referral") {
    await user.selectOptions(screen.getByLabelText("Referral account"), referralAccount.uid);
  }
  await user.click(screen.getByRole("button", { name: /Continue/i }));
  await user.click(screen.getByRole("button", { name: /Continue/i }));
}

function promoRecord(code: string, input: Partial<PromoCodeInput> = {}): AdminPromoCode {
  return {
    category: input.category ?? "admin_promo",
    code,
    codeType: input.codeType ?? "discount",
    commissionPercent: input.commissionPercent ?? 0,
    createdAt: "2026-07-22T00:00:00.000Z",
    discountPercent: input.discountPercent ?? 30,
    minimumSpendCents: input.minimumSpendCents ?? 0,
    singleUsePerAccount: input.singleUsePerAccount ?? false,
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
