"use client";

import { useRouter } from "next/navigation";
import ProtectedRoute from "../components/ProtectedRoute";
import Link from "next/link";

export default function Settings() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
        {/* HEADER */}
        <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-800/50">
          <div className="max-w-md mx-auto flex items-center gap-4 px-4 py-3">
            <button
              onClick={() => router.back()}
              className="text-white hover:text-cyan-400 transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          {/* ACCOUNT SETTINGS */}
          <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-bold text-lg">Account</h2>
            </div>
            <div className="divide-y divide-gray-800">
              <Link
                href="/profile/edit"
                className="flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition"
              >
                <span>Edit Profile</span>
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
              <Link
                href="/settings/blocked"
                className="flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition"
              >
                <span>Blocked Users</span>
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* PRIVACY */}
          <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-bold text-lg">Privacy</h2>
            </div>
            <div className="divide-y divide-gray-800">
              <Link
                href="/settings/privacy"
                className="flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition"
              >
                <span>Privacy Settings</span>
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
