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

      // Set up interval for background refresh (every 30 seconds)
      refreshIntervalRef.current = setInterval(backgroundRefresh, 30000);

      // Clean up interval on unmount
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isAuthenticated, userEmail, fetchEmails, backgroundRefresh]);

  // Refresh emails when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0 && isAuthenticated && userEmail) {
      fetchEmails();
    }
  }, [refreshTrigger, fetchEmails, isAuthenticated, userEmail]);

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);

    // If it's a received email and not read yet, mark it as read
    if (email.recipient_email === userEmail && !email.read_at) {
      await fetchEmails();
    }
  };

  const handleComposeClick = () => {
    setIsComposing(true);
    setSelectedEmail(null);
  };

  const handleSendEmail = async (success: boolean) => {
    setIsComposing(false);
    if (success) {
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
    setIsComposing(false);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
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
    <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden">
      <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-white text-xl font-semibold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Messages
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-colors duration-200"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={handleComposeClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Compose
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/30">
        <div className="flex">
          <button
            className={`py-3 px-6 text-sm font-medium flex items-center relative ${activeTab === 'inbox'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-900/10'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              } transition-colors duration-200`}
            onClick={() => setActiveTab('inbox')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            Inbox
            {unreadCount > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            className={`py-3 px-6 text-sm font-medium flex items-center ${activeTab === 'sent'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-900/10'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              } transition-colors duration-200`}
            onClick={() => setActiveTab('sent')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Sent
            {sentEmails.length > 0 && (
              <span className="ml-2 bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {sentEmails.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className="overflow-y-auto max-h-[calc(100vh-15rem)] divide-y divide-gray-700/50">
        {activeTab === 'inbox' ? (
          receivedEmails.length > 0 ? (
            receivedEmails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onSelect={handleSelectEmail}
              />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">No emails in your inbox</p>
              <p className="mt-1">Your inbox is empty. New messages will appear here.</p>
            </div>
          )
        ) : (
          sentEmails.length > 0 ? (
            sentEmails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onSelect={handleSelectEmail}
              />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <p className="text-lg font-medium">No sent emails</p>
              <p className="mt-1">Emails you send will appear here. Try composing a new message.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Inbox;
