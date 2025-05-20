/**
 * Email notification utilities
 */

/**
 * Formats an email notification with the sender's name and a clickable link to Quant Client
 * 
 * @param senderName The name of the sender (not email address)
 * @param messageId The ID of the message to view
 * @returns Formatted notification text
 */
export const formatEmailNotification = (senderName: string, messageId: string): string => {
  return `You've received a new message from **${senderName}** via Quant Client.

To view the full message, please click here: [Quant Client](http://localhost:3000/?view=${messageId})

This is a notification email. The actual message content is securely stored in Quant Client.`;
};
