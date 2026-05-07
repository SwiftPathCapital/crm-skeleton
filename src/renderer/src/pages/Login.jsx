// src/renderer/src/pages/Login.jsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/logo.png";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Fetch agent profile to get role
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (agentError) throw agentError;

      onLogin(data.user, agentData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center px-4"
      style={{
        background: "radial-gradient(ellipse at top, #0d1528 0%, #080b10 60%)"
      }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-900/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-[#0d1117] border border-[#1e2d4a] rounded-2xl p-8 shadow-2xl">
          
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img 
              src={logo} 
              alt="Swift Path Capital" 
              className="h-24 w-auto object-contain mb-4"
            />
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent opacity-30" />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-white text-xl font-bold tracking-wide">Agent Portal</h1>
            <p className="text-[#4a5568] text-sm mt-1">Sign in to access your leads</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[#8892a4] text-xs font-semibold uppercase tracking-wider block mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="agent@swiftpathcapital.com"
                className="w-full bg-[#080b10] border border-[#1e2d4a] rounded-lg px-4 py-3 text-white text-sm
                  placeholder-[#2d3748] focus:outline-none focus:border-[#c9a84c] focus:ring-1
                  focus:ring-[#c9a84c] transition-colors"
              />
            </div>

            <div>
              <label className="text-[#8892a4] text-xs font-semibold uppercase tracking-wider block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#080b10] border border-[#1e2d4a] rounded-lg px-4 py-3 text-white text-sm
                  placeholder-[#2d3748] focus:outline-none focus:border-[#c9a84c] focus:ring-1
                  focus:ring-[#c9a84c] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200
                bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] hover:from-[#e8c96d] hover:to-[#c9a84c]
                text-[#080b10] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-[#2d3748] text-xs">
              Swift Path Capital — Capitalize on Momentum
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
