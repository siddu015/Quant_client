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
    
    // Calculate a reliable timestamp from the formatted date
    // This will be used for consistent sorting
    let sentTimestamp = 0;
    
    try {
      // Get a proper date object
      const sentDate = new Date(formattedSentAt);
      
      // Ensure we have a valid date before getting the timestamp
      if (!isNaN(sentDate.getTime())) {
        sentTimestamp = sentDate.getTime();
        
        // For debugging: Show what timestamp was generated
        console.log(`Generated timestamp for "${email.subject}": ${sentTimestamp} (${sentDate.toLocaleString()})`);
      } else {
        // If we couldn't parse a proper date, use current time minus offset
        console.warn(`Invalid sent_at format for email ${email.id} (${email.subject}): "${formattedSentAt}"`);
        sentTimestamp = Date.now() - 1000000; 
      }
    } catch (e) {
      console.error(`Error creating timestamp for email ${email.id}:`, e);
      sentTimestamp = Date.now() - 1000000;
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
    
    // Enhanced email object with processed label data
    const processedEmail = {
      ...email,
      sent_at: formattedSentAt,
      sent_timestamp: sentTimestamp,
      read_at: updatedReadAt,
      important,
      category: category || undefined
    };
    
    // Special logging for sent emails to ensure correct sorting
    if (labelIds.includes(GMAIL_LABELS.SENT)) {
      console.log(`PROCESSED SENT EMAIL: "${processedEmail.subject}"`, {
        id: processedEmail.id,
        original_date: email.sent_at,
        formatted_date: formattedSentAt,
        timestamp: sentTimestamp,
        date_obj: new Date(formattedSentAt).toLocaleString()
      });
    }
    
    return processedEmail;
  });
};

// Enhanced helper function to sort emails by date with debugging
const sortEmailsByDate = (emails: Email[]): Email[] => {
  if (!emails || !Array.isArray(emails)) {
    return [];
  }

  console.log('Before sorting, first 3 emails:', 
    emails.slice(0, 3).map(e => ({
      id: e.id, 
      subject: e.subject,
      sent_at: e.sent_at,
      sent_timestamp: e.sent_timestamp
    }))
  );

  // First ensure all emails have valid timestamps
  const emailsWithValidTimestamps = emails.map(email => {
    if (!email.sent_timestamp || isNaN(email.sent_timestamp)) {
      const timestamp = new Date(email.sent_at).getTime();
      return {
        ...email,
        sent_timestamp: isNaN(timestamp) ? Date.now() - 1000000 : timestamp
      };
    }
    return email;
  });

  // Sort by timestamp - newest first
  const sorted = [...emailsWithValidTimestamps].sort((a, b) => {
    const timestampA = a.sent_timestamp || 0;
    const timestampB = b.sent_timestamp || 0;
    return timestampB - timestampA;
  });

  console.log('After sorting, first 3 emails:', 
    sorted.slice(0, 3).map(e => ({
      id: e.id, 
      subject: e.subject,
      sent_at: e.sent_at,
      sent_timestamp: e.sent_timestamp
    }))
  );

  // Double-check sorting
  for (let i = 1; i < Math.min(sorted.length, 10); i++) {
    const prevTimestamp = sorted[i-1].sent_timestamp || 0;
    const currTimestamp = sorted[i].sent_timestamp || 0;
    if (currTimestamp > prevTimestamp) {
      console.error(`SORTING ERROR: Email at index ${i} (${sorted[i].subject}) has timestamp ${currTimestamp}, which is newer than previous email (${sorted[i-1].subject}) with timestamp ${prevTimestamp}`);
    }
  }

  return sorted;
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
        
        // Log sent email timestamps BEFORE any sorting
        if (sent.length > 0) {
          console.log('RAW SENT EMAILS BEFORE SORTING:');
          sent.forEach(email => {
            console.log(`Email "${email.subject}": ${email.sent_at} (timestamp: ${email.sent_timestamp})`);
          });
        }
        
        // Deduplicate sent emails using a Map with gmail_id or id as key
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
        
        // SIMPLIFIED SORTING: Use a single, reliable sort by timestamp only
        console.log('SORTING SENT EMAILS BY TIMESTAMP...');
        sent.sort((a, b) => {
          // For debugging, log each comparison
          const timestampA = a.sent_timestamp || 0;
          const timestampB = b.sent_timestamp || 0;
          console.log(`Comparing "${a.subject}" (${timestampA}) vs "${b.subject}" (${timestampB})`);
          return timestampB - timestampA; // Newest first
        });
        
        // Log the final sorted order
        if (sent.length > 0) {
          console.log('FINAL SENT EMAIL ORDER:');
          sent.forEach((email, index) => {
            const date = new Date(email.sent_at);
            console.log(`${index}: "${email.subject}" - ${date.toLocaleString()} (${email.sent_timestamp})`);
          });
        }
        
        // Step 2: Filter received emails similarly
        const received = processedEmails.filter((email: Email) => 
          email.recipient_email === userEmail && 
          email.sender_email !== userEmail
        );
        
        // Sort received emails the same way
        received.sort((a, b) => (b.sent_timestamp || 0) - (a.sent_timestamp || 0));
        
        // Log diagnostic information
        logEmailCounts(sent, received);
        
        return { 
          sent: sent, 
          received: received 
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
        
        // Verify the sent emails have sent_timestamp
        processedSent = processedSent.map(email => {
          if (!email.sent_timestamp || email.sent_timestamp === 0) {
            console.warn(`Sent email ${email.id} has no valid timestamp, fixing:`, email.sent_at);
            return {
              ...email,
              sent_timestamp: new Date(email.sent_at).getTime() || Date.now() - 10000
            };
          }
          return email;
        });
        
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
        
        // Verify sorting worked correctly
        if (sortedSent.length > 1) {
          console.log('Verifying sent email sort order (legacy format):');
          for (let i = 0; i < Math.min(sortedSent.length, 5); i++) {
            console.log(`  ${i}: ${sortedSent[i].subject} - ${sortedSent[i].sent_at} (${sortedSent[i].sent_timestamp})`);
          }
          
          // Check if sorting is correct (newer emails should come first)
          let sortingIssue = false;
          for (let i = 1; i < sortedSent.length; i++) {
            const current = sortedSent[i].sent_timestamp || 0;
            const prev = sortedSent[i-1].sent_timestamp || 0;
            if (current > prev) {
              console.error(`Sorting issue detected at index ${i}: ${sortedSent[i].subject} (${current}) is newer than ${sortedSent[i-1].subject} (${prev})`);
              sortingIssue = true;
            }
          }
          
          if (sortingIssue) {
            console.warn('Re-sorting sent emails using timestamp only...');
            // Force sorting using only timestamp, most recent first
            sortedSent.sort((a, b) => (b.sent_timestamp || 0) - (a.sent_timestamp || 0));
          }
        }
        
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
