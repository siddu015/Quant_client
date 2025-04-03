// EmailService.ts
import { Email, SendEmailRequest } from '../types/Email';

const API_URL = 'http://localhost:8080';

interface UserResponse {
  authenticated: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
  message?: string;
}

// Gmail label mapping - all possible labels from Gmail API
export const GMAIL_LABELS = {
  IMPORTANT: 'IMPORTANT',
  CATEGORY_PERSONAL: 'CATEGORY_PERSONAL',
  CATEGORY_SOCIAL: 'CATEGORY_SOCIAL',
  CATEGORY_UPDATES: 'CATEGORY_UPDATES',
  CATEGORY_FORUMS: 'CATEGORY_FORUMS',
  CATEGORY_PROMOTIONS: 'CATEGORY_PROMOTIONS',
  UNREAD: 'UNREAD',
  INBOX: 'INBOX',
  SENT: 'SENT',
  DRAFT: 'DRAFT',
  STARRED: 'STARRED'
};

/**
 * Format date to valid ISO string or return fallback
 * @param dateStr Date string to validate and format
 * @returns Valid ISO date string
 */
const formatValidDate = (dateStr: string | undefined): string => {
  if (!dateStr) {
    console.warn('Empty date received in formatValidDate');
    return new Date().toISOString();
  }
  
  console.log('Formatting date:', dateStr, 'Type:', typeof dateStr);
  
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      const iso = date.toISOString();
      console.log('Valid date converted to:', iso);
      return iso;
    }
    console.warn('Invalid date detected:', dateStr);
    return new Date().toISOString();
  } catch (e) {
    console.error('Error parsing date:', dateStr, e);
    return new Date().toISOString();
  }
};

/**
 * Process emails to extract label information
 * Converts Gmail API label IDs to user-friendly properties
 */
const processEmails = (emails: Email[]): Email[] => {
  if (!emails || !Array.isArray(emails)) {
    console.warn('Invalid emails array in processEmails', emails);
    return [];
  }
  
  return emails.map(email => {
    // Ensure the email has basic required properties
    if (!email || typeof email !== 'object') {
      console.warn('Invalid email object in processEmails', email);
      return email;
    }
    
    // Format dates - ensure sent_at is a valid date
    const formattedSentAt = formatValidDate(email.sent_at);
    
    // Parse sent_at as a timestamp for consistent sorting
    let sentTimestamp = 0;
    try {
      sentTimestamp = new Date(formattedSentAt).getTime();
      // If date parsing fails, use a fallback timestamp
      if (isNaN(sentTimestamp)) {
        console.warn(`Invalid sent_at timestamp for email ${email.id}: ${formattedSentAt}`);
        sentTimestamp = 0;
      }
    } catch (e) {
      console.error('Error parsing sent date:', e);
      sentTimestamp = 0;
    }
    
    // Use existing email data, but parse label_ids to determine properties
    const labelIds = email.label_ids || [];
    
    // Set important flag based on IMPORTANT or STARRED label
    const important = labelIds.includes(GMAIL_LABELS.IMPORTANT) || 
                       labelIds.includes(GMAIL_LABELS.STARRED);
    
    // Determine if unread based on UNREAD label
    // If the email has the UNREAD label, it means it hasn't been read yet
    // Or if read_at is null, it means it hasn't been read yet
    const isUnread = labelIds.includes(GMAIL_LABELS.UNREAD) || email.read_at === null;
    
    // Override read_at if we have label information indicating unread status
    let updatedReadAt = email.read_at;
    if (labelIds.includes(GMAIL_LABELS.UNREAD)) {
      // If it has UNREAD label, make sure read_at is null
      updatedReadAt = null;
    } else if (email.read_at === null && !labelIds.includes(GMAIL_LABELS.UNREAD)) {
      // If it doesn't have UNREAD label but read_at is null, set it to now 
      // (assuming it's been read at some point)
      updatedReadAt = new Date().toISOString();
    }
    
    // Determine category from Gmail category labels
    let category = '';
    if (labelIds.includes(GMAIL_LABELS.CATEGORY_PERSONAL)) category = 'Personal';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_SOCIAL)) category = 'Social';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_UPDATES)) category = 'Updates';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_FORUMS)) category = 'Forums';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_PROMOTIONS)) category = 'Promotions';
    
    // Handle encryption status
    const isEncrypted = email.is_encrypted || false;
    
    // Enhanced email object with processed label data
    return {
      ...email,
      sent_at: formattedSentAt,
      sent_timestamp: sentTimestamp, // Add timestamp for reliable sorting
      read_at: updatedReadAt,
      important,
      category: category || undefined,
      is_encrypted: isEncrypted
    };
  });
};

