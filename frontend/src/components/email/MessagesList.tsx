import React from 'react';
import { Email } from '../../types/Email';
import EmailListItem from './EmailListItem';

interface MessagesListProps {
  emails: Email[];
  onSelect: (email: Email) => void;
  isLoading: boolean;
  mode: 'inbox' | 'sent' | 'drafts' | 'quantum' | 'trash';
}

const MessagesList: React.FC<MessagesListProps> = ({ emails, onSelect, isLoading, mode }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="text-center">No messages found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {emails.map(email => (
        <EmailListItem
          key={email.id}
          email={email}
          onClick={() => onSelect(email)}
          mode={mode}
        />
      ))}
    </div>
  );
};

export default MessagesList;