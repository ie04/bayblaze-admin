import type { Account } from "./lib/types";
import type { PromoCodeInput } from "./lib/adminApi";

export type PromotionType = "standard" | "referral";

type SharedPromotionFields = {
  code: string;
  discountPercent: string;
  minimumSpend: string;
  minimumSpendEnabled: boolean;
  singleUsePerAccount: boolean;
};

export type StandardPromotionForm = SharedPromotionFields & {
  category: "admin_promo";
  codeType: "discount" | "bogo";
  promotionType: "standard";
};

export type ReferralPromotionForm = SharedPromotionFields & {
  category: "referral_partner";
  codeType: "discount";
  commissionPercent: string;
  ownerUid: string;
  promotionType: "referral";
};

export type PromotionForm = StandardPromotionForm | ReferralPromotionForm;
export type PromotionFormErrors = Partial<Record<
  "code" | "commissionPercent" | "discountPercent" | "minimumSpend" | "ownerUid",
  string
>>;

export function createDefaultPromotionForm(type: PromotionType): PromotionForm {
  const shared = {
    code: `BB${createPromoCodeSuffix()}`,
    discountPercent: "30",
    minimumSpend: "50",
    minimumSpendEnabled: false,
    singleUsePerAccount: false,
  };

  if (type === "referral") {
    return {
      ...shared,
      category: "referral_partner",
      codeType: "discount",
      commissionPercent: "30",
      ownerUid: "",
      promotionType: "referral",
    };
  }

  return {
    ...shared,
    category: "admin_promo",
    codeType: "discount",
    promotionType: "standard",
  };
}

export function validatePromotionForm(form: PromotionForm, accounts: Account[]) {
  const errors: PromotionFormErrors = {};
  const normalizedCode = normalizePromoCode(form.code);

  if (!normalizedCode) {
    errors.code = "Enter a promotion code.";
  }

  if (form.codeType === "discount") {
    const discountPercent = parsePercent(form.discountPercent);

    if (discountPercent === null) {
      errors.discountPercent = "Discount must be between 1% and 100%.";
    }
  }

  if (form.minimumSpendEnabled) {
    const minimumSpendCents = parseMoneyCents(form.minimumSpend);

    if (minimumSpendCents === null || minimumSpendCents <= 0) {
      errors.minimumSpend = "Enter a minimum purchase greater than $0.";
    } else if (minimumSpendCents > 100_000_000) {
      errors.minimumSpend = "Minimum purchase cannot exceed $1,000,000.";
    }
  }

  if (form.promotionType === "referral") {
    const commissionPercent = parsePercent(form.commissionPercent);

    if (commissionPercent === null) {
      errors.commissionPercent = "Commission must be between 1% and 100%.";
    }

    const owner = accounts.find((account) => account.uid === form.ownerUid);

    if (!form.ownerUid) {
      errors.ownerUid = "Select the BayBlaze account that owns this referral promo.";
    } else if (!owner) {
      errors.ownerUid = "Select an existing BayBlaze account.";
    } else if (owner.disabled) {
      errors.ownerUid = "The selected referral account is disabled.";
    }
  }

  return errors;
}

export function buildPromotionCreateInput(form: PromotionForm): PromoCodeInput {
  const shared = {
    category: form.category,
    code: normalizePromoCode(form.code),
    codeType: form.codeType,
    minimumSpendCents: form.minimumSpendEnabled ? parseMoneyCents(form.minimumSpend) ?? 0 : 0,
    singleUsePerAccount: form.singleUsePerAccount,
  };

  if (form.promotionType === "referral") {
    return {
      ...shared,
      codeType: "discount",
      commissionPercent: parsePercent(form.commissionPercent) ?? 0,
      discountPercent: parsePercent(form.discountPercent) ?? 0,
      ownerUid: form.ownerUid,
    };
  }

  return form.codeType === "bogo"
    ? shared
    : {
        ...shared,
        discountPercent: parsePercent(form.discountPercent) ?? 0,
      };
}

export function normalizePromoCode(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80).toUpperCase();
}

export function normalizePercentInput(value: string) {
  return value.replace(/[^\d.]/g, "").slice(0, 5);
}

export function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [dollars = "", ...rest] = cleaned.split(".");
  const cents = rest.join("").slice(0, 2);

  return rest.length ? `${dollars.slice(0, 6)}.${cents}` : dollars.slice(0, 6);
}

export function createPromoCodeSuffix() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function parsePercent(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 && number <= 100
    ? Math.round(number * 100) / 100
    : null;
}

function parseMoneyCents(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}
