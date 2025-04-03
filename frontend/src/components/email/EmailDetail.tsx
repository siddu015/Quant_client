// EmailDetail.tsx
import React, { useState } from 'react';
import { Email } from '../../types/Email';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
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

const EmailDetail: React.FC<EmailDetailProps> = ({ email, onBack }) => {
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
    <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
      {/* Header */}
      <div className="p-4 bg-gray-800/30 border-b border-gray-800/50 flex justify-between items-center">
        <button
          onClick={onBack}
          className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 p-2 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-xl text-sm ${isSentEmail ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {isSentEmail ? 'Sent' : 'Received'}
          </span>
          {email.read_at && !isSentEmail && (
            <span className="bg-gray-700/50 text-gray-400 px-3 py-1 rounded-xl text-sm">
              Read
            </span>
          )}
          {!email.read_at && !isSentEmail && (
            <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Unread
            </span>
          )}
          {email.important && (
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Important
            </span>
          )}
          {email.attachments && email.attachments.length > 0 && (
            <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attachment ({email.attachments.length})
            </span>
          )}
          {email.category && (
            <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {email.category}
            </span>
          )}
          {email.is_encrypted && (
            <span className="bg-blue-900/40 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-xl text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Quantum Encrypted
            </span>
          )}
        </div>
      </div>

      {/* Email content */}
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${isSentEmail ? 'bg-purple-500/50' : 'bg-blue-500/50'} flex items-center justify-center text-white font-medium text-lg`}>
            {(isSentEmail ? email.recipient_email : email.sender_email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">Subject:</label>
                <h2 className="text-xl font-semibold text-gray-200">{displayEmail.subject}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">From:</label>
                  <p className="text-sm text-gray-300">{displayEmail.sender_email}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">To:</label>
                  <p className="text-sm text-gray-300">{displayEmail.recipient_email}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Date:</label>
                <p className="text-sm text-gray-300">{formatDate(displayEmail.sent_at)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Message:</label>
          {email.is_encrypted && !decryptedEmail ? (
            <div className="bg-gray-800/20 rounded-xl p-6 text-center">
              <div className="bg-blue-900/30 rounded-xl p-6 mb-4">
                <div className="flex justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Quantum Encrypted Message</h3>
                <p className="text-gray-300 mb-4">This message is encrypted with quantum-resistant encryption.</p>
                <button
                  onClick={handleDecrypt}
                  disabled={isDecrypting}
                  className={`w-full py-2 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg shadow-lg transition-all duration-200 ${isDecrypting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isDecrypting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Decrypting Message...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      Decrypt Message
                    </span>
                  )}
                </button>
              </div>
              
              <div className="text-gray-400 text-sm">
                <p>The content of this message is encrypted and can only be viewed with your private key.</p>
                <p>Click the button above to decrypt the message.</p>
              </div>
            </div>
          ) : isMarketingEmail(displayEmail.subject, displayEmail.body) ? (
            // Marketing email specialized rendering with enhanced formatting
            <div className="bg-gray-800/20 rounded-xl p-6">
              <div className="email-content newsletter-content text-gray-300">
                {displayEmail.body.startsWith('<html') || displayEmail.body.includes('<div') || displayEmail.body.includes('<table') ? (
                  // For HTML marketing emails
                  <div 
                    className="html-email marketing-email" 
                    dangerouslySetInnerHTML={{ 
                      __html: displayEmail.body 
                    }} 
                  />
                ) : (
                  // For markdown marketing emails
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    components={{
                      // Custom components with enhanced styling for marketing emails
                      h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-blue-300 my-6 pb-2 border-b border-blue-800/30" {...props} />,
                      h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-blue-300 my-5 pb-1 border-b border-blue-800/30" {...props} />,
                      h3: ({node, ...props}: any) => <h3 className="text-lg font-bold text-blue-300 my-4" {...props} />,
                      h4: ({node, ...props}: any) => <h4 className="text-base font-semibold text-blue-300 my-3" {...props} />,
                      p: ({node, ...props}: any) => <p className="my-3 text-gray-300 leading-relaxed" {...props} />,
                      a: ({node, href, ...props}: any) => {
                        if (href && href.startsWith('mailto:')) {
                          return <a className="text-blue-400 hover:text-blue-300 font-medium" href={href} {...props} />;
                        }
                        return <a className="text-blue-400 hover:text-blue-300 font-medium" href={href} target="_blank" rel="noopener noreferrer" {...props} />;
                      },
                      ul: ({node, ...props}: any) => <ul className="my-4 pl-6 space-y-2" {...props} />,
                      ol: ({node, ...props}: any) => <ol className="my-4 pl-6 space-y-2 list-decimal" {...props} />,
                      li: ({node, ...props}: any) => <li className="pl-1 text-gray-300" {...props} />,
                      hr: ({node, ...props}: any) => <hr className="my-6 border-blue-800/30" {...props} />,
                      img: ({node, ...props}: any) => <img className="max-w-full h-auto rounded my-6 shadow-lg" {...props} />
                    }}
                  >
                    {preprocessMarkdown(displayEmail.body)}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/20 rounded-xl p-6">
              <div className="email-content text-gray-300">
                {displayEmail.body.startsWith('<html') || displayEmail.body.includes('<div') || displayEmail.body.includes('<table') ? (
                  // For HTML emails, use dangerouslySetInnerHTML with caution 
                  // This is already sanitized by rehype-sanitize in React-Markdown
                  <div 
                    className="html-email" 
                    dangerouslySetInnerHTML={{ 
                      __html: displayEmail.body 
                    }} 
                  />
                ) : (
                  // For markdown and plain text emails
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    components={{
                      // Custom components for rendering markdown elements
                      h1: ({node, ...props}: any) => <h1 className="text-xl font-bold text-gray-200 my-4" {...props} />,
                      h2: ({node, ...props}: any) => <h2 className="text-lg font-bold text-gray-200 my-3" {...props} />,
                      h3: ({node, ...props}: any) => <h3 className="text-base font-bold text-gray-200 my-3" {...props} />,
                      h4: ({node, ...props}: any) => <h4 className="text-base font-semibold text-gray-200 my-2" {...props} />,
                      h5: ({node, ...props}: any) => <h5 className="text-sm font-semibold text-gray-200 my-2" {...props} />,
                      h6: ({node, ...props}: any) => <h6 className="text-sm font-semibold text-gray-200 my-2" {...props} />,
                      p: ({node, ...props}: any) => <p className="my-2 text-gray-300" {...props} />,
                      a: ({node, href, ...props}: any) => {
                        // Handle mailto links
                        if (href && href.startsWith('mailto:')) {
                          return <a className="text-blue-400 hover:text-blue-300 underline" href={href} {...props} />;
                        }
                        // Handle normal links - open in new tab
                        return <a className="text-blue-400 hover:text-blue-300 underline" href={href} target="_blank" rel="noopener noreferrer" {...props} />;
                      },
                      ul: ({node, ...props}: any) => <ul className="list-disc pl-5 my-2" {...props} />,
                      ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 my-2" {...props} />,
                      li: ({node, ...props}: any) => <li className="my-1" {...props} />,
                      blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-gray-600 pl-4 italic my-4 text-gray-400" {...props} />,
                      code: ({node, inline, className, children, ...props}: any) => 
                        inline 
                          ? <code className="bg-gray-700/50 px-1 rounded text-blue-300" {...props}>{children}</code>
                          : <code className="block bg-gray-700/50 p-3 rounded my-4 text-blue-300 overflow-x-auto" {...props}>{children}</code>,
                      pre: ({node, ...props}: any) => <pre className="bg-gray-700/50 p-4 rounded-lg my-4 overflow-x-auto" {...props} />,
                      hr: ({node, ...props}: any) => <hr className="my-6 border-gray-700" {...props} />,
                      table: ({node, ...props}: any) => <table className="min-w-full divide-y divide-gray-700 my-4" {...props} />,
                      thead: ({node, ...props}: any) => <thead className="bg-gray-700/30" {...props} />,
                      tbody: ({node, ...props}: any) => <tbody className="divide-y divide-gray-700" {...props} />,
                      tr: ({node, ...props}: any) => <tr className="hover:bg-gray-700/30" {...props} />,
                      th: ({node, ...props}: any) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" {...props} />,
                      td: ({node, ...props}: any) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300" {...props} />,
                      img: ({node, ...props}: any) => <img className="max-w-full h-auto rounded my-4" {...props} />
                    }}
                  >
                    {/* Process the email content to fix markdown formatting issues */}
                    {preprocessMarkdown(displayEmail.body)}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
