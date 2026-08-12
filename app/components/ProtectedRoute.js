"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
// 🔥 ALL NECESSARY IMPORTS INCLUDED (No more missing function errors!)
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  orderBy,
  limit,
  serverTimestamp, // 🔥 ADDED THIS RIGHT HERE!
} from "firebase/firestore";
import Link from "next/link";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [coinBalance, setCoinBalance] = useState(0);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [totalGroupUnread, setTotalGroupUnread] = useState(0);

  // 🔥 NEW: Toast Notification State
  const [toast, setToast] = useState(null);

  // 1. AUTH & COIN BALANCE LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            // 🔥 FIX: Define userData first, then use it!
            const userData = userDoc.data();
            setCoinBalance(userData.coinBalance || 0);
            setTotalGroupUnread(userData.totalGroupUnread || 0);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. UNREAD MESSAGES BADGE + GHOST HUNTER CLEANUP
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", auth.currentUser.uid),
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let totalUnread = 0;
      const cleanupPromises = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const convoId = docSnap.id;

        // 🔥 GHOST HUNTER: If the old "unreadCount" field exists and is > 0, reset it!
        if (data.unreadCount > 0) {
          cleanupPromises.push(
            updateDoc(doc(db, "conversations", convoId), {
              unreadCount: 0, // Banish the old ghost to 0
              unreadCounts: data.unreadCounts || {}, // Ensure the new map exists
            }).catch((err) => console.error("Auto-cleanup error:", err)),
          );
        }

        // Calculate using ONLY the new, perfect unreadCounts map
        const myUnread = data.unreadCounts?.[auth.currentUser.uid] || 0;
        totalUnread += myUnread;
      });

      // Run the cleanups in the background
      if (cleanupPromises.length > 0) {
        await Promise.all(cleanupPromises);
      }

      setTotalUnreadMessages(totalUnread);
    });

    return () => unsubscribe();
  }, []);

  // 3. 🔥 LIVE IN-APP TOAST NOTIFICATION LISTENER (No Firestore Index Required!)
  // 3. 🔥 LIVE IN-APP TOAST NOTIFICATION LISTENER (BULLETPROOF)
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      where("read", "==", false),
      limit(10),
    );

    // 🔥 FIX 1: Make the callback async so we can fetch missing names from the database
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        docs.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.() || new Date(0);
          const timeB = b.createdAt?.toDate?.() || new Date(0);
          return timeB.getTime() - timeA.getTime();
        });

        const newNotif = docs[0];
        const notifTime = newNotif.createdAt?.toDate?.() || new Date();
        const now = new Date();

        if (now - notifTime < 15000) {
          let icon = "";
          let link = "/notifications";

          // Get the sender's ID (could be senderId or actorUid depending on the feature)
          const senderId = newNotif.senderId || newNotif.actorUid;
          let title = newNotif.senderName || "Someone";

          // 🔥 FIX 2: If senderName is missing, fetch it dynamically from the users collection!
          if (!newNotif.senderName && senderId) {
            try {
              const userDoc = await getDoc(doc(db, "users", senderId));
              if (userDoc.exists()) {
                title =
                  userDoc.data().fullName ||
                  userDoc.data().username ||
                  "Someone";
              }
            } catch (err) {
              console.error("Error fetching sender name for toast:", err);
            }
          }

          let subtitle = "interacted with you";
          if (newNotif.type === "message") {
            icon = "";
            link = "/messages";
            subtitle = "sent you a message";
          } else if (newNotif.type === "gift") {
            icon = "🎁";
            link = "/analytics";
            subtitle = "sent you a gift";
          } else if (newNotif.type === "follow") {
            icon = "👤";
            link = "/notifications";
            subtitle = "started following you";
          } else if (newNotif.type === "comment") {
            icon = "💬";
            link = "/notifications";
            subtitle = "commented on your post";
          } else if (newNotif.type === "reply") {
            icon = "↩️";
            link = "/notifications";
            subtitle = "replied to your comment";
          } else if (newNotif.type === "like") {
            icon = "❤️";
            link = "/notifications";
            subtitle = "liked your post";
          }

          setToast({
            id: newNotif.id,
            icon: icon,
            title: title,
            message: subtitle,
            link: link,
          });

          setTimeout(() => setToast(null), 6000);
        }
      }
    });

    return () => unsubscribe();

    // 🔥 FIX 3: Add auth.currentUser?.uid to dependencies!
    // This ensures the listener RESTARTS when you switch accounts!
  }, [auth.currentUser?.uid]);

  // 🔥 GLOBAL ONLINE STATUS TRACKER (TIGHT & BULLETPROOF)
  useEffect(() => {
    if (!auth.currentUser) return;

    const updateLastSeen = () => {
      updateDoc(doc(db, "users", auth.currentUser.uid), {
        lastSeen: serverTimestamp(),
      }).catch((err) => console.error("Error updating lastSeen:", err));
    };

    updateLastSeen();

    // 🔥 FIX: Ping every 30 seconds instead of 60. This keeps the timestamp fresh!
    const interval = setInterval(updateLastSeen, 30000);

    const handleUnload = () => {
      updateLastSeen();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      updateLastSeen();
    };
  }, []);
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {/* 🔥 LIVE TOAST NOTIFICATION UI */}
      {toast && (
        <Link href={toast.link} onClick={() => setToast(null)}>
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[60] w-[90%] max-w-md bg-[#1a1a1a]/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 shadow-2xl shadow-cyan-500/10 flex items-center gap-4 cursor-pointer hover:bg-[#222] transition animate-in slide-in-from-top-5 fade-in duration-300">
            <div className="text-3xl">{toast.icon}</div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">{toast.title}</p>
              <p className="text-gray-400 text-xs">{toast.message}</p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setToast(null);
              }}
              className="text-gray-500 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        </Link>
      )}

      {/* 🔥 1. GLOBAL TOP HEADER */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-md mx-auto flex justify-between items-center px-4 py-3">
          <h1 className="text-xl font-bold text-cyan-400 tracking-tight">
            YouChat
          </h1>
          <div className="flex items-center gap-3">
            <div className="bg-[#1a1a1a] border border-gray-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-yellow-400 shadow-sm">
              <span>🪙</span>{" "}
              <span>{coinBalance > 0 ? coinBalance.toLocaleString() : 0}</span>
            </div>
            <button className="relative p-2 text-gray-400 hover:text-white transition">
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a]"></span>
            </button>
          </div>
        </div>
      </div>

      {/* 🔥 2. THE ACTUAL PAGE CONTENT */}
      <div className="pt-16 pb-24 min-h-screen bg-[#0a0a0a]">{children}</div>

      {/* 🔥 3. GLOBAL BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-gray-800/50 pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center py-3 px-2">
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 transition-all ${pathname === "/" ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
          >
            <svg
              className="w-6 h-6"
              fill={pathname === "/" ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-[10px] font-bold">Feed</span>
          </Link>

          <Link
            href="/messages"
            className={`relative flex flex-col items-center gap-1 transition-all ${pathname.startsWith("/messages") ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
          >
            <svg
              className="w-6 h-6"
              fill={pathname.startsWith("/messages") ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-[10px] font-bold">Chat</span>
            {totalUnreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">
                {totalUnreadMessages > 99 ? "99+" : totalUnreadMessages}
              </span>
            )}
          </Link>

          <Link
            href="/groups"
            className={`relative flex flex-col items-center gap-1 transition-all ${pathname.startsWith("/groups") ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
          >
            <svg
              className="w-6 h-6"
              fill={pathname.startsWith("/groups") ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-[10px] font-bold">Groups</span>

            {/* 🔥 DYNAMIC GROUP UNREAD BADGE */}
            {totalGroupUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">
                {totalGroupUnread > 99 ? "99+" : totalGroupUnread}
              </span>
            )}
          </Link>

          <Link
            href="/youbuy"
            className={`flex flex-col items-center gap-1 transition-all ${pathname === "/youbuy" ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
          >
            <svg
              className="w-6 h-6"
              fill={pathname === "/youbuy" ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-[10px] font-bold">YouBuy</span>
          </Link>

          <Link
            href="/services"
            className={`flex flex-col items-center gap-1 transition-all ${pathname.startsWith("/services") ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
          >
            <svg
              className="w-6 h-6"
              fill={pathname.startsWith("/services") ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-[10px] font-bold">Services</span>
          </Link>
        </div>
      </div>
    </>
  );
}
