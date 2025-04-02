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
          // Create a new array and sort by timestamp (newest first)
          const sortedSent = [...cachedEmails.sent].sort((a, b) => {
            const timestampA = a.sent_timestamp || new Date(a.sent_at).getTime() || 0;
            const timestampB = b.sent_timestamp || new Date(b.sent_at).getTime() || 0;
            return timestampB - timestampA;
          });
          
          setEmails(sortedSent);
        } else if (mode === 'inbox') {
          setEmails([...cachedEmails.received]);
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
      
      // Check for any duplicates in sent emails by ID
      const sentEmailIds = result.sent.map(e => e.id);
      const uniqueSentIds = new Set(sentEmailIds);
      
      if (sentEmailIds.length !== uniqueSentIds.size) {
        console.warn(`Found ${sentEmailIds.length - uniqueSentIds.size} duplicate IDs in sent emails, but these should have been deduplicated already.`);
        
        // Additional deduplication just to be safe
        const uniqueSentEmails = new Map<string, Email>();
        result.sent.forEach(email => {
          const key = email.gmail_id || email.id;
          if (!uniqueSentEmails.has(key) || 
              (email.sent_timestamp && uniqueSentEmails.get(key)!.sent_timestamp && 
              email.sent_timestamp > uniqueSentEmails.get(key)!.sent_timestamp!)) {
            uniqueSentEmails.set(key, email);
          }
        });
        
        // Replace the sent array with deduplicated version
        result.sent = Array.from(uniqueSentEmails.values());
        console.log(`After additional deduplication, sent count: ${result.sent.length}`);
      }
      
      // CRITICAL STEP: Ensure sent emails are sorted correctly
      // Re-sort the sent emails to be absolutely sure they're in correct order
      result.sent.sort((a, b) => {
        const timestampA = a.sent_timestamp || new Date(a.sent_at).getTime() || 0;
        const timestampB = b.sent_timestamp || new Date(b.sent_at).getTime() || 0;
        return timestampB - timestampA; // Newest first
      });
      
      // Check for any cross-category duplicates
      const sentIds = new Set(result.sent.map(e => e.gmail_id || e.id));
      const receivedIds = new Set(result.received.map(e => e.gmail_id || e.id));
      const duplicates = Array.from(sentIds).filter(id => receivedIds.has(id));
      
      if (duplicates.length > 0) {
        console.warn('Found duplicate email IDs across sent and received:', duplicates);
        // Remove duplicates from received (keep them in sent)
        const filteredReceived = result.received.filter(e => !sentIds.has(e.gmail_id || e.id));
        result.received = filteredReceived;
        console.log('After removing duplicates, received count:', result.received.length);
      }
      
      // Self-sent emails check
      if (userEmail) {
        const selfSentEmails = result.received.filter(e => e.sender_email === userEmail);
        if (selfSentEmails.length > 0) {
          console.warn('Found self-sent emails in received folder:', selfSentEmails.map(e => e.id));
          // Remove these from received as they should only be in sent
          result.received = result.received.filter(e => e.sender_email !== userEmail);
          console.log('After removing self-sent emails, received count:', result.received.length);
        }
      }
      
      // Cache the results - verify sorting is correct before setting
      setCachedEmails(result);
      
      // Set emails based on mode
      if (mode === 'sent') {
        // Verify proper sorting one last time
        const sortedSent = [...result.sent].sort((a, b) => {
          const timestampA = a.sent_timestamp || new Date(a.sent_at).getTime() || 0;
          const timestampB = b.sent_timestamp || new Date(b.sent_at).getTime() || 0;
          return timestampB - timestampA;
        });
        
        // Check if sorting made any changes and log
        const wasSorted = JSON.stringify(sortedSent.map(e => e.id)) === 
                         JSON.stringify(result.sent.map(e => e.id));
        
        if (!wasSorted) {
          console.warn('Final sorting changed the order of sent emails in Inbox component');
        }
        
        setEmails(sortedSent);
      } else if (mode === 'inbox') {
        setEmails([...result.received]);
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
        // Deep comparison of timestamps to ensure proper sorting of sent emails
        console.log('Verifying sent email sort order in Inbox component');
        
        // Clone the emails to avoid modifying cache
        const clonedSentEmails = JSON.parse(JSON.stringify(cachedEmails.sent)) as Email[];
        
        // Directly parse dates from sent_at for more reliable sorting
        const emailsWithParsedDates = clonedSentEmails.map(email => {
          try {
            // Try to get a reliable date object first
            const sentDate = new Date(email.sent_at);
            const timestamp = !isNaN(sentDate.getTime()) ? sentDate.getTime() : 0;
            
            // Log the actual date parsing for debugging
            console.log(`Email "${email.subject}" date: ${email.sent_at} → timestamp: ${timestamp}`);
            
            return {
              ...email,
              // Use parsed timestamp or existing timestamp, whichever is more recent
              sent_timestamp: Math.max(timestamp, email.sent_timestamp || 0)
            };
          } catch (e) {
            console.error(`Error parsing date for email ${email.id}:`, e);
            return email;
          }
        });
        
        // Sort by timestamp with improved logging
        const sortedSent = emailsWithParsedDates.sort((a, b) => {
          const timestampA = a.sent_timestamp || 0;
          const timestampB = b.sent_timestamp || 0;
          
          // Log comparison for debugging
          console.log(`Comparing: ${a.subject} (${timestampA}) vs ${b.subject} (${timestampB}) = ${timestampB - timestampA}`);
          
          return timestampB - timestampA;
        });
        
        // Log the final sorted order
        console.log('FINAL SORTED ORDER:');
        sortedSent.forEach((email, index) => {
          const date = new Date(email.sent_at);
          console.log(`${index}: ${email.subject} - ${date.toLocaleString()} (${email.sent_timestamp})`);
        });
        
        setEmails(sortedSent);
      } else if (mode === 'inbox') {
        setEmails([...cachedEmails.received]);
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
      console.log('Starting email refresh...');
      // First clear the cached emails to ensure we get a fresh load
      setCachedEmails(null);
      
      // Trigger the refresh on the backend
      const refreshResult = await EmailService.refreshEmails();
      console.log('Backend refresh result:', refreshResult);
      
      if (!refreshResult) {
        console.warn('Backend refresh returned false, might need to retry');
      }
      
      // Add a small delay to ensure backend processing is complete
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Force a complete reload from the server with explicit sorting
      await fetchEmails(false, true);
      
      // Double-check sorting for sent emails
      if (mode === 'sent' && emails.length > 0) {
        console.log('Verifying sent email order after refresh');
        
        // Create a new sorted copy with very explicit sorting by timestamp
        const verifiedSorted = [...emails]
          // Ensure all emails have valid timestamps
          .map(email => {
            if (!email.sent_timestamp) {
              const timestamp = new Date(email.sent_at).getTime();
              return {
                ...email,
                sent_timestamp: isNaN(timestamp) ? Date.now() - 1000000 : timestamp
              };
            }
            return email;
          })
          // Sort by timestamp, newest first
          .sort((a, b) => {
            const timestampA = a.sent_timestamp || 0;
            const timestampB = b.sent_timestamp || 0;
            return timestampB - timestampA;
          });
        
        // Log the sorted order for debugging
        console.log('AFTER REFRESH - SENT EMAIL ORDER:');
        verifiedSorted.forEach((email, i) => {
          console.log(`${i}: ${email.subject} - ${new Date(email.sent_at).toLocaleString()} (${email.sent_timestamp})`);
        });
        
        // Update emails with the guaranteed sorted version
        setEmails(verifiedSorted);
      }
      
      console.log('Email refresh completed successfully');
    } catch (err) {
      console.error('Error refreshing emails:', err);
      setError('Failed to refresh emails');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail, fetchEmails, mode, emails]);

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    
    // If it's a received email and not read yet, mark it as read
    if (email.recipient_email === userEmail && !email.read_at) {
      try {
        console.log('Marking email as read:', email.id);
        const success = await EmailService.markAsRead(email.id);
        
        if (success) {
          console.log('Email marked as read successfully');
          // Update the email in our cached emails state
          if (cachedEmails) {
            // Create a new date string for read_at
            const readAt = new Date().toISOString();
            
            // Update the cached received emails
            const updatedReceived = cachedEmails.received.map(e => 
              e.id === email.id ? { ...e, read_at: readAt } : e
            );
            
            // Update the email in our current list view
            const updatedEmails = emails.map(e =>
              e.id === email.id ? { ...e, read_at: readAt } : e
            );
            
            // Important: Don't change the order when updating the cache
            setCachedEmails({
              ...cachedEmails,
              received: updatedReceived
            });
            
            // Update the current view
            setEmails(updatedEmails);
          }
        } else {
          console.error('Failed to mark email as read');
        }
      } catch (err) {
        console.error('Error marking email as read:', err);
      }
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
                        {(() => {
                          try {
                            const date = new Date(email.sent_at);
                            
                            // First check if timestamp is valid
                            if (isNaN(date.getTime())) {
                              console.warn(`Invalid date for email ${email.id}: ${email.sent_at}`);
                              return 'Unknown date';
                            }
                            
                            // Format date as "MMM DD, HH:MM" or "MMM DD, YYYY, HH:MM" if not current year
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
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              });
                            }
                            
                            // Different year
                            return date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            });
                          } catch (e) {
                            console.error('Error formatting date:', e);
                            return 'Unknown date';
                          }
                        })()}
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
                    <h3 className={`text-base ${email.read_at ? 'text-gray-400' : 'text-gray-200'} truncate`}>
                      {email.subject}
                    </h3>
                  </div>
                  
                  {/* Message preview only shown when expanded */}
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
