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
        
        const sent = data.emails.filter((email: Email) => 
          email.sender_email === userEmail
        );
        const received = data.emails.filter((email: Email) => 
          email.recipient_email === userEmail
        );
        
        console.log(`Categorized ${sent.length} sent and ${received.length} received emails`);
        return { sent, received };
      }
      
      // Handle legacy format if it exists
      if (Array.isArray(data.sent) && Array.isArray(data.received)) {
        console.log('Using legacy email format');
        return data;
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
      
      return data.email;
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
};
