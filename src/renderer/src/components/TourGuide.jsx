// src/renderer/src/components/TourGuide.jsx
import React, { useEffect, useState } from "react";

const BASE_STEPS = [
  {
    view: null,
    title: "Welcome to Swift Path CRM",
    body: "This quick tour walks you through every section of the app. Use the arrows to move between pages — we'll navigate there automatically.",
  },
  {
    view: "my-leads",
    title: "My Leads",
    body: "Your assigned leads live here. Click any row to expand it and see contact info, notes, call history, and documents. Use the search and filter bar to zero in on specific leads quickly.",
  },
  {
    view: "deal-pipeline",
    title: "Deal Pipeline",
    body: "Track every active deal from submission through funding. Move deals through stages, attach commission notes, and keep an eye on what's pending approval.",
  },
  {
    view: "clients",
    title: "My Clients",
    body: "Funded clients live here after a deal closes. Keep their info and history in one place for renewals and follow-ups.",
  },
  {
    view: "live-transfers",
    title: "Live Transfer Tracker",
    body: "Log every live transfer call — customer name, number, email, state, vendor (e.g. SDLT), and status. Update the status as the deal progresses from Pending to Funded.",
  },
  {
    view: "new-application",
    title: "Applications",
    body: "Fill out and send a merchant cash advance application directly from here. The form emails the submission package and generates a signature request automatically.",
  },
  {
    view: "email-client",
    title: "Email",
    body: "Send and receive emails through your connected Zoho account. Use the rich-text composer to format messages and attach files straight from your computer.",
  },
  {
    view: "messaging",
    title: "Messaging",
    body: "SMS conversations with your leads powered by Telnyx. The badge on this icon shows unread messages. Replies come in real-time so you never miss a response.",
  },
  {
    view: "calendar",
    title: "Calendar",
    body: "Schedule callbacks, follow-ups, and meetings. Events sync with your Zoho Calendar so they show up on all your devices.",
  },
  {
    view: "scripts",
    title: "Scripts",
    body: "Access call scripts and objection-handling guides right inside the CRM so you never have to switch windows mid-call.",
  },
];

const ADMIN_STEPS = [
  {
    view: "admin-dashboard",
    title: "Admin Dashboard",
    body: "A bird's-eye view of the entire team — call volume, lead counts, deal activity, and agent performance all in one place.",
  },
  {
    view: "agent-management",
    title: "Agent Management",
    body: "Add agents, set roles, and assign SIP credentials and DIDs for the softphone. Changes here take effect immediately.",
  },
  {
    view: "agent-leads",
    title: "Agent Leads",
    body: "See every lead broken down by agent. Great for spotting who needs more pipeline and who's due for a check-in.",
  },
  {
    view: "settings",
    title: "Settings",
    body: "Configure dispositions, branding, DID assignments, and other CRM-wide options. Most settings here are admin-only.",
  },
];

export default function TourGuide({ setActiveView, isAdmin, onExit }) {
  const steps = isAdmin ? [...BASE_STEPS, ...ADMIN_STEPS] : BASE_STEPS;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const target = steps[step]?.view;
    if (target) setActiveView(target);
  }, [step]);

  function prev() { setStep(s => Math.max(0, s - 1)); }
  function next() {
    if (step < steps.length - 1) setStep(s => s + 1);
    else onExit();
  }

  const current = steps[step];
  const isLast  = step === steps.length - 1;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
      <div className="pointer-events-auto bg-[#0f1117] border border-[#2d3748] rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-[#1e2130]">
          <div
            className="h-1 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="px-5 py-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <span className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-wider">
                Step {step + 1} of {steps.length}
              </span>
              <h3 className="text-white font-semibold text-base leading-tight mt-0.5">{current.title}</h3>
            </div>
            <button
              onClick={onExit}
              className="text-[#4a5568] hover:text-white transition-colors flex-shrink-0 mt-0.5"
              title="Exit tour"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-[#8892a4] leading-relaxed">{current.body}</p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`rounded-full transition-all ${
                    i === step
                      ? "w-4 h-2 bg-[#c9a84c]"
                      : "w-2 h-2 bg-[#2d3748] hover:bg-[#4a5568]"
                  }`}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#8892a4] hover:text-white hover:bg-[#1e2130] transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 transition-all"
              >
                {isLast ? "Done" : "Next"}
                {!isLast && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
