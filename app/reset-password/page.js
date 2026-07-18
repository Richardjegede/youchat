"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [oobCode, setOobCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const code = searchParams.get("oobCode");
    if (code) {
      setOobCode(code);
      // Verify the code is valid immediately
      verifyPasswordResetCode(auth, code)
        .then((email) => {
          setVerified(true);
        })
        .catch((err) => {
          setError(
            "This reset link is invalid or has expired. Please request a new one.",
          );
        });
    } else {
      setError("No reset code found. Please use the link from your email.");
    }
  }, [searchParams]);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess("Password reset successful! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError("Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!verified && !error && !success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold">
            You<span className="text-cyan-400">Chat</span>
          </Link>
          <h2 className="text-2xl font-bold mt-4">Reset Password</h2>
          <p className="text-gray-400 text-sm mt-2">
            Enter your new password below.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500 text-green-400 p-3 rounded-lg mb-4 text-sm text-center">
            {success}
          </div>
        )}

        {verified && !success && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

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
