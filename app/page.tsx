"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "./lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import { onSnapshot } from "firebase/firestore";
import GiftSelectorModal from "./components/GiftSelectorModal";
import StoryViewer from "./components/StoryViewer";

export default function Home() {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState({
    id: "",
    name: "",
    postId: "",
  });
  const [showPostModal, setShowPostModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stories, setStories] = useState([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyFile, setStoryFile] = useState<any>(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0); // Added for top header

  useEffect(() => {
    fetchFeed();
    // Fetch coin balance for top header
    const fetchBalance = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) setCoinBalance(userDoc.data().coinBalance || 0);
      }
    };
    fetchBalance();
  }, [activeTab]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const now = new Date();

      // 🔥 GET CURRENT USER'S BLOCKED LIST
      let blockedUserIds = [];
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          blockedUserIds = userDoc.data().blockedUsers || [];
        }
      }

      const q = query(
        collection(db, "feed"),
        orderBy("createdAt", "desc"),
        limit(30),
      );
      const snapshot = await getDocs(q);
      let items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      //  FILTER OUT: Expired sponsored posts AND blocked users
      items = items.filter((item) => {
        // Filter expired sponsored
        if (item.isSponsored && item.sponsoredUntil) {
          const expiry = item.sponsoredUntil.toDate
            ? item.sponsoredUntil.toDate()
            : new Date(item.sponsoredUntil);
          if (expiry <= now) return false;
        }
        // Filter blocked users
        if (blockedUserIds.includes(item.authorId)) return false;

        return true;
      });

      // ... rest of your sorting code ...

      items.sort((a, b) => {
        if (a.isSponsored && !b.isSponsored) return -1;
        if (!a.isSponsored && b.isSponsored) return 1;
        const dateA = a.createdAt?.toDate?.() || 0;
        const dateB = b.createdAt?.toDate?.() || 0;
        return dateB - dateA;
      });

      const finalItems =
        activeTab === "all"
          ? items.slice(0, 20)
          : items.filter((i) => i.type === activeTab).slice(0, 20);
      setFeedItems(finalItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadStory = async (e: any) => {
    e.preventDefault();
    if (!storyFile) return;
    setUploadingStory(true);

    const data = new FormData();
    data.append("file", storyFile);
    data.append("upload_preset", "youbuy-present");
    const resourceType = storyFile.type.startsWith("video") ? "video" : "image";
    data.append("resource_type", resourceType);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/qxd9ghri/${resourceType}/upload`,
        { method: "POST", body: data },
      );
      const result = await res.json();

      let realName = auth.currentUser?.email?.split("@")[0] || "Creator";
      let userAvatarUrl = null;

      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser!.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.fullName) realName = userData.fullName;
          userAvatarUrl = userData.avatar || null;
        }
      } catch (err) {
        console.error(err);
      }

      await addDoc(collection(db, "stories"), {
        userId: auth.currentUser!.uid,
        userName: realName,
        userAvatar: userAvatarUrl,
        mediaUrl: result.secure_url,
        mediaType: resourceType,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        viewers: [],
        likes: [], // 🔥 ADDED THIS FOR THE LIKE FEATURE!
      });

      setShowCreateStory(false);
      setStoryFile(null);
      alert("✅ Story added successfully!");
    } catch (err) {
      console.error("Story upload error:", err);
      alert("Failed to upload story");
    } finally {
      setUploadingStory(false);
    }
  };
  useEffect(() => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 🔥 REMOVED orderBy FROM FIRESTORE TO PREVENT INDEX ERRORS!
    const q = query(
      collection(db, "stories"),
      where("expiresAt", ">", twentyFourHoursAgo),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activeStories = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // 🔥 SORT IN JAVASCRIPT INSTEAD! (Much safer, no indexes needed)
        activeStories.sort((a, b) => {
          const timeA = a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : 0;
          const timeB = b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : 0;
          return timeB - timeA; // Descending order (newest first)
        });

        const sponsoredStories = activeStories.filter(
          (s) =>
            s.isSponsored === true ||
            s.isSponsored === "true" ||
            s.userId === "sponsored_system",
        );
        const regularStories = activeStories.filter(
          (s) =>
            s.isSponsored !== true &&
            s.isSponsored !== "true" &&
            s.userId !== "sponsored_system",
        );

        const latestSponsored =
          sponsoredStories.length > 0 ? sponsoredStories[0] : null;
        let sponsoredGroup = null;

        if (latestSponsored) {
          const now = new Date();
          const expiry = latestSponsored.sponsoredUntil?.toDate
            ? latestSponsored.sponsoredUntil.toDate()
            : new Date(latestSponsored.sponsoredUntil);
          if (expiry > now) {
            sponsoredGroup = {
              userId: "sponsored_system",
              userName: "Sponsored",
              userAvatar: "📢",
              isSponsored: true,
              stories: [latestSponsored],
            };
          }
        }

        const grouped: any = {};
        regularStories.forEach((story) => {
          if (!grouped[story.userId]) {
            grouped[story.userId] = {
              userId: story.userId,
              userName: story.userName,
              userAvatar: story.userAvatar,
              stories: [],
            };
          }
          grouped[story.userId].stories.push(story);
        });

        Object.values(grouped).forEach((group: any) => {
          group.stories.sort(
            (a: any, b: any) =>
              (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0),
          );
        });

        const finalStories = sponsoredGroup
          ? [sponsoredGroup, ...Object.values(grouped)]
          : Object.values(grouped);

        setStories(finalStories);
      },
      (error) => {
        console.error("Error fetching stories:", error);
      },
    );

    // 🔥 TRIGGER BACKGROUND CLEANUP
    fetch("/api/cleanup-statuses", { method: "POST" })
      .then((res) => res.json())
      .then((data) =>
        console.log(
          `🧹 Cleaned up ${data.deletedStories || 0} expired stories!`,
        ),
      )
      .catch((err) => console.error("Cleanup failed", err));

    return () => unsubscribe();
  }, []);
  // 🔥 SMART SEARCH FILTERING LOGIC (Upgraded to catch Usernames too!)
  const filteredItems = feedItems.filter((item) => {
    if (!searchQuery.trim()) return true; // If search is empty, show everything

    const query = searchQuery.toLowerCase();

    // 🔥 We now check ALL possible name fields
    const authorName = (item.authorName || "").toLowerCase();
    const authorUsername = (item.authorUsername || "").toLowerCase();
    const username = (item.username || "").toLowerCase(); // Fallback just in case

    const content = (item.content || "").toLowerCase();
    const title = (item.title || "").toLowerCase();

    // Search matches Author Name, Username, Post Content, or Product/Video Title
    return (
      authorName.includes(query) ||
      authorUsername.includes(query) ||
      username.includes(query) ||
      content.includes(query) ||
      title.includes(query)
    );
  });

  // 🔥 DEFINE getTimeAgo HERE, RIGHT BEFORE THE RETURN STATEMENT
  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "Just now";

    // Safely handle both Firestore Timestamps and regular dates/strings
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  return (
    <ProtectedRoute>
      {/* 🔥 MAIN CONTAINER - DESKTOP OPTIMIZED */}
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-16 pb-24">
        {/* 🔥 1. SLEEK TOP HEADER (WIDENED) */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-800/50">
          <div className="max-w-3xl mx-auto flex justify-between items-center px-6 py-3">
            <h1 className="text-2xl font-bold text-cyan-400 tracking-tight">
              YouChat
            </h1>
            <div className="flex items-center gap-4">
              <div className="bg-[#1a1a1a] border border-gray-800 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold text-yellow-400 shadow-sm">
                <span>🪙</span>
                <span>
                  {coinBalance > 0 ? coinBalance.toLocaleString() : 0}
                </span>
              </div>
              <button className="relative p-2 text-gray-400 hover:text-white transition">
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
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a]"></span>
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 2. SHOP CREATION BANNER (WIDENED) */}
        <div className="max-w-3xl mx-auto px-6 mt-6">
          <div className="bg-gradient-to-r from-purple-600 to-cyan-600 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  🏪 Want to Sell on YouChat?
                </h2>
                <p className="text-gray-100 text-sm">
                  Open your shop and reach thousands of students across Africa!
                </p>
              </div>
              <Link
                href="/youbuy/create-shop"
                className="bg-white text-purple-600 hover:bg-gray-100 px-6 py-3 rounded-full font-bold transition shadow-lg whitespace-nowrap"
              >
                Create Your Shop →
              </Link>
            </div>
          </div>
        </div>

        {/* 🔥 3. SMART SEARCH BAR (WIDENED) */}
        <div className="sticky top-16 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-800/50 px-6 py-3">
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people, posts, or products..."
              className="w-full bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded-full pl-12 pr-10 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition"
              >
                <svg
                  className="h-5 w-5"
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
            )}
          </div>
        </div>

        {/* 🔥 4. STORIES BAR (WIDENED) */}
        <div className="max-w-3xl mx-auto px-6 py-4 border-b border-gray-800/50">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-gray-300">Stories</h2>
            <button
              onClick={() => router.push("/updates")}
              className="text-xs text-cyan-400 font-semibold hover:text-cyan-300 transition"
            >
              See All Updates →
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {/* YOUR STORY BUTTON */}
            <div
              className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0"
              onClick={() => setShowCreateStory(true)}
            >
              <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border-2 border-dashed border-gray-600 flex items-center justify-center text-2xl text-gray-400 hover:border-cyan-500 hover:text-cyan-500 transition">
                +
              </div>
              <span className="text-[10px] text-gray-400 truncate max-w-[64px]">
                Your Story
              </span>
            </div>

            {/* OTHER USERS' STORIES */}
            {stories.map((group: any, index) => {
              const myUid = auth.currentUser?.uid;
              const hasUnviewed = group.stories.some(
                (s: any) => !s.viewers?.includes(myUid),
              );
              const storyCount = group.stories.length;
              const latestStory = group.stories[storyCount - 1];
              const isVideo = latestStory.mediaType === "video";

              return (
                <div
                  key={group.userId}
                  className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0"
                  onClick={() => router.push("/updates")}
                >
                  <div
                    className={`relative w-16 h-16 rounded-full p-[2px] ${hasUnviewed ? "bg-gradient-to-tr from-cyan-500 to-blue-600" : "bg-gray-600"}`}
                  >
                    <div className="w-full h-full rounded-full bg-[#0a0a0a] p-[2px] overflow-hidden relative">
                      {!isVideo && latestStory.mediaUrl ? (
                        <img
                          src={latestStory.mediaUrl}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : group.userAvatar ? (
                        <img
                          src={group.userAvatar}
                          className="w-full h-full rounded-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center font-bold text-sm">
                          {group.userName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="text-white text-xs">▶</span>
                        </div>
                      )}
                      {storyCount > 1 && (
                        <div className="absolute bottom-0 right-0 bg-cyan-500 text-black text-[8px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">
                          {storyCount}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] truncate max-w-[72px] text-center ${hasUnviewed ? "text-white font-semibold" : "text-gray-500"}`}
                  >
                    {group.userName?.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/*  5. FEED CONTENT (WIDENED) */}
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
              <p className="text-gray-400 mb-4">Nothing here yet.</p>
              <button
                onClick={() => setShowPostModal(true)}
                className="bg-cyan-500 text-black font-bold px-6 py-2 rounded-full"
              >
                Create First Post
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-gray-400 font-bold mb-2">No results found</p>
              <p className="text-gray-500 text-sm">
                Try searching for a different name or keyword.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <FeedItem
                key={item.id}
                item={item}
                getTimeAgo={getTimeAgo}
                onGiftClick={(authorId, authorName, postId) => {
                  setSelectedRecipient({
                    id: authorId,
                    name: authorName,
                    postId: postId,
                  });
                  setShowGiftModal(true);
                }}
              />
            ))
          )}
        </div>

        {/* 🔥 6. FAB BUTTON (POSITIONED FOR DESKTOP) */}
        <button
          onClick={() => setShowPostModal(true)}
          className="fixed bottom-24 right-6 md:right-[calc(50%-420px)] w-14 h-14 bg-cyan-500 hover:bg-cyan-400 text-black rounded-full shadow-2xl flex items-center justify-center text-3xl font-bold transition transform hover:scale-110 active:scale-95 z-40"
        >
          +
        </button>

        {/* 🔥 7. PREMIUM BOTTOM NAVIGATION (SPACED OUT FOR DESKTOP) */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-gray-800/50 pb-safe">
          <div className="max-w-3xl mx-auto flex justify-between items-center py-3 px-8">
            {/* 1. FEED */}
            <Link
              href="/"
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === "feed" || activeTab === "all" ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
            >
              <svg
                className="w-7 h-7"
                fill={
                  activeTab === "feed" || activeTab === "all"
                    ? "currentColor"
                    : "none"
                }
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="text-[11px] font-bold">Feed</span>
            </Link>

            {/* 2. CHAT */}
            <Link
              href="/messages"
              className={`relative flex flex-col items-center gap-1 transition-all ${activeTab === "messages" ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
            >
              <svg
                className="w-7 h-7"
                fill={activeTab === "messages" ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="text-[11px] font-bold">Chat</span>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">
                3
              </span>
            </Link>

            {/* 3. GROUPS */}
            <Link
              href="/groups"
              className={`relative flex flex-col items-center gap-1 transition-all ${activeTab === "groups" ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
            >
              <svg
                className="w-7 h-7"
                fill={activeTab === "groups" ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="text-[11px] font-bold">Groups</span>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">
                5
              </span>
            </Link>

            {/* 4. YOUBUY */}
            <Link
              href="/youbuy"
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === "market" ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
            >
              <svg
                className="w-7 h-7"
                fill={activeTab === "market" ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="text-[11px] font-bold">YouBuy</span>
            </Link>

            {/* 5. SERVICES */}
            <Link
              href="/services"
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === "services" ? "text-cyan-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}
            >
              <svg
                className="w-7 h-7"
                fill={activeTab === "services" ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-[11px] font-bold">Services</span>
            </Link>
          </div>
        </div>

        {/* 🔥 8. MODALS (Keep your existing modals as they are) */}
        {showStoryViewer && stories[currentStoryIndex] && (
          <StoryViewer
            storiesGroup={stories[currentStoryIndex]}
            onClose={() => setShowStoryViewer(false)}
          />
        )}
        {showCreateStory && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6 text-white">
                Add to Story
              </h2>
              <form onSubmit={uploadStory} className="space-y-4">
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center bg-[#1a1a1a]">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setStoryFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="story-upload"
                  />
                  <label
                    htmlFor="story-upload"
                    className="cursor-pointer block"
                  >
                    {storyFile ? (
                      <p className="text-cyan-400 font-semibold">
                        {storyFile.name}
                      </p>
                    ) : (
                      <>
                        <div className="text-4xl mb-2">📸</div>
                        <p className="text-gray-400 text-sm">
                          Click to select photo or video
                        </p>
                      </>
                    )}
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateStory(false)}
                    className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!storyFile || uploadingStory}
                    className="flex-1 bg-cyan-500 text-black py-3 rounded-xl font-bold disabled:bg-gray-600"
                  >
                    {uploadingStory ? "Posting..." : "Share to Story"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showPostModal && (
          <PostModal
            onClose={() => setShowPostModal(false)}
            onSuccess={fetchFeed}
          />
        )}
        <GiftSelectorModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          recipientId={selectedRecipient.id}
          recipientName={selectedRecipient.name}
          postId={selectedRecipient.postId}
        />
      </div>
    </ProtectedRoute>
  );
}

// =================================================================
// 🔥 FEED ITEM COMPONENT (KEPT EXACTLY AS IT WAS)
// =================================================================
function FeedItem({ item, getTimeAgo, onGiftClick }: any) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(item.commentsList || []);
  const [toast, setToast] = useState("");
  const [authorUsername, setAuthorUsername] = useState("");
  const [authorSchool, setAuthorSchool] = useState("");
  const [authorYearOfStudy, setAuthorYearOfStudy] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [replyingToIndex, setReplyingToIndex] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);
  const [isAuthorVerified, setIsAuthorVerified] = useState(false);

  const totalGiftsReceived = item.giftCount || 0;

  useEffect(() => {
    if (
      item.likedBy &&
      auth.currentUser &&
      item.likedBy.includes(auth.currentUser.uid)
    )
      setLiked(true);
  }, [item.likedBy]);

  useEffect(() => {
    const fetchAuthorData = async () => {
      if (item.authorId) {
        try {
          const userDoc = await getDoc(doc(db, "users", item.authorId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.avatar) setAuthorAvatar(data.avatar);
            if (data.isVerified) setIsAuthorVerified(true);
            setAuthorUsername(data.username || "");
            setAuthorSchool(data.school || "");
            setAuthorYearOfStudy(data.yearOfStudy || "");
          }
        } catch (err) {
          console.error("Error fetching author profile:", err);
        }
      }
    };
    fetchAuthorData();
  }, [item.authorId]);

  const sendNotification = async (
    targetUserId: string,
    actorUid: string,
    type: string,
    message: string,
  ) => {
    if (!targetUserId || targetUserId === actorUid) return;
    try {
      await addDoc(collection(db, "notifications"), {
        userId: targetUserId,
        actorUid,
        type,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  };

  const handleFollow = async () => {
    if (!auth.currentUser || !item.authorId) return;
    const currentUid = auth.currentUser.uid;
    const authorUid = item.authorId;
    try {
      if (isFollowing) {
        await updateDoc(doc(db, "users", currentUid), {
          following: arrayRemove(authorUid),
        });
        await updateDoc(doc(db, "users", authorUid), {
          followers: arrayRemove(currentUid),
        });
        setIsFollowing(false);
      } else {
        await updateDoc(doc(db, "users", currentUid), {
          following: arrayUnion(authorUid),
        });
        await updateDoc(doc(db, "users", authorUid), {
          followers: arrayUnion(currentUid),
        });
        setIsFollowing(true);
        await sendNotification(
          authorUid,
          currentUid,
          "follow",
          "started following you",
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;
    setLikeCount(newCount);
    if (newLiked) {
      await updateDoc(doc(db, "feed", item.id), {
        likes: newCount,
        likedBy: arrayUnion(auth.currentUser!.uid),
      });
      await sendNotification(
        item.authorId,
        auth.currentUser!.uid,
        "like",
        "liked your post",
      );
    } else {
      await updateDoc(doc(db, "feed", item.id), {
        likes: newCount,
        likedBy: arrayRemove(auth.currentUser!.uid),
      });
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    let authorName = auth.currentUser?.email?.split("@")[0] || "You";
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().fullName)
        authorName = userDoc.data().fullName;
    }

    const newComment = {
      text: commentText,
      author: authorName,
      authorId: auth.currentUser.uid, // 🔥 CRITICAL: Save the ID so we can notify them later!
      time: "Just now",
      likes: 0,
      replies: [],
    };
    const newComments = [...comments, newComment];
    setComments(newComments);
    setCommentText("");
    await updateDoc(doc(db, "feed", item.id), { commentsList: newComments });

    // Notify Post Author
    await sendNotification(
      item.authorId,
      auth.currentUser.uid,
      "comment",
      `${authorName} commented on your post`,
    );
  };

  const handleCommentLike = async (commentIndex) => {
    const updatedComments = [...comments];
    const comment = updatedComments[commentIndex];
    if (!comment.likedBy) comment.likedBy = [];

    const userUid = auth.currentUser.uid;
    const hasLiked = comment.likedBy.includes(userUid);

    if (hasLiked) {
      comment.likes = (comment.likes || 1) - 1;
      comment.likedBy = comment.likedBy.filter((id) => id !== userUid);
    } else {
      comment.likes = (comment.likes || 0) + 1;
      comment.likedBy.push(userUid);

      // 🔥 NOTIFY THE AUTHOR OF THE COMMENT THAT IT WAS LIKED!
      if (comment.authorId && comment.authorId !== userUid) {
        await sendNotification(
          comment.authorId,
          userUid,
          "like",
          `liked your comment`,
        );
      }
    }

    setComments(updatedComments);
    await updateDoc(doc(db, "feed", item.id), {
      commentsList: updatedComments,
    });
  };

  const handleReply = async (commentIndex) => {
    if (!replyText.trim()) return;

    let authorName = auth.currentUser?.email?.split("@")[0] || "You";
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().fullName)
        authorName = userDoc.data().fullName;
    }

    const updatedComments = [...comments];
    if (!updatedComments[commentIndex].replies)
      updatedComments[commentIndex].replies = [];

    updatedComments[commentIndex].replies.push({
      text: replyText,
      author: authorName,
      authorId: auth.currentUser.uid, // 🔥 Save ID for nested replies!
      time: "Just now",
    });

    setComments(updatedComments);
    setReplyText("");
    setReplyingToIndex(null);
    await updateDoc(doc(db, "feed", item.id), {
      commentsList: updatedComments,
    });

    // 🔥 NOTIFY THE AUTHOR OF THE COMMENT BEING REPLIED TO!
    const originalCommentAuthorId = comments[commentIndex].authorId;
    if (
      originalCommentAuthorId &&
      originalCommentAuthorId !== auth.currentUser.uid
    ) {
      await sendNotification(
        originalCommentAuthorId,
        auth.currentUser.uid,
        "reply",
        `${authorName} replied to your comment`,
      );
    }

    // Also notify the Post Author (optional, but good for engagement)
    if (
      item.authorId !== auth.currentUser.uid &&
      item.authorId !== originalCommentAuthorId
    ) {
      await sendNotification(
        item.authorId,
        auth.currentUser.uid,
        "reply",
        `${authorName} replied in your post`,
      );
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "YouChat Post", url });
      } catch (err) {}
    } else {
      await navigator.clipboard.writeText(url);
      setToast("Link copied!");
      setTimeout(() => setToast(""), 2000);
    }
  };

  const renderContent = () => {
    if (item.mediaItems && item.mediaItems.length > 0) {
      return (
        <div className="mb-3">
          <div
            className="flex overflow-x-auto snap-x snap-mandatory rounded-xl scroll-smooth"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
              scrollSnapType: "x mandatory",
            }}
          >
            <style jsx>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {item.mediaItems.map((media: any, index: number) => (
              <div
                key={index}
                className="snap-center flex-shrink-0 relative bg-black rounded-lg overflow-hidden w-full"
                style={{ aspectRatio: "4/5", maxHeight: "500px" }}
              >
                {media.type === "video" ? (
                  <video
                    src={media.url}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={media.url}
                    alt={`Ad ${index + 1}`}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable="false"
                  />
                )}
                {item.mediaItems.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                    {index + 1} / {item.mediaItems.length}
                  </div>
                )}
              </div>
            ))}
          </div>
          {item.mediaItems.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {item.mediaItems.map((_: any, i: number) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-600"
                ></div>
              ))}
            </div>
          )}
          {item.content && (
            <p className="text-gray-100 text-sm mt-3 leading-relaxed">
              {item.content}
            </p>
          )}
        </div>
      );
    }
    switch (item.type) {
      case "product":
        return (
          <Link href={`/item/${item.id}`} className="block group">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                className="w-full h-64 object-cover rounded-xl mb-3"
              />
            )}
            <h3 className="font-bold">{item.title}</h3>
            <p className="text-cyan-400 font-bold">
              ₦{Number(item.price).toLocaleString()}
            </p>
          </Link>
        );
      case "video":
        return (
          <div className="space-y-2">
            <div className="relative bg-black rounded-lg overflow-hidden">
              {item.videoUrl ? (
                <video
                  src={item.videoUrl}
                  controls
                  className="w-full max-h-[500px] object-cover"
                  poster={item.thumbnail || ""}
                />
              ) : (
                <div className="w-full h-64 bg-gray-900 rounded-lg flex items-center justify-center text-4xl">
                  🎥
                </div>
              )}
            </div>
            {item.videoCaption && (
              <p className="text-gray-300 text-sm mt-2">{item.videoCaption}</p>
            )}
            {item.videoLocation && (
              <p className="text-cyan-400 text-xs flex items-center gap-1">
                📍 {item.videoLocation}
              </p>
            )}
            <h3 className="font-bold">{item.title}</h3>
          </div>
        );
      case "job":
        return (
          <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border border-green-500/20 p-4 rounded-xl">
            <h3 className="font-bold text-lg mb-1">💼 {item.title}</h3>
            <p className="text-cyan-400 font-semibold text-sm mb-2">
              {item.salary || "Competitive Pay"}
            </p>
            <p className="text-gray-300 text-sm">{item.content}</p>
          </div>
        );
      default:
        return (
          <div>
            <p className="text-gray-100 text-lg leading-relaxed mb-3">
              {item.content}
            </p>
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt="Post"
                className="w-full h-64 object-cover rounded-lg"
              />
            )}
          </div>
        );
    }
  };

  return (
    <div
      className={`bg-[#111] border rounded-xl p-4 relative ${item.isSponsored ? "border-yellow-500/50 bg-yellow-500/5" : "border-gray-800/50"}`}
    >
      {item.isSponsored && (
        <div className="absolute top-4 right-4 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 z-10 shadow-lg">
          <span></span> Sponsored
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/user/${item.authorId}`}>
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-sm cursor-pointer hover:opacity-80 transition">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={item.authorName}
                className="w-full h-full object-cover"
              />
            ) : (
              item.authorName?.charAt(0).toUpperCase() || "U"
            )}
          </div>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={`font-semibold text-sm ${item.isSponsored ? "text-yellow-400" : "text-white"}`}
            >
              @
              {authorUsername ||
                item.authorName?.toLowerCase().replace(/\s+/g, "") ||
                "user"}
            </p>
            {isAuthorVerified && (
              <svg
                className="w-4 h-4 text-cyan-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                title="Verified Creator"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          {(authorSchool || authorYearOfStudy) && (
            <p className="text-gray-400 text-xs mt-0.5">
              {authorSchool}
              {authorYearOfStudy && ` • ${authorYearOfStudy}`}
            </p>
          )}
          <p className="text-gray-500 text-xs">{getTimeAgo(item.createdAt)}</p>
        </div>
        {auth.currentUser &&
          item.authorId &&
          auth.currentUser.uid !== item.authorId && (
            <button
              onClick={handleFollow}
              className={`px-4 py-1 rounded-full text-xs font-bold transition ${isFollowing ? "bg-[#1a1a1a] text-gray-400 border border-gray-700" : "bg-cyan-500 text-black hover:bg-cyan-400"}`}
            >
              {isFollowing ? "Following" : "+ Follow"}
            </button>
          )}
      </div>
      {renderContent()}
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-800/50">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 transition text-sm ${liked ? "text-red-500 font-bold" : "text-gray-400 hover:text-red-400"}`}
        >
          {liked ? "❤️" : "🤍"} {likeCount}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition text-sm"
        >
          💬 {comments.length}
        </button>
        <button
          onClick={() =>
            onGiftClick(item.authorId, item.authorName || "Creator", item.id)
          }
          className={`flex items-center gap-2 transition text-sm font-semibold relative ${totalGiftsReceived > 0 ? "text-pink-500 font-bold" : "text-gray-400 hover:text-pink-500"}`}
        >
          🎁 Gift
          {totalGiftsReceived > 0 && (
            <span className="bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {totalGiftsReceived}
            </span>
          )}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition text-sm"
        >
          🔗 Share
        </button>
      </div>
      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-800/50">
          {comments.length === 0 ? (
            <p className="text-gray-500 text-sm mb-3">
              No comments yet. Be the first!
            </p>
          ) : (
            comments.map((c: any, i: number) => (
              <div key={i} className="mb-4 bg-[#0a0a0a] p-3 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-cyan-400 text-sm">
                      {c.author}
                    </span>
                    <p className="text-gray-300 text-sm">{c.text}</p>
                  </div>
                  <button
                    onClick={() => handleCommentLike(i)}
                    className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1"
                  >
                    ❤️ {c.likes || 0}
                  </button>
                </div>
                {c.replies && c.replies.length > 0 && (
                  <div className="ml-4 mt-2 border-l-2 border-gray-800 pl-3">
                    {c.replies.map((r: any, ri: number) => (
                      <div key={ri} className="mb-1">
                        <span className="font-bold text-gray-400 text-xs">
                          {r.author}:{" "}
                        </span>
                        <span className="text-gray-300 text-xs">{r.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() =>
                    setReplyingToIndex(replyingToIndex === i ? null : i)
                  }
                  className="text-xs text-gray-500 hover:text-cyan-400 mt-1 font-bold"
                >
                  Reply
                </button>
                {replyingToIndex === i && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleReply(i);
                    }}
                    className="flex gap-2 mt-2"
                  >
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="bg-cyan-500 text-black px-2 py-1 rounded text-xs font-bold"
                    >
                      Send
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
          <form onSubmit={handleComment} className="flex gap-2 mt-3">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="bg-cyan-500 text-black px-4 py-2 rounded-lg text-sm font-bold"
            >
              Post
            </button>
          </form>
        </div>
      )}
      {toast && (
        <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// =================================================================
// ✅ POST MODAL (KEPT EXACTLY AS IT WAS)
// =================================================================
function PostModal({ onClose, onSuccess }: any) {
  const [postType, setPostType] = useState("social");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<any>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoCaption, setVideoCaption] = useState("");
  const [videoLocation, setVideoLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const uploadVideoToCloudinary = async (file: any) => {
    setUploadingVideo(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "youbuy-present");
    data.append("resource_type", "video");
    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/qxd9ghri/video/upload",
        { method: "POST", body: data },
      );
      const result = await res.json();
      return result.secure_url;
    } catch (err) {
      console.error("Video upload error:", err);
      alert("Failed to upload video");
      return null;
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      let authorName = auth.currentUser?.email?.split("@")[0] || "Anonymous";
      let isVerified = false;
      let authorUsername = "";
      let authorSchool = "";
      let authorYearOfStudy = "";

      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.fullName) authorName = userData.fullName;
          isVerified = userData.isVerified || false;
          authorUsername =
            userData.username || authorName.toLowerCase().replace(/\s+/g, "");
          authorSchool = userData.school || "";
          authorYearOfStudy = userData.yearOfStudy || "";
        }
      }

      let finalVideoUrl = videoUrl;
      if (postType === "video" && videoFile) {
        finalVideoUrl = await uploadVideoToCloudinary(videoFile);
        if (!finalVideoUrl) {
          setLoading(false);
          return;
        }
      }

      await addDoc(collection(db, "feed"), {
        type: postType,
        content,
        title,
        videoUrl: finalVideoUrl,
        videoCaption,
        videoLocation,
        authorUsername,
        authorSchool,
        authorYearOfStudy,
        authorId: auth.currentUser?.uid,
        authorName,
        isAuthorVerified: isVerified,
        createdAt: serverTimestamp(),
        likes: 0,
        commentsList: [],
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Create Post</h2>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {["social", "product", "video", "event", "job"].map((type) => (
            <button
              key={type}
              onClick={() => setPostType(type)}
              className={`py-2 rounded-lg text-xs font-bold capitalize transition ${postType === type ? "bg-cyan-500 text-black" : "bg-[#1a1a1a] text-gray-400"}`}
            >
              {type}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {postType !== "social" && (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
              placeholder="Title"
              required
            />
          )}
          {postType === "video" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Upload Video
                </label>
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-cyan-500 transition cursor-pointer bg-[#1a1a1a]">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="cursor-pointer block"
                  >
                    {videoFile ? (
                      <div>
                        <p className="text-cyan-400 font-semibold">
                          {videoFile.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="text-4xl mb-2">🎥</div>
                        <p className="text-gray-400 text-sm">
                          Click to upload video
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          MP4, MOV up to 100MB
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#151515] px-2 text-gray-500">
                    Or paste URL
                  </span>
                </div>
              </div>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                placeholder="https://example.com/video.mp4"
              />
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Caption (Optional)
                </label>
                <input
                  type="text"
                  value={videoCaption}
                  onChange={(e) => setVideoCaption(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="Add a caption to your video..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Location (Optional)
                </label>
                <input
                  type="text"
                  value={videoLocation}
                  onChange={(e) => setVideoLocation(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="e.g., UNILAG, Lagos"
                />
              </div>
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none resize-none"
            placeholder={
              postType === "video"
                ? "Add a description..."
                : "What's happening?"
            }
            required
          />
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#1a1a1a] hover:bg-[#222] py-3 rounded-xl font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingVideo}
              className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black py-3 rounded-xl font-bold transition"
            >
              {uploadingVideo
                ? "Uploading Video..."
                : loading
                  ? "Posting..."
                  : "Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
