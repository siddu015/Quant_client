// EmailService.ts
import { Email, SendEmailRequest } from '../types/Email';

const API_URL = 'http://localhost:8080';

export const EmailService = {
  // Get all emails (both sent and received)
  async getEmails(): Promise<{ sent: Email[], received: Email[] }> {
    try {
      const response = await fetch(`${API_URL}/api/emails`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch emails: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.success ? data : { sent: [], received: [] };
    } catch (error) {
      console.error('Error fetching emails:', error);
      return { sent: [], received: [] };
    }
  },
  
  // Get a specific email by ID
  async getEmail(id: number): Promise<Email | null> {
    try {
      const response = await fetch(`${API_URL}/api/emails/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch email: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.success ? data.email : null;
    } catch (error) {
      console.error(`Error fetching email ${id}:`, error);
      return null;
    }
  },
  
  // Send a new email
  async sendEmail(emailRequest: SendEmailRequest): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/emails`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailRequest),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  },
};
