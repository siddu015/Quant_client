// AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

// Helper function for Google profile URLs
const sanitizeProfilePicture = (url: string | null): string | null => {
  if (!url) return null;
  
  // Ensure HTTPS protocol
  let sanitized = url.startsWith('http://') 
    ? url.replace('http://', 'https://') 
    : url;
  
  // Update Google image size parameters
  if (sanitized.includes('googleusercontent.com') && sanitized.includes('=s')) {
    sanitized = sanitized.replace(/=s\d+-c/, '=s256-c');
  }
  
  return sanitized;
};

interface UserResponse {
  authenticated: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
  message?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  userEmail: string | null;
  userName: string | null;
  userPicture: string | null;
  isLoading: boolean;
  checkAuthStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userEmail: null,
  userName: null,
  userPicture: null,
  isLoading: true,
  checkAuthStatus: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userPicture, setUserPicture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('http://localhost:8080/api/user', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      const data: UserResponse = await response.json();
      console.log('Auth check response:', data);

      if (response.ok) {
        setIsAuthenticated(data.authenticated);
        setUserEmail(data.email);
        setUserName(data.name);
        setUserPicture(sanitizeProfilePicture(data.picture));

        if (data.authenticated) {
          console.log('User is authenticated:', data.email);
        } else {
          console.log('User is not authenticated:', data.message);
          throw new Error(data.message || 'Not authenticated');
        }
      } else {
        throw new Error('Failed to check authentication status');
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setIsAuthenticated(false);
      setUserEmail(null);
      setUserName(null);
      setUserPicture(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
    
    // Set up an interval to periodically check auth status (every 5 minutes)
    const intervalId = setInterval(checkAuthStatus, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  const logout = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }

      // Clear auth state
      setIsAuthenticated(false);
      setUserEmail(null);
      setUserName(null);
      setUserPicture(null);

      // Force reload to clear any cached state
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear auth state on error
      setIsAuthenticated(false);
      setUserEmail(null);
      setUserName(null);
      setUserPicture(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userEmail,
        userName,
        userPicture,
        isLoading,
        checkAuthStatus,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);