// EmailDetail.tsx
import React from 'react';
import { Email } from '../types/Email';

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
}

const EmailDetail: React.FC<EmailDetailProps> = ({ email, onBack }) => {
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden w-full">
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white flex items-center transition-colors duration-200 mr-4"
          aria-label="Back to inbox"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <h2 className="text-white text-lg font-semibold truncate flex-1">
          {email.subject}
        </h2>
      </div>

      <div className="p-5">
        <div className="flex items-start mb-6">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${senderAvatarColor} flex items-center justify-center text-white font-medium mr-3`}>
            {getInitial(email.sender_email)}
          </div>
          
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="text-white font-medium">{email.sender_email}</p>
                <p className="text-gray-400 text-sm">
                  To: <span className="text-gray-300">{email.recipient_email}</span>
                </p>
              </div>
              <p className="text-gray-400 text-sm mt-2 sm:mt-0">
                {formatDate(email.sent_at)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-5 mt-2">
          <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
            {email.body}
          </div>
        </div>
        
        <div className="mt-6 flex justify-between">
          <button
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Inbox
          </button>
          
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
            onClick={() => {
              // In a real app, we would implement reply functionality
              alert('Reply functionality would be implemented here');
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Reply
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