// Helper function to sort emails by date
const sortEmailsByDate = (emails: Email[]): Email[] => {
  if (!emails || !Array.isArray(emails)) {
    return [];
  }

  return [...emails].sort((a, b) => {
    // Use sent_timestamp if available (most reliable)
    if (a.sent_timestamp && b.sent_timestamp) {
      return b.sent_timestamp - a.sent_timestamp;
    }
    
    // Fallback to comparing date strings
    try {
      const dateA = new Date(a.sent_at);
      const dateB = new Date(b.sent_at);
      
      // If both dates are valid, compare them
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateB.getTime() - dateA.getTime();
      }
      
      // If one date is invalid, prioritize the valid one
      if (!isNaN(dateA.getTime())) return -1;
      if (!isNaN(dateB.getTime())) return 1;
    } catch (e) {
      console.error('Error comparing dates:', e);
    }
    
    // Last resort: string comparison
    return b.sent_at.localeCompare(a.sent_at);
  });
};

// Helper to log email diagnostics for debugging
const logEmailCounts = (sent: Email[], received: Email[]) => {
  console.log(`Email counts - Sent: ${sent.length}, Received: ${received.length}`);
  if (sent.length > 0) {
    console.log('First sent email:', {
      id: sent[0].id,
      sentAt: sent[0].sent_at,
      sender: sent[0].sender_email,
      recipient: sent[0].recipient_email
    });
  }
};

/**
 * Email service for handling email operations
 */
