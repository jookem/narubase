import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types/database'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({ user: null, profile: null, loading: true, refreshProfile: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Track whether we've completed the first load so subsequent auth events
  // (token refresh, tab focus) never flip loading back to true.
  const initializedRef = useRef(false)

  useEffect(() => {
    // Initial session load — runs once on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
        initializedRef.current = true
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore events that fire on tab focus / token refresh — they must
      // never reset the UI to a loading state.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setLoading(false)
        initializedRef.current = false
        return
      }

      // SIGNED_IN: only do a full re-init when this is a genuine new login,
      // not a background session restore after the first load.
      if (event === 'SIGNED_IN') {
        if (initializedRef.current) return  // already loaded — ignore
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
        return
      }

      // USER_UPDATED or anything else — silently update the user object only
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data as Profile | null)
    setLoading(false)
    initializedRef.current = true
  }

  async function refreshProfile() {
    if (!user) return
    await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
