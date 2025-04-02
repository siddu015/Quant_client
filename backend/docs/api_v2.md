# Quantum Email Client API v2 - Filtering and Sorting

This document describes the extended API routes for the Quantum Email Client that support filtering and sorting emails.

## Email Filtering and Sorting

### Get Emails (with filtering)

**URL**: `/api/emails`

**Method**: `GET`

**Auth Required**: Yes (session cookie)

**Query Parameters**:

- `label` (optional): Filter emails by label ID
- `is_read` (optional): Filter by read status (`true` or `false`)
- `search` (optional): Search in subject, body, sender, or recipient
- `sender` (optional): Filter by sender email (partial match)
- `recipient` (optional): Filter by recipient email (partial match)
- `sort_by` (optional): Field to sort by (`date`, `sender`, or `subject`)
- `sort_order` (optional): Sort direction (`asc` or `desc`)
- `limit` (optional): Maximum number of emails to return
- `offset` (optional): Number of emails to skip

**Success Response**:

```json
{
  "success": true,
  "emails": [
    {
      "id": "uuid-string",
      "sender_id": "sender-id",
      "sender_email": "sender@example.com",
      "sender_name": "Sender Name",
      "recipient_email": "recipient@example.com",
      "subject": "Email Subject",
      "body": "Email Body",
      "sent_at": "2023-01-01T00:00:00Z",
      "read_at": "2023-01-01T01:00:00Z",
      "gmail_id": "gmail-message-id",
      "label_ids": ["INBOX", "IMPORTANT", "CATEGORY_PERSONAL"]
    }
  ],
  "source": "cache|gmail|database",
  "filtered": true
}
```

**Example Requests**:

1. Get all unread emails:

   ```
   GET /api/emails?is_read=false
   ```

2. Search emails containing "invoice":

   ```
   GET /api/emails?search=invoice
   ```

3. Get emails with a specific label, sorted by sender:

   ```
   GET /api/emails?label=IMPORTANT&sort_by=sender&sort_order=asc
   ```

4. Get emails from a specific sender:

   ```
   GET /api/emails?sender=example.com
   ```

5. Pagination example:
   ```
   GET /api/emails?limit=20&offset=40
   ```

## Gmail Query Syntax

When using the search parameter, you can use Gmail's advanced search operators:

- `from:` - Specify sender
- `to:` - Specify recipient
- `subject:` - Search in subject
- `has:attachment` - Emails with attachments
- `is:unread` - Unread emails
- `is:starred` - Starred emails
- `after:YYYY/MM/DD` - Emails after date
- `before:YYYY/MM/DD` - Emails before date

For example:

```
GET /api/emails?search=has:attachment after:2023/01/01
```

## Error Handling

If authentication fails or an error occurs, the API will return:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Details about the error (optional)"
}
```

## Notes on Caching

- For simple filtering requests, the server may return cached data for better performance
- For complex filtering or sorting, the server will fetch fresh data from Gmail API
- Use `/api/emails/refresh` endpoint to force a refresh of email data