export const EmailService = {
  // Get all emails (both sent and received)
  async getEmails(): Promise<{ sent: Email[], received: Email[] }> {
    try {
      console.log('Fetching emails...');
      const response = await fetch(`${API_URL}/api/emails`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch emails:', response.statusText);
        throw new Error(`Failed to fetch emails: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Email response:', data);
      
      if (!data.success) {
        console.error('API returned unsuccessful response:', data.error || 'Unknown error');
        throw new Error(data.error || 'Failed to fetch emails');
      }

      // Handle unified emails array format
      if (data.emails && Array.isArray(data.emails)) {
        // Get user info to properly categorize emails
        const userResponse = await fetch(`${API_URL}/api/user`, {
          credentials: 'include',
        });
        
        const userData: UserResponse = await userResponse.json();
        console.log('User data for email categorization:', userData);
        
        if (!userResponse.ok || !userData.authenticated || !userData.email) {
          console.error('Failed to get user email for categorization:', userData.message || 'Unknown error');
          throw new Error('Could not determine user email for categorizing emails');
        }
        
        const userEmail = userData.email;
        console.log('Categorizing emails for user:', userEmail);
        
        // Process all emails to add timestamps, format dates, etc.
        const processedEmails = processEmails(data.emails);
        
        // Step 1: Split emails into sent and potential received categories
        let sent = processedEmails.filter((email: Email) => 
          email.sender_email === userEmail
        );
        
        // Deduplicate sent emails using a Map with gmail_id or id as key
        // This prevents the same email from appearing multiple times
        const uniqueSentMap = new Map<string, Email>();
        sent.forEach(email => {
          const key = email.gmail_id || email.id;
          if (!uniqueSentMap.has(key) || 
              (email.sent_timestamp && uniqueSentMap.get(key)!.sent_timestamp && 
               email.sent_timestamp > uniqueSentMap.get(key)!.sent_timestamp!)) {
            uniqueSentMap.set(key, email);
          }
        });
        
        // Convert the Map back to an array
        sent = Array.from(uniqueSentMap.values());
        
        // Step 2: A message is "received" if the recipient is the current user 
        // AND it wasn't sent by the current user (to prevent duplicates)
        const received = processedEmails.filter((email: Email) => 
          email.recipient_email === userEmail && 
          email.sender_email !== userEmail
        );
        
        // Log the number of emails being removed as duplicates
        console.log(`Removed ${processedEmails.filter(e => e.sender_email === userEmail).length - sent.length} duplicate sent emails`);
        
        // Step 3: Sort both arrays by date (newest first)
        const sortedSent = sortEmailsByDate(sent);
        const sortedReceived = sortEmailsByDate(received);
        
        // Log diagnostic information
        logEmailCounts(sortedSent, sortedReceived);
        
        return { 
          sent: sortedSent, 
          received: sortedReceived 
        };
      }
      
      // Handle legacy format if it exists (process both sent and received arrays)
      if (Array.isArray(data.sent) && Array.isArray(data.received)) {
        console.log('Using legacy email format');
        
        // Get user info for proper filtering
        const userResponse = await fetch(`${API_URL}/api/user`, {
          credentials: 'include',
        });
        
        const userData: UserResponse = await userResponse.json();
        const userEmail = userData.email || '';
        
        // Process emails
        let processedSent = processEmails(data.sent);
        let processedReceived = processEmails(data.received);
        
        // Deduplicate sent emails
        const uniqueSentMap = new Map<string, Email>();
        processedSent.forEach(email => {
          const key = email.gmail_id || email.id;
          if (!uniqueSentMap.has(key) || 
              (email.sent_timestamp && uniqueSentMap.get(key)!.sent_timestamp && 
               email.sent_timestamp > uniqueSentMap.get(key)!.sent_timestamp!)) {
            uniqueSentMap.set(key, email);
          }
        });
        
        // Convert the Map back to an array
        processedSent = Array.from(uniqueSentMap.values());
        
        // Ensure no duplication between sent and received
        // If the user sent an email to themselves, it should only appear in sent
        const sentIds = new Set(processedSent.map(email => email.gmail_id || email.id));
        processedReceived = processedReceived.filter(email => 
          // Keep email in received only if:
          // 1. It's not from the current user (most important check)
          email.sender_email !== userEmail &&
          // 2. It's not already in the sent folder (backup check)
          !sentIds.has(email.gmail_id || email.id)
        );
        
        // Sort by date (newest first)
        const sortedSent = sortEmailsByDate(processedSent);
        const sortedReceived = sortEmailsByDate(processedReceived);
        
        // Log diagnostic information
        logEmailCounts(sortedSent, sortedReceived);
        
        return { 
          sent: sortedSent, 
          received: sortedReceived 
        };
      }
      
      console.error('Invalid email response format:', data);
      throw new Error('Invalid email response format');
    } catch (error) {
      console.error('Error in getEmails:', error);
      throw error;
    }
  },
  
  // Get a specific email by ID
  async getEmail(id: number): Promise<Email | null> {
    try {
      console.log('Fetching email:', id);
      const response = await fetch(`${API_URL}/api/emails/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch email:', response.statusText);
        throw new Error(`Failed to fetch email: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Email details response:', data);
      
      if (!data.success) {
        console.error('Failed to get email:', data.error || 'Unknown error');
        return null;
      }
      
      // Process email to include label information
      const processedEmail = processEmails([data.email])[0];
      return processedEmail;
    } catch (error) {
      console.error(`Error fetching email ${id}:`, error);
      return null;
    }
  },
  
  // Send a new email
  async sendEmail(emailRequest: SendEmailRequest): Promise<boolean> {
    try {
      console.log('Sending email:', emailRequest);
      const response = await fetch(`${API_URL}/api/emails`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailRequest),
      });
      
      if (!response.ok) {
        console.error('Failed to send email:', response.statusText);
        throw new Error(`Failed to send email: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Send email response:', data);
      
      if (!data.success) {
        console.error('Failed to send email:', data.error || 'Unknown error');
        return false;
      }
      
      // After sending, refresh emails to include the newly sent email
      // Use a slight delay to ensure the backend has had time to process the email
      try {
        console.log('Waiting 500ms before refreshing emails...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('Refreshing emails to get newly sent email...');
        const refreshResult = await this.refreshEmails();
        console.log('Email refresh result:', refreshResult);
        
        if (!refreshResult) {
          console.warn('Email refresh failed after sending, will need to manually refresh');
        }
      } catch (refreshError) {
        console.warn('Failed to refresh emails after sending, but email was sent successfully:', refreshError);
        // Don't return false here - the email was sent successfully even if refresh failed
      }
      
      return true;
    } catch (error) {
      console.error('Error in sendEmail:', error);
      return false;
    }
  },
  
  // Force refresh emails from Gmail API
  async refreshEmails(): Promise<boolean> {
    try {
      console.log('Refreshing emails...');
      const response = await fetch(`${API_URL}/api/emails/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('Failed to refresh emails:', response.statusText);
        throw new Error(`Failed to refresh emails: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Refresh emails response:', data);
      
      return data.success;
    } catch (error) {
      console.error('Error in refreshEmails:', error);
      return false;
    }
  },
  
  // Filter emails by category
  filterByCategory(emails: Email[], category: string): Email[] {
    return emails.filter(email => email.category === category);
  },
  
  // Filter important emails
  filterImportant(emails: Email[]): Email[] {
    return emails.filter(email => email.important);
  },
  
  // Filter unread emails
  filterUnread(emails: Email[]): Email[] {
    return emails.filter(email => !email.read_at);
  },
  
  // Mark an email as read
  async markAsRead(emailId: string): Promise<boolean> {
    try {
      console.log('Marking email as read:', emailId);
      
      if (!emailId) {
        console.error('Invalid email ID provided');
        return false;
      }
      
      // Fetch the specific email to make sure we get the latest version with updated labels
      const email = await this.getEmail(parseInt(emailId));
      
      if (!email) {
        console.error('Could not find email to mark as read:', emailId);
        return false;
      }
      
      // If already read, no need to do anything
      if (email.read_at) {
        console.log('Email already marked as read');
        return true;
      }
      
      // Update the email's read status via the Gmail API
      const response = await fetch(`${API_URL}/api/emails/${emailId}/read`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error('Failed to mark email as read:', response.statusText);
        return false;
      }
      
      const data = await response.json();
      console.log('Mark as read response:', data);
      
      return data.success;
    } catch (error) {
      console.error('Error marking email as read:', error);
      return false;
    }
  }
};
