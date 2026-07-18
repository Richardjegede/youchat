"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import Link from "next/link";

export default function VerifyEmail() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (currentUser.emailVerified) {
          router.push("/"); // If already verified, go to home
        }
      } else {
        router.push("/register"); // If no user, go back to register
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleResend = async () => {
    if (!user) return;
    setSending(true);
    try {
      await sendEmailVerification(user);
      setMessage(
        "Verification email resent! Please check your inbox and spam folder.",
      );
    } catch (err) {
      setMessage("Failed to resend. Please try again later.");
    }
    setSending(false);
  };

  const handleCheck = async () => {
    if (user) {
      await user.reload(); // Refresh user data from Firebase
      if (user.emailVerified) {
        router.push("/"); // Success! Go to app
      } else {
        setMessage(
          "Email not verified yet. Please click the link in your email first.",
        );
      }
    }
  };

  if (!user)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111] border border-gray-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-cyan-400"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold mb-2">Verify Your Email</h2>
        <p className="text-gray-400 text-sm mb-6">
          We've sent a verification link to{" "}
          <span className="text-cyan-400 font-semibold">{user.email}</span>.
          <br />
          Please check your inbox (and spam folder) and click the link to
          activate your account.
        </p>

        {message && (
          <div className="bg-blue-500/10 border border-blue-500 text-blue-400 p-3 rounded-lg mb-4 text-sm">
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleCheck}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-lg transition"
          >
            I Have Verified My Email
          </button>

          <button
            onClick={handleResend}
            disabled={sending}
            className="w-full bg-[#1a1a1a] border border-gray-700 hover:border-cyan-400 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {sending ? "Sending..." : "Resend Verification Email"}
          </button>
        </div>

        <Link
          href="/login"
          className="block mt-6 text-gray-500 hover:text-white text-sm transition"
        >
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
