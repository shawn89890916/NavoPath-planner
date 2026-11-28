import React, { useState, type ReactNode } from "react";
import { Button, Input } from "./UiPrimitives";
import { UiChevronDownIcon } from "./UiIcons";
import "./SettingsControls.css";

/**
 * SettingsControls — the unified setting-row primitive system for the NavoPath
 * settings page. Every setting item in every section must be rendered through
 * these components so the visual rhythm, borders, typography, and interaction
 * states stay consistent. No section should hand-roll its own label + control
 * markup.
 *
 * Visual language follows NavoPathStyle.md: paper-like surfaces, fine rules,
 * restrained annotation color, no dashboard feel, no hover lift, no glow.
 *
 * Exported primitives:
 *   - SettingSection      (titled group with optional description)
 *   - SettingRow          (title + description + control slot, single fine rule)
 *   - SettingToggle       (sliding switch, neutral ink + paper track)
 *   - SettingSelect       (native select styled as paper control)
 *   - SettingNumberInput  (number input with optional min/max/step)
 *   - SettingTextInput    (text input)
 *   - SettingActionButton (secondary or danger action button)
 *   - SettingDisclosure   (expandable setting row)
 *   - SettingDescription  (small muted description text)
 */

export function SettingSection({
  title,
  description,
  children,
  tone = "normal",
  anchor,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  tone?: "normal" | "danger";
  /** Legacy callers may still pass variant; section depth now determines the surface. */
  variant?: "plain" | "grouped";
  anchor?: string;
}) {
  return (
    <section
      className={`df-settings-group df-settings-group--grouped${tone === "danger" ? " df-settings-group--danger" : ""}`}
      data-settings-anchor={anchor}
      tabIndex={anchor ? -1 : undefined}
    >
      {(title || description) && <header className="df-settings-group-head">
        {title && <h3 className="df-settings-group-title">{title}</h3>}
        {description ? <p className="df-settings-group-desc">{description}</p> : null}
      </header>}
      <div className="df-settings-group-body">{children}</div>
    </section>
  );
}

export function SettingRow({
  title,
  description,
  control,
  disabled,
  children,
  anchor,
  layout = "default",
  trailing,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
  anchor?: string;
  layout?: "default" | "stacked" | "actions";
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`df-settings-row${layout === "stacked" ? " df-settings-row--stacked" : layout === "actions" ? " df-settings-row--actions" : ""}`}
      data-disabled={disabled ? "true" : undefined}
      data-settings-anchor={anchor}
      tabIndex={anchor ? -1 : undefined}
    >
      <div className="df-settings-row-label">
        <span className="df-settings-row-title">{title}</span>
        {description ? <span className="df-settings-row-desc">{description}</span> : null}
      </div>
      <div className="df-settings-row-control">{control ?? children}</div>
      {trailing != null && <div className="df-settings-row-trailing">{trailing}</div>}
    </div>
  );
}

export function SettingToggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`df-settings-toggle${checked ? " is-on" : ""}`}
      data-state={checked ? "on" : "off"}
      data-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="df-settings-toggle-knob" />
    </button>
  );
}

export function SettingDisclosure({ title, description, children, anchor, open, onToggle }: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  anchor?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  return (
    <details className="df-settings-disclosure" data-settings-anchor={anchor} tabIndex={anchor ? -1 : undefined}
      open={open} onToggle={onToggle ? (event) => onToggle(event.currentTarget.open) : undefined}>
      <summary className="df-settings-disclosure-toggle">
        <span className="df-settings-row-label">
          <span className="df-settings-row-title">{title}</span>
          {description && <span className="df-settings-row-desc">{description}</span>}
        </span>
        <UiChevronDownIcon size={16} />
      </summary>
      <div className="df-settings-disclosure-body">{children}</div>
    </details>
  );
}

export function SettingSelect<T extends string>({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: ReactNode }[];
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select
      className="df-settings-select"
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label as any}
        </option>
      ))}
    </select>
  );
}

/** The workspace is the live preview; the normal settings save pipeline batches writes. */
export function SettingSlider({ value, min, max, step = 1, onChange, ariaLabel, displayValue }: {
  value: number; min: number; max: number; step?: number;
  onChange: (value: number) => void; ariaLabel: string; displayValue?: ReactNode;
}) {
  return <span className="df-settings-range-control">
    <input type="range" className="df-settings-range" min={min} max={max} step={step} value={value} aria-label={ariaLabel}
      onChange={event => onChange(Number(event.currentTarget.value))} />
    {displayValue !== undefined && <span className="df-settings-number-suffix">{displayValue}</span>}
  </span>;
}

export function SettingNumberInput({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  ariaLabel,
  suffix,
  commitOnBlur = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  suffix?: ReactNode;
  commitOnBlur?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="df-settings-number-wrap">
      <Input
        type="number"
        className="df-settings-number df-utility-input"
        value={draft ?? value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => {
          if (commitOnBlur) {
            setDraft(e.currentTarget.value);
            return;
          }
          const n = Number(e.currentTarget.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        onBlur={commitOnBlur ? (event) => {
          const next = event.currentTarget.valueAsNumber;
          setDraft(null);
          if (Number.isFinite(next) && next !== value) onChange(next);
        } : undefined}
        onKeyDown={commitOnBlur ? (event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        } : undefined}
      />
      {suffix ? <span className="df-settings-number-suffix" aria-hidden="true">{suffix}</span> : null}
    </span>
  );
}

export function SettingTextInput({
  value,
  onChange,
  disabled,
  ariaLabel,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  type?: "text" | "password" | "time" | "email";
}) {
  return (
    <Input
      type={type}
      className="df-settings-input df-utility-input"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SettingColorInput({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <label className="df-settings-color-field">
      <span className="df-settings-color-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
      <span aria-hidden="true">{value.toUpperCase()}</span>
      <input
        type="color"
        className="df-settings-color-input"
        value={value}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </label>
  );
}

export function SettingActionButton({
  children,
  onClick,
  disabled,
  pending,
  tone = "secondary",
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  tone?: "secondary" | "primary" | "danger";
  ariaLabel?: string;
}) {
  const variant = tone === "danger" ? "danger" : tone === "primary" ? "primary" : "secondary";

  return (
    <Button
      type="button"
      variant={variant}
      className="df-settings-action"
      aria-label={ariaLabel}
      disabled={disabled}
      pending={pending}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function SettingDescription({ children }: { children: ReactNode }) {
  return <p className="df-settings-group-desc">{children}</p>;
}
