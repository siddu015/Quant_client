// ComposeEmail.tsx
import React, { useState } from 'react';
import { SendEmailRequest, Email } from '../types/Email';
import { EmailService } from '../services/EmailService';

interface ComposeEmailProps {
  onSend: (success: boolean) => void;
  onCancel: () => void;
}

const ComposeEmail: React.FC<ComposeEmailProps> = ({ onSend, onCancel }) => {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    recipient?: string;
    subject?: string;
    body?: string;
  }>({});

  // Email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const validateForm = (): boolean => {
    const errors: {
      recipient?: string;
      subject?: string;
      body?: string;
    } = {};
    
    // Validate recipient email
    if (!recipient.trim()) {
      errors.recipient = 'Recipient email is required';
    } else if (!emailRegex.test(recipient.trim())) {
      errors.recipient = 'Please enter a valid email address';
    }
    
    // Validate subject
    if (!subject.trim()) {
      errors.subject = 'Subject is required';
    } else if (subject.trim().length > 100) {
      errors.subject = 'Subject must be less than 100 characters';
    }
    
    // Validate body
    if (!body.trim()) {
      errors.body = 'Message body is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    // Clear previous errors
    setError(null);
    setIsSending(true);
    
    try {
      const emailRequest: SendEmailRequest = {
        recipient_email: recipient.trim(),
        subject: subject.trim(),
        body: body.trim()
      };
      
      const success = await EmailService.sendEmail(emailRequest);
      
      if (success) {
        onSend(true);
      } else {
        setError('Failed to send email. Please try again.');
        setIsSending(false);
      }
    } catch (err) {
      console.error('Error sending email:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsSending(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white text-xl font-semibold">Compose Email</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition-colors duration-200"
          disabled={isSending}
          aria-label="Close compose email"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-md mb-6 text-sm flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="recipient" className="block text-gray-300 text-sm font-medium mb-2">
            To:
          </label>
          <input
            type="email"
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={`w-full bg-gray-800 border ${
              validationErrors.recipient ? 'border-red-500' : 'border-gray-700'
            } rounded-md py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200`}
            placeholder="recipient@example.com"
            disabled={isSending}
            required
          />
          {validationErrors.recipient && (
            <p className="mt-1 text-sm text-red-400">{validationErrors.recipient}</p>
          )}
        </div>

        <div>
          <label htmlFor="subject" className="block text-gray-300 text-sm font-medium mb-2">
            Subject:
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`w-full bg-gray-800 border ${
              validationErrors.subject ? 'border-red-500' : 'border-gray-700'
            } rounded-md py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200`}
            placeholder="Email subject"
            disabled={isSending}
            required
          />
          {validationErrors.subject && (
            <p className="mt-1 text-sm text-red-400">{validationErrors.subject}</p>
          )}
        </div>

        <div>
          <label htmlFor="body" className="block text-gray-300 text-sm font-medium mb-2">
            Message:
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className={`w-full bg-gray-800 border ${
              validationErrors.body ? 'border-red-500' : 'border-gray-700'
            } rounded-md py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200`}
            placeholder="Write your message here..."
            disabled={isSending}
            required
          />
          {validationErrors.body && (
            <p className="mt-1 text-sm text-red-400">{validationErrors.body}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-md text-sm font-medium transition duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md text-sm font-medium transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
            disabled={isSending}
          >
            {isSending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ComposeEmail;
