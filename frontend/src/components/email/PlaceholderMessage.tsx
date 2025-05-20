import React from 'react';

interface PlaceholderMessageProps {
  senderName: string;
  messageId: string;
}

const PlaceholderMessage: React.FC<PlaceholderMessageProps> = ({ senderName, messageId }) => {
  return (
    <div className="bg-gray-900/70 backdrop-blur-lg rounded-lg p-6 max-w-md mx-auto my-8 border border-gray-800/50 shadow-lg">
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-white font-medium">New Message</h3>
          <p className="text-gray-400 text-sm">Quantum secure email</p>
        </div>
      </div>
      
      <div className="py-4 border-t border-b border-gray-800 mb-4">
        <p className="text-gray-300 mb-2">You've received a new message from <span className="font-bold text-blue-400">{senderName}</span></p>
        <p className="text-gray-400 text-sm">
          This is a notification email. The actual message content is securely stored in Quant-client.
        </p>
      </div>
      
      <div className="flex justify-center">
        <a 
          href={`http://localhost:3000/?view=${messageId}`}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
        >
          <span className="mr-2">Open in Quant Client</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default PlaceholderMessage;
