"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";

interface UserContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (cancelled) return;
        setProfile(data);
      }
      setLoading(false);
    }

    fetchUser();

    const {
      data: { subscription },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <UserContext.Provider value={{ user, profile, loading, isAdmin: profile?.role === "admin" }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
}
