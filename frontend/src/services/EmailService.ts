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
    
    // Use existing email data, but parse label_ids to determine properties
    const labelIds = email.label_ids || [];
    
    // Set important flag based on IMPORTANT or STARRED label
    const important = labelIds.includes(GMAIL_LABELS.IMPORTANT) || 
                       labelIds.includes(GMAIL_LABELS.STARRED);
    
    // Determine category from Gmail category labels
    let category = '';
    if (labelIds.includes(GMAIL_LABELS.CATEGORY_PERSONAL)) category = 'Personal';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_SOCIAL)) category = 'Social';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_UPDATES)) category = 'Updates';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_FORUMS)) category = 'Forums';
    else if (labelIds.includes(GMAIL_LABELS.CATEGORY_PROMOTIONS)) category = 'Promotions';
    
    // Enhanced email object with processed label data
    return {
      ...email,
      important,
      category: category || undefined
    };
  });
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
        
        // Process and categorize emails
        const processedEmails = processEmails(data.emails);
        
        const sent = processedEmails.filter((email: Email) => 
          email.sender_email === userEmail
        );
        const received = processedEmails.filter((email: Email) => 
          email.recipient_email === userEmail
        );
        
        // Sort emails by date, newest first
        sent.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
        received.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
        
        console.log(`Categorized ${sent.length} sent and ${received.length} received emails`);
        return { sent, received };
      }
      
      // Handle legacy format if it exists (process both sent and received arrays)
      if (Array.isArray(data.sent) && Array.isArray(data.received)) {
        console.log('Using legacy email format');
        
        // Process and sort both arrays
        const sent = processEmails(data.sent)
          .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
        
        const received = processEmails(data.received)
          .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
        
        return { sent, received };
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
      
      if (data.success) {
        // Force a refresh immediately after sending to get the latest emails
        await this.refreshEmails();
        return true;
      }
      
      console.error('Failed to send email:', data.error || 'Unknown error');
      return false;
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
  }
};
