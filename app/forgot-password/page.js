"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(
        "Password reset email sent! Check your inbox (and spam folder).",
      );
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email address.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold">
            You<span className="text-cyan-400">Chat</span>
          </Link>
          <h2 className="text-2xl font-bold mt-4">Forgot Password?</h2>
          <p className="text-gray-400 text-sm mt-2">
            Enter your email to receive a reset link.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-500/10 border border-green-500 text-green-400 p-3 rounded-lg mb-4 text-sm text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link
            href="/login"
            className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
