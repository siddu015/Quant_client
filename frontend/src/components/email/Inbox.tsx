// Inbox.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Email } from '../../types/Email';
import { EmailService } from '../../services/EmailService';
import EmailDetail from './EmailDetail';
import { useAuth } from '../../context/AuthContext';
import EmailListItem from './EmailListItem';

interface InboxProps {
  mode: 'inbox' | 'sent' | 'drafts' | 'quantum';
}

const Inbox: React.FC<InboxProps> = ({ mode }) => {
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
    } catch (err) {
      console.error('Error in fetchEmails:', err);
      setError('Failed to load emails. Please try again later.');
      setEmails([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail, mode]);

  // Handle mode change efficiently using cached data
  useEffect(() => {
    if (initialLoadDone) {
      setIsLoading(true);
      
      // Use cached data when switching between modes
      if (mode === 'sent') {
        setEmails(emailCacheRef.current.sent);
        setTotalPages(emailCacheRef.current.sentTotalPages);
      } else if (mode === 'inbox') {
        setEmails(emailCacheRef.current.received);
        setTotalPages(emailCacheRef.current.receivedTotalPages); 
      }
      
      setCurrentPage(0);
      setIsLoading(false);
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

  // Calculate time since last sync
  const getTimeSinceSync = useCallback(() => {
    if (!lastSync) {
      // Return current timestamp when there's no sync time to avoid showing "Never"
      const now = new Date();
      return now.toLocaleString();
    }
    
    const now = Math.floor(Date.now() / 1000);
    const diff = now - lastSync;
    
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
    
    setIsRefreshing(true);
    setError(null);
    
    try {
      console.log('Manually refreshing emails...');
      
      // First clear the emails to show loading state
      setEmails([]);
      
      // Then trigger the backend refresh endpoint
      const refreshResult = await EmailService.refreshEmails();
      
      // Always force a full reload regardless of whether new emails were found
      await fetchEmails(0, true);
      
      if (refreshResult.success) {
        console.log(`Refresh successful, found ${refreshResult.newEmailCount} new emails`);
        if (refreshResult.lastSync) {
          setLastSync(refreshResult.lastSync);
        }
      } else {
        console.error('Failed to refresh emails from server');
        setError('Failed to refresh emails. Please try again later.');
      }
    } catch (err) {
      console.error('Error during refresh:', err);
      setError('Failed to refresh emails. Please try again later.');
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated, userEmail, fetchEmails]);

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

  // Render email list view
  const renderEmailList = () => (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 p-2 border-b border-gray-700/30">
        <h2 className="text-xl font-semibold text-blue-600">{mode.charAt(0).toUpperCase() + mode.slice(1)}</h2>
        <div className="flex items-center space-x-4">
          <div className="text-xs text-gray-400">
            Last synced: {lastSync ? getTimeSinceSync() : 'Never'}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`px-3 py-1 rounded-md flex items-center space-x-1 ${
              isRefreshing 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            <svg 
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
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
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {emails.length === 0 ? (
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
          <p className="text-center text-gray-400">No emails found</p>
          <p className="text-center text-gray-500 text-sm mt-2">Click the refresh button to check for new emails</p>
        </div>
      ) : (
        <>
          <div className="flex-grow overflow-auto custom-scrollbar">
            <div className="divide-gray-700/30">
              {emails.map(email => (
                <EmailListItem 
                  key={email.id} 
                  email={email} 
                  onClick={() => handleSelectEmail(email)} 
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
    return (
      <EmailDetail 
        email={selectedEmail} 
        onBack={handleBackToList} 
      />
    );
  }

  return renderEmailList();
};

export default Inbox;
