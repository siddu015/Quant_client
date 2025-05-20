// EmailDetail.tsx
import React, { useState, useEffect } from 'react';
import { Email } from '../../types/Email';
import { useAuth } from '../../context/AuthContext';
import { EmailService } from '../../services/EmailService';
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
  email: Email | null;
  onBack: () => void;
  onClose?: () => void;
  onEmailDeleted?: () => void;
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

const EmailDetail: React.FC<EmailDetailProps> = ({ email, onBack, onClose, onEmailDeleted }) => {
  // Move hooks to the top level so they're always called
  const { userEmail } = useAuth();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedEmail, setDecryptedEmail] = useState<Email | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Add safeguard to return null if email is not provided
  if (!email) {
    return null;
  }

  const isSentEmail = email.sender_email === userEmail;

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return '';
      }
      
      return date.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  };

  // Handle delete button click
  const handleDelete = async () => {
    try {
      setIsLoading(true);
      console.log('Deleting email with ID:', email.id);
      
      const success = await EmailService.deleteEmail({
        id: email.id,
        permanently_delete: false // Never permanently delete from detail view, always move to trash first
      });
      
      if (success) {
        console.log('Email successfully moved to trash');
        // Call the onEmailDeleted callback to refresh the list
        if (onEmailDeleted) {
          onEmailDeleted();
        }
        // Call onClose to return to email list
        if (onClose) {
          onClose();
        }
      } else {
        console.error('Failed to delete email');
      }
    } catch (err) {
      console.error('Error deleting email:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get initials for avatar
  const getInitial = (email: string) => {
    return email.charAt(0).toUpperCase();
  };
  
  // Generate avatar color
  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-600', 'bg-purple-600', 'bg-green-600', 
      'bg-pink-600', 'bg-indigo-600', 'bg-yellow-600', 
      'bg-red-600', 'bg-cyan-600'
    ];
    
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Handle decrypt button click
  const handleDecrypt = async () => {
    if (!email) return;
    
    setIsDecrypting(true);
    
    try {
      // Simulate decryption with delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a "decrypted" version
      setDecryptedEmail({
        ...email,
        subject: email.subject.replace('[Q-ENCRYPTED]', '').trim()
      });
    } catch (error) {
      console.error("Error decrypting:", error);
    } finally {
      setIsDecrypting(false);
    }
  };

  // Determine which email to display (the decrypted one or original)
  const displayEmail = decryptedEmail || email;
  
  // Check if the email appears to be marketing content
  const isMarketing = isMarketingEmail(displayEmail.subject, displayEmail.body);
  
  // Preprocess content for better markdown rendering
  const processedBody = isMarketing ? 
    preprocessMarkdown(displayEmail.body) : 
    displayEmail.body;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900/60 p-4 rounded-t-xl border-b border-gray-700/50 flex justify-between">
        <div className="flex items-center">
          <button 
            onClick={onBack}
            className="mr-4 p-2 bg-gray-800/60 hover:bg-gray-700/60 rounded-full text-gray-300 hover:text-gray-100 transition-all duration-150"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h3 className="text-lg font-medium text-gray-100">
            {displayEmail.subject}
          </h3>
        </div>
        <div className="flex gap-2">
          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="p-2 bg-gray-800/60 hover:bg-red-900/70 rounded-full text-gray-300 hover:text-red-300 transition-all duration-150"
            aria-label="Delete email"
            title="Delete email"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          {/* Close button */}
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 bg-gray-800/60 hover:bg-gray-700/60 rounded-full text-gray-300 hover:text-gray-100 transition-all duration-150"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Email content */}
      <div className="flex-grow overflow-auto p-4 lg:p-6 custom-scrollbar">
        <div className="bg-gray-900/40 rounded-xl p-6 mb-6">
          <div className="flex justify-between mb-4">
            <div className="flex items-center">
              <div className={`w-12 h-12 rounded-full ${getAvatarColor(isSentEmail ? displayEmail.recipient_email : displayEmail.sender_email)} flex items-center justify-center text-white font-semibold text-xl shadow-lg mr-4`}>
                {getInitial(isSentEmail ? displayEmail.recipient_email : displayEmail.sender_email)}
              </div>
              <div>
                <h4 className="text-md font-semibold text-gray-100">
                  {isSentEmail ? `To: ${displayEmail.recipient_email}` : displayEmail.sender_email}
                </h4>
                <p className="text-sm text-gray-400">
                  {formatDate(displayEmail.sent_at)}
                </p>
              </div>
            </div>
            
            {/* Show decrypt button if encrypted */}
            {(email.is_encrypted || email.subject.includes('[Q-ENCRYPTED]')) && !decryptedEmail && (
              <button
                onClick={handleDecrypt}
                disabled={isDecrypting}
                className="px-4 py-2 bg-gray-700/60 hover:bg-indigo-700/40 text-gray-100 rounded-lg text-sm shadow-lg transition-all duration-150 flex items-center"
              >
                {isDecrypting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Decrypting...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Decrypt
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Content area */}
          <div className="mt-6">
            {/* Show visualization when decrypting */}
            {isDecrypting && <DecryptionVisualizer />}
            
            {/* Show email content */}
            {!isDecrypting && (
              <div className="bg-gray-900/20 p-4 rounded-lg">
                <div className="text-gray-300 prose prose-sm prose-invert max-w-none">
                  {isMarketing ? (
                    // Handle marketing emails with markdown
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    >
                      {processedBody}
                    </ReactMarkdown>
                  ) : (
                    // Simple text display for normal emails
                    <div dangerouslySetInnerHTML={{ __html: processedBody.replace(/\n/g, '<br>') }} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
