// Single source of truth — synced from dialer app dashboard DISPOSITIONS list.

export const CALL_DISPOSITIONS = [
  { value: "Interested",         label: "Interested",         color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "Callback",           label: "Callback",           color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "App Received",       label: "App Received",       color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  { value: "Docs Received",      label: "Docs Received",      color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  { value: "Pending App & Docs", label: "Pending App & Docs", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "Deal Funded",        label: "Deal Funded",        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "Not Interested",     label: "Not Interested",     color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "No Answer",          label: "No Answer",          color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  { value: "Left Voicemail",     label: "Left Voicemail",     color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "Wrong Number",       label: "Wrong Number",       color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "DNC",                label: "DNC",                color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "completed",          label: "Completed",          color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
];

// Lead lifecycle statuses — pipeline stages merged with all dialer dispositions.
export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Callback",
  "Left Voicemail",
  "No Answer",
  "App Received",
  "Docs Received",
  "Pending App & Docs",
  "App Sent",
  "App Signed",
  "Deal Funded",
  "Not Interested",
  "Wrong Number",
  "DNC",
];

export function dispositionStyle(val) {
  return CALL_DISPOSITIONS.find(d => d.value === val)?.color
    ?? "bg-[#1e2130] text-[#8892a4] border-[#2d3748]";
}

export function dispositionLabel(val) {
  return CALL_DISPOSITIONS.find(d => d.value === val)?.label ?? val;
}
