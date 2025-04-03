import React from 'react';
import { useAuth } from '../../context/AuthContext';
import ProfileImage from '../ui/ProfileImage';

interface SidebarProps {
  activeSection: 'inbox' | 'sent' | 'drafts' | 'quantum';
  onSectionChange: (section: 'inbox' | 'sent' | 'drafts' | 'quantum') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const { userEmail, userName, userPicture } = useAuth();

  return (
    <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
      {/* User info */}
      <div className="p-6 border-b border-gray-800/50 flex flex-col items-center">
        {userPicture ? (
          <ProfileImage src={userPicture} size="large" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        
        {userName && (
          <p className="text-lg font-semibold text-gray-200">{userName}</p>
        )}
        
        {userEmail && (
          <p className="text-sm text-gray-400">{userEmail}</p>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="p-4">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => onSectionChange('inbox')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                activeSection === 'inbox'
                  ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                  : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              Inbox
            </button>
          </li>
          <li>
            <button
              onClick={() => onSectionChange('sent')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                activeSection === 'sent'
                  ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                  : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Sent
            </button>
          </li>
          <li>
            <button
              onClick={() => onSectionChange('drafts')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                activeSection === 'drafts'
                  ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                  : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Drafts
            </button>
          </li>
          <li>
            <button
              onClick={() => onSectionChange('quantum')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                activeSection === 'quantum'
                  ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                  : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Quantum
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar; 