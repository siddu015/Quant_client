import React, { useState, useEffect } from 'react';
import { EmailService } from '../services/EmailService';

// Define Email interface to fix TypeScript errors
interface Email {
  id: string;
  subject: string;
  sender_email?: string;
  recipient_email?: string;
  sent_at: string;
  body?: string;
}

// Define EmailData interface for better state typing
interface EmailData {
  sent: Email[];
  received: Email[];
}

const Dashboard = () => {
  const [emails, setEmails] = useState<EmailData>({ sent: [], received: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEmails = async () => {
    setIsLoading(true);
    try {
      const emailData = await EmailService.getEmails();
      setEmails(emailData);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await EmailService.refreshEmails();
      // After cache is refreshed, fetch emails again
      await fetchEmails();
    } catch (error) {
      console.error('Error refreshing emails:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Email Dashboard</h1>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-4 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Inbox</h2>
            {emails.received.length > 0 ? (
              <div className="space-y-4">
                {emails.received.map((email) => (
                  <div key={email.id} className="border-b pb-4">
                    <div className="font-medium">{email.subject}</div>
                    <div className="text-sm text-gray-600">From: {email.sender_email}</div>
                    <div className="text-xs text-gray-500">{new Date(email.sent_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No emails received</p>
            )}
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Sent</h2>
            {emails.sent.length > 0 ? (
              <div className="space-y-4">
                {emails.sent.map((email) => (
                  <div key={email.id} className="border-b pb-4">
                    <div className="font-medium">{email.subject}</div>
                    <div className="text-sm text-gray-600">To: {email.recipient_email}</div>
                    <div className="text-xs text-gray-500">{new Date(email.sent_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No emails sent</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 