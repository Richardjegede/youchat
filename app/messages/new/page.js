"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function NewMessagePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <NewMessageContent />
    </Suspense>
  );
}

function NewMessageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("userId");
  const [status, setStatus] = useState("Starting conversation...");

  useEffect(() => {
    if (!auth.currentUser || !targetUserId) {
      router.push("/messages");
      return;
    }

    const startConversation = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", targetUserId));
        if (!userDoc.exists()) {
          setStatus("User not found.");
          return;
        }
        const targetUser = userDoc.data();

        const q = query(
          collection(db, "conversations"),
          where("participants", "array-contains", auth.currentUser.uid),
        );
        const querySnapshot = await getDocs(q);

        let existingConvoId = null;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.participants.includes(targetUserId)) {
            existingConvoId = doc.id;
          }
        });

        if (existingConvoId) {
          router.push(`/messages/${existingConvoId}`);
        } else {
          const convoRef = await addDoc(collection(db, "conversations"), {
            participants: [auth.currentUser.uid, targetUserId],
            otherUserId: targetUserId, // 🔥 ADDED: Needed for clickable profiles
            otherUserName:
              targetUser.fullName || targetUser.email?.split("@")[0] || "User",
            otherUserAvatar: targetUser.avatar || null,
            lastMessage: "",
            unreadCount: 0, // 🔥 ADDED: Needed for unread badges
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
          router.push(`/messages/${convoRef.id}`);
        }
      } catch (err) {
        console.error("Error starting conversation:", err);
        setStatus("Failed to start conversation.");
      }
    };

    startConversation();
  }, [targetUserId, router]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">{status}</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
