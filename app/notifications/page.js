"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import Link from "next/link";
import ProtectedRoute from "../components/ProtectedRoute";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch notifications for the current user
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "message":
        return "💬";
      case "like":
        return "❤️";
      case "follow":
        return "👤";
      case "comment":
        return "🗨️";
      default:
        return "🔔";
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-6">Notifications</h1>

          {loading ? (
            <div className="text-center py-20">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
              <div className="text-6xl mb-4">🔔</div>
              <p className="text-gray-400 mb-4">No notifications yet</p>
              <p className="text-gray-500 text-sm">
                When someone interacts with you, it will show up here!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-4 rounded-xl border flex items-start gap-4 cursor-pointer transition ${
                    notif.read
                      ? "bg-[#111] border-gray-800"
                      : "bg-[#1a1a1a] border-cyan-500/30"
                  }`}
                >
                  <div className="text-2xl">{getIcon(notif.type)}</div>
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      <span className="font-semibold text-cyan-400">
                        {notif.senderName || "Someone"}
                      </span>{" "}
                      {notif.message || "You have a new notification"}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {notif.createdAt?.toDate().toLocaleString()}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
