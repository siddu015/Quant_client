// ComposeEmail.tsx
import React, { useState, useEffect } from 'react';

interface ComposeEmailProps {
  onSend: (email: { recipient: string; subject: string; body: string; encrypt: boolean }) => void;
  onCancel: () => void;
  isOpen: boolean;
  onSaveDraft?: (draft: { recipient: string; subject: string; body: string }) => void;
  initialDraft?: { recipient: string; subject: string; body: string };
}

// Animation component to visualize quantum encryption
const QuantumEncryptionVisualizer: React.FC<{message: string}> = ({message}) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [encryptedSample, setEncryptedSample] = useState<string[]>([]);
  
  useEffect(() => {
    // Create a pseudo-encrypted version of the first 20 chars for visualization
    const sampleText = message.substring(0, 20);
    
    // Generate random "encrypted" chars based on the original message
    const newEncrypted = Array.from(sampleText).map(char => {
      const possibleChars = '!@#$%^&*()_+-=[]{}|;:"<>?/~`₿Ω∑∆πφ√∞≈≠≤≥';
      return possibleChars[Math.floor(Math.random() * possibleChars.length)];
    });
    
    setEncryptedSample(newEncrypted);
    
    // Animate the encryption visualization
    const timer = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 10);
    }, 300);
    
    return () => clearInterval(timer);
  }, [message]);
  
  // Create a visual representation of the encryption process
  const renderVisualization = () => {
    if (message.length === 0) return null;
    
    // Get a sample of the message
    const sampleText = message.substring(0, 20);
    let visualText = "";
    
    // Gradually "encrypt" the text based on animation frame
    for (let i = 0; i < sampleText.length; i++) {
      if (i < animationFrame * 2) {
        visualText += encryptedSample[i] || '█';
      } else {
        visualText += sampleText[i];
      }
    }
    
    return (
      <div className="flex flex-col items-center p-4 bg-black/30 rounded-lg space-y-2">
        <div className="flex items-center justify-center space-x-2 text-sm text-purple-300 font-mono">
          <span className="text-green-400">ORIGINAL: </span>
          <span>{sampleText.padEnd(20, ' ')}...</span>
        </div>
        
        <div className="flex justify-center space-x-2 my-1">
          {Array(10).fill(0).map((_, i) => (
            <svg 
              key={i} 
              className={`h-5 w-1 ${i <= animationFrame ? 'text-purple-500' : 'text-gray-700'}`} 
              fill="currentColor" 
              viewBox="0 0 4 20"
            >
              <rect width="4" height="20" />
            </svg>
          ))}
        </div>
        
        <div className="flex items-center justify-center space-x-2 text-sm text-purple-400 font-mono">
          <span className="text-purple-400">QUANTUM: </span>
          <span>{visualText}...</span>
        </div>
      </div>
    );
  };
  
  return (
    <div className="w-full">
      {renderVisualization()}
    </div>
  );
};

const ComposeEmail: React.FC<ComposeEmailProps> = ({ 
  onSend, 
  onCancel, 
  isOpen, 
  onSaveDraft,
  initialDraft 
}) => {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Initialize with initialDraft if provided
  useEffect(() => {
    if (initialDraft) {
      setRecipient(initialDraft.recipient);
      setSubject(initialDraft.subject);
      setBody(initialDraft.body);
    }
  }, [initialDraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSend({ recipient, subject, body, encrypt: true });
      setRecipient('');
      setSubject('');
      setBody('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // If there's content in any field, save as draft before closing
    if ((recipient || subject || body) && onSaveDraft) {
      onSaveDraft({ recipient, subject, body });
    }
    onCancel();
  };

  if (!isOpen) return null;

  // Minimized view
  if (isMinimized) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50 h-16 w-64 flex items-center justify-between p-4 cursor-pointer" onClick={() => setIsMinimized(false)}>
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-gray-200 text-sm">New Message</span>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}
            className="text-gray-400 hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 backdrop-blur-lg rounded-t-2xl shadow-xl overflow-hidden border border-gray-800/50">
      {/* Header */}
      <div className="p-3 bg-gray-800/50 border-b border-gray-800/50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {initialDraft ? 'Edit Draft' : 'New Message'}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 p-1.5 rounded-lg transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          <button
            onClick={handleCancel}
            className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 p-1.5 rounded-lg transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-400 mb-1">
            To:
          </label>
          <input
            id="recipient"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
            className="w-full bg-gray-800/30 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
            placeholder="recipient@example.com"
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-400 mb-1">
            Subject:
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full bg-gray-800/30 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
            placeholder="Enter subject"
          />
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-medium text-gray-400 mb-1">
            Message:
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={8}
            className="w-full bg-gray-800/30 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 resize-none"
            placeholder="Write your message here..."
          />
        </div>

        {/* Quantum Encryption Visualizer - Always show when there's content */}
        {body.length > 0 && (
          <QuantumEncryptionVisualizer message={body} />
        )}

        <div className="flex items-center">
          <div className="flex-1">
            <div className="text-sm font-bold text-blue-400 flex items-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              QUANTUM SECURE
            </div>
          </div>

          <div className="flex space-x-2">
            {onSaveDraft && (
              <button
                type="button"
                onClick={() => {
                  if (onSaveDraft) onSaveDraft({ recipient, subject, body });
                  onCancel();
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 flex items-center shadow-md text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Draft
              </button>
            )}

          <button
            type="submit"
            disabled={isLoading}
            className={`px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 flex items-center shadow-md text-sm ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </>
            )}
          </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ComposeEmail;
