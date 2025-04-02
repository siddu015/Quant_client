// Inbox.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Email } from '../types/Email';
import { EmailService } from '../services/EmailService';
import EmailListItem from './EmailListItem';
import EmailDetail from './EmailDetail';
import ComposeEmail from './ComposeEmail';
import { useAuth } from '../AuthContext';

const Inbox: React.FC = () => {
  // State management
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [receivedEmails, setReceivedEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);

  // Get auth context
  const { isAuthenticated, userEmail } = useAuth();

  // Reference to store interval ID
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized fetch function to avoid recreation on each render
  const fetchEmails = useCallback(async (showLoading = true) => {
    if (!isAuthenticated || !userEmail) {
      console.log('Not fetching emails - user not authenticated or email not available');
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      console.log('Fetching emails for user:', userEmail);
      const result = await EmailService.getEmails();
      
      console.log(`Received ${result.sent.length} sent and ${result.received.length} received emails`);
      setSentEmails(result.sent);
      setReceivedEmails(result.received);
    } catch (err) {
      console.error('Error in fetchEmails:', err);
      setError('Failed to load emails. Please try again later.');
      setSentEmails([]);
      setReceivedEmails([]);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, userEmail]);

  // Background refresh function
  const backgroundRefresh = useCallback(async () => {
    if (!isAuthenticated || !userEmail || isBackgroundRefreshing) {
      return;
    }

    setIsBackgroundRefreshing(true);
    try {
      console.log('Performing background refresh...');
      const result = await EmailService.getEmails();
      setSentEmails(result.sent);
      setReceivedEmails(result.received);
    } catch (err) {
      console.error('Background refresh error:', err);
    } finally {
      setIsBackgroundRefreshing(false);
    }
  }, [isAuthenticated, userEmail, isBackgroundRefreshing]);

  // Setup periodic refresh when component mounts
  useEffect(() => {
    if (isAuthenticated && userEmail) {
      console.log('Setting up email fetching for user:', userEmail);
      fetchEmails();
    }
  }, [isAuthenticated, userEmail, fetchEmails]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    if (!isAuthenticated || !userEmail) return;
    
    setIsLoading(true);
    try {
      await EmailService.refreshEmails();
      await fetchEmails(false);
    } catch (err) {
      console.error('Error refreshing emails:', err);
      setError('Failed to refresh emails');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail, fetchEmails]);

  // Handle compose click
  const handleComposeClick = () => {
    setIsComposing(true);
  };

  // Handle send email
  const handleSendEmail = async (email: any) => {
    try {
      await EmailService.sendEmail(email);
      setIsComposing(false);
      handleRefresh();
    } catch (err) {
      console.error('Error sending email:', err);
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);

    // If it's a received email and not read yet, mark it as read
    if (email.recipient_email === userEmail && !email.read_at) {
      await fetchEmails();
    }
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
    setIsComposing(false);
  };

  const handleRetry = () => {
    console.log('Retrying email fetch...');
    setError(null);
    fetchEmails(true);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg shadow-lg p-6">
        <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded-md flex items-start" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-grow">
            <p className="font-medium">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render email detail or compose view
  if (selectedEmail) {
    return <EmailDetail email={selectedEmail} onBack={handleBackToList} />;
  }

  if (isComposing) {
    return <ComposeEmail onSend={handleSendEmail} onCancel={() => setIsComposing(false)} />;
  }

  // Calculate unread count
  const unreadCount = receivedEmails.filter(email => !email.read_at).length;

  // Render inbox
  return (
    <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
      <div className="p-4 bg-gray-800/30 border-b border-gray-800/50 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-200 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Messages
        </h2>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={`bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 p-2 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={handleComposeClick}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:scale-[1.02]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Compose
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 bg-gray-800/20 border-b border-gray-800/50">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === 'inbox'
                ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Inbox {unreadCount > 0 && <span className="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">{unreadCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === 'sent'
                ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Sent
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className="divide-y divide-gray-800/50">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          (activeTab === 'inbox' ? receivedEmails : sentEmails).map((email) => (
            <div
              key={email.id}
              onClick={() => handleSelectEmail(email)}
              className="p-4 hover:bg-gray-800/30 cursor-pointer transition-all duration-200"
            >
              <div className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${email.read_at ? 'bg-gray-700/50' : 'bg-blue-500/50'} flex items-center justify-center text-white font-medium`}>
                  {email.sender_email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${email.read_at ? 'text-gray-400' : 'text-gray-200'}`}>
                      {activeTab === 'inbox' ? email.sender_email : email.recipient_email}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(email.sent_at).toLocaleString()}
                    </p>
                  </div>
                  <h3 className={`mt-1 text-base ${email.read_at ? 'text-gray-400' : 'text-gray-200'} truncate`}>
                    {email.subject}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {email.body}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Inbox;
