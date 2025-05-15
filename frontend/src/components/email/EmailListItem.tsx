// EmailListItem.tsx
import React, { memo, useMemo } from 'react';
import { Email } from '../../types/Email';

interface EmailListItemProps {
  email: Email;
  onClick: () => void;
}

const EmailListItem: React.FC<EmailListItemProps> = ({ email, onClick }) => {
  // Memoize the formatted date to avoid recalculation on each render
  const formattedDate = useMemo(() => {
    try {
      const date = new Date(email.sent_at);
      
      // Check if timestamp is valid
      if (isNaN(date.getTime())) {
        return 'Unknown date';
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
      return 'Unknown date';
    }
  }, [email.sent_at]);

  // Determine sender or recipient display name
  const displayName = useMemo(() => {
    if (email.sender_name && email.sender_email !== email.recipient_email) {
      return email.sender_name;
    }
    return email.sender_email;
  }, [email.sender_name, email.sender_email, email.recipient_email]);

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

  return (
    <div 
      onClick={onClick}
      className={`p-4 border-b border-gray-700/30 transition-all duration-150 ${
        !email.read_at 
          ? 'bg-gray-800/40 hover:bg-gray-700/60' 
          : 'bg-gray-900/40 hover:bg-gray-800/60'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-medium shadow-md`}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-center">
            <h3 className={`${
              !email.read_at 
                ? 'font-semibold text-white' 
                : 'font-medium text-gray-300'
            } truncate`}>
              {displayName}
            </h3>
            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
              {formattedDate}
            </span>
          </div>
          
          <div className="flex items-center">
            <h4 className={`truncate ${
              !email.read_at 
                ? 'font-medium text-gray-100' 
                : 'text-gray-300'
            }`}>
              {email.subject}
            </h4>
            
            {isEncrypted && (
              <span className="ml-2 text-xs bg-indigo-900/60 text-indigo-300 py-0.5 px-2 rounded-full flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Encrypted
              </span>
            )}
          </div>
          
          <p className={`truncate text-sm ${
            !email.read_at 
              ? 'text-gray-300' 
              : 'text-gray-400'
          }`}>
            {email.body.replace(/<[^>]*>/g, '').substring(0, 100)}
            {email.body.length > 100 ? '...' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(EmailListItem, (prevProps, nextProps) => {
  // Only re-render if email ID changes or read status changes
  return prevProps.email.id === nextProps.email.id && 
         prevProps.email.read_at === nextProps.email.read_at;
});
