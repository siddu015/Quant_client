// Inbox.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Email } from '../types/Email';
import { EmailService } from '../services/EmailService';
import EmailDetail from './EmailDetail';
import { useAuth } from '../AuthContext';

interface InboxProps {
  mode: 'inbox' | 'sent' | 'drafts' | 'quantum';
}

const Inbox: React.FC<InboxProps> = ({ mode }) => {
  // State management
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedEmails, setCachedEmails] = useState<{
    received: Email[];
    sent: Email[];
  } | null>(null);

  // Get auth context
  const { isAuthenticated, userEmail } = useAuth();

  // Memoized fetch function to avoid recreation on each render
  const fetchEmails = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (!isAuthenticated || !userEmail) {
      console.log('Not fetching emails - user not authenticated or email not available');
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // If we have cached emails and not forcing refresh, use them
      if (cachedEmails && !forceRefresh) {
        console.log('Using cached emails');
        if (mode === 'sent') {
          setEmails(cachedEmails.sent);
        } else if (mode === 'inbox') {
          setEmails(cachedEmails.received);
        } else {
          setEmails([]);
        }
        if (showLoading) {
          setIsLoading(false);
        }
        return;
      }

      console.log('Fetching emails for user:', userEmail);
      const result = await EmailService.getEmails();
      
      // Cache the results
      setCachedEmails(result);
      
      // Set emails based on mode
      if (mode === 'sent') {
        setEmails(result.sent);
      } else if (mode === 'inbox') {
        setEmails(result.received);
      } else {
        setEmails([]);
      }
    } catch (err) {
      console.error('Error in fetchEmails:', err);
      setError('Failed to load emails. Please try again later.');
      setEmails([]);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, userEmail, mode, cachedEmails]);

  // Fetch emails when component mounts
  useEffect(() => {
    if (isAuthenticated && userEmail) {
      console.log('Initial email fetch');
      fetchEmails(true, true); // Force refresh on mount
    }
  }, [isAuthenticated, userEmail]);

  // Update displayed emails when mode changes
  useEffect(() => {
    if (cachedEmails) {
      console.log('Updating displayed emails from cache for mode:', mode);
      if (mode === 'sent') {
        setEmails(cachedEmails.sent);
      } else if (mode === 'inbox') {
        setEmails(cachedEmails.received);
      } else {
        setEmails([]);
      }
    }
  }, [mode, cachedEmails]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!isAuthenticated || !userEmail) return;
    
    setIsLoading(true);
    try {
      await EmailService.refreshEmails();
      await fetchEmails(false, true); // Force refresh from server
    } catch (err) {
      console.error('Error refreshing emails:', err);
      setError('Failed to refresh emails');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail, fetchEmails]);

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);

    // If it's a received email and not read yet, mark it as read
    if (email.recipient_email === userEmail && !email.read_at) {
      await fetchEmails();
    }
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
  };

  const handleRetry = () => {
    console.log('Retrying email fetch...');
    setError(null);
    fetchEmails(true);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
        <div className="flex justify-center items-center h-64">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50 p-6">
        <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded-xl flex items-start" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-grow">
            <p className="font-medium">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render email detail view
  if (selectedEmail) {
    return <EmailDetail email={selectedEmail} onBack={handleBackToList} />;
  }

  // Calculate unread count
  const unreadCount = mode === 'inbox' ? emails.filter(email => !email.read_at).length : 0;

  // Render email list
  return (
    <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
      <div className="p-4 bg-gray-800/30 border-b border-gray-800/50 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-200 flex items-center">
          {mode === 'inbox' ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Inbox
              {unreadCount > 0 && (
                <span className="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">
                  {unreadCount}
                </span>
              )}
            </>
          ) : mode === 'sent' ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Sent
            </>
          ) : mode === 'drafts' ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Drafts
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quantum Secured
            </>
          )}
        </h2>
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
      </div>

      {/* Email list */}
      <div className="divide-y divide-gray-800/50">
        {emails.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
              {mode === 'inbox' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </div>
            <p className="text-lg font-medium text-gray-300">No emails found</p>
            <p className="mt-1 text-sm text-gray-400">
              {mode === 'inbox'
                ? 'Your inbox is empty. New messages will appear here.'
                : mode === 'sent'
                ? 'No sent emails yet. Try composing a new message.'
                : mode === 'drafts'
                ? 'No drafts saved. Start composing to save drafts.'
                : 'No quantum secured emails yet.'}
            </p>
          </div>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              onClick={() => handleSelectEmail(email)}
              className="p-4 hover:bg-gray-800/30 cursor-pointer transition-all duration-200"
            >
              <div className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${email.read_at ? 'bg-gray-700/50' : 'bg-blue-500/50'} flex items-center justify-center text-white font-medium`}>
                  {(mode === 'inbox' ? email.sender_email : email.recipient_email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 mb-1 inline-block">
                        {mode === 'inbox' ? 'From:' : 'To:'}
                      </span>
                      <p className={`text-sm font-medium ${email.read_at ? 'text-gray-400' : 'text-gray-200'}`}>
                        {mode === 'inbox' ? email.sender_email : email.recipient_email}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 mb-1 inline-block">
                        Date:
                      </span>
                      <p className="text-xs text-gray-500">
                        {new Date(email.sent_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Email labels/tags */}
                  <div className="flex flex-wrap gap-2 my-2">
                    {!email.read_at && mode === 'inbox' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Unread
                      </span>
                    )}
                    
                    {email.important && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Important
                      </span>
                    )}
                    
                    {email.attachments && email.attachments.length > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        Attachment
                      </span>
                    )}
                    
                    {email.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {email.category}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 mb-1 inline-block">
                      Subject:
                    </span>
                    <h3 className={`text-base ${email.read_at ? 'text-gray-400' : 'text-gray-200'} truncate`}>
                      {email.subject}
                    </h3>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 mb-1 inline-block">
                      Message:
                    </span>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {email.body}
                    </p>
                  </div>
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
