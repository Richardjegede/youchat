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
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import ProtectedRoute from "../components/ProtectedRoute";
import { useRouter } from "next/navigation";

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [accepting, setAccepting] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const q = query(
          collection(db, "notifications"),
          where("userId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
          let notifs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Fetch actor names
          for (let notif of notifs) {
            if (!notif.actorName && notif.actorUid) {
              try {
                const userDoc = await getDoc(doc(db, "users", notif.actorUid));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  notif.actorName = data.fullName || data.username || "User";
                  notif.actorUsername = data.username || "";
                }
              } catch (err) {
                console.error("Error fetching user name:", err);
              }
            }
          }

          setNotifications(notifs);
          setLoading(false);
        });

        return () => unsubscribe();
      } else {
        setLoading(false);
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

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const unreadNotifs = notifications.filter((n) => !n.read);
      const updatePromises = unreadNotifs.map((notif) =>
        updateDoc(doc(db, "notifications", notif.id), { read: true }),
      );
      await Promise.all(updatePromises);
    } catch (err) {
      console.error("Error marking all as read:", err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  // 🔥 NEW: CLEAR ALL NOTIFICATIONS (DELETE FROM DATABASE)
  const clearAllNotifications = async () => {
    if (
      !confirm(
        "⚠️ WARNING: This will PERMANENTLY DELETE all your notifications. This cannot be undone. Are you sure?",
      )
    ) {
      return;
    }

    setClearingAll(true);
    try {
      // Use batch write for efficiency (max 500 per batch)
      const batch = writeBatch(db);
      notifications.forEach((notif) => {
        const notifRef = doc(db, "notifications", notif.id);
        batch.delete(notifRef);
      });

      await batch.commit();
      alert("✅ All notifications cleared successfully!");
    } catch (err) {
      console.error("Error clearing notifications:", err);
      alert("Failed to clear notifications. Please try again.");
    } finally {
      setClearingAll(false);
      setShowClearConfirm(false);
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

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id);

    if (notif.type === "gift" || notif.type === "gift_sent") {
      router.push(`/user/${notif.actorUid}`);
    } else if (notif.type === "like" || notif.type === "comment") {
      router.push(`/`);
    } else if (notif.type === "follow") {
      router.push(`/user/${notif.actorUid}`);
    } else if (notif.type === "message") {
      router.push(`/messages`);
    }
  };

  const getNotificationStyle = (type) => {
    switch (type) {
      case "gift":
        return {
          icon: "🎁",
          color: "from-pink-500 to-purple-600",
          bg: "bg-pink-500/10",
          border: "border-pink-500/30",
        };
      case "gift_sent":
        return {
          icon: "✅",
          color: "from-green-500 to-emerald-600",
          bg: "bg-green-500/10",
          border: "border-green-500/30",
        };
      case "like":
        return {
          icon: "❤️",
          color: "from-red-500 to-pink-600",
          bg: "bg-red-500/10",
          border: "border-red-500/30",
        };
      case "comment":
        return {
          icon: "💬",
          color: "from-blue-500 to-cyan-600",
          bg: "bg-blue-500/10",
          border: "border-blue-500/30",
        };
      case "follow":
        return {
          icon: "👤",
          color: "from-purple-500 to-indigo-600",
          bg: "bg-purple-500/10",
          border: "border-purple-500/30",
        };
      case "message":
        return {
          icon: "✉️",
          color: "from-cyan-500 to-blue-600",
          bg: "bg-cyan-500/10",
          border: "border-cyan-500/30",
        };
      case "group_join_request":
        return {
          icon: "👥",
          color: "from-orange-500 to-red-600",
          bg: "bg-orange-500/10",
          border: "border-orange-500/30",
        };
      default:
        return {
          icon: "🔔",
          color: "from-gray-500 to-gray-600",
          bg: "bg-gray-500/10",
          border: "border-gray-500/30",
        };
    }
  };

  const filterNotifications = () => {
    if (activeTab === "all") return notifications;
    if (activeTab === "gifts")
      return notifications.filter(
        (n) => n.type === "gift" || n.type === "gift_sent",
      );
    if (activeTab === "social")
      return notifications.filter((n) =>
        ["like", "comment", "follow"].includes(n.type),
      );
    if (activeTab === "system")
      return notifications.filter((n) =>
        ["message", "group_join_request"].includes(n.type),
      );
    return notifications;
  };

  const groupByDate = (notifs) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    notifs.forEach((notif) => {
      const notifDate = notif.createdAt?.toDate?.() || new Date();
      if (notifDate >= today) {
        groups.today.push(notif);
      } else if (notifDate >= yesterday) {
        groups.yesterday.push(notif);
      } else if (notifDate >= weekAgo) {
        groups.thisWeek.push(notif);
      } else {
        groups.older.push(notif);
      }
    });

    return groups;
  };

  const tabs = [
    { id: "all", label: "All", icon: "" },
    { id: "gifts", label: "Gifts", icon: "🎁" },
    { id: "social", label: "Social", icon: "❤️" },
    { id: "system", label: "System", icon: "⚙️" },
  ];

  const filteredNotifs = filterNotifications();
  const groupedNotifs = groupByDate(filteredNotifs);
  const unreadCount = notifications.filter((n) => !n.read).length;

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
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-gray-400 text-sm mt-1">
                  {unreadCount} unread notification
                  {unreadCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {/* MARK ALL AS READ */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={markingAllRead}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-full text-sm font-bold transition disabled:opacity-50"
                >
                  {markingAllRead ? "Marking..." : "Mark all read"}
                </button>
              )}

              {/* 🔥 CLEAR ALL BUTTON */}
              {notifications.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={clearingAll}
                  className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-sm font-bold transition disabled:opacity-50"
                >
                  {clearingAll ? "Clearing..." : "Clear All"}
                </button>
              )}
            </div>
          </div>

          {/* CONFIRMATION MODAL */}
          {showClearConfirm && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-[#151515] border border-red-500/50 rounded-2xl p-6 max-w-md w-full">
                <div className="text-center">
                  <div className="text-5xl mb-4">🗑️</div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    Clear All Notifications?
                  </h2>
                  <p className="text-gray-400 text-sm mb-6">
                    This will{" "}
                    <span className="text-red-400 font-bold">
                      PERMANENTLY DELETE
                    </span>{" "}
                    all {notifications.length} notification(s) from your
                    database. This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 bg-[#1a1a1a] hover:bg-[#222] py-3 rounded-xl font-semibold text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={clearAllNotifications}
                      disabled={clearingAll}
                      className="flex-1 bg-red-500 hover:bg-red-400 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {clearingAll ? "Deleting..." : "Yes, Delete All"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABS */}
          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-white text-black scale-105"
                    : "bg-[#1a1a1a] text-gray-400 hover:bg-[#222]"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* NOTIFICATIONS LIST */}
          {filteredNotifs.length === 0 ? (
            <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
              <div className="text-6xl mb-4">🔔</div>
              <p className="text-gray-400 mb-4">No notifications yet</p>
              <p className="text-gray-500 text-sm">
                When someone interacts with you, it will show up here!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedNotifs.today.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Today
                  </h3>
                  <div className="space-y-2">
                    {groupedNotifs.today.map((notif) => (
                      <NotificationItem
                        key={notif.id}
                        notif={notif}
                        getNotificationStyle={getNotificationStyle}
                        handleNotificationClick={handleNotificationClick}
                        handleAccept={handleAccept}
                        handleDecline={handleDecline}
                        accepting={accepting}
                        declining={declining}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedNotifs.yesterday.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Yesterday
                  </h3>
                  <div className="space-y-2">
                    {groupedNotifs.yesterday.map((notif) => (
                      <NotificationItem
                        key={notif.id}
                        notif={notif}
                        getNotificationStyle={getNotificationStyle}
                        handleNotificationClick={handleNotificationClick}
                        handleAccept={handleAccept}
                        handleDecline={handleDecline}
                        accepting={accepting}
                        declining={declining}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedNotifs.thisWeek.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    This Week
                  </h3>
                  <div className="space-y-2">
                    {groupedNotifs.thisWeek.map((notif) => (
                      <NotificationItem
                        key={notif.id}
                        notif={notif}
                        getNotificationStyle={getNotificationStyle}
                        handleNotificationClick={handleNotificationClick}
                        handleAccept={handleAccept}
                        handleDecline={handleDecline}
                        accepting={accepting}
                        declining={declining}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedNotifs.older.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Older
                  </h3>
                  <div className="space-y-2">
                    {groupedNotifs.older.map((notif) => (
                      <NotificationItem
                        key={notif.id}
                        notif={notif}
                        getNotificationStyle={getNotificationStyle}
                        handleNotificationClick={handleNotificationClick}
                        handleAccept={handleAccept}
                        handleDecline={handleDecline}
                        accepting={accepting}
                        declining={declining}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

// =================================================================
// NOTIFICATION ITEM COMPONENT
// =================================================================
function NotificationItem({
  notif,
  getNotificationStyle,
  handleNotificationClick,
  handleAccept,
  handleDecline,
  accepting,
  declining,
}) {
  const style = getNotificationStyle(notif.type);

  return (
    <div
      onClick={() => handleNotificationClick(notif)}
      className={`p-4 rounded-xl border flex items-start gap-4 cursor-pointer transition hover:scale-[1.02] ${
        notif.read
          ? "bg-[#111] border-gray-800"
          : `bg-gradient-to-r ${style.bg} ${style.border}`
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${style.color} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}
      >
        {style.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm">
          {notif.type !== "gift_sent" && notif.actorUid ? (
            <Link
              href={`/user/${notif.actorUid}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-cyan-400 hover:underline mr-1"
            >
              {notif.actorName || "Someone"}
            </Link>
          ) : null}
          {notif.message || "You have a new notification"}
        </p>
        <p className="text-gray-500 text-xs mt-1">
          {notif.createdAt?.toDate
            ? notif.createdAt
                .toDate()
                .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Just now"}
        </p>
      </div>

      {!notif.read && (
        <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2 flex-shrink-0"></div>
      )}

      {notif.type === "group_join_request" && (
        <div
          className="flex flex-col gap-2 mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleAccept(notif)}
            disabled={accepting === notif.id}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              accepting === notif.id
                ? "bg-gray-500 text-gray-300"
                : "bg-green-500 hover:bg-green-400 text-black"
            }`}
          >
            {accepting === notif.id ? "Processing..." : "Accept"}
          </button>
          <button
            onClick={() => handleDecline(notif)}
            disabled={declining === notif.id}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
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
  );
}
