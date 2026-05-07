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
  const initializedRef = useRef(false)
  // Track the last user ID we loaded a profile for so SIGNED_IN events that fire
  // for the already-active user (cross-tab sync, PWA resume) don't reset the UI.
  const activeUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Initial session load — runs once on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      activeUserIdRef.current = u?.id ?? null
      if (u) {
        fetchProfile(u.id)
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
        activeUserIdRef.current = null
        return
      }

      if (event === 'SIGNED_IN') {
        const incomingId = session?.user?.id ?? null
        setUser(session?.user ?? null)
        if (session?.user) {
          // Only show a loading state if this is a genuinely new sign-in.
          // SIGNED_IN also fires during cross-tab sync and PWA background-resume;
          // in those cases the profile is already loaded and resetting loading
          // would cause a visible flash / hang.
          const isNewUser = incomingId !== activeUserIdRef.current || !initializedRef.current
          activeUserIdRef.current = incomingId
          if (isNewUser) setLoading(true)
          fetchProfile(session.user.id)
        }
        return
      }

      // USER_UPDATED or anything else — silently update the user object only
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string, attempt = 0) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      setProfile(data as Profile | null)
      setLoading(false)
      initializedRef.current = true
    } catch (err) {
      // Retry once after 1 s — the PostgREST layer sometimes hasn't
      // propagated the new JWT yet when this fires right after SIGNED_IN.
      if (attempt === 0) {
        setTimeout(() => fetchProfile(userId, 1), 1000)
        return
      }
      console.error('[AuthContext] fetchProfile failed:', err)
      setProfile(null)
      setLoading(false)
      initializedRef.current = true
    }
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
