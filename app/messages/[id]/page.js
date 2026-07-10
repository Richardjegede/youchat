"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function ChatRoom() {
  const { id } = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!id || !auth.currentUser) return;

    // Fetch conversation details
    const fetchConversation = async () => {
      try {
        const convoDoc = await getDoc(doc(db, "conversations", id));
        if (convoDoc.exists()) {
          setConversation({ id: convoDoc.id, ...convoDoc.data() });
        } else {
          router.push("/messages");
        }
      } catch (err) {
        console.error("Error fetching conversation:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();

    // Real-time messages listener
    const q = query(
      collection(db, "conversations", id, "messages"),
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [id, router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    try {
      // Add message to subcollection
      await addDoc(collection(db, "conversations", id, "messages"), {
        text: newMessage,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.email.split("@")[0],
        createdAt: serverTimestamp(),
      });

      // Update conversation's last message
      await updateDoc(doc(db, "conversations", id), {
        lastMessage: newMessage,
        lastMessageTime: serverTimestamp(),
      });

      // 🔔 SEND MESSAGE NOTIFICATION!
      const recipientId = conversation.participants.find(
        (p) => p !== auth.currentUser.uid,
      );
      if (recipientId) {
        // Get current user's name
        let senderName = auth.currentUser.email.split("@")[0];
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists() && userDoc.data().fullName) {
          senderName = userDoc.data().fullName;
        }

        await addDoc(collection(db, "notifications"), {
          userId: recipientId,
          senderId: auth.currentUser.uid,
          senderName: senderName, // 🔥 Store sender's name
          type: "message",
          message: "sent you a message",
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!conversation) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        {/* Chat Header */}
        <div className="bg-[#111] border-b border-gray-800 p-4 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => router.push("/messages")}
            className="text-gray-400 hover:text-white"
          >
            ←
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold">
            {conversation.otherUserName?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-semibold">
              {conversation.otherUserName || "User"}
            </p>
            <p className="text-xs text-gray-400">Active now</p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isOwn = msg.senderId === auth.currentUser.uid;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-2xl ${
                    isOwn
                      ? "bg-cyan-500 text-black"
                      : "bg-[#1a1a1a] text-white border border-gray-800"
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  <p
                    className={`text-xs mt-1 ${isOwn ? "text-black/60" : "text-gray-500"}`}
                  >
                    {msg.createdAt?.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form
          onSubmit={handleSendMessage}
          className="bg-[#111] border-t border-gray-800 p-4 flex gap-2"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-full px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2 rounded-full font-bold transition"
          >
            Send
          </button>
        </form>
      </div>
    </ProtectedRoute>
  );
}
