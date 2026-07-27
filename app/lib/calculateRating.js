import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// 🔥 CALCULATE AVERAGE RATING FOR A USER BASED ON ALL THEIR SERVICES
export const updateUserRating = async (userId) => {
  try {
    // 1. Find all services owned by this user
    const servicesQuery = query(
      collection(db, "services"),
      where("creatorId", "==", userId),
    );
    const servicesSnap = await getDocs(servicesQuery);

    let totalReviews = 0;
    let totalRatingSum = 0;

    // 2. Loop through each service and get its reviews
    for (const serviceDoc of servicesSnap.docs) {
      const reviewsQuery = query(
        collection(db, "reviews"),
        where("serviceId", "==", serviceDoc.id),
      );
      const reviewsSnap = await getDocs(reviewsQuery);

      reviewsSnap.forEach((reviewDoc) => {
        const review = reviewDoc.data();
        totalRatingSum += review.rating;
        totalReviews++;
      });
    }

    // 3. Calculate the true average
    const averageRating = totalReviews > 0 ? totalRatingSum / totalReviews : 0;

    // 4. Update the user's main profile with the new average
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      rating: parseFloat(averageRating.toFixed(1)), // e.g., 4.3
      reviewCount: totalReviews,
    });

    return { averageRating, totalReviews };
  } catch (err) {
    console.error("Error updating rating:", err);
    return null;
  }
};
