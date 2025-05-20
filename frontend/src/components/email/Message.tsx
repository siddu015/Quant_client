import React from 'react';
import { Email } from '../../types/Email';

interface MessageProps {
  email: Email;
  onClose: () => void;
}

const Message: React.FC<MessageProps> = ({ email, onClose }) => {
  return (
    <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl p-6 shadow-xl overflow-hidden border border-gray-800/50 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">{email.subject}</h2>
        <button
          onClick={onClose}
          className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 p-2 rounded-lg transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800/50">
        <div>
          <p className="text-gray-300">
            <span className="font-semibold">From:</span> {email.sender_email}
          </p>
          <p className="text-gray-300">
            <span className="font-semibold">To:</span> {email.recipient_email}
          </p>
          <p className="text-gray-400 text-sm">
            {new Date(email.sent_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center">
          {email.is_encrypted && (
            <div className="text-xs font-bold text-blue-400 px-2 py-1 rounded-full bg-blue-500/10 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              QUANTUM SECURE
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-grow overflow-auto mb-4">
        <div className="text-gray-300 whitespace-pre-wrap">
          {email.body}
        </div>
      </div>
    </div>
  );
};

export default Message;