// EmailDetail.tsx
import React, { useState, useEffect } from 'react';
import { Email } from '../../types/Email';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

// Decryption Visualization Component
const DecryptionVisualizer: React.FC = () => {
  const [animationStep, setAnimationStep] = useState(0);
  const [cipherLines, setCipherLines] = useState<string[]>([]);
  
  useEffect(() => {
    // Generate random binary data for visualization
    const lines: string[] = [];
    for(let i = 0; i < 5; i++) {
      let line = '';
      for(let j = 0; j < 40; j++) {
        line += Math.random() > 0.5 ? '1' : '0';
      }
      lines.push(line);
    }
    setCipherLines(lines);
    
    // Animation loop
    const timer = setInterval(() => {
      setAnimationStep(prev => (prev + 1) % 15);
    }, 200);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="bg-black/40 rounded-xl p-4 my-4 font-mono text-xs">
      <div className="flex justify-between items-center mb-2">
        <div className="text-purple-400 font-bold">QUANTUM DECRYPTION IN PROGRESS</div>
        <div className="text-green-400">{Math.min(Math.round(animationStep * 7.5), 100)}%</div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-blue-400 mb-1">ENCRYPTED CIPHERTEXT</div>
          {cipherLines.map((line, idx) => (
            <div key={`cipher-${idx}`} className="text-blue-300 font-mono overflow-hidden">
              {line}
            </div>
          ))}
        </div>
        
        <div className="space-y-1 border-l border-gray-700 pl-4">
          <div className="text-green-400 mb-1">DECRYPTION PROCESS</div>
          {cipherLines.map((line, idx) => (
            <div key={`plain-${idx}`} className="text-green-300 font-mono overflow-hidden">
              {/* Gradually reveal "decrypted" text based on animation step */}
              {animationStep > idx * 2 ? 
                Array(line.length).fill(0).map((_, i) => 
                  i < ((animationStep - idx * 2) * 5) ? 
                    (Math.random() > 0.5 ? 'A' : (Math.random() > 0.5 ? 'T' : (Math.random() > 0.5 ? 'G' : 'C'))) : 
                    line[i]
                ).join('') 
                : line}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 pt-2 border-t border-gray-700 text-center">
        <div className="text-xs text-gray-400">Using Kyber-768 Post-Quantum Cryptography</div>
        <div className="flex justify-center space-x-1 mt-2">
          {Array(10).fill(0).map((_, i) => (
            <div 
              key={i} 
              className={`h-1 w-4 rounded ${i < animationStep / 1.5 ? 'bg-green-500' : 'bg-gray-700'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onClose?: () => void;
}

const preprocessMarkdown = (content: string): string => {
  if (!content) return '';
  
  // Split content into lines for easier processing
  const lines = content.split('\n');
  const processedLines = [];
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Fix headers without space after # (e.g., ###Title -> ### Title)
    if (/^#{1,6}[^#\s]/.test(line)) {
      line = line.replace(/^(#{1,6})([^#\s])/, '$1 $2');
    }
    
    // Special marketing email fix: Handle inline headers like "###Build. Preview. Deploy."
    if (line.match(/###[A-Za-z0-9]/) || line.match(/##[A-Za-z0-9]/)) {
      line = line.replace(/(###|##)([A-Za-z0-9])/, "$1 $2");
    }
    
    // Fix headers that might appear in the middle of a line (common in marketing emails)
    if (line.includes('###') && !line.startsWith('#')) {
      // If ### appears in the middle of text, ensure it has proper spacing or move to new line
      line = line.replace(/([^#\s])(###)([^#\s])/, "$1\n\n### $3");
    }
    
    // Fix bullet points without proper spacing
    if (/^(\s*)-[^\s]/.test(line)) {
      line = line.replace(/^(\s*)-([^\s])/, '$1- $2');
    }
    
    // Fix numbered lists without proper spacing
    if (/^(\s*)\d+\.[^\s]/.test(line)) {
      line = line.replace(/^(\s*\d+\.)([^\s])/, '$1 $2');
    }
    
    // Add line to processed lines
    processedLines.push(line);
  }
  
  // Rejoin lines
  let processedContent = processedLines.join('\n');
  
  // Add debug info to help track issues (for development only - remove in production)
  // console.log('Processed content:', processedContent);
  
  return processedContent
    // Additional fixes for common email marketing formatting issues
    
    // Replace multiple consecutive newlines with just two newlines
    .replace(/\n{3,}/g, '\n\n')
    
    // Fix markdown links if needed
    .replace(/\[(.*?)\]\s*\((.*?)\)/g, '[$1]($2)')
    
    // Replace plain "---" with proper horizontal rule
    .replace(/^---$/gm, '\n---\n')
    
    // Fix any underlined headers (e.g., Title\n===== -> # Title)
    .replace(/^(.+)\n={3,}$/gm, '# $1')
    .replace(/^(.+)\n-{3,}$/gm, '## $1')
    
    // Make sure all headers have proper spacing and are on their own line
    .replace(/^(#{1,6}\s)(.*?)$/gm, '\n$1$2\n')
    
    // Enhance bullet lists with better spacing
    .replace(/^(\s*[*-]\s+)(.*?)$/gm, '\n$1$2\n')
    
    // Make sure all newlines are handled correctly for markdown
    .replace(/\n/g, '  \n');
};

// Improve marketing email detection
const isMarketingEmail = (subject: string, body: string): boolean => {
  if (!subject || !body) return false;
  
  // Common patterns in marketing emails
  const marketingSubjectPatterns = [
    /newsletter/i, 
    /update/i, 
    /news/i, 
    /announcement/i, 
    /introducing/i,
    /new feature/i,
    /launch/i,
    /release/i,
    /offer/i,
    /sale/i,
    /discount/i,
    /promo/i,
    /deal/i,
    /special/i,
    /invite/i,
    /welcome/i,
    /preview/i,
    /coming soon/i,
    /^re:/i // Often marketing emails have "Re:" prefix even for first contact
  ];
  
  // Check if the subject contains marketing keywords
  const hasMarketingSubject = marketingSubjectPatterns.some(pattern => pattern.test(subject));
  
  // Additional body pattern checks
  const marketingBodyPatterns = [
    /<table/i,                       // HTML tables (common in marketing emails)
    /###(?:[^#]|$)/,                 // ### headers 
    /##(?:[^#]|$)/,                  // ## headers
    /view in browser/i,              // Common marketing email phrases
    /view email in browser/i,
    /unsubscribe/i,
    /opt[ -]out/i,
    /privacy policy/i,
    /terms of service/i,
    /preferences/i,
    /update preferences/i,
    /https?:\/\/[^\s"]+\.(gif|png|jpg|jpeg|webp)/i,  // Image links
    /\[product update\]/i,
    /\[update\]/i,
    /<img[^>]+src=/i,                // HTML images
    /style=['"][^'"]*background[^'"]*['"]/, // CSS backgrounds
    /style=['"][^'"]*color[^'"]*['"]/, // CSS colors
    /style=['"][^'"]*font[^'"]*['"]/, // CSS fonts
    /\*\|[A-Z_]+\|\*/,               // Mailchimp-style merge tags
    /<%[^%]+%>/,                     // Email template variables
    /\{\{[^}]+\}\}/                  // Handlebars-style template variables
  ];
  
  // Check if the body contains marketing patterns
  const hasMarketingBody = marketingBodyPatterns.some(pattern => pattern.test(body));
  
  // Layout-based detection (common in marketing emails)
  const hasMarketingLayout = 
    body.includes('--') ||                       // Separator lines
    (body.match(/\n/g) || []).length > 15 ||     // Many line breaks
    (body.match(/http/g) || []).length > 2 ||    // Multiple links
    body.length > 1000;                         // Long body
  
  return hasMarketingSubject || hasMarketingBody || hasMarketingLayout;
};

const EmailDetail: React.FC<EmailDetailProps> = ({ email, onBack, onClose }) => {
  const { userEmail } = useAuth();
  const isSentEmail = email.sender_email === userEmail;
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedEmail, setDecryptedEmail] = useState<Email | null>(null);

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'Invalid date';
      }
      
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Date error';
    }
  };

  // Get first letter of email for avatar
  const getInitial = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  // Get random color based on email string (for avatar background)
  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-600', 'bg-purple-600', 'bg-green-600', 
      'bg-yellow-600', 'bg-red-600', 'bg-pink-600', 
      'bg-indigo-600', 'bg-teal-600'
    ];
    
    // Simple hash function to get consistent color for same email
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const senderAvatarColor = getAvatarColor(email.sender_email);

  // Handle decryption
  const handleDecrypt = async () => {
    try {
      setIsDecrypting(true);
      
      // Add a small delay to allow the animation to be seen
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const response = await fetch(`http://localhost:8080/api/emails/${email.id}/decrypt`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('Failed to decrypt email:', response.statusText);
        throw new Error(`Failed to decrypt email: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        console.error('Failed to decrypt email:', data.error || 'Unknown error');
        throw new Error(data.error || 'Failed to decrypt email');
      }
      
      setDecryptedEmail(data.email);
    } catch (error) {
      console.error('Error decrypting email:', error);
      alert('Failed to decrypt message. Please try again later.');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Use decrypted version if available
  const displayEmail = decryptedEmail || email;

  return (
    <div className="h-full flex flex-col bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
      {/* Header */}
      <div className="p-4 bg-gray-800/40 border-b border-gray-700/50 flex justify-between items-center">
        <button
          onClick={onBack}
          className="bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 p-2 rounded-xl transition-all duration-200 hover:shadow-lg flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        
        <div className="flex space-x-2">
          {email.is_encrypted && !decryptedEmail && (
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className={`bg-indigo-800/60 hover:bg-indigo-700/60 text-indigo-100 px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 ${isDecrypting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              <span>{isDecrypting ? 'Decrypting...' : 'Decrypt Message'}</span>
            </button>
          )}
          
          {/* Close button if onClose is provided */}
          {onClose && (
            <button
              onClick={onClose}
              className="bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 p-2 rounded-xl transition-all duration-200 hover:shadow-lg flex items-center gap-2"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Close</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Email content */}
      <div className="p-6 border-b border-gray-700/30">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-12 h-12 ${senderAvatarColor} rounded-full flex items-center justify-center text-white text-xl font-medium shadow-lg`}>
            {getInitial(email.sender_email)}
          </div>
          
          <div className="flex-grow">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between md:gap-4">
              <h1 className="text-xl font-semibold text-white mb-1">
                {displayEmail.subject}
                {email.is_encrypted && (
                  <span className="ml-2 text-xs bg-indigo-900/60 text-indigo-300 py-0.5 px-2 rounded-full inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Encrypted
                  </span>
                )}
              </h1>
              <span className="text-sm text-gray-400">
                {formatDate(email.sent_at)}
              </span>
            </div>
            
            <div className="flex items-center text-gray-300 mt-2">
              <span className="font-medium">
                {isSentEmail ? 'To: ' : 'From: '}
              </span>
              <span className="ml-2">
                {isSentEmail ? email.recipient_email : email.sender_email}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Email content */}
      <div className="custom-scrollbar p-6 overflow-y-auto flex-grow bg-gradient-to-b from-gray-900/20 to-gray-800/20">
        {/* Show decryption visualizer when decrypting */}
        {isDecrypting && <DecryptionVisualizer />}
        
        {/* Hide actual email content during decryption */}
        {!isDecrypting && (
          isMarketingEmail(displayEmail.subject, displayEmail.body) ? (
            // For marketing emails, wrap in a div with the html-email class for styling
            <div 
              className="html-email" 
              dangerouslySetInnerHTML={{ __html: displayEmail.body }} 
            />
          ) : (
            // For regular emails, use markdown parser with proper styling
            <div className="email-content">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
              >
                {preprocessMarkdown(displayEmail.body)}
              </ReactMarkdown>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default EmailDetail;
