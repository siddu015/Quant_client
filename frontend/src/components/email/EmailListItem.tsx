// EmailListItem.tsx
import React, { memo, useMemo } from 'react';
import { Email } from '../../types/Email';
import { EmailService } from '../../services/EmailService';

interface EmailListItemProps {
  email: Email;
  onClick: () => void;
  isSelected?: boolean;
  mode: 'inbox' | 'sent' | 'drafts' | 'quantum' | 'trash';
  onEmailDeleted?: () => void;
}

const EmailListItem: React.FC<EmailListItemProps> = ({ email, onClick, isSelected, mode, onEmailDeleted }) => {
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

  // Handle delete button click
  const handleDelete = async (e: React.MouseEvent) => {
    console.log('handleDelete called in EmailListItem for email ID:', email.id, 'Mode:', mode);
    e.stopPropagation(); // Prevent triggering onClick of the parent div
    
    try {
      const success = await EmailService.deleteEmail({
        id: email.id,
        permanently_delete: mode === 'trash' // Permanently delete if already in trash
      });
      
      if (success && onEmailDeleted) {
        onEmailDeleted();
      }
    } catch (err) {
      console.error('Error deleting email:', err);
    }
  };

  // Handle restore button click (for trash mode)
  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick of the parent div
    
    try {
      const success = await EmailService.restoreFromTrash(email.id);
      
      if (success && onEmailDeleted) {
        onEmailDeleted();
      }
    } catch (err) {
      console.error('Error restoring email:', err);
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`p-4 border-b border-gray-700/30 transition-all duration-150 group relative ${
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
      
      {/* Action buttons that appear on hover */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
        {mode === 'trash' ? (
          <>
            <button 
              onClick={handleRestore} 
              className="p-2 rounded-full hover:bg-gray-600/50 text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Restore email"
              title="Restore email"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button 
              onClick={handleDelete} 
              className="p-2 rounded-full hover:bg-red-900/50 text-gray-400 hover:text-red-300 transition-colors"
              aria-label="Permanently delete email"
              title="Permanently delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        ) : (
          <button 
            onClick={handleDelete} 
            className="p-2 rounded-full hover:bg-gray-600/50 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Delete email"
            title="Delete email"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders, but include onEmailDeleted in the comparison
export default memo(EmailListItem, (prevProps, nextProps) => {
  // Only re-render if email ID changes, read status changes, selection state changes, or onEmailDeleted changes
  return prevProps.email.id === nextProps.email.id && 
         prevProps.email.read_at === nextProps.email.read_at &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.onEmailDeleted === nextProps.onEmailDeleted;
});
