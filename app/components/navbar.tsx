"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc, // 🔥 ADDED: Needed to auto-revoke expired verifications
} from "firebase/firestore";

export default function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(null);

  // 🔔 REAL-TIME UNREAD NOTIFICATIONS COUNTER & USER FETCH
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // 🔥 FETCH USER DATA to check if they are actually verified
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          let isCurrentlyVerified = userData.isVerified || false;

          // 🔥 AUTO-EXPIRATION CHECK (The SaaS Magic)
          if (userData.isVerified && userData.subscriptionEnd) {
            const expiryDate = new Date(userData.subscriptionEnd);
            const today = new Date();

            // If today is past the expiry date, revoke verification automatically!
            if (today > expiryDate) {
              console.log("⚠️ Verification expired! Revoking access...");
              await updateDoc(doc(db, "users", currentUser.uid), {
                isVerified: false,
              });
              isCurrentlyVerified = false; // Update local state immediately
            }
          }

          // Set the user with the updated (possibly revoked) status
          setUser({ ...userData, isVerified: isCurrentlyVerified });
        }

        const q = query(
          collection(db, "notifications"),
          where("userId", "==", currentUser.uid),
          where("read", "==", false),
        );

        const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
          setUnreadCount(snapshot.size);
        });

        return () => unsubscribeNotifs();
      } else {
        setUnreadCount(0);
        setUser(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setIsOpen(false);
    router.push("/login");
  };

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "YouChat",
        text: "Check out the African Student Super App!",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
    closeMenu();
  };

  return (
    <>
      {/* SLEEK TOP BAR */}
      <nav className="fixed top-0 w-full p-4 flex justify-between items-center z-50 bg-black/90 backdrop-blur-md border-b border-gray-800">
        {/* LOGO */}
        <Link href="/" className="text-xl font-bold tracking-tight">
          You<span className="text-cyan-400">Chat</span>
        </Link>

        {/* RIGHT SIDE ACTIONS */}
        <div className="flex items-center gap-3">
          {/* 🔔 NOTIFICATION BELL WITH BADGE */}
          <Link
            href="/notifications"
            className="relative w-10 h-10 bg-[#1a1a1a] hover:bg-[#222] rounded-xl flex items-center justify-center transition"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </Link>

          {/* 4x4 MENU BOX */}
          <button
            onClick={toggleMenu}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition active:scale-95 ${isOpen ? "bg-cyan-500" : "bg-white"}`}
          >
            <svg
              className={`w-6 h-6 ${isOpen ? "text-black" : "text-black"} transition`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* 🔥 CLEAN, SCROLLABLE MOBILE MENU SIDEBAR */}
      <div
        className={`fixed top-0 right-0 w-72 h-full bg-[#111] border-l border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          {/* Header with Close Button */}
          <div className="flex justify-between items-center p-6 border-b border-gray-800">
            <span className="text-lg font-bold text-white">Menu</span>
            <button
              onClick={closeMenu}
              className="text-gray-400 hover:text-white"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable Menu Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <Link
              href="/"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white"
            >
              <span className="text-xl">🏠</span>{" "}
              <span className="font-medium">Home</span>
            </Link>

            <Link
              href="/profile"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white"
            >
              <span className="text-xl">👤</span>{" "}
              <span className="font-medium">Profile</span>
            </Link>

            <Link
              href="/messages"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white"
            >
              <span className="text-xl">💬</span>{" "}
              <span className="font-medium">Messages</span>
            </Link>
            <Link
              href="/groups"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white"
            >
              <span className="text-xl">👥</span>
              <span className="font-medium">Groups</span>
            </Link>
            <Link
              href="/analytics"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white"
            >
              <span className="text-xl">📊</span>{" "}
              <span className="font-medium">Analytics</span>
            </Link>

            <Link
              href="/settings"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white"
            >
              <span className="text-xl">⚙️</span>{" "}
              <span className="font-medium">Page Settings</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white text-left"
            >
              <span className="text-xl">{isDarkMode ? "☀️" : "🌙"}</span>{" "}
              <span className="font-medium">Dark Mode</span>
            </button>

            <div className="border-t border-gray-700 my-2"></div>

            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white text-left"
            >
              <span className="text-xl">🔗</span>{" "}
              <span className="font-medium">Invite Friends</span>
            </button>

            <Link
              href="/advertise"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition text-white"
            >
              <span className="text-xl">📢</span>{" "}
              <span className="font-medium">Advertise</span>
            </Link>

            <div className="border-t border-gray-700 my-4"></div>

            {/* 🔥 CONDITIONAL VERIFICATION BADGE / BUTTON */}
            {user?.isVerified ? (
              <div className="bg-cyan-500/10 border border-cyan-500 rounded-lg p-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-cyan-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-cyan-400 font-semibold text-sm">
                  Verified Student
                </span>
              </div>
            ) : (
              <Link
                href="/verify"
                onClick={closeMenu}
                className="block w-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg p-3 flex items-center justify-center gap-2 hover:scale-[1.02] transition"
              >
                <span className="text-white font-semibold text-sm">
                  Get Verified (₦1,000/mo) ✓
                </span>
              </Link>
            )}
          </div>

          {/* Logout Button at the bottom */}
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/20 transition text-red-400 font-medium"
            >
              <span className="text-xl">🚪</span> <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* OVERLAY TO CLOSE MENU */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={closeMenu}
        ></div>
      )}
    </>
  );
}
