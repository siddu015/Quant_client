import React from 'react';
import { useAuth } from '../../context/AuthContext';
import ProfileImage from '../ui/ProfileImage';

interface HeaderProps {
  onLogout: () => Promise<void>;
}

const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const { userEmail, userName, userPicture } = useAuth();

  return (
    <header className="relative bg-gray-900/50 backdrop-blur-lg border-b border-gray-800/50 shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Quantum Mail
            </h1>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-4">
              {userPicture && (
                <ProfileImage src={userPicture} size="small" />
              )}
              <div>
                {userName && (
                  <p className="text-sm font-medium text-gray-200">{userName}</p>
                )}
                {userEmail && (
                  <p className="text-xs text-gray-400">{userEmail}</p>
                )}
              </div>
            </div>
            
            <button 
              onClick={onLogout}
              className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 hover:shadow-lg hover:shadow-purple-500/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 