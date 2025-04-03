// EmailListItem.tsx
import React from 'react';
import { Email } from '../types/Email';

interface EmailListItemProps {
  email: Email;
  onSelect: (email: Email) => void;
}

const EmailListItem: React.FC<EmailListItemProps> = ({ email, onSelect }) => {
  // Helper function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Determine if email is unread
  const isUnread = !email.read_at;
  
  // Get sender display name (use name if available, otherwise email)
  const senderDisplay = email.sender_name || email.sender_email;
  
  // Format timestamp
  const formattedDate = formatDate(email.sent_at);
  
  // Check if email has labels
  const hasLabels = email.label_ids && email.label_ids.length > 0;
  
  // Get label colors based on system labels
  const getLabelColor = (labelId: string) => {
    switch(labelId) {
      case 'INBOX': return 'bg-blue-500';
      case 'SENT': return 'bg-green-500';
      case 'IMPORTANT': return 'bg-yellow-500';
      case 'TRASH': return 'bg-red-500';
      case 'DRAFT': return 'bg-orange-500';
      case 'SPAM': return 'bg-purple-500';
      case 'STARRED': return 'bg-yellow-400';
      default:
        // For custom labels or categories
        if (labelId.startsWith('CATEGORY_')) return 'bg-indigo-500';
        return 'bg-gray-500';
    }
  };

  return (
    <div 
      className={`flex flex-col p-4 border-b border-gray-700/50 hover:bg-gray-800/30 cursor-pointer transition-colors duration-200 ${isUnread ? 'bg-gray-800/80' : ''}`}
      onClick={() => onSelect(email)}
    >
      <div className="flex justify-between items-start mb-1">
        <div className={`text-sm font-medium ${isUnread ? 'text-white' : 'text-gray-300'} flex items-center`}>
          {senderDisplay}
          {email.is_encrypted && (
            <span className="ml-2 inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {formattedDate}
        </div>
      </div>
      
      <div className={`text-sm ${isUnread ? 'font-semibold text-white' : 'text-gray-400'} flex items-center`}>
        {email.subject}
        {email.is_encrypted && (
          <span className="ml-2 text-xs px-2 py-0.5 bg-blue-900/40 text-blue-400 border border-blue-500/30 rounded-full">
            Encrypted
          </span>
        )}
      </div>
      
      <div className="text-xs text-gray-500 mt-1 line-clamp-1">
        {email.is_encrypted 
          ? "This message is encrypted with quantum-resistant encryption."
          : `${email.body.substring(0, 100)}${email.body.length > 100 ? '...' : ''}`
        }
      </div>
      
      {/* Display labels if present */}
      {hasLabels && (
        <div className="flex flex-wrap gap-1 mt-2">
          {email.label_ids!.map(labelId => (
            <span 
              key={labelId}
              className={`${getLabelColor(labelId)} text-white text-xs px-2 py-0.5 rounded-full`}
            >
              {labelId.replace('CATEGORY_', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmailListItem;
