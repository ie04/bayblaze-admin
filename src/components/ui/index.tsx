import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

import { cx } from "../../lib/classes";

type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  brand: "border-[var(--bb-blaze-soft)] bg-[var(--bb-blaze-soft)] text-[var(--bb-charcoal)]",
  neutral: "border-[var(--bb-line)] bg-[var(--bb-surface-warm)] text-[var(--bb-muted)]",
  success: "border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] text-[var(--bb-success-strong)]",
  warning: "border-[var(--bb-warning-soft)] bg-[var(--bb-warning-soft)] text-[var(--bb-warning-strong)]",
  danger: "border-[var(--bb-danger-soft)] bg-[var(--bb-danger-soft)] text-[var(--bb-danger-strong)]",
  info: "border-[var(--bb-info-soft)] bg-[var(--bb-info-soft)] text-[var(--bb-info-strong)]",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bb-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  loading?: boolean;
  size?: "sm" | "md" | "icon";
  variant?: "primary" | "secondary" | "danger" | "ghost" | "quiet";
};

export function Button({
  children,
  className,
  disabled,
  fullWidth,
  loading,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: "border-transparent bg-[var(--bb-blaze)] text-white shadow-[0_12px_24px_rgba(201,77,18,0.18)] hover:bg-[var(--bb-blaze-strong)]",
    secondary: "border-[var(--bb-line)] bg-white text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-soft)] hover:border-[var(--bb-blaze)]",
    danger: "border-[var(--bb-danger-soft)] bg-[var(--bb-danger-soft)] text-[var(--bb-danger-strong)] hover:border-[var(--bb-danger)]",
    ghost: "border-transparent bg-transparent text-[var(--bb-charcoal)] hover:bg-[var(--bb-surface-warm)]",
    quiet: "border-[var(--bb-line)] bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)] hover:border-[var(--bb-blaze)]",
  }[variant];
  const sizeClass = {
    sm: "min-h-10 rounded-2xl px-3 text-sm",
    md: "min-h-12 rounded-2xl px-4 text-base",
    icon: "size-11 rounded-full p-0",
  }[size];

  return (
    <button
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 border font-black transition disabled:cursor-not-allowed disabled:opacity-60",
        focusRing,
        variantClass,
        sizeClass,
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  elevated = false,
  ...props
}: HTMLAttributes<HTMLElement> & { elevated?: boolean }) {
  return (
    <section
      className={cx(
        "rounded-[20px] border border-[var(--bb-line)] bg-white p-4 shadow-[var(--bb-shadow-soft)] md:p-5",
        elevated && "shadow-[var(--bb-shadow-card)]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function Badge({ children, className, tone = "neutral" }: { children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <span className={cx("inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-black uppercase", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function Input({ className, icon, label, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; label?: string }) {
  return (
    <label className={cx("block", className)}>
      {label ? <span className="mb-2 block text-xs font-black uppercase text-[var(--bb-muted)]">{label}</span> : null}
      <span className={cx("flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--bb-line)] bg-white px-3 shadow-[var(--bb-shadow-soft)] focus-within:border-[var(--bb-blaze)]", focusRing)}>
        {icon ? <span className="shrink-0 text-[var(--bb-charcoal)]">{icon}</span> : null}
        <input className="min-w-0 flex-1 bg-transparent py-2.5 text-base font-semibold text-[var(--bb-charcoal)] outline-none placeholder:text-[var(--bb-muted)]" {...props} />
      </span>
    </label>
  );
}

export function Textarea({ className, label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className={cx("block", className)}>
      {label ? <span className="mb-2 block text-xs font-black uppercase text-[var(--bb-muted)]">{label}</span> : null}
      <textarea
        className={cx("min-h-28 w-full resize-none rounded-2xl border border-[var(--bb-line)] bg-white px-4 py-3 text-base font-semibold text-[var(--bb-charcoal)] outline-none focus:border-[var(--bb-blaze)]", focusRing)}
        {...props}
      />
    </label>
  );
}

export function PageHeader({ actions, eyebrow, icon, title, subtitle }: {
  actions?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 lg:max-w-2xl lg:flex-1">
        {eyebrow ? <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">{eyebrow}</p> : null}
        <div className="flex items-center gap-3">
          {icon ? <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]">{icon}</span> : null}
          <h2 className="text-2xl font-black leading-tight text-[var(--bb-charcoal)] md:text-3xl">{title}</h2>
        </div>
        {subtitle ? <p className="mt-2 text-sm font-semibold leading-6 text-[var(--bb-muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="w-full shrink-0 lg:w-auto lg:max-w-[42rem]">{actions}</div> : null}
    </div>
  );
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--bb-danger-soft)] bg-[var(--bb-danger-soft)] p-4 text-sm font-bold leading-6 text-[var(--bb-danger-strong)]">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ children, title = "Nothing here yet" }: { children?: ReactNode; title?: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[20px] border border-dashed border-[var(--bb-line)] bg-white p-6 text-center">
      <div>
        <Inbox className="mx-auto mb-3 size-8 text-[var(--bb-muted)]" aria-hidden="true" />
        <p className="font-black text-[var(--bb-charcoal)]">{title}</p>
        {children ? <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">{children}</p> : null}
      </div>
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 rounded-[20px] border border-[var(--bb-line)] bg-white p-6 text-sm font-black text-[var(--bb-muted)]">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}
