// EmailService.ts
import { Email, SendEmailRequest, SaveDraftRequest, DeleteEmailRequest } from '../types/Email';

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
 * Format date to valid ISO string or return null if invalid
 * @param dateStr Date string to validate
 * @returns Original date string if valid, or null if invalid
 */
const formatValidDate = (dateStr: string | undefined): string | null => {
  if (!dateStr) {
    console.warn('Empty date received in formatValidDate');
    return null;
  }
  
  try {
    // Only validate the date, don't modify it if valid
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      // Return the original string, not a transformed version
      return dateStr;
    }
    
    console.warn('Invalid date detected in formatValidDate:', dateStr);
    return null; // Return null for invalid dates
  } catch (e) {
    console.error('Error parsing date in formatValidDate:', dateStr, e);
    return null; // Return null on error
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
    
    // Format dates - ensure sent_at is a valid date or keep original
    const formattedSentAt = formatValidDate(email.sent_at);
    
    // Parse sent_at as a timestamp for consistent sorting
    let sentTimestamp = 0;
    try {
      if (formattedSentAt) {
        sentTimestamp = new Date(formattedSentAt).getTime();
        // If date parsing fails, use a fallback timestamp
        if (isNaN(sentTimestamp)) {
          console.warn(`Invalid sent_at timestamp for email ${email.id}: ${formattedSentAt}`);
          sentTimestamp = 0;
        }
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
      sent_at: formattedSentAt || email.sent_at, // Keep original if validation failed
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
  // Get all emails (both sent and received) with pagination and refresh control
  async getEmails(page = 0, pageSize = 50, forceRefresh = false): Promise<{ sent: Email[], received: Email[], totalPages: number, currentPage: number, lastSync?: number }> {
    try {
      console.log(`Fetching emails: page=${page}, pageSize=${pageSize}, forceRefresh=${forceRefresh}`);
      
      // Add pagination and refresh parameters
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        force_refresh: forceRefresh.toString()
      });
      
      const response = await fetch(`${API_URL}/api/emails?${params.toString()}`, {
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

      // Cache hit indicated by the API
      if (data.cached) {
        console.log('Using cached email data from server');
      }

      // Handle the raw emails from the pagination-aware API response
      if (data.emails && Array.isArray(data.emails)) {
        // Get user info to properly categorize emails
        const userResponse = await fetch(`${API_URL}/api/user`, {
          credentials: 'include',
        });
        
        const userData: UserResponse = await userResponse.json();
        
        if (!userResponse.ok || !userData.authenticated || !userData.email) {
          console.error('Failed to get user email for categorization:', userData.message || 'Unknown error');
          throw new Error('Could not determine user email for categorizing emails');
        }
        
        const userEmail = userData.email;
        
        // Process all emails to add timestamps, format dates, etc.
        const processedEmails = processEmails(data.emails);
        
        // Split emails into sent and received
        const sent = processedEmails.filter(email => email.sender_email === userEmail);
        const received = processedEmails.filter(email => email.recipient_email === userEmail && email.sender_email !== userEmail);
        
        // Use the helper function defined at the bottom of this file
        const uniqueSent = _deduplicateEmails(sent);
        const uniqueReceived = _deduplicateEmails(received);
        
        // Sort emails by date
        const sortedSent = sortEmailsByDate(uniqueSent);
        const sortedReceived = sortEmailsByDate(uniqueReceived);
        
        // Log email counts for debug
        logEmailCounts(sortedSent, sortedReceived);
        
        // Return emails with pagination metadata
        return {
          sent: sortedSent,
          received: sortedReceived,
          totalPages: data.total_pages || 1,
          currentPage: data.current_page || 0,
          lastSync: data.last_sync
        };
      }
      
      throw new Error('Invalid email data format received from API');
    } catch (error) {
      console.error('Error fetching emails:', error);
      // Return empty result on error
      return { sent: [], received: [], totalPages: 1, currentPage: 0 };
    }
  },

  // Get a specific email by ID
  async getEmail(id: string): Promise<Email | null> {
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
      
      // Don't automatically refresh - let the user control when to refresh
      // Just return success immediately
      return true;
    } catch (error) {
      console.error('Error in sendEmail:', error);
      return false;
    }
  },
  
  // Refresh emails - optimized to only get new emails
  async refreshEmails(): Promise<{ success: boolean, newEmailCount: number, lastSync?: number }> {
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
        return { success: false, newEmailCount: 0 };
      }
      
      const data = await response.json();
      console.log('Email refresh response:', data);
      
      if (!data.success) {
        console.error('API returned unsuccessful response:', data.error || 'Unknown error');
        return { success: false, newEmailCount: 0 };
      }

      // Include more detailed result with last sync time
      return { 
        success: true, 
        newEmailCount: data.new_emails || 0,
        lastSync: data.last_sync
      };
    } catch (error) {
      console.error('Error refreshing emails:', error);
      return { success: false, newEmailCount: 0 };
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
      const email = await this.getEmail(emailId);
      
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
  },

  // Save email as draft
  async saveDraft(draftRequest: SaveDraftRequest): Promise<Email | null> {
    try {
      const response = await fetch(`${API_URL}/api/drafts`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftRequest),
      });

      if (!response.ok) {
        console.error('Failed to save draft:', response.statusText);
        throw new Error(`Failed to save draft: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        console.error('API returned unsuccessful response:', data.error || 'Unknown error');
        throw new Error(data.error || 'Failed to save draft');
      }

      return data.email || null;
    } catch (error) {
      console.error('Error saving draft:', error);
      return null;
    }
  },

  // Get all drafts
  async getDrafts(page = 0, pageSize = 50): Promise<{ drafts: Email[], totalPages: number, currentPage: number }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        drafts_only: 'true',
      });

      const response = await fetch(`${API_URL}/api/drafts?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch drafts:', response.statusText);
        throw new Error(`Failed to fetch drafts: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        console.error('API returned unsuccessful response:', data.error || 'Unknown error');
        throw new Error(data.error || 'Failed to fetch drafts');
      }

      return {
        drafts: processEmails(data.emails || []),
        totalPages: data.total_pages || 1,
        currentPage: data.current_page || 0,
      };
    } catch (error) {
      console.error('Error fetching drafts:', error);
      return { drafts: [], totalPages: 1, currentPage: 0 };
    }
  },

  // Delete email (move to trash or permanently delete)
  async deleteEmail(deleteRequest: DeleteEmailRequest): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/emails/${deleteRequest.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permanently_delete: deleteRequest.permanently_delete || false,
        }),
      });

      if (!response.ok) {
        console.error('Failed to delete email:', response.statusText);
        throw new Error(`Failed to delete email: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      console.error('Error deleting email:', error);
      return false;
    }
  },

  // Get emails in trash
  async getTrash(page = 0, pageSize = 50): Promise<{ emails: Email[], totalPages: number, currentPage: number }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        include_deleted: 'true',
      });

      const response = await fetch(`${API_URL}/api/trash?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch trash:', response.statusText);
        throw new Error(`Failed to fetch trash: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        console.error('API returned unsuccessful response:', data.error || 'Unknown error');
        throw new Error(data.error || 'Failed to fetch trash');
      }

      return {
        emails: processEmails(data.emails || []),
        totalPages: data.total_pages || 1,
        currentPage: data.current_page || 0,
      };
    } catch (error) {
      console.error('Error fetching trash:', error);
      return { emails: [], totalPages: 1, currentPage: 0 };
    }
  },

  // Restore email from trash
  async restoreFromTrash(emailId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/trash/${emailId}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to restore email:', response.statusText);
        throw new Error(`Failed to restore email: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      console.error('Error restoring email:', error);
      return false;
    }
  },
};

// Helper function to deduplicate emails by ID
const _deduplicateEmails = (emails: Email[]): Email[] => {
  const uniqueMap = new Map<string, Email>();
  
  emails.forEach(email => {
    const key = email.gmail_id || email.id;
    // Check if this email should replace existing one - either not present yet
    // or has a newer timestamp than the existing one
    const existingEmail = uniqueMap.get(key);
    if (!existingEmail || 
        (email.sent_timestamp && existingEmail.sent_timestamp && 
         email.sent_timestamp > existingEmail.sent_timestamp)) {
      uniqueMap.set(key, email);
    }
  });
  
  return Array.from(uniqueMap.values());
};
