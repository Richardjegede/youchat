"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import Link from "next/link";
import ProtectedRoute from "../components/ProtectedRoute";

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch all conversations where user is a participant
    const fetchConversations = async () => {
      try {
        const q = query(
          collection(db, "conversations"),
          where("participants", "array-contains", auth.currentUser.uid),
        );

        // Real-time listener for conversations
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const convos = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Filter out conversations with NO messages and sort by time
          const sortedConvos = convos
            .filter(
              (convo) => convo.lastMessage && convo.lastMessage.trim() !== "",
            )
            .sort((a, b) => {
              // Sort by lastMessageTime (newest first)
              const timeA = a.lastMessageTime?.toDate()?.getTime() || 0;
              const timeB = b.lastMessageTime?.toDate()?.getTime() || 0;
              return timeB - timeA;
            });

          setConversations(sortedConvos);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error("Error fetching conversations:", err);
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-6">Messages</h1>

          {loading ? (
            <div className="text-center py-20">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-400 mb-4">No messages yet</p>
              <p className="text-gray-500 text-sm">
                Start a conversation by visiting someone's profile!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((convo) => (
                <Link
                  key={convo.id}
                  href={`/messages/${convo.id}`}
                  className="block"
                >
                  <div className="bg-[#111] border border-gray-800 rounded-xl p-4 hover:border-cyan-500 transition flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold">
                      {convo.otherUserName?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {convo.otherUserName || "User"}
                      </p>
                      <p className="text-gray-400 text-sm truncate">
                        {convo.lastMessage}
                      </p>
                    </div>
                    {convo.lastMessageTime && (
                      <p className="text-gray-500 text-xs whitespace-nowrap">
                        {new Date(
                          convo.lastMessageTime.toDate(),
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
