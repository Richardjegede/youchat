"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import Link from "next/link";
import ProtectedRoute from "../components/ProtectedRoute";

export default function Messages() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", auth.currentUser.uid),
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rawConvos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔥 GHOST HUNTER: Clean up old conversations in the list view too
      const cleanupPromises = rawConvos.map(async (convo) => {
        if (convo.unreadCount > 0) {
          await updateDoc(doc(db, "conversations", convo.id), {
            unreadCount: 0,
            unreadCounts: convo.unreadCounts || {},
          }).catch((err) => console.error("List cleanup error:", err));
        }
        return convo;
      });

      await Promise.all(cleanupPromises);

      // Now fetch the correct names and calculate the NEW unread count
      const fixedConvos = await Promise.all(
        rawConvos.map(async (convo) => {
          const otherUserId = convo.participants.find(
            (p) => p !== auth.currentUser.uid,
          );

          if (otherUserId) {
            const userDoc = await getDoc(doc(db, "users", otherUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();

              // Use ONLY the new map
              const myUnread = convo.unreadCounts?.[auth.currentUser.uid] || 0;

              return {
                ...convo,
                otherUserId,
                otherUserName: userData.fullName || userData.username || "User",
                otherUserAvatar: userData.avatar || null,
                unreadCount: myUnread,
              };
            }
          }
          return convo;
        }),
      );

      const sortedConvos = fixedConvos
        .filter((convo) => convo.lastMessage && convo.lastMessage.trim() !== "")
        .sort((a, b) => {
          const timeA = a.lastMessageTime?.toDate()?.getTime() || 0;
          const timeB = b.lastMessageTime?.toDate()?.getTime() || 0;
          return timeB - timeA;
        });

      setConversations(sortedConvos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredConvos = conversations.filter((convo) => {
    if (activeTab === "unread") return convo.unreadCount > 0;
    if (activeTab === "favorites") return convo.isFavorite === true;
    return true;
  });

  const totalUnread = conversations.reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0,
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-6">Messages</h1>

          {/* SLEEK TABS BAR */}
          <div className="flex bg-[#111] border border-gray-800 rounded-xl p-1 mb-6">
            {["all", "unread", "favorites"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition capitalize flex items-center justify-center gap-1 ${
                  activeTab === tab
                    ? "bg-cyan-500 text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab}
                {tab === "unread" && totalUnread > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {totalUnread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : filteredConvos.length === 0 ? (
            <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-400 mb-4">No {activeTab} messages</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConvos.map((convo) => (
                <div
                  key={convo.id}
                  onClick={() => router.push(`/messages/${convo.id}`)}
                  className="bg-[#111] border border-gray-800 rounded-xl p-4 hover:border-cyan-500 transition flex items-center gap-4 cursor-pointer relative"
                >
                  {/* CLICKABLE PROFILE PICTURE */}
                  <Link
                    href={`/user/${convo.otherUserId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  >
                    {convo.otherUserAvatar ? (
                      <img
                        src={convo.otherUserAvatar}
                        className="w-12 h-12 rounded-full object-cover border border-gray-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg">
                        {convo.otherUserName?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}

                    {/* 🔥 GREEN ONLINE DOT (Tightened to 2 minutes) */}
                    {convo.otherUserLastSeen &&
                      (() => {
                        const timeDiff =
                          new Date().getTime() -
                          convo.otherUserLastSeen.toDate().getTime();
                        const isOnline = timeDiff < 120000; // 2 minutes
                        return isOnline ? (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#111] rounded-full"></span>
                        ) : null;
                      })()}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-white truncate">
                        {convo.otherUserName || "User"}
                      </p>
                      {convo.lastMessageTime && (
                        <p className="text-gray-500 text-xs whitespace-nowrap ml-2">
                          {new Date(
                            convo.lastMessageTime.toDate(),
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      {/* 🔥 MAGIC FIX: Show "Typing..." on the main list! */}
                      {convo.typing === convo.otherUserId ? (
                        <p className="text-cyan-400 text-sm font-bold animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
                          Typing...
                        </p>
                      ) : (
                        <p
                          className={`text-sm truncate ${convo.unreadCount > 0 ? "text-white font-semibold" : "text-gray-400"}`}
                        >
                          {convo.lastMessage}
                        </p>
                      )}

                      {convo.unreadCount > 0 && (
                        <span className="bg-cyan-500 text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
