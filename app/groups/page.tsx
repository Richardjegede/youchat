"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";

export default function GroupsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchGroups();
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "groups"),
        orderBy("memberCount", "desc"),
        limit(20),
      );
      const snapshot = await getDocs(q);
      const groupsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(groupsData);
    } catch (err) {
      console.error("Error fetching groups:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Discover Groups</h1>
          <Link
            href="/groups/create"
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-full font-bold text-sm transition flex items-center gap-2"
          >
            <span>+</span> Create Group
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
            <p className="text-gray-400 mb-4">No groups found yet.</p>
            <Link
              href="/groups/create"
              className="bg-cyan-500 text-black font-bold px-6 py-2 rounded-full"
            >
              Be the first to create one!
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="block bg-[#111] border border-gray-800 rounded-xl p-4 hover:border-cyan-500 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-800 overflow-hidden flex-shrink-0">
                    {group.groupIcon ? (
                      <img
                        src={group.groupIcon}
                        alt={group.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        👥
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white truncate group-hover:text-cyan-400 transition">
                        {group.name}
                      </h3>
                      {group.privacy === "public" ? (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
                          Public
                        </span>
                      ) : group.privacy === "secret" ? (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                          Secret
                        </span>
                      ) : (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm truncate mb-1">
                      {group.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>📁 {group.category}</span>
                      <span>👤 {group.memberCount || 1} members</span>
                    </div>
                  </div>
                  <div className="text-gray-600 group-hover:text-cyan-400 transition">
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
