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
        </div>
      </div>

      {/* Email content */}
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${isSentEmail ? 'bg-purple-500/50' : 'bg-blue-500/50'} flex items-center justify-center text-white font-medium text-lg`}>
            {(isSentEmail ? email.recipient_email : email.sender_email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-200 mb-2">{email.subject}</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span>From: {email.sender_email}</span>
                  <span>•</span>
                  <span>To: {email.recipient_email}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatDate(email.sent_at)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-800/20 rounded-xl p-6 text-gray-300 whitespace-pre-wrap">
          {email.body}
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
