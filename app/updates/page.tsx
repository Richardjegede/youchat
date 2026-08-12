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
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";

export default function UpdatesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const q = query(
      collection(db, "stories"),
      where("expiresAt", ">", twentyFourHoursAgo),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allStories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Group stories by user
      const grouped: any = {};
      allStories.forEach((story) => {
        if (!grouped[story.userId]) {
          grouped[story.userId] = {
            userId: story.userId,
            userName: story.userName,
            userAvatar: story.userAvatar,
            stories: [],
            isSponsored: story.isSponsored || false,
            viewers: story.viewers || [],
          };
        }
        grouped[story.userId].stories.push(story);
      });

      // Sort stories within each group
      Object.values(grouped).forEach((group: any) => {
        group.stories.sort(
          (a: any, b: any) =>
            (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0),
        );
      });

      setStories(Object.values(grouped));
      setLoading(false);
    });
    // 🔥 TRIGGER CLEANUP
    fetch("/api/cleanup-statuses", { method: "POST" })
      .then((res) => res.json())
      .then((data) =>
        console.log(
          `🧹 Cleaned up ${data.deletedStories || 0} expired stories!`,
        ),
      )
      .catch((err) => console.error("Cleanup failed", err));

    return () => unsubscribe();
  }, []);

  const handleViewStory = (group: any) => {
    // Navigate to the full-screen viewer
    router.push(`/updates/${group.userId}`);
  };

  const handleViewersList = (group: any) => {
    // Open a simple alert/modal showing who viewed YOUR status
    if (group.viewers.length === 0) {
      alert("No one has viewed your status yet! 👀");
      return;
    }

    // In a real app, we'd fetch their names. For now, let's show the count and IDs
    // We will upgrade this to show avatars in the next step!
    alert(
      `️ ${group.viewers.length} people viewed your status!\n\nViewers: ${group.viewers.length} users.`,
    );
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white pt-24">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-20 pb-24">
        {/* HEADER */}
        <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 z-10 flex justify-between items-center max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Updates</h1>
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 text-sm"
          >
            Close
          </button>
        </div>

        {/* STATUS LIST */}
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {stories.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No active stories</p>
              <p className="text-gray-500 text-sm mt-2">
                Be the first to post an update!
              </p>
            </div>
          ) : (
            stories.map((group: any) => {
              const isMyStory = auth.currentUser?.uid === group.userId;

              return (
                <div
                  key={group.userId}
                  className="flex items-center gap-4 p-3 bg-[#111] rounded-xl"
                >
                  {/* AVATAR WITH RING */}
                  <div
                    onClick={() => handleViewStory(group)}
                    className={`relative w-14 h-14 rounded-full p-0.5 cursor-pointer ${group.isSponsored ? "bg-gradient-to-r from-yellow-500 to-orange-500" : "bg-gradient-to-r from-cyan-500 to-blue-500"}`}
                  >
                    <div className="w-full h-full rounded-full bg-[#0a0a0a] p-0.5">
                      {group.userAvatar ? (
                        <img
                          src={group.userAvatar}
                          alt={group.userName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-xl">
                          {group.userName?.charAt(0) || "?"}
                        </div>
                      )}
                    </div>
                    {group.isSponsored && (
                      <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded">
                        AD
                      </div>
                    )}
                  </div>

                  {/* USER INFO */}
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleViewStory(group)}
                  >
                    <h3 className="font-bold text-white flex items-center gap-2">
                      {group.userName}
                      {isMyStory && (
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                          Your story
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-400 text-xs">
                      {group.stories.length}{" "}
                      {group.stories.length === 1 ? "story" : "stories"} •{" "}
                      {new Date(
                        group.stories[0].createdAt?.toDate?.() || Date.now(),
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* 🔥 THE EYE ICON (Only visible to the owner) */}
                  {isMyStory && (
                    <button
                      onClick={() => handleViewersList(group)}
                      className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-full transition"
                    >
                      <svg
                        className="w-4 h-4 text-cyan-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <span className="text-xs font-bold text-white">
                        {group.viewers.length}
                      </span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
