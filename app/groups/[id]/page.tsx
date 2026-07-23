"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
  setDoc,
  deleteDoc, // 🔥 ADDED for removing members
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";

export default function GroupPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Modals & Forms
  const [showPostModal, setShowPostModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [joining, setJoining] = useState(false);

  // Interaction States
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [postAuthors, setPostAuthors] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null); // For admin dropdown

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchGroupData(currentUser.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [id, router]);

  useEffect(() => {
    const fetchAuthors = async () => {
      const authorsData: any = {};
      for (const post of posts) {
        if (post.authorId && !authorsData[post.authorId]) {
          try {
            const userDoc = await getDoc(doc(db, "users", post.authorId));
            if (userDoc.exists()) {
              const data = userDoc.data();
              authorsData[post.authorId] =
                data.fullName ||
                data.username ||
                data.email?.split("@")[0] ||
                "User";
            }
          } catch (err) {
            console.error("Error fetching author:", err);
          }
        }
      }
      setPostAuthors(authorsData);
    };
    if (posts.length > 0) fetchAuthors();
  }, [posts]);

  const fetchGroupData = async (uid: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const groupDoc = await getDoc(doc(db, "groups", id as string));
      if (groupDoc.exists()) {
        setGroup({ id: groupDoc.id, ...groupDoc.data() });
        const memberDoc = await getDoc(
          doc(db, "groups", id as string, "members", uid),
        );
        setUserRole(memberDoc.exists() ? memberDoc.data().role : null);
      }

      // 🔥 FETCH MEMBERS AND THEIR REAL PROFILES
      const membersQuery = query(
        collection(db, "groups", id as string, "members"),
      );
      const membersSnapshot = await getDocs(membersQuery);

      const membersData = [];
      for (const docSnap of membersSnapshot.docs) {
        const memberInfo = docSnap.data();
        // Fetch real user data from main 'users' collection
        const userDoc = await getDoc(doc(db, "users", memberInfo.userId));
        if (userDoc.exists()) {
          membersData.push({
            id: docSnap.id,
            ...memberInfo,
            ...userDoc.data(), // Merges fullName, avatar, etc.
          });
        }
      }
      setMembers(membersData);

      const postsQuery = query(
        collection(db, "feed"),
        where("groupId", "==", id),
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsData = postsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      postsData.sort((a, b) => {
        if (a.isAnnouncement && !b.isAnnouncement) return -1;
        if (!a.isAnnouncement && b.isAnnouncement) return 1;
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
      setPosts(postsData);
    } catch (err) {
      console.error("Error fetching group data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async () => {
    if (!user || !group) return;
    setJoining(true);
    try {
      const role = group.privacy === "public" ? "member" : "pending";
      await setDoc(doc(db, "groups", group.id, "members", user.uid), {
        userId: user.uid,
        role,
        joinedAt: serverTimestamp(),
        notificationsEnabled: true,
      });
      // 🔥 NOTIFY ADMIN FOR BOTH PRIVATE AND SECRET GROUPS
      if (group.privacy === "private" || group.privacy === "secret") {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};

        // 🔥 GRAB THE REAL NAME SAFELY
        const actorName =
          userData.fullName ||
          userData.username ||
          user.email?.split("@")[0] ||
          "Someone";

        await addDoc(collection(db, "notifications"), {
          userId: group.createdBy,
          actorUid: user.uid,
          actorName: actorName, // 🔥 THIS IS WHAT THE NOTIFICATIONS PAGE READS
          type: "group_join_request",
          groupId: group.id,
          groupName: group.name,
          message: `${actorName} wants to join ${group.name}`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      setUserRole(role);
      setShowJoinModal(false);
      fetchGroupData(user.uid);
    } catch (err) {
      console.error("Error joining group:", err);
      alert("Failed to join group");
    } finally {
      setJoining(false);
    }
  };

  const handleSecretJoin = async () => {
    if (!user || !group) return;
    if (inviteCodeInput.toUpperCase() !== group.inviteCode) {
      alert("❌ Invalid Invite Code.");
      return;
    }
    await handleJoinRequest();
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !user || !group) return;
    try {
      await addDoc(collection(db, "feed"), {
        type: "social",
        content: newPostContent,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0],
        groupId: group.id,
        groupName: group.name,
        isPinned,
        isAnnouncement,
        createdAt: serverTimestamp(),
        likes: 0,
        commentsList: [],
      });
      setNewPostContent("");
      setIsPinned(false);
      setIsAnnouncement(false);
      setShowPostModal(false);
      fetchGroupData(user.uid);
    } catch (err) {
      console.error("Error creating post:", err);
    }
  };

  const handleLikePost = async (postId: string, currentLikes: number) => {
    if (!user) return;
    const postRef = doc(db, "feed", postId);
    const hasLiked = likedPosts.has(postId);
    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likes: currentLikes - 1,
          likedBy: arrayRemove(user.uid),
        });
        const newLiked = new Set(likedPosts);
        newLiked.delete(postId);
        setLikedPosts(newLiked);
      } else {
        await updateDoc(postRef, {
          likes: currentLikes + 1,
          likedBy: arrayUnion(user.uid),
        });
        const newLiked = new Set(likedPosts);
        newLiked.add(postId);
        setLikedPosts(newLiked);
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleCommentPost = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    const postRef = doc(db, "feed", postId);
    try {
      const newComment = {
        text: commentText,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0],
        createdAt: serverTimestamp(),
        likes: 0,
      };
      await updateDoc(postRef, { commentsList: arrayUnion(newComment) });
      setCommentText("");
    } catch (err) {
      console.error("Error commenting:", err);
    }
  };

  // 🔥 ADMIN ACTIONS
  const handleMakeAdmin = async (memberId: string) => {
    if (!confirm("Make this user an Admin?")) return;
    try {
      await updateDoc(doc(db, "groups", group.id, "members", memberId), {
        role: "admin",
      });
      alert("User promoted to Admin!");
      fetchGroupData(user?.uid || "");
      setActiveMenuId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update role");
    }
  };

  const handleDemoteAdmin = async (memberId: string) => {
    if (!confirm("Remove Admin status from this user?")) return;
    try {
      await updateDoc(doc(db, "groups", group.id, "members", memberId), {
        role: "member",
      });
      alert("User demoted to Member.");
      fetchGroupData(user?.uid || "");
      setActiveMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this user from the group?"))
      return;
    try {
      await deleteDoc(doc(db, "groups", group.id, "members", memberId));
      // Decrement count
      const groupRef = doc(db, "groups", group.id);
      const groupDoc = await getDoc(groupRef);
      if (groupDoc.exists()) {
        await updateDoc(groupRef, {
          memberCount: Math.max(0, (groupDoc.data().memberCount || 1) - 1),
        });
      }
      alert("User removed from group.");
      fetchGroupData(user?.uid || "");
      setActiveMenuId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to remove user");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  if (!group)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <Link
          href="/groups"
          className="bg-cyan-500 text-black px-6 py-2 rounded-full font-bold"
        >
          Back to Groups
        </Link>
      </div>
    );

  const isAdmin = userRole === "admin";
  const isMember = userRole === "member";
  const isPending = userRole === "pending";
  const canPost = isAdmin || (isMember && group.settings?.allowMemberPosts);
  const actualMemberCount = members.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-purple-600 to-cyan-600 overflow-hidden">
        {group.coverPhoto && (
          <img src={group.coverPhoto} className="w-full h-full object-cover" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
          <div className="max-w-2xl mx-auto flex items-end gap-4">
            <div className="w-20 h-20 rounded-full border-4 border-[#0a0a0a] overflow-hidden bg-gray-800 flex items-center justify-center text-3xl font-bold">
              {group.groupIcon ? (
                <img
                  src={group.groupIcon}
                  className="w-full h-full object-cover"
                />
              ) : (
                "👥"
              )}
            </div>
            <div className="flex-1 mb-2">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {group.name}
                {group.privacy === "secret" && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                    Secret
                  </span>
                )}
              </h1>
              <button
                onClick={() => setShowMembersModal(true)}
                className="text-gray-300 text-sm hover:text-cyan-400 transition flex items-center gap-1"
              >
                <span>👥 {actualMemberCount} members</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-[#111] border border-gray-800 rounded-xl p-4 mb-6">
          <p className="text-gray-300 mb-3">{group.description}</p>
          {isAdmin && group.privacy === "secret" && group.inviteCode && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-xs font-bold uppercase mb-2 tracking-wider">
                {" "}
                Admin: Secret Invite Code
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#0a0a0a] text-white text-xl font-mono font-bold tracking-[0.2em] text-center py-2 rounded-lg border border-red-500/50">
                  {group.inviteCode}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(group.inviteCode);
                    alert("Copied! ");
                  }}
                  className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-lg font-bold text-sm transition"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          {!userRole && (
            <div className="mt-4">
              {group.privacy === "public" && (
                <button
                  onClick={handleJoinRequest}
                  disabled={joining}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition disabled:opacity-50"
                >
                  {joining ? "Joining..." : "Join Group"}
                </button>
              )}
              {group.privacy === "private" && (
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition"
                >
                  Request to Join
                </button>
              )}
              {group.privacy === "secret" && (
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl transition"
                >
                  Enter Secret Code
                </button>
              )}
            </div>
          )}
          {isPending && (
            <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center text-yellow-400 text-sm font-semibold">
              {" "}
              Request pending admin approval.
            </div>
          )}
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Group Feed</h2>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-full font-bold text-sm transition"
              >
                + Add
              </button>
            )}
            {canPost && (
              <button
                onClick={() => setShowPostModal(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-full font-bold text-sm transition"
              >
                + Post
              </button>
            )}
          </div>
        </div>

        {!isMember && !isAdmin ? (
          <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
            <p className="text-gray-400 mb-4">Join this group to see posts.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
            <p className="text-gray-400 mb-4">No posts yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const authorName =
                postAuthors[post.authorId] || post.authorName || "Unknown";
              const isLiked = likedPosts.has(post.id);
              const showComments = showCommentsFor === post.id;
              return (
                <div
                  key={post.id}
                  className={`bg-[#111] border rounded-xl p-4 ${post.isAnnouncement ? "border-cyan-500/50 bg-cyan-500/5" : post.isPinned ? "border-yellow-500/50 bg-yellow-500/5" : "border-gray-800"}`}
                >
                  <div className="flex gap-2 mb-2">
                    {post.isAnnouncement && (
                      <span className="text-[10px] bg-cyan-500 text-black px-2 py-0.5 rounded-full font-bold">
                        📢 ANNOUNCEMENT
                      </span>
                    )}
                    {post.isPinned && (
                      <span className="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">
                        📌 PINNED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-sm">
                      {authorName?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{authorName}</p>
                      <p className="text-gray-500 text-xs">
                        {post.createdAt?.toDate
                          ? post.createdAt.toDate().toLocaleDateString()
                          : "Recently"}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-100 mb-3 whitespace-pre-wrap">
                    {post.content}
                  </p>
                  <div className="flex gap-4 text-sm border-t border-gray-800 pt-3">
                    <button
                      onClick={() => handleLikePost(post.id, post.likes || 0)}
                      className={`flex items-center gap-2 transition ${isLiked ? "text-red-500 font-bold" : "text-gray-400 hover:text-red-400"}`}
                    >
                      {isLiked ? "❤️" : "🤍"} {post.likes || 0}
                    </button>
                    <button
                      onClick={() =>
                        setShowCommentsFor(showComments ? null : post.id)
                      }
                      className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition"
                    >
                      💬 {post.commentsList?.length || 0}
                    </button>
                  </div>
                  {showComments && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      {post.commentsList?.length === 0 ? (
                        <p className="text-gray-500 text-sm mb-3">
                          No comments yet.
                        </p>
                      ) : (
                        <div className="space-y-3 mb-3">
                          {post.commentsList?.map(
                            (comment: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-[#0a0a0a] p-3 rounded-lg"
                              >
                                <p className="text-sm text-gray-300">
                                  <span className="font-bold text-cyan-400">
                                    {comment.authorName}:{" "}
                                  </span>
                                  {comment.text}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                      <form
                        onSubmit={(e) => handleCommentPost(e, post.id)}
                        className="flex gap-2"
                      >
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔥 MEMBERS MODAL WITH ADMIN CONTROLS */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                Group Members ({actualMemberCount})
              </h2>
              <button
                onClick={() => setShowMembersModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="space-y-2">
              {members.map((member) => {
                const isSelf = member.userId === user?.uid;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between bg-[#1a1a1a] p-3 rounded-xl"
                  >
                    <div
                      onClick={() => {
                        setShowMembersModal(false);
                        router.push(`/user/${member.userId}`);
                      }}
                      className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center font-bold">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          member.fullName?.charAt(0).toUpperCase() || "U"
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {member.fullName || member.username || "User"}
                        </p>
                        <p className="text-gray-500 text-xs capitalize">
                          {member.role}
                        </p>
                      </div>
                    </div>

                    {/* 🔥 ADMIN ACTIONS MENU */}
                    {isAdmin && !isSelf && (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenuId(
                              activeMenuId === member.id ? null : member.id,
                            )
                          }
                          className="text-gray-400 hover:text-white p-2"
                        >
                          ⋮
                        </button>
                        {activeMenuId === member.id && (
                          <div className="absolute right-0 top-8 bg-[#222] border border-gray-700 rounded-lg shadow-xl z-50 w-40 overflow-hidden">
                            <button
                              onClick={() =>
                                router.push(`/user/${member.userId}`)
                              }
                              className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333]"
                            >
                              View Profile
                            </button>
                            {member.role === "member" ? (
                              <button
                                onClick={() => handleMakeAdmin(member.userId)}
                                className="block w-full text-left px-4 py-2 text-sm text-cyan-400 hover:bg-[#333]"
                              >
                                Make Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDemoteAdmin(member.userId)}
                                className="block w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-[#333]"
                              >
                                Demote to Member
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#333] border-t border-gray-700"
                            >
                              Remove User
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {member.role === "admin" && (
                      <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full ml-2">
                        Admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* JOIN MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {group.privacy === "secret"
                ? "Enter Secret Code"
                : "Request to Join"}
            </h2>
            {group.privacy === "secret" ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) =>
                    setInviteCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="e.g., X7K9P2"
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-cyan-500"
                  maxLength={6}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowJoinModal(false)}
                    className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSecretJoin}
                    disabled={joining || inviteCodeInput.length !== 6}
                    className="flex-1 bg-cyan-500 text-black py-3 rounded-xl font-bold disabled:opacity-50"
                  >
                    {joining ? "Verifying..." : "Unlock"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  The admin will review your request.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowJoinModal(false)}
                    className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinRequest}
                    disabled={joining}
                    className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold disabled:opacity-50"
                  >
                    {joining ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE POST MODAL */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">Create Post</h2>
            <form onSubmit={handleCreatePost}>
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's happening?"
                rows={4}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 mb-4 resize-none"
                required
              />
              {isAdmin && (
                <div className="flex gap-4 mb-4 bg-[#1a1a1a] p-3 rounded-xl border border-gray-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="w-4 h-4 accent-yellow-500"
                    />
                    <span className="text-sm text-gray-300">📌 Pin</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnnouncement}
                      onChange={(e) => setIsAnnouncement(e.target.checked)}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <span className="text-sm text-gray-300">
                      📢 Announcement
                    </span>
                  </label>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-cyan-500 text-black py-3 rounded-xl font-bold"
                >
                  Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL (Admin Only) */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Add Members</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={async (e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 2) {
                  const usersQuery = query(collection(db, "users"), limit(20));
                  const snapshot = await getDocs(usersQuery);
                  const users = snapshot.docs
                    .filter(
                      (doc) =>
                        doc
                          .data()
                          .fullName?.toLowerCase()
                          .includes(e.target.value.toLowerCase()) ||
                        doc
                          .data()
                          .username?.toLowerCase()
                          .includes(e.target.value.toLowerCase()),
                    )
                    .map((doc) => ({ id: doc.id, ...doc.data() }));
                  setSearchResults(users);
                } else {
                  setSearchResults([]);
                }
              }}
              placeholder="Search by name or username..."
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 mb-4"
            />
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between bg-[#1a1a1a] p-3 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        u.fullName?.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{u.fullName}</p>
                      <p className="text-gray-500 text-xs">@{u.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await setDoc(
                        doc(db, "groups", group.id, "members", u.id),
                        {
                          userId: u.id,
                          role: "member",
                          joinedAt: serverTimestamp(),
                          notificationsEnabled: true,
                          userName: u.fullName,
                          userAvatar: u.avatar,
                        },
                      );
                      alert(`Added ${u.fullName}!`);
                      fetchGroupData(user?.uid || "");
                      setShowAddMemberModal(false);
                    }}
                    className="bg-cyan-500 text-black px-3 py-1 rounded-lg text-sm font-bold"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="w-full mt-4 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
