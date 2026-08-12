"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function StatusViewerPage() {
  const { userId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const startIndex = parseInt(searchParams.get("startIndex") || "0");

  const [stories, setStories] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const currentUser = auth.currentUser;

  // 🔥 FETCH STORIES FOR THIS USER
  useEffect(() => {
    const fetchStories = async () => {
      if (!userId) return;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const q = query(
        collection(db, "stories"),
        where("userId", "==", userId),
        where("expiresAt", ">", twentyFourHoursAgo),
      );

      const snapshot = await getDocs(q);
      const fetchedStories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      fetchedStories.sort(
        (a, b) =>
          (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0),
      );

      setStories(fetchedStories);

      if (currentUser && fetchedStories[startIndex]) {
        const likes = fetchedStories[startIndex].likes || [];
        setIsLiked(likes.includes(currentUser.uid));
      }
    };

    fetchStories();
  }, [userId, startIndex, currentUser]);

  // 🔥 MARK AS VIEWED AUTOMATICALLY
  useEffect(() => {
    const markAsViewed = async () => {
      if (currentUser && stories[currentIndex]) {
        try {
          await updateDoc(doc(db, "stories", stories[currentIndex].id), {
            viewers: arrayUnion(currentUser.uid),
          });
        } catch (err) {
          console.error("Error marking as viewed:", err);
        }
      }
    };
    markAsViewed();
  }, [currentIndex, stories, currentUser]);

  // 🔥 AUTO-ADVANCE PROGRESS BAR
  useEffect(() => {
    if (stories.length === 0 || isPaused) return;

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + 2; // 2% every 100ms = 5 seconds total
      });
    }, 100);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [currentIndex, stories.length, isPaused]);

  // 🔥 NAVIGATION HANDLERS
  const handleNext = () => {
    setProgress(0);
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      checkLikeStatus(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      checkLikeStatus(currentIndex - 1);
    } else {
      router.back();
    }
  };

  const checkLikeStatus = (index: number) => {
    if (currentUser && stories[index]) {
      const likes = stories[index].likes || [];
      setIsLiked(likes.includes(currentUser.uid));
    }
  };

  // 🔥 ACTION HANDLERS
  const handleLike = async () => {
    if (!currentUser || !stories[currentIndex]) return;
    const storyId = stories[currentIndex].id;

    try {
      if (isLiked) {
        await updateDoc(doc(db, "stories", storyId), {
          likes: arrayRemove(currentUser.uid),
        });
        setIsLiked(false);
      } else {
        await updateDoc(doc(db, "stories", storyId), {
          likes: arrayUnion(currentUser.uid),
        });
        setIsLiked(true);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const handleReply = () => {
    router.push(
      `/messages?userId=${userId}&replyToStory=${stories[currentIndex].id}`,
    );
  };

  const handleGift = () => {
    alert(`🎁 Opening Gift Selector for ${stories[currentIndex].userName}...`);
  };

  const currentStory = stories[currentIndex];

  if (!currentStory) {
    return (
      <ProtectedRoute>
        <div className="fixed inset-0 bg-black flex items-center justify-center text-white z-[100]">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      {/* 🔥 CHANGED z-50 to z-[100] TO SIT ABOVE THE MAIN APP NAV BAR */}
      <div className="fixed inset-0 bg-black z-[100] flex flex-col">
        {/* 1. PROGRESS BARS */}
        <div className="absolute top-0 left-0 right-0 p-2 pt-3 flex gap-1 z-20">
          {stories.map((_, idx) => (
            <div
              key={idx}
              className="flex-1 h-1 bg-gray-700/50 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{
                  width:
                    idx < currentIndex
                      ? "100%"
                      : idx === currentIndex
                        ? `${progress}%`
                        : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* 2. HEADER */}
        <div className="absolute top-8 left-0 right-0 px-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            {currentStory.userAvatar ? (
              <img
                src={currentStory.userAvatar}
                alt=""
                className="w-9 h-9 rounded-full border border-gray-600"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center font-bold text-sm">
                {currentStory.userName?.charAt(0)}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm drop-shadow-md">
                {currentStory.userName}
              </span>
              <span className="text-gray-300 text-[10px] drop-shadow-md">
                {currentStory.createdAt?.toDate
                  ? new Date(
                      currentStory.createdAt.toDate(),
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Just now"}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="text-white p-2 hover:bg-white/10 rounded-full transition"
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

        {/* 3. MEDIA CONTENT */}
        <div
          className="flex-1 flex items-center justify-center relative bg-black"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
            onClick={handlePrev}
          />

          {currentStory.mediaType === "video" ? (
            <video
              src={currentStory.mediaUrl}
              className="max-h-[85vh] max-w-full object-contain"
              autoPlay
              muted
              playsInline
              onEnded={handleNext}
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Status"
              className="max-h-[85vh] max-w-full object-contain"
            />
          )}

          <div
            className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
            onClick={handleNext}
          />
        </div>

        {/* 4. BOTTOM ACTIONS (Pushed up with pb-16 to clear the main nav bar) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20">
          {currentStory.caption && (
            <p className="text-white text-sm mb-4 text-center drop-shadow-md px-4">
              {currentStory.caption}
            </p>
          )}

          <div className="flex items-center gap-4 max-w-md mx-auto">
            <button
              onClick={handleReply}
              className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-3 text-white text-sm font-medium hover:bg-white/20 transition flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span>Reply...</span>
            </button>

            <button
              onClick={handleLike}
              className={`p-3 rounded-full transition transform active:scale-90 ${isLiked ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              <svg
                className="w-6 h-6"
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>

            <button
              onClick={handleGift}
              className="p-3 rounded-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition transform active:scale-90 border border-yellow-500/30"
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
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
