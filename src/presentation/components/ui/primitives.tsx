import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  ...props
}: Readonly<ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
  size?: "default" | "small";
}>) {
  return <button className={classes("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)} type={type} {...props} />;
}

export function TextInput({ className, ...props }: Readonly<InputHTMLAttributes<HTMLInputElement>>) {
  return <input className={classes("ui-input", className)} {...props} />;
}

export function Textarea({ className, ...props }: Readonly<TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  return <textarea className={classes("ui-textarea", className)} {...props} />;
}

export function Field({
  id,
  label,
  hint,
  children,
}: Readonly<{ id: string; label: string; hint?: string; children: ReactNode }>) {
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {hint === undefined ? null : <span className="ui-field__hint" id={`${id}-hint`}>{hint}</span>}
      {children}
    </div>
  );
}

export function Badge({ tone = "neutral", children, className }: Readonly<{
  tone?: "neutral" | "sprout" | "sun" | "indigo" | "danger";
  children: ReactNode;
  className?: string;
}>) {
  return <span className={classes("ui-badge", `ui-badge--${tone}`, className)}>{children}</span>;
}

export function Surface({ as: Tag = "div", className, children }: Readonly<{
  as?: "div" | "article" | "section" | "aside";
  className?: string;
  children: ReactNode;
}>) {
  return <Tag className={classes("ui-surface", className)}>{children}</Tag>;
}

const alertIcons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
} as const;

export function AlertBanner({ tone, title, children, role }: Readonly<{
  tone: keyof typeof alertIcons;
  title: string;
  children?: ReactNode;
  role?: "alert" | "status";
}>) {
  const Icon = alertIcons[tone];
  return (
    <div className={`ui-alert ui-alert--${tone}`} role={role}>
      <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
      <div><strong>{title}</strong>{children === undefined ? null : <p>{children}</p>}</div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
}>) {
  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="ui-segmented__item"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.icon}{option.label}
        </button>
      ))}
    </div>
  );
}

export function SkeletonLines() {
  return <div className="ui-skeleton" aria-hidden="true"><i /><i /><i /></div>;
}
