// Auth context with exact userState structure from deprecated client
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Exact same userState structure from deprecated client
interface UserState {
  // Authentication state
  currentUserId: string | null; // Supabase user.id (UUID) when authenticated
  isAuthenticated: boolean;
  userEmail: string | null;
  
  // Token/billing state
  tokensRemaining: number;
  subscriptionTier: string;
  
  // AI Assist state (host-only)
  aiAssistEnabled: boolean;
  aiPrompt: string;
  isHost: boolean; // Track if current user is the room host
  
  // Transcription state
  transcriptionEnabled: boolean;
  lastTranscriptionTime: number;
  transcriptionChunkCount: number;
}

// Initial state - exact same as deprecated client
const initialUserState: UserState = {
  // Authentication state
  currentUserId: null,
  isAuthenticated: false,
  userEmail: null,
  
  // Token/billing state
  tokensRemaining: 0,
  subscriptionTier: 'free',
  
  // AI Assist state (host-only)
  aiAssistEnabled: false,
  aiPrompt: '',
  isHost: false,
  
  // Transcription state
  transcriptionEnabled: false,
  lastTranscriptionTime: 0,
  transcriptionChunkCount: 0,
};

interface AuthContextType {
  userState: UserState;
  setUserState: React.Dispatch<React.SetStateAction<UserState>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userState, setUserState] = useState<UserState>(initialUserState);

  return (
    <AuthContext.Provider value={{ userState, setUserState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}