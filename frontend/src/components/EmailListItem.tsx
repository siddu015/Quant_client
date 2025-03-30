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

  // Get first letter of email for avatar
  const getInitial = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  // Get random color based on email string (for avatar background)
  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-600', 'bg-purple-600', 'bg-green-600', 
      'bg-yellow-600', 'bg-red-600', 'bg-pink-600', 
      'bg-indigo-600', 'bg-teal-600'
    ];
    
    // Simple hash function to get consistent color for same email
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const emailToDisplay = isReceived ? email.sender_email : email.recipient_email;
  const avatarColor = getAvatarColor(emailToDisplay);

  return (
    <div 
      onClick={onClick}
      className={`flex items-center p-4 cursor-pointer hover:bg-gray-800 transition-colors duration-150 ${isUnread ? 'bg-gray-800/70' : ''}`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium mr-3`}>
        {getInitial(emailToDisplay)}
      </div>
      
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center mb-1">
          <p className={`text-sm truncate ${isUnread ? 'font-semibold text-white' : 'font-normal text-gray-300'}`}>
            {emailToDisplay}
          </p>
          <span className="ml-auto text-xs text-gray-400 flex-shrink-0 pl-2">
            {formatDate(email.sent_at)}
          </span>
        </div>
        
        <h3 className={`text-sm truncate ${isUnread ? 'font-medium text-white' : 'font-normal text-gray-400'}`}>
          {email.subject}
        </h3>
        
        <p className="text-xs truncate mt-1 text-gray-500 pr-4">
          {email.body.length > 100 ? `${email.body.substring(0, 100)}...` : email.body}
        </p>
      </div>
      
      {isUnread && (
        <div className="ml-2 w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0"></div>
      )}
    </div>
  );
};

export default EmailListItem;
