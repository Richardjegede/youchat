"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function BlockedUsers() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const blockedIds = userDoc.data().blockedUsers || [];

          // Fetch details of all blocked users
          const usersData = await Promise.all(
            blockedIds.map(async (userId: string) => {
              const userDoc = await getDoc(doc(db, "users", userId));
              if (userDoc.exists()) {
                return { id: userId, ...userDoc.data() };
              }
              return null;
            }),
          );

          setBlockedUsers(usersData.filter((user) => user !== null));
        }
      } catch (err) {
        console.error("Error fetching blocked users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockedUsers();
  }, [currentUser]);

  const handleUnblock = async (userId: string, userName: string) => {
    if (!currentUser) return;

    if (!window.confirm(`Unblock ${userName}?`)) return;

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        blockedUsers: arrayRemove(userId),
      });

      // Remove from UI immediately
      setBlockedUsers((prev) => prev.filter((user) => user.id !== userId));
      alert(`✅ You have unblocked ${userName}`);
    } catch (err) {
      console.error("Error unblocking user:", err);
      alert("Failed to unblock user.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
            <h1 className="text-xl font-bold">Blocked Users</h1>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-6">
          {blockedUsers.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4"></div>
              <h2 className="text-xl font-bold mb-2">No Blocked Users</h2>
              <p className="text-gray-400 text-sm">
                You haven't blocked anyone yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm mb-4">
                You have blocked {blockedUsers.length}{" "}
                {blockedUsers.length === 1 ? "user" : "users"}. Unblocking will
                allow them to see your profile and interact with you again.
              </p>

              {blockedUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-[#111] border border-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-bold text-gray-500">
                          {user.fullName?.charAt(0).toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">
                        {user.fullName || "Unknown User"}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        @{user.username || "user"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleUnblock(user.id, user.fullName || "this user")
                    }
                    className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-full text-sm font-bold transition"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
