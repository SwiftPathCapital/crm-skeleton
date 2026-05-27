// Single source of truth for dispositions — synced from the dialer's dialer_calls.disposition values.

export const CALL_DISPOSITIONS = [
  { value: "Callback",       label: "Callback",       color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "No Answer",      label: "No Answer",      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "Not Interested", label: "Not Interested", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "Wrong Number",   label: "Wrong Number",   color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  { value: "DNC",            label: "DNC",            color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "completed",      label: "Completed",      color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
];

// Lead lifecycle statuses — pipeline stages + dialer dispositions merged.
export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Callback",
  "No Answer",
  "Not Interested",
  "Wrong Number",
  "App Sent",
  "App Signed",
  "Funded",
  "DNC",
];

export function dispositionStyle(val) {
  return CALL_DISPOSITIONS.find(d => d.value === val)?.color
    ?? "bg-[#1e2130] text-[#8892a4] border-[#2d3748]";
}

export function dispositionLabel(val) {
  return CALL_DISPOSITIONS.find(d => d.value === val)?.label ?? val;
}
