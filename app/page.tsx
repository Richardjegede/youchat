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
import ProtectedRoute from "./components/ProtectedRoute";
import { onSnapshot } from "firebase/firestore";
import StoryViewer from "./components/StoryViewer";

export default function Home() {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  // 🔥 STORIES STATES
  const [stories, setStories] = useState([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [uploadingStory, setUploadingStory] = useState(false);

  const tabs = [
    { id: "all", label: "All" },
    { id: "product", label: "Market" },
    { id: "social", label: "Social" },
    { id: "video", label: "Videos" },
    { id: "event", label: "Events" },
    { id: "job", label: "Jobs" },
  ];

  useEffect(() => {
    fetchFeed();
  }, [activeTab]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "feed"),
        orderBy("createdAt", "desc"),
        limit(20),
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setFeedItems(
        activeTab === "all" ? items : items.filter((i) => i.type === activeTab),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  // 🔥 UPLOAD STORY TO CLOUDINARY
  const uploadStory = async (e) => {
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
        {
          method: "POST",
          body: data,
        },
      );
      const result = await res.json();

      // 🔥 FETCH REAL NAME INSTEAD OF EMAIL
      let realName = auth.currentUser?.email?.split("@")[0] || "Creator";
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists() && userDoc.data().fullName) {
          realName = userDoc.data().fullName;
        }
      } catch (err) {
        console.error(err);
      }

      await addDoc(collection(db, "stories"), {
        userId: auth.currentUser.uid,
        userName: realName, // ✅ REAL NAME!
        userAvatar: null,
        mediaUrl: result.secure_url,
        mediaType: resourceType,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        viewers: [],
      });

      setShowCreateStory(false);
      setStoryFile(null);
    } catch (err) {
      console.error("Story upload error:", err);
      alert("Failed to upload story");
    } finally {
      setUploadingStory(false);
    }
  };

  // 🔥 FETCH ACTIVE STORIES (24 Hours)
  useEffect(() => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const q = query(
      collection(db, "stories"),
      where("expiresAt", ">", twentyFourHoursAgo),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeStories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔥 GROUP STORIES BY USER
      const grouped = {};
      activeStories.forEach((story) => {
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

      // Sort stories inside each group by date (oldest first)
      Object.values(grouped).forEach((group) => {
        group.stories.sort(
          (a, b) => a.createdAt?.toDate() - b.createdAt?.toDate(),
        );
      });

      setStories(Object.values(grouped));
    });

    return () => unsubscribe();
  }, []);

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-24 pt-20">
        {/* 🔥 STORIES BAR - PASTED RIGHT HERE! */}
        <div className="sticky top-16 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-gray-800/50 py-4 overflow-x-auto scrollbar-hide">
          <div className="max-w-2xl mx-auto px-4 flex gap-4">
            {/* Add Story Button */}
            <div
              className="flex flex-col items-center gap-1 cursor-pointer"
              onClick={() => setShowCreateStory(true)}
            >
              <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border-2 border-dashed border-gray-600 flex items-center justify-center text-2xl text-gray-400 hover:border-cyan-500 hover:text-cyan-500 transition">
                +
              </div>
              <span className="text-xs text-gray-400">Your Story</span>
            </div>

            {/* Other Users' Stories (Grouped with Broken Circle) */}
            {stories.map((group, index) => {
              const myUid = auth.currentUser?.uid;
              const hasUnviewed = group.stories.some(
                (s) => !s.viewers?.includes(myUid),
              );
              const storyCount = group.stories.length;

              // Get the latest story for the thumbnail
              const latestStory = group.stories[storyCount - 1];
              const isVideo = latestStory.mediaType === "video";

              return (
                <div
                  key={group.userId}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                  onClick={() => {
                    setCurrentStoryIndex(index);
                    setShowStoryViewer(true);
                  }}
                >
                  {/* Ring Container */}
                  <div
                    className={`relative w-16 h-16 rounded-full p-[2px] ${hasUnviewed ? "bg-gradient-to-tr from-cyan-500 to-blue-600" : "bg-gray-600"}`}
                  >
                    <div className="w-full h-full rounded-full bg-[#0a0a0a] p-[2px] overflow-hidden relative">
                      {/* THUMBNAIL */}
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

                      {/* VIDEO ICON OVERLAY */}
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="text-white text-xs">▶</span>
                        </div>
                      )}

                      {/* 🔥 BROKEN CIRCLE INDICATOR (Count Badge) */}
                      {storyCount > 1 && (
                        <div className="absolute bottom-0 right-0 bg-cyan-500 text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">
                          {storyCount}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-xs truncate w-16 text-center ${hasUnviewed ? "text-white font-semibold" : "text-gray-500"}`}
                  >
                    {group.userName?.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* YOUR EXISTING TABS SECTION (UNCHANGED) */}
        <div className="sticky top-40 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-gray-800/50 overflow-x-auto scrollbar-hide">
          <div className="max-w-2xl mx-auto flex gap-2 px-4 py-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-white text-black scale-105" : "bg-[#1a1a1a] text-gray-400 hover:bg-[#222]"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* FEED CONTENT (UNCHANGED) */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {loading ? (
            <div className="text-center py-20">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
          ) : (
            feedItems.map((item) => (
              <FeedItem key={item.id} item={item} getTimeAgo={getTimeAgo} />
            ))
          )}
        </div>

        {/* FAB BUTTON (UNCHANGED) */}
        <button
          onClick={() => setShowPostModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-500 hover:bg-cyan-400 text-black rounded-full shadow-2xl flex items-center justify-center text-3xl font-bold transition transform hover:scale-110 active:scale-95 z-40"
        >
          +
        </button>

        {/* 🔥 STORY VIEWER MODAL (Passes the whole group) */}
        {showStoryViewer && stories[currentStoryIndex] && (
          <StoryViewer
            storiesGroup={stories[currentStoryIndex]}
            onClose={() => setShowStoryViewer(false)}
          />
        )}

        {/* 🔥 CREATE STORY MODAL - ADDED HERE */}
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
                    onChange={(e) => setStoryFile(e.target.files[0])}
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

        {/* POST MODAL (UNCHANGED) */}
        {showPostModal && (
          <PostModal
            onClose={() => setShowPostModal(false)}
            onSuccess={fetchFeed}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

// 🔥 THE ULTIMATE INTERACTIVE FEED ITEM (With Clickable Avatars & Blue Tick!)
function FeedItem({ item, getTimeAgo }) {
  // ... (keep all your existing state variables like liked, likeCount, etc.)
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(item.commentsList || []);
  const [toast, setToast] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [replyingToIndex, setReplyingToIndex] = useState(null);
  const [replyText, setReplyText] = useState("");

  // 🔥 NEW STATES FOR AUTHOR PROFILE
  const [authorAvatar, setAuthorAvatar] = useState(null);
  const [isAuthorVerified, setIsAuthorVerified] = useState(false);

  // Check if user already liked this post
  useEffect(() => {
    if (
      item.likedBy &&
      auth.currentUser &&
      item.likedBy.includes(auth.currentUser.uid)
    ) {
      setLiked(true);
    }
  }, [item.likedBy]);

  // 🔥 FETCH AUTHOR'S AVATAR AND VERIFICATION STATUS
  useEffect(() => {
    const fetchAuthorProfile = async () => {
      if (item.authorId) {
        try {
          const userDoc = await getDoc(doc(db, "users", item.authorId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.avatar) setAuthorAvatar(data.avatar);
            if (data.isVerified) setIsAuthorVerified(true); // 🔥 MAGIC LINE
          }
        } catch (err) {
          console.error("Error fetching author profile:", err);
        }
      }
    };
    fetchAuthorProfile();
  }, [item.authorId]);

  // ... (keep your existing handleFollow, handleLike, handleComment functions exactly as they are) ...
  // 🔥 ADD THIS FUNCTION TO PREVENT CRASHES
  const sendNotification = async (
    targetUserId: string,
    actorUid: string,
    type: string,
    message: string,
  ) => {
    if (!targetUserId || targetUserId === actorUid) return; // Don't notify yourself
    try {
      await addDoc(collection(db, "notifications"), {
        userId: targetUserId,
        actorUid: actorUid,
        type: type, // "like", "comment", "follow", etc.
        message: message,
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
        likedBy: arrayUnion(auth.currentUser.uid),
      });
      await sendNotification(
        item.authorId,
        auth.currentUser.uid,
        "like",
        "liked your post",
      );
    } else {
      await updateDoc(doc(db, "feed", item.id), {
        likes: newCount,
        likedBy: arrayRemove(auth.currentUser.uid),
      });
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    let authorName = auth.currentUser?.email?.split("@")[0] || "You";
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().fullName) {
        authorName = userDoc.data().fullName;
      }
    }

    const newComment = {
      text: commentText,
      author: authorName,
      time: "Just now",
      likes: 0,
      replies: [],
    };
    const newComments = [...comments, newComment];
    setComments(newComments);
    setCommentText("");
    await updateDoc(doc(db, "feed", item.id), { commentsList: newComments });

    // 🔔 SEND COMMENT NOTIFICATION!
    await sendNotification(
      item.authorId,
      auth.currentUser.uid,
      "comment",
      `commented: "${commentText.substring(0, 30)}${commentText.length > 30 ? "..." : ""}"`,
    );
  };

  // 🔥 SMART COMMENT LIKE (Prevents infinite counting!)
  const handleCommentLike = async (commentIndex) => {
    const updatedComments = [...comments];
    const comment = updatedComments[commentIndex];

    // Initialize the likedBy array if it doesn't exist
    if (!comment.likedBy) comment.likedBy = [];

    const userUid = auth.currentUser.uid;
    const hasLiked = comment.likedBy.includes(userUid);

    if (hasLiked) {
      // If already liked, UNLIKE it (remove name, decrease count)
      comment.likes = (comment.likes || 1) - 1;
      comment.likedBy = comment.likedBy.filter((id) => id !== userUid);
    } else {
      // If not liked, LIKE it (add name, increase count)
      comment.likes = (comment.likes || 0) + 1;
      comment.likedBy.push(userUid);
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
      if (userDoc.exists() && userDoc.data().fullName) {
        authorName = userDoc.data().fullName;
      }
    }

    const updatedComments = [...comments];
    if (!updatedComments[commentIndex].replies)
      updatedComments[commentIndex].replies = [];

    updatedComments[commentIndex].replies.push({
      text: replyText,
      author: authorName,
      time: "Just now",
    });

    setComments(updatedComments);
    setReplyText("");
    setReplyingToIndex(null);
    await updateDoc(doc(db, "feed", item.id), {
      commentsList: updatedComments,
    });

    // 🔔 SEND REPLY NOTIFICATION!
    await sendNotification(
      item.authorId,
      auth.currentUser.uid,
      "comment",
      `replied to your comment: "${replyText.substring(0, 30)}${replyText.length > 30 ? "..." : ""}"`,
    );
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
            <div className="relative bg-black rounded-xl overflow-hidden">
              {item.videoUrl ? (
                <video
                  src={item.videoUrl}
                  controls
                  className="w-full max-h-96 object-cover"
                  poster={item.thumbnail || ""}
                />
              ) : (
                <div className="w-full h-80 bg-gray-900 rounded-xl flex items-center justify-center text-4xl">
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
                className="w-full h-64 object-cover rounded-xl"
              />
            )}
          </div>
        );
    }
  };

  return (
    <div className="bg-[#111] border border-gray-800/50 rounded-2xl p-5 relative">
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
          {/* 🔥 NAME + CELEBRITY BLUE TICK */}
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm text-white">
              {item.authorName || "Anonymous"}
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
            comments.map((c, i) => (
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
                    {c.replies.map((r, ri) => (
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
// ✅ POST MODAL WITH VIDEO UPLOAD
function PostModal({ onClose, onSuccess }) {
  const [postType, setPostType] = useState("social");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoCaption, setVideoCaption] = useState("");
  const [videoLocation, setVideoLocation] = useState("");
  const [loading, setLoading] = useState(false);

  // Upload video to Cloudinary
  const uploadVideoToCloudinary = async (file) => {
    setUploadingVideo(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "youbuy-present");
    data.append("resource_type", "video");

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/qxd9ghri/video/upload",
        {
          method: "POST",
          body: data,
        },
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let authorName = auth.currentUser?.email?.split("@")[0] || "Anonymous";
      let isVerified = false; // 🔥 DEFAULT TO FALSE

      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          if (userDoc.data().fullName) {
            authorName = userDoc.data().fullName;
          }
          isVerified = userDoc.data().isVerified || false; // 🔥 GET VERIFICATION STATUS
        }
      }

      // Handle video upload if file exists
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
        authorId: auth.currentUser?.uid,
        authorName: authorName,
        isAuthorVerified: isVerified, // 🔥 SAVE IT TO THE POST!
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

        {/* Post Type Selector */}
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
          {/* Title Field (for non-social posts) */}
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

          {/* Video Upload Section */}
          {postType === "video" && (
            <div className="space-y-4">
              {/* Video File Upload */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Upload Video
                </label>
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-cyan-500 transition cursor-pointer bg-[#1a1a1a]">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files[0])}
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

              {/* OR Paste URL */}
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

              {/* Video Caption */}
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

              {/* Video Location */}
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

          {/* Content/Description Field */}
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

          {/* Submit Buttons */}
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
