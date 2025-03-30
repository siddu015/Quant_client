// AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userEmail: string | null;
  userName: string | null;
  userPicture: string | null;
  isLoading: boolean;
  checkAuthStatus: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userEmail: null,
  userName: null,
  userPicture: null,
  isLoading: true,
  checkAuthStatus: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userPicture, setUserPicture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      console.log('Checking authentication status...');
      setIsLoading(true);
      
      const response = await fetch('http://localhost:8080/api/user', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Auth status response:', data);
      
      setIsAuthenticated(data.authenticated);
      setUserEmail(data.email || null);
      setUserName(data.name || null);
      setUserPicture(data.picture || null);
      
      // If authenticated, ensure we're on the dashboard
      if (data.authenticated && window.location.pathname === '/') {
        console.log('Authenticated user on welcome page, redirecting to dashboard...');
        window.location.href = '/dashboard';
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
      console.log('Logging out...');
      
      // Call the backend logout endpoint
      const response = await fetch('http://localhost:8080/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('Logout failed:', response.statusText);
      } else {
        console.log('Logout successful');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local auth state regardless of backend response
      setIsAuthenticated(false);
      setUserEmail(null);
      setUserName(null);
      setUserPicture(null);
      
      // Redirect to home
      window.location.href = '/';
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