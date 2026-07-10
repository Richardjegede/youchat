"use client";

import { useState, useEffect, useRef } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export default function StoryViewer({ storiesGroup, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);

  const currentStory = storiesGroup.stories[currentIndex];
  const totalStories = storiesGroup.stories.length;

  // Duration: 5s for images, 20s for videos
  const duration = currentStory.mediaType === "video" ? 20000 : 5000;

  useEffect(() => {
    if (!currentStory) return;

    // Mark as viewed
    const markViewed = async () => {
      if (
        auth.currentUser &&
        !currentStory.viewers?.includes(auth.currentUser.uid)
      ) {
        try {
          await updateDoc(doc(db, "stories", currentStory.id), {
            viewers: arrayUnion(auth.currentUser.uid),
          });
        } catch (err) {
          console.error(err);
        }
      }
    };
    markViewed();

    // Reset progress for new story
    setProgress(0);

    // Handle Video Logic
    if (currentStory.mediaType === "video" && videoRef.current) {
      videoRef.current.play().catch((e) => console.log("Autoplay blocked", e));

      const updateProgress = () => {
        if (videoRef.current && !videoRef.current.paused) {
          const pct =
            (videoRef.current.currentTime / videoRef.current.duration) * 100;
          setProgress(isNaN(pct) ? 0 : pct);
        }
      };
      const interval = setInterval(updateProgress, 100);
      return () => clearInterval(interval);
    }
    // Handle Image Logic
    else {
      const timer = setTimeout(() => {
        handleNext();
      }, duration);

      const startTime = Date.now();
      const animFrame = requestAnimationFrame(function animate() {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / duration) * 100, 100);
        setProgress(pct);
        if (pct < 100) requestAnimationFrame(animate);
      });

      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(animFrame);
      };
    }
  }, [currentStory, duration]); // Removed handleNext from deps to prevent loops

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

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* 🔥 PROGRESS BARS (Z-INDEX 60 TO STAY ON TOP) */}
      <div className="absolute top-2 left-0 w-full px-2 z-[60] flex gap-1">
        {storiesGroup.stories.map((_, idx) => (
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
              }}
            ></div>
          </div>
        ))}
      </div>

      {/* 🔥 HEADER (Z-INDEX 60) */}
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

      {/* Media Content */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        {currentStory.mediaType === "video" ? (
          <video
            ref={videoRef}
            src={currentStory.mediaUrl}
            className="max-h-full max-w-full object-contain"
            onEnded={handleNext}
          />
        ) : (
          <img
            src={currentStory.mediaUrl}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {/* 🔥 NAVIGATION OVERLAY (Z-INDEX 40 - BELOW PROGRESS BAR) */}
      <div className="absolute inset-0 flex z-[40]">
        {/* Left 1/3: Go Back */}
        <div className="w-1/3 h-full" onClick={handlePrev}></div>
        {/* Right 2/3: Go Next */}
        <div className="w-2/3 h-full" onClick={handleNext}></div>
      </div>
    </div>
  );
}
