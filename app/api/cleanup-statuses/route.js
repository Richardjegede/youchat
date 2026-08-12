import { NextResponse } from "next/server";
import { db } from "../../lib/firebase";
// 🔥 FIXED: Added 'query' and 'where' to the imports!
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

const getCloudinaryPublicId = (url) => {
  if (!url || !url.includes("cloudinary.com")) return null;
  const urlParts = url.split("/upload/");
  if (urlParts.length < 2) return null;
  let publicId = urlParts[1];
  publicId = publicId.replace(/^v\d+\//, "");
  publicId = publicId.replace(/\.[^/.]+$/, "");
  return publicId;
};

async function cleanupCollection(collectionName) {
  const twentyFourHoursAgo = Timestamp.fromDate(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  const colRef = collection(db, collectionName);

  // 🔥 QUERY 1: Find docs with expiresAt in the past
  const q1 = query(colRef, where("expiresAt", "<", twentyFourHoursAgo));
  const snapshot1 = await getDocs(q1);

  // 🔥 QUERY 2: Find docs with sponsoredUntil in the past (for sponsored content)
  const q2 = query(colRef, where("sponsoredUntil", "<", twentyFourHoursAgo));
  const snapshot2 = await getDocs(q2);

  const deletedIds = new Set(); // Use Set to avoid duplicates
  let totalDeleted = 0;

  // Process both snapshots
  for (const snapshot of [snapshot1, snapshot2]) {
    for (const docSnap of snapshot.docs) {
      if (deletedIds.has(docSnap.id)) continue; // Skip if already deleted

      const data = docSnap.data();
      const mediaUrls = [];

      if (data.mediaUrl) mediaUrls.push(data.mediaUrl);
      if (data.imageUrl) mediaUrls.push(data.imageUrl);
      if (data.videoUrl) mediaUrls.push(data.videoUrl);

      if (data.mediaItems && Array.isArray(data.mediaItems)) {
        data.mediaItems.forEach((item) => {
          if (item.url) mediaUrls.push(item.url);
        });
      }

      // Delete ALL associated media from Cloudinary
      for (const url of mediaUrls) {
        const publicId = getCloudinaryPublicId(url);
        if (publicId) {
          await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/delete-image`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: url }),
            },
          );
        }
      }

      // Delete the document from Firestore
      await deleteDoc(doc(db, collectionName, docSnap.id));
      deletedIds.add(docSnap.id);
      totalDeleted++;
    }
  }

  return totalDeleted;
}

export async function POST() {
  try {
    // 🔥 Clean up BOTH Stories and Feed ads automatically!
    const storiesDeleted = await cleanupCollection("stories");
    const feedDeleted = await cleanupCollection("feed");

    return NextResponse.json({
      success: true,
      deletedStories: storiesDeleted,
      deletedFeed: feedDeleted,
      totalDeleted: storiesDeleted + feedDeleted,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
