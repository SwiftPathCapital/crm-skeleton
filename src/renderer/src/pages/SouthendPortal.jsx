// src/renderer/src/pages/SouthendPortal.jsx
import React, { useState } from "react";

const PORTAL_URL = "https://portal.southendcapital.com/login";

export default function SouthendPortal() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  function handleLoad() {
    setLoading(false);
  }

  function handleError() {
    setLoading(false);
    setBlocked(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#0f1117] border-b border-[#1e2130] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center">
            <svg className="w-4 h-4 text-[#080b10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-sm font-semibold">Southend Capital Portal</h1>
            <p className="text-[#4a5568] text-xs">{PORTAL_URL}</p>
          </div>
        </div>
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2130] text-[#8892a4] hover:text-white text-xs font-medium transition-colors"
          title="Open in new tab"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in new tab
        </a>
      </div>

      {/* iframe area */}
      <div className="flex-1 relative bg-[#080b10]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#4a5568] text-sm">Loading Southend Capital Portal…</p>
            </div>
          </div>
        )}

        {blocked ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="w-16 h-16 rounded-full bg-[#1e2130] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Portal blocked embedding</h2>
              <p className="text-[#4a5568] text-sm mb-5">
                Southend Capital's portal has restricted iframe embedding for security reasons. You can still access it in a new tab.
              </p>
              <a
                href={PORTAL_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#c9a84c] text-[#080b10] font-semibold text-sm hover:bg-[#e8c96d] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Southend Capital Portal
              </a>
            </div>
          </div>
        ) : (
          <iframe
            src={PORTAL_URL}
            title="Southend Capital Portal"
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        )}
      </div>
    </div>
  );
}
