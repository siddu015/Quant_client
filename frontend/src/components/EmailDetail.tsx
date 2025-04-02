// EmailDetail.tsx
import React from 'react';
import { Email } from '../types/Email';
import { useAuth } from '../AuthContext';

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
}

const EmailDetail: React.FC<EmailDetailProps> = ({ email, onBack }) => {
  const { userEmail } = useAuth();
  const isSentEmail = email.sender_email === userEmail;

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'Invalid date';
      }
      
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Date error';
    }
  };

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

  const senderAvatarColor = getAvatarColor(email.sender_email);

  return (
    <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
      {/* Header */}
      <div className="p-4 bg-gray-800/30 border-b border-gray-800/50 flex justify-between items-center">
        <button
          onClick={onBack}
          className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 p-2 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-xl text-sm ${isSentEmail ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {isSentEmail ? 'Sent' : 'Received'}
          </span>
          {email.read_at && !isSentEmail && (
            <span className="bg-gray-700/50 text-gray-400 px-3 py-1 rounded-xl text-sm">
              Read
            </span>
          )}
          {!email.read_at && !isSentEmail && (
            <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Unread
            </span>
          )}
          {email.important && (
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Important
            </span>
          )}
          {email.attachments && email.attachments.length > 0 && (
            <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attachment ({email.attachments.length})
            </span>
          )}
          {email.category && (
            <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {email.category}
            </span>
          )}
        </div>
      </div>

      {/* Email content */}
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${isSentEmail ? 'bg-purple-500/50' : 'bg-blue-500/50'} flex items-center justify-center text-white font-medium text-lg`}>
            {(isSentEmail ? email.recipient_email : email.sender_email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">Subject:</label>
                <h2 className="text-xl font-semibold text-gray-200">{email.subject}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">From:</label>
                  <p className="text-sm text-gray-300">{email.sender_email}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">To:</label>
                  <p className="text-sm text-gray-300">{email.recipient_email}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Date:</label>
                <p className="text-sm text-gray-300">{formatDate(email.sent_at)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Message:</label>
          <div className="bg-gray-800/20 rounded-xl p-6 text-gray-300 whitespace-pre-wrap">
            {email.body}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
