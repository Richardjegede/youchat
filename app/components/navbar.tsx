"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // 🔔 REAL-TIME UNREAD NOTIFICATIONS COUNTER (FIXED)
  useEffect(() => {
    // Wait for Firebase Auth to confirm who the user is
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false),
        );

        const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
          setUnreadCount(snapshot.size);
          // Debug: Check your console to see if it finds them!
          console.log("Unread notifications:", snapshot.size);
        });

        return () => unsubscribeNotifs();
      } else {
        setUnreadCount(0);
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
        {/* 🔍 SEARCH ICON */}
        <Link
          href="/search"
          className="relative w-10 h-10 bg-[#1a1a1a] hover:bg-[#222] rounded-xl flex items-center justify-center transition"
        >
          <span className="text-xl">🔍</span>
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

      {/* GLASSMORPHISM DROPDOWN MENU */}
      <div
        className={`fixed top-20 right-4 w-64 bg-black/95 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 z-50 ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}
      >
        <div className="p-2 space-y-1">
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

          <div className="border-t border-gray-700 my-2"></div>

          {/* VERIFIED BADGE */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/20 text-cyan-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-bold text-sm">Verified Student</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/20 transition text-red-400 text-left mt-2"
          >
            <span className="text-xl">🚪</span>{" "}
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* OVERLAY TO CLOSE MENU */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={closeMenu}></div>}
    </>
  );
}
