// Inbox.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Email } from '../../types/Email';
import { EmailService } from '../../services/EmailService';
import EmailDetail from './EmailDetail';
import { useAuth } from '../../context/AuthContext';
import EmailListItem from './EmailListItem';

interface InboxProps {
  mode: 'inbox' | 'sent' | 'drafts' | 'quantum' | 'trash';
  initialMessageId?: string | null;
  onMessageClosed?: () => void;
}

const Inbox: React.FC<InboxProps> = ({ mode, initialMessageId, onMessageClosed }) => {
  // State management
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  // Cache reference to avoid unnecessary fetches
  const emailCacheRef = useRef<{
    received: Email[];
    sent: Email[];
    receivedTotalPages: number;
    sentTotalPages: number;
    lastSync?: number;
  }>({ 
    received: [], 
    sent: [], 
    receivedTotalPages: 1, 
    sentTotalPages: 1 
  });
  
  // Get auth context
  const { isAuthenticated, userEmail } = useAuth();

  // Memoized fetch function with pagination
  const fetchEmails = useCallback(async (page = 0, forceRefresh = false) => {
    if (!isAuthenticated || !userEmail) {
      console.log('Not fetching emails - user not authenticated or email not available');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching emails for page ${page}, force refresh: ${forceRefresh}`);
      const result = await EmailService.getEmails(page, 50, forceRefresh);
      
      // Update the cache reference
      emailCacheRef.current = {
        received: result.received,
        sent: result.sent,
        receivedTotalPages: mode === 'inbox' ? result.totalPages : emailCacheRef.current.receivedTotalPages,
        sentTotalPages: mode === 'sent' ? result.totalPages : emailCacheRef.current.sentTotalPages,
        lastSync: result.lastSync
      };
      
      // Update pagination state based on current mode
      if (mode === 'inbox') {
        setTotalPages(result.totalPages);
      } else if (mode === 'sent') {
        setTotalPages(result.totalPages);
      }
      
      setCurrentPage(result.currentPage);
      
      // Set last sync time
      if (result.lastSync) {
        setLastSync(result.lastSync);
      } else {
        // If backend didn't provide a lastSync time (e.g., new user)
        // but emails were fetched (implies success), set it to now.
        // Check if emails were actually fetched to avoid setting on empty initial state
        if (mode === 'sent' ? result.sent.length > 0 : result.received.length > 0 || result.totalPages > 0) {
            setLastSync(Math.floor(Date.now() / 1000));
        }
      }
      
      // Set emails based on mode
      if (mode === 'sent') {
        setEmails(result.sent);
      } else if (mode === 'inbox') {
        setEmails(result.received);
      } else {
        setEmails([]);
      }
      
      setInitialLoadDone(true);
      
      // If initialMessageId is set, load that email after emails are loaded
      if (initialMessageId && emails.length > 0) {
        loadEmailById(initialMessageId);
      }
    } catch (err) {
      console.error('Error in fetchEmails:', err);
      setError('Failed to load emails. Please try again later.');
      setEmails([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail, mode, initialMessageId]);

  // Handle mode change efficiently using cached data
  useEffect(() => {
    if (initialLoadDone) {
      // Use cached data when switching between modes
      if (mode === 'sent') {
        setEmails(emailCacheRef.current.sent);
        setTotalPages(emailCacheRef.current.sentTotalPages);
        setCurrentPage(0);
      } else if (mode === 'inbox') {
        setEmails(emailCacheRef.current.received);
        setTotalPages(emailCacheRef.current.receivedTotalPages); 
        setCurrentPage(0);
      } else if (mode === 'drafts' || mode === 'trash' || mode === 'quantum') {
        setEmails([]);
        setTotalPages(1); // Set to 1 so pagination controls (which show if totalPages > 1) are hidden
        setCurrentPage(0);
      }
    }
  }, [mode, initialLoadDone]);

  // Load emails when component mounts or mode changes - never automatically refresh
  useEffect(() => {
    if (isAuthenticated && userEmail && !initialLoadDone) {
      console.log('Initial loading of emails');
      // Only load emails on first mount, never refresh automatically
      fetchEmails(0, false);
    }
    
    // Do not include any dependencies that would cause automatic refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userEmail]);

  // Effect to handle initialMessageId
  useEffect(() => {
    if (initialMessageId && initialLoadDone) {
      loadEmailById(initialMessageId);
    }
  }, [initialMessageId, initialLoadDone]);

  // Function to load email by ID
  const loadEmailById = useCallback(async (id: string) => {
    try {
      // Check if the email is already in our list
      const existingEmail = emails.find(email => email.id === id);
      
      if (existingEmail) {
        setSelectedEmail(existingEmail);
        return;
      }
      
      // If not found in current list, fetch it from API
      const email = await EmailService.getEmail(id);
      if (email) {
        setSelectedEmail(email);
      }
    } catch (err) {
      console.error('Error loading email by ID:', err);
      setError('Failed to load the message. Please try again later.');
    }
  }, [emails]);

  // Calculate time since last sync
  const getTimeSinceSync = useCallback(() => {
    if (!lastSync) {
      return 'Never';
    }
    
    const now = Math.floor(Date.now() / 1000);
    const diff = now - lastSync;
    
    if (diff === 0) return 'Just now';
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    
    // For older syncs, show actual date and time
    const syncDate = new Date(lastSync * 1000);
    return syncDate.toLocaleString();
  }, [lastSync]);

  // Handle refresh button click - enhanced to ensure emails are actually reloaded
  const handleRefresh = useCallback(async () => {
    if (!isAuthenticated || !userEmail || isRefreshing) return;
    
    setIsLoading(true); // Show main loader
    setIsRefreshing(true); // For button spinner and disabling button
    setError(null);
    
    try {
      console.log('Manually refreshing emails...');
      
      // Clear emails to ensure list is empty before new data or if loader is delayed
      setEmails([]);
      
      // Trigger the backend refresh endpoint
      const refreshResult = await EmailService.refreshEmails();
      
      // Always force a full reload. fetchEmails will manage isLoading internally,
      // setting it to false upon completion or its own error.
      await fetchEmails(0, true);
      
      if (refreshResult.success) {
        console.log(`Refresh successful, found ${refreshResult.newEmailCount} new emails`);
        if (refreshResult.lastSync) {
          setLastSync(refreshResult.lastSync);
        } else {
          setLastSync(Math.floor(Date.now() / 1000));
        }
      } else {
        console.error('Failed to refresh emails from server');
        setError('Failed to refresh emails. Please try again later.');
        // If refreshEmails failed but fetchEmails wasn't called or itself failed to set isLoading false
        // This is a fallback, as fetchEmails should handle its own isLoading state.
        setIsLoading(false); 
      }
    } catch (err) {
      console.error('Error during refresh:', err);
      setError('Failed to refresh emails. Please try again later.');
      setIsLoading(false); // Ensure loader is hidden on error
    } finally {
      setIsRefreshing(false); // Hide button spinner
    }
  }, [isAuthenticated, userEmail, isRefreshing, fetchEmails /* Added isRefreshing to dependencies */]);

  // Handle pagination
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      fetchEmails(newPage, false);
    }
  }, [totalPages, fetchEmails]);

  // Select an email to view
  const handleSelectEmail = useCallback(async (email: Email) => {
    setSelectedEmail(email);
    
    // Mark as read if not already read
    if (!email.read_at) {
      try {
        const success = await EmailService.markAsRead(email.id);
        if (success) {
          // Update the email in our list
          setEmails(prevEmails => 
            prevEmails.map(e => 
              e.id === email.id 
                ? { ...e, read_at: new Date().toISOString() } 
                : e
            )
          );
          
          // Also update in our cache reference
          if (mode === 'inbox') {
            emailCacheRef.current.received = emailCacheRef.current.received.map(e => 
              e.id === email.id 
                ? { ...e, read_at: new Date().toISOString() } 
                : e
            );
          } else if (mode === 'sent') {
            emailCacheRef.current.sent = emailCacheRef.current.sent.map(e => 
              e.id === email.id 
                ? { ...e, read_at: new Date().toISOString() } 
                : e
            );
          }
        }
      } catch (err) {
        console.error('Error marking email as read:', err);
      }
    }
  }, [mode]);

  // Handle back to list
  const handleBackToList = useCallback(() => {
    setSelectedEmail(null);
  }, []);

  // Retry loading emails if there was an error
  const handleRetry = useCallback(() => {
    fetchEmails(currentPage, true);
  }, [fetchEmails, currentPage]);

  // Handle closing email detail view
  const handleCloseDetail = useCallback(() => {
    setSelectedEmail(null);
    if (onMessageClosed) {
      onMessageClosed();
    }
  }, [onMessageClosed]);

  // Render email list view
  const renderEmailList = () => (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 p-2 border-b border-gray-700/30">
        <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-gray-300 to-blue-400">{mode.charAt(0).toUpperCase() + mode.slice(1)}</h2>
        <div className="flex items-center space-x-4">
          <div className="text-xs text-gray-400">
            Last synced: {lastSync ? getTimeSinceSync() : 'Never'}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh emails"
            aria-label="Refresh emails"
            className={`p-2 rounded-lg flex items-center justify-center transition-all duration-150 transform focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 ${
              isRefreshing 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600 shadow-md hover:shadow-lg hover:scale-105 active:bg-gray-700'
            }`}
          >
            <svg 
              className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>
        </div>
      </div>

      {emails.length === 0 ? (
        mode === 'drafts' ? (
          <div className="flex flex-col justify-center items-center h-full">
            <div className="bg-gray-800/60 rounded-full p-6 mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"></path>
              </svg>
            </div>
            <p className="text-center text-gray-400">No drafts found</p>
            <p className="text-center text-gray-500 text-sm mt-2">Your saved drafts will appear here.</p>
          </div>
        ) : mode === 'trash' ? (
          <div className="flex flex-col justify-center items-center h-full">
            <div className="bg-gray-800/60 rounded-full p-6 mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </div>
            <p className="text-center text-gray-400">No trash found</p>
            <p className="text-center text-gray-500 text-sm mt-2">Deleted emails will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-full">
            <div className="bg-gray-800/60 rounded-full p-6 mb-4">
              <svg 
                className="w-12 h-12 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                />
              </svg>
            </div>
            <p className="text-center text-gray-400">No emails found in {mode}</p>
            <p className="text-center text-gray-500 text-sm mt-2">Click the refresh button to check for new emails or try another folder.</p>
          </div>
        )
      ) : (
        <>
          <div className="flex-grow overflow-auto custom-scrollbar">
            <div className="divide-gray-700/30">
              {emails.map(email => (
                <EmailListItem 
                  key={email.id} 
                  email={email} 
                  onClick={() => handleSelectEmail(email)} 
                  mode={mode}
                />
              ))}
            </div>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center items-center p-2 mt-2 text-gray-300">
              <button 
                className={`px-3 py-1 rounded-md flex items-center mr-2 ${
                  currentPage === 0 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
              >
                Previous
              </button>
              <span className="mx-2 text-sm">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button 
                className={`px-3 py-1 rounded-md flex items-center ml-2 ${
                  currentPage >= totalPages - 1 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Render email detail view
  const renderEmailDetail = () => (
    <EmailDetail 
      email={selectedEmail} 
      onBack={handleBackToList} 
      onClose={handleCloseDetail}
    />
  );

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-full">
        <div className="text-red-400 mb-4">{error}</div>
        <button 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md" 
          onClick={handleRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  // Render email detail view
  if (selectedEmail) {
    return renderEmailDetail();
  }

  return renderEmailList();
};

export default Inbox;
