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
  deleteDoc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase"; // 🔥 FIXED: Added 'db' back!
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import ProtectedRoute from "../components/ProtectedRoute";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [declining, setDeclining] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const q = query(
          collection(db, "notifications"),
          where("userId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
        );

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const notifs = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setNotifications(notifs);
            setLoading(false); // 🔥 THIS WILL NOW FIRE SUCCESSFULLY
          },
          (error) => {
            console.error("Notification fetch error:", error);
            setLoading(false); // 🔥 SAFETY NET: Stop loading even if there's an error
          },
        );

        return () => unsubscribe();
      } else {
        setLoading(false); // 🔥 SAFETY NET: Stop loading if no user
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAccept = async (notif) => {
    setAccepting(notif.id);
    try {
      await setDoc(
        doc(db, "groups", notif.groupId, "members", notif.actorUid),
        {
          userId: notif.actorUid,
          role: "member",
          joinedAt: serverTimestamp(),
          notificationsEnabled: true,
        },
      );

      const groupRef = doc(db, "groups", notif.groupId);
      const groupDoc = await getDoc(groupRef);
      if (groupDoc.exists()) {
        await updateDoc(groupRef, {
          memberCount: (groupDoc.data().memberCount || 1) + 1,
        });
      }

      await deleteDoc(doc(db, "notifications", notif.id));
    } catch (err) {
      console.error("Error accepting request:", err);
      alert("Failed to accept request");
    } finally {
      setAccepting(null);
    }
  };

  const handleDecline = async (notif) => {
    setDeclining(notif.id);
    try {
      await deleteDoc(doc(db, "notifications", notif.id));
    } catch (err) {
      console.error("Error declining request:", err);
      alert("Failed to decline request");
    } finally {
      setDeclining(null);
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
      case "group_join_request":
        return "👥";
      default:
        return "🔔";
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
          <div className="max-w-2xl mx-auto flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-6">Notifications</h1>

          {notifications.length === 0 ? (
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
                        {notif.actorName || "Someone"}
                      </span>{" "}
                      {notif.message || "You have a new notification"}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {notif.createdAt?.toDate
                        ? notif.createdAt.toDate().toLocaleString()
                        : "Just now"}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2"></div>
                  )}

                  {notif.type === "group_join_request" && (
                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(notif);
                        }}
                        disabled={accepting === notif.id}
                        className={`w-24 px-3 py-1 rounded-lg text-sm font-bold transition ${
                          accepting === notif.id
                            ? "bg-gray-500 text-gray-300"
                            : "bg-green-500 hover:bg-green-400 text-black"
                        }`}
                      >
                        {accepting === notif.id ? "Processing..." : "Accept"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDecline(notif);
                        }}
                        disabled={declining === notif.id}
                        className={`w-24 px-3 py-1 rounded-lg text-sm font-bold transition ${
                          declining === notif.id
                            ? "bg-gray-500 text-gray-300"
                            : "bg-red-500 hover:bg-red-400 text-white"
                        }`}
                      >
                        {declining === notif.id ? "Processing..." : "Decline"}
                      </button>
                    </div>
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
