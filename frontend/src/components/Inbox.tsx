// Inbox.tsx
import React, { useState, useEffect } from 'react';
import { Email } from '../types/Email';
import { EmailService } from '../services/EmailService';
import EmailListItem from './EmailListItem';
import EmailDetail from './EmailDetail';
import ComposeEmail from './ComposeEmail';

const Inbox: React.FC = () => {
  // Rest of the component remains unchanged
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [receivedEmails, setReceivedEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch emails on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchEmails();
  }, [refreshTrigger]);

  const fetchEmails = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { sent, received } = await EmailService.getEmails();
      setSentEmails(sent);
      setReceivedEmails(received);
    } catch (err) {
      setError('Failed to load emails. Please try again later.');
      console.error('Error fetching emails:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    
    // If it's a received email and not read yet, mark it as read
    if (email.recipient_email && !email.read_at) {
      // In a real app, we would call an API to mark as read
      // For now, we'll just refresh the emails list
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
      // Trigger a refresh by incrementing the refreshTrigger
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

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-md flex items-start" role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div>
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline ml-1">{error}</span>
          <button 
            onClick={handleRefresh}
            className="mt-2 bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors duration-200"
          >
            Try Again
          </button>
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
    <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden w-full">
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-white text-xl font-semibold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Quantum Mail
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
      <div className="bg-gray-800">
        <div className="flex">
          <button
            className={`py-3 px-6 text-sm font-medium flex items-center relative ${
              activeTab === 'inbox'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900/20'
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
            className={`py-3 px-6 text-sm font-medium flex items-center ${
              activeTab === 'sent'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900/20'
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
      <div className="overflow-y-auto max-h-[calc(100vh-15rem)] divide-y divide-gray-700">
        {activeTab === 'inbox' ? (
          receivedEmails.length > 0 ? (
            receivedEmails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                isReceived={true}
                onClick={() => handleSelectEmail(email)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 text-lg mb-2">Your inbox is empty</p>
              <p className="text-gray-500 text-sm max-w-md">When you receive emails, they will appear here.</p>
              <button
                onClick={handleRefresh}
                className="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          )
        ) : sentEmails.length > 0 ? (
          sentEmails.map((email) => (
            <EmailListItem
              key={email.id}
              email={email}
              isReceived={false}
              onClick={() => handleSelectEmail(email)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <p className="text-gray-400 text-lg mb-2">No sent emails</p>
            <p className="text-gray-500 text-sm max-w-md">When you send emails, they will appear here.</p>
            <button
              onClick={handleComposeClick}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Compose Email
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
