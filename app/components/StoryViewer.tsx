"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export default function StoryViewer({ storiesGroup, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const animationRef = useRef(null);

  // 🔥 USE MEMO: This stops the array from recreating on every render,
  // which stops the timer from resetting and vibrating!
  const allSlides = useMemo(() => {
    return storiesGroup.stories.flatMap((story) => {
      if (story.mediaItems && story.mediaItems.length > 0) {
        return story.mediaItems.map((item, index) => ({
          ...story,
          id: story.id + "_" + index,
          mediaUrl: item.url,
          mediaType: item.type || "image", // Safety fallback
          createdAt: story.createdAt,
        }));
      }
      return [
        {
          ...story,
          mediaType: story.mediaType || "image", // Safety fallback
        },
      ];
    });
  }, [storiesGroup.stories]); // Only recalculate if the actual stories change

  const currentStory = allSlides[currentIndex];
  const totalStories = allSlides.length;
  const duration = currentStory?.mediaType === "video" ? 20000 : 5000;

  // 🔥 MARK AS VIEWED (Now works for Sponsored stories too!)
  useEffect(() => {
    if (!currentStory) return;

    const markViewed = async () => {
      if (auth.currentUser) {
        // 🔥 REMOVED the "sponsored_system" restriction
        try {
          await updateDoc(doc(db, "stories", currentStory.id.split("_")[0]), {
            viewers: arrayUnion(auth.currentUser.uid),
          });
        } catch (err) {
          console.error(err);
        }
      }
    };
    markViewed();
  }, [currentStory]);

  // 🔥 PROGRESS & AUTO-ADVANCE LOGIC (Your exact working logic)
  useEffect(() => {
    if (!currentStory) return;

    // Clean up previous timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    setProgress(0);

    // Handle Video
    if (currentStory.mediaType === "video" && videoRef.current) {
      const video = videoRef.current;

      video.play().catch((e) => console.log("Autoplay blocked", e));

      const updateProgress = () => {
        if (video && !video.paused && !video.ended) {
          const pct = (video.currentTime / video.duration) * 100;
          setProgress(isNaN(pct) ? 0 : pct);
          timerRef.current = setTimeout(updateProgress, 100);
        }
      };

      updateProgress();

      const handleVideoEnd = () => {
        if (currentIndex < totalStories - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          onClose();
        }
      };

      video.addEventListener("ended", handleVideoEnd);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        video.removeEventListener("ended", handleVideoEnd);
        video.pause();
      };
    }
    // Handle Image - AUTO ADVANCE EVERY 5 SECONDS
    else {
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / duration) * 100, 100);

        setProgress(pct);

        if (pct >= 100) {
          // Auto advance to next story
          if (currentIndex < totalStories - 1) {
            setCurrentIndex((prev) => prev + 1);
          } else {
            onClose();
          }
        } else {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }
  }, [currentStory, currentIndex, totalStories, onClose, duration]);

  // 🔥 NAVIGATION FUNCTIONS
  const handleNext = () => {
    if (currentIndex < totalStories - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, totalStories, onClose]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
      {/* 9:16 PHONE CONTAINER */}
      <div
        className="relative w-full h-full max-w-md mx-auto bg-black overflow-hidden"
        style={{ aspectRatio: "9/16", maxHeight: "100vh" }}
      >
        {/* PROGRESS BARS */}
        <div className="absolute top-2 left-0 w-full px-2 z-[60] flex gap-1">
          {allSlides.map((_, idx) => (
            <div
              key={idx}
              className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width:
                    idx < currentIndex
                      ? "100%"
                      : idx === currentIndex
                        ? `${progress}%`
                        : "0%",
                  transition: "none",
                }}
              ></div>
            </div>
          ))}
        </div>

        {/* HEADER */}
        <div className="absolute top-6 left-0 w-full flex justify-between items-center px-4 z-[60]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800">
              {storiesGroup.userAvatar ? (
                <img
                  src={storiesGroup.userAvatar}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                  {storiesGroup.userName?.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-white font-semibold text-sm">
              {storiesGroup.userName}
            </span>
            <span className="text-gray-400 text-xs">
              {currentStory.createdAt
                ?.toDate()
                .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <button onClick={onClose} className="text-white text-2xl font-bold">
            ✕
          </button>
        </div>

        {/* MEDIA - 9:16 PHONE STYLE */}
        <div className="w-full h-full flex items-center justify-center bg-black relative">
          {currentStory.mediaType === "video" ? (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl}
              className="w-full h-full object-cover"
              style={{ aspectRatio: "9/16" }}
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              className="w-full h-full object-cover"
              style={{ aspectRatio: "9/16" }}
            />
          )}
        </div>

        {/* NAVIGATION ZONES */}
        <div className="absolute inset-0 flex z-[40]">
          <div className="w-1/3 h-full" onClick={handlePrev}></div>
          <div className="w-2/3 h-full" onClick={handleNext}></div>
        </div>
      </div>
    </div>
  );
}
