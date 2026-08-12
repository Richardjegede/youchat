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
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";

// 🔥 SMART TIME FORMATTER
const formatMessageTime = (timestamp) => {
  if (!timestamp?.toDate) return "";
  const date = timestamp.toDate();
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return timeStr;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${timeStr}`;
  }
  return `${date.toLocaleDateString([], { weekday: "short" })} ${timeStr}`;
};

export default function ChatRoom() {
  const { id } = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const typingTimeoutRef = useRef(null);

  // 🔥 VOICE NOTE STATES
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  // 1. CONVERSATION & MESSAGES LISTENER
  useEffect(() => {
    if (!id || !auth.currentUser) return;

    const fetchConversation = async () => {
      try {
        const convoDoc = await getDoc(doc(db, "conversations", id));
        if (convoDoc.exists()) {
          const convoData = convoDoc.data();
          const otherUserId = convoData.participants.find(
            (p) => p !== auth.currentUser.uid,
          );
          setConversation({ id: convoDoc.id, ...convoData, otherUserId });
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

    const convoUnsubscribe = onSnapshot(
      doc(db, "conversations", id),
      (docSnap) => {
        if (docSnap.exists()) {
          setConversation((prev) => ({ ...prev, ...docSnap.data() }));
        }
      },
    );

    const q = query(
      collection(db, "conversations", id, "messages"),
      orderBy("createdAt", "asc"),
    );
    const messagesUnsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => {
      convoUnsubscribe();
      messagesUnsubscribe();
    };
  }, [id, router]);

  // 2. OTHER USER ONLINE STATUS LISTENER
  useEffect(() => {
    if (!conversation?.otherUserId) return;
    const userUnsubscribe = onSnapshot(
      doc(db, "users", conversation.otherUserId),
      (docSnap) => {
        if (docSnap.exists()) {
          setOtherUser(docSnap.data());
        }
      },
    );
    return () => userUnsubscribe();
  }, [conversation?.otherUserId]);

  // 3. AUTO-SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. MARK AS READ
  useEffect(() => {
    if (!id || !auth.currentUser || messages.length === 0) return;
    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        (msg) => msg.senderId !== auth.currentUser.uid && msg.status !== "read",
      );
      if (unreadMessages.length > 0) {
        try {
          await Promise.all(
            unreadMessages.map((msg) =>
              updateDoc(doc(db, "conversations", id, "messages", msg.id), {
                status: "read",
              }),
            ),
          );
          await updateDoc(doc(db, "conversations", id), {
            [`unreadCounts.${auth.currentUser.uid}`]: 0,
          });
        } catch (err) {
          console.error("Error marking messages as read:", err);
        }
      }
    };
    markAsRead();
  }, [messages, id]);

  // 5. HANDLE TYPING INPUT
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      updateDoc(doc(db, "conversations", id), { typing: auth.currentUser.uid });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      setIsTypingLocal(false);
      await updateDoc(doc(db, "conversations", id), { typing: null });
    }, 3000);
  };

  // 6. HANDLE SEND TEXT MESSAGE
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    try {
      let senderName = auth.currentUser.email?.split("@")[0] || "User";
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().fullName) {
        senderName = userDoc.data().fullName;
      }

      const recipientId =
        conversation.otherUserId ||
        conversation.participants.find((p) => p !== auth.currentUser.uid);
      const currentUnreadCounts = conversation.unreadCounts || {};
      const recipientCurrentCount = currentUnreadCounts[recipientId] || 0;

      await addDoc(collection(db, "conversations", id, "messages"), {
        text: newMessage,
        senderId: auth.currentUser.uid,
        senderName: senderName,
        status: "sent",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "conversations", id), {
        lastMessage: newMessage,
        lastMessageTime: serverTimestamp(),
        [`unreadCounts.${recipientId}`]: recipientCurrentCount + 1,
        typing: null,
      });

      if (recipientId) {
        await addDoc(collection(db, "notifications"), {
          userId: recipientId,
          senderId: auth.currentUser.uid,
          senderName: senderName,
          type: "message",
          message: `${senderName} sent you a message`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      setNewMessage("");
      setIsTypingLocal(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // 🔥 START RECORDING
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsLocked(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to send voice notes!");
    }
  };

  // 🔥 CANCEL RECORDING
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      clearInterval(timerRef.current);
      chunksRef.current = [];
    }
    setIsRecording(false);
    setIsLocked(false);
    setRecordingTime(0);
    setUploading(false);
  };

  // 🔥 SEND VOICE NOTE (ASYNC TRAP FIXED!)
  const sendVoiceNote = async () => {
    if (!conversation) return;

    // 1. Stop recording if it's running
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setIsLocked(false);
    setUploading(true);

    // 🔥 MAGIC FIX: Wait 150ms for the final 'ondataavailable' event to fire and populate chunksRef!
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (chunksRef.current.length === 0) {
      alert("Recording was too short. Please try again.");
      setUploading(false);
      return;
    }

    try {
      // 2. Create blob from collected chunks
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = []; // Clear for next time

      // 3. Upload to Cloudinary
      const data = new FormData();
      data.append("file", blob, "voice_note.webm");
      data.append("upload_preset", "youbuy-present");
      data.append("resource_type", "video");

      const res = await fetch(
        "https://api.cloudinary.com/v1_1/qxd9ghri/video/upload",
        {
          method: "POST",
          body: data,
        },
      );

      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      const audioUrl = result.secure_url;

      // 4. Save to Firestore
      const recipientId =
        conversation.otherUserId ||
        conversation.participants.find((p) => p !== auth.currentUser.uid);

      await addDoc(collection(db, "conversations", id, "messages"), {
        audioUrl: audioUrl,
        audioDuration: recordingTime,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.email?.split("@")[0],
        status: "sent",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "conversations", id), {
        lastMessage: "🎤 Voice message",
        lastMessageTime: serverTimestamp(),
        [`unreadCounts.${recipientId}`]:
          (conversation.unreadCounts?.[recipientId] || 0) + 1,
      });

      setRecordingTime(0);
    } catch (err) {
      console.error("Error sending voice note:", err);
      alert("Failed to send voice note. Check your internet connection.");
    } finally {
      setUploading(false);
    }
  };

  // Helper to format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!conversation) return null;

  const displayName =
    otherUser?.fullName ||
    otherUser?.username ||
    conversation.otherUserName ||
    "User";
  const displayAvatar = otherUser?.avatar || conversation.otherUserAvatar;
  const otherUserId = conversation.otherUserId;

  // 🔥 CALCULATE STATUS OUTSIDE JSX
  let statusText = "Offline";
  let statusColor = "text-gray-500";
  let showGreenDot = false;
  const isTypingRemote = conversation?.typing === otherUserId;

  if (isTypingRemote) {
    statusText = "Typing...";
    statusColor = "text-cyan-400 font-bold animate-pulse";
  } else if (otherUser?.lastSeen) {
    const lastSeenTime = otherUser.lastSeen.toDate
      ? otherUser.lastSeen.toDate().getTime()
      : new Date(otherUser.lastSeen).getTime();
    const timeDiff = new Date().getTime() - lastSeenTime;

    if (timeDiff < 120000) {
      statusText = "Online";
      statusColor = "text-green-400";
      showGreenDot = true;
    } else {
      statusText = "Last seen recently";
      statusColor = "text-gray-400";
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        {/* Chat Header */}
        <div className="bg-[#111] border-b border-gray-800 p-4 flex items-center gap-3 sticky top-16 z-40 shadow-lg">
          <button
            onClick={() => router.push("/messages")}
            className="text-gray-400 hover:text-white text-xl"
          >
            ←
          </button>

          <Link href={`/user/${otherUserId}`} className="flex-shrink-0">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                className="w-10 h-10 rounded-full object-cover border border-gray-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold">
                {displayName?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </Link>

          <div className="flex-1">
            <p className="font-semibold">{displayName}</p>
            {isTypingRemote ? (
              <p className={`${statusColor} text-xs flex items-center gap-1`}>
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
                {statusText}
              </p>
            ) : (
              <p className={`${statusColor} text-xs flex items-center gap-1.5`}>
                {showGreenDot && (
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                )}
                {statusText}
              </p>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
          {messages.map((msg) => {
            const isOwn = msg.senderId === auth.currentUser.uid;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl ${isOwn ? "bg-cyan-500 text-black rounded-br-none" : "bg-[#1a1a1a] text-white border border-gray-800 rounded-bl-none"}`}
                >
                  {!isOwn && msg.senderName && !msg.audioUrl && (
                    <p className="text-xs text-cyan-400 font-bold mb-1">
                      {msg.senderName}
                    </p>
                  )}

                  {msg.text && (
                    <p className="text-sm break-words">{msg.text}</p>
                  )}

                  {msg.audioUrl && (
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <svg
                        className={`w-5 h-5 ${isOwn ? "text-black" : "text-cyan-400"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                      </svg>
                      <audio
                        controls
                        src={msg.audioUrl}
                        className={`h-8 w-full ${isOwn ? "accent-black" : "accent-cyan-400"}`}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-1">
                    <p
                      className={`text-[10px] ${isOwn ? "text-black/60" : "text-gray-500"}`}
                    >
                      {msg.audioUrl
                        ? `🎤 ${formatTime(msg.audioDuration || 0)}`
                        : formatMessageTime(msg.createdAt)}
                    </p>
                    {isOwn && (
                      <span
                        className={`text-xs font-bold ${msg.status === "read" ? "text-blue-400" : "text-black/60"}`}
                      >
                        {msg.status === "read" ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 🔥 WHATSAPP-STYLE DYNAMIC INPUT AREA */}
        <div className="bg-[#111] border-t border-gray-800 p-4 flex gap-2 items-center">
          {isRecording ? (
            // MODE 1: RECORDING UI (Uses onClick={sendVoiceNote})
            <div className="flex-1 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-full px-4 py-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="text-gray-400 hover:text-red-400 transition"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>

              <div className="flex-1 flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-400 font-bold text-sm">
                  {formatTime(recordingTime)}
                </span>

                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className={`ml-2 p-1 rounded-full transition ${isLocked ? "bg-cyan-500 text-black" : "text-gray-400 hover:text-white"}`}
                  title="Lock recording"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    {isLocked ? (
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    ) : (
                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                    )}
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={sendVoiceNote}
                disabled={uploading}
                className="text-cyan-400 hover:text-cyan-300 font-bold transition disabled:opacity-50 flex items-center gap-1"
              >
                {uploading ? "⏳ Sending..." : "Send"}
              </button>
            </div>
          ) : (
            // MODE 2: TEXT INPUT UI (Uses onSubmit={handleSendMessage})
            <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-full px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="bg-cyan-500 hover:bg-cyan-400 text-black w-10 h-10 rounded-full flex items-center justify-center font-bold transition"
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
              </button>
            </form>
          )}

          {/* MODE 3: MIC BUTTON (Only shows when NOT recording AND text input is empty) */}
          {!isRecording && !newMessage.trim() && (
            <button
              type="button"
              onClick={startRecording}
              className="bg-[#1a1a1a] border border-gray-700 hover:border-cyan-500 text-gray-400 hover:text-cyan-400 w-10 h-10 rounded-full flex items-center justify-center transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
