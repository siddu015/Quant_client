/**
 * Utility function to ensure Google profile URLs are properly formatted
 */
export const formatGoogleProfileUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  // Handle newer Google profile URL format
  if (url.includes('googleusercontent.com')) {
    // Use a larger image size (s256-c instead of s96-c)
    const updatedUrl = url.replace(/=s\d+-c/, "=s256-c");
    // Double-check that the URL is using HTTPS
    return updatedUrl.replace(/^http:\/\//, "https://");
  }
  
  return url;
}; 