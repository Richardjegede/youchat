import { doc, updateDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// 🔥 ANTI-FAKE VIEW TRACKER
export const trackVideoView = async (videoId, userId) => {
  if (!userId) return false; // Don't track if not logged in

  try {
    const viewRef = doc(db, "videoViews", `${videoId}_${userId}`);
    const viewDoc = await getDoc(viewRef);

    const now = Date.now();
    const lastViewed = viewDoc.exists() ? viewDoc.data().timestamp : 0;
    const timeSinceLastView = now - lastViewed;

    // ✅ Only count if user hasn't watched in last 5 minutes (prevent spam refreshes)
    if (timeSinceLastView > 5 * 60 * 1000 || !viewDoc.exists()) {
      // Record the view
      await setDoc(viewRef, {
        videoId,
        userId,
        timestamp: now,
      });

      // Increment video view count in the main videos collection
      const videoRef = doc(db, "videos", videoId);
      await updateDoc(videoRef, {
        views: increment(1),
      });

      return true; // View counted
    }

    return false; // View ignored (too soon)
  } catch (err) {
    console.error("Error tracking view:", err);
    return false;
  }
};
