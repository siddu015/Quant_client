// EmailListItem.tsx
import React, { memo, useMemo } from 'react';
import { Email } from '../../types/Email';

interface EmailListItemProps {
  email: Email;
  onClick: () => void;
  isSelected?: boolean;
  mode: 'inbox' | 'sent' | 'drafts' | 'quantum' | 'trash';
}

const EmailListItem: React.FC<EmailListItemProps> = ({ email, onClick, isSelected, mode }) => {
  // Memoize the formatted date to avoid recalculation on each render
  const formattedDate = useMemo(() => {
    try {
      // If sent_at is empty or clearly invalid, return empty string
      if (!email.sent_at || email.sent_at === 'Invalid Date Placeholder') {
        return '';
      }
      
      const date = new Date(email.sent_at);
      
      // Check if timestamp is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Format date based on how recent it is
      const now = new Date();
      const isCurrentYear = date.getFullYear() === now.getFullYear();
      const isSameDay = date.toDateString() === now.toDateString();
      
      // If same day, show just the time
      if (isSameDay) {
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      }
      
      // If same year but not same day
      if (isCurrentYear) {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        });
      }
      
      // Different year
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }, [email.sent_at]);

  // Determine sender or recipient display name
  const displayName = useMemo(() => {
    if (mode === 'sent') {
      return email.recipient_email;
    }
    if (email.sender_name && email.sender_email !== email.recipient_email) {
      return email.sender_name;
    }
    return email.sender_email;
  }, [email.sender_name, email.sender_email, email.recipient_email, mode]);

  // Generate a color based on the name for avatar background
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-purple-600', 'bg-green-600', 
      'bg-pink-600', 'bg-indigo-600', 'bg-yellow-600', 
      'bg-red-600', 'bg-cyan-600'
    ];
    
    // Simple hash function to determine color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Check if email is encrypted
  const isEncrypted = email.is_encrypted || email.subject.includes("[Q-ENCRYPTED]");

  // Check if email is a draft
  const isDraft = email.is_draft;

  return (
    <div 
      onClick={onClick}
      className={`p-4 border-b border-gray-700/30 transition-all duration-150 ${
        isSelected
          ? 'bg-blue-900/30 hover:bg-blue-900/40'
          : !email.read_at 
            ? 'bg-gray-800/40 hover:bg-gray-700/60' 
            : 'bg-gray-900/40 hover:bg-gray-800/60'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-medium shadow-md`}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-grow min-w-0">
          {/* Sender and Date */}
          <div className="flex justify-between items-center mb-0.5">
            <h3 className={`text-sm ${
              !email.read_at 
                ? 'font-bold text-gray-100' 
                : 'font-semibold text-gray-400'
            } truncate`}>
              {displayName}
            </h3>
            <div className="flex items-center">
              {isDraft && (
                <span className="text-xs bg-yellow-900/60 text-yellow-300 py-0.5 px-2 rounded-full flex-shrink-0 mr-2">
                  Draft
                </span>
              )}
              {formattedDate && (
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formattedDate}
                </span>
              )}
            </div>
          </div>
          
          {/* Subject and Body Preview */}
          <div className="flex items-center">
            <h4 className={`text-sm truncate ${
              !email.read_at 
                ? 'font-medium text-gray-200' 
                : 'text-gray-400'
            }`}>
              {email.subject}
            </h4>
            {/* Separator and Body Preview */}
            <span className={`text-sm ${!email.read_at ? 'text-gray-400' : 'text-gray-500'} mx-1 flex-shrink-0`}>-</span>
            <p className={`truncate text-xs ${
              !email.read_at 
                ? 'text-gray-400' 
                : 'text-gray-500'
            }`}>
              {email.body.replace(/<[^>]*>/g, '').substring(0, 100)}
              {email.body.length > 100 ? '...' : ''}
            </p>
            
            {isEncrypted && (
              <span className="ml-2 text-xs bg-indigo-900/60 text-indigo-300 py-0.5 px-2 rounded-full flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Encrypted
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(EmailListItem, (prevProps, nextProps) => {
  // Only re-render if email ID changes, read status changes, or selection state changes
  return prevProps.email.id === nextProps.email.id && 
         prevProps.email.read_at === nextProps.email.read_at &&
         prevProps.isSelected === nextProps.isSelected;
});
