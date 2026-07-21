'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Small form primitives shared by the TV Monitor builder sections.
 * Styling matches the admin editor conventions (label/input classes in globals.css).
 */

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-toca-navy focus:outline-none ${props.className ?? ''}`}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <TextInput
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-toca-navy' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        />
      </button>
    </label>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={isHex && value.length === 7 ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
        aria-label="Pick color"
      />
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="#0d4774 or rgba(...)" />
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-toca-navy focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultOpen = true,
  summary,
  warning = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Renders a click-to-toggle header; sections start closed with defaultOpen=false. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Short status chip shown next to the title (visible when collapsed too). */
  summary?: string;
  /** Amber-tints the summary chip for actionable gaps (e.g. "no media yet"). */
  warning?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="mb-3 mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        <div className="mt-3 space-y-3">{children}</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="flex shrink-0 items-center gap-2">
          {summary && (
            <span
              className={`max-w-[16rem] truncate rounded-full px-2.5 py-0.5 text-xs font-medium ${
                warning ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {summary}
            </span>
          )}
          <ChevronDown
            size={18}
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open && (
        <>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
          <div className="mt-3 space-y-3">{children}</div>
        </>
      )}
    </section>
  );
}
