/**
 * DimensionInput.jsx
 * Shared size controls for every quoter.
 *
 *  <UnitSelect>     – pick the display unit (mm, cm, m, in, ft)
 *  <DimensionInput> – a number box that SHOWS a length in the display unit but
 *                     reports it in the quoter's storage unit. Changing the
 *                     display unit re-shows the same length converted
 *                     (20cm → 0.2m) without changing what's priced.
 */
import { useEffect, useState } from "react";
import { UNITS, UNIT_KEYS, convertLength } from "../lib/units.js";

export function UnitSelect({ value, onChange, className = "", units = UNIT_KEYS, id, ariaLabel = "Unit" }) {
  return (
    <select id={id} aria-label={ariaLabel} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {units.map((u) => (
        <option key={u} value={u}>{UNITS[u].label} · {UNITS[u].name}</option>
      ))}
    </select>
  );
}

export function DimensionInput({ value, baseUnit, displayUnit, onChange, className = "", style, min = "0", ...rest }) {
  const shown = convertLength(value, baseUnit, displayUnit);
  // Keep the typed text while editing so "20." or "0.0" isn't snapped away.
  const [text, setText] = useState(String(shown));

  useEffect(() => {
    setText((cur) => (Number(cur) === shown && cur !== "" ? cur : String(shown)));
  }, [shown]);

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      step={UNITS[displayUnit]?.step ?? "any"}
      className={className}
      style={style}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        // Convert back to the storage unit without rounding to the display precision
        const factor = (UNITS[displayUnit]?.mm ?? 1) / (UNITS[baseUnit]?.mm ?? 1);
        onChange(isFinite(n) ? Math.round(n * factor * 1e6) / 1e6 : 0);
      }}
      {...rest}
    />
  );
}
