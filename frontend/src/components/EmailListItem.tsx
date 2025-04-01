// EmailListItem.tsx
import React from 'react';
import { Email } from '../types/Email';

interface EmailListItemProps {
  email: Email;
  isReceived: boolean;
  onClick: () => void;
}

const EmailListItem: React.FC<EmailListItemProps> = ({ email, isReceived, onClick }) => {
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Determine if email is unread (only for received emails)
  const isUnread = isReceived && !email.read_at;

  // Get display name (use sender_name if available, otherwise first part of email)
  const getDisplayName = () => {
    if (isReceived && email.sender_name) {
      return email.sender_name;
    }
    
    const emailToUse = isReceived ? email.sender_email : email.recipient_email;
    return emailToUse.split('@')[0];
  };

  // Get first letter of name for avatar
  const getInitial = () => {
    const displayName = getDisplayName();
    return displayName.charAt(0).toUpperCase();
  };

  // Get random color based on email string (for avatar background)
  const getAvatarColor = () => {
    const emailToUse = isReceived ? email.sender_email : email.recipient_email;
    const colors = [
      'bg-blue-600', 'bg-purple-600', 'bg-green-600', 
      'bg-indigo-600', 'bg-pink-600', 'bg-teal-600',
      'bg-orange-600', 'bg-cyan-600'
    ];
    
    // Simple hash function to get consistent color for same email
    const hash = emailToUse.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const emailToDisplay = isReceived ? email.sender_email : email.recipient_email;
  const displayName = getDisplayName();
  const avatarColor = getAvatarColor();

  return (
    <div 
      onClick={onClick}
      className={`flex items-center p-4 cursor-pointer border-l-2 hover:bg-gray-800/40 transition-colors duration-150 ${
        isUnread 
          ? 'bg-blue-900/10 border-blue-500' 
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium mr-3 shadow-md`}>
        {getInitial()}
      </div>
      
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center mb-1">
          <p className={`text-sm truncate ${
            isUnread 
              ? 'font-semibold text-white' 
              : 'font-normal text-gray-300'
          }`}>
            {displayName}
            <span className="text-gray-500 font-normal ml-1 hidden sm:inline">
              ({emailToDisplay})
            </span>
          </p>
          <span className="ml-auto text-xs text-gray-400 flex-shrink-0 pl-2">
            {formatDate(email.sent_at)}
          </span>
        </div>
        
        <h3 className={`text-sm truncate ${
          isUnread 
            ? 'font-medium text-white' 
            : 'font-normal text-gray-400'
        }`}>
          {email.subject || "(No subject)"}
        </h3>
        
        <p className="text-xs truncate mt-1 text-gray-500 pr-4">
          {email.body 
            ? (email.body.length > 100 ? `${email.body.substring(0, 100)}...` : email.body) 
            : "(No content)"
          }
        </p>
      </div>
      
      {isUnread && (
        <div className="ml-2 w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0"></div>
      )}
    </div>
  );
};

export default EmailListItem;
