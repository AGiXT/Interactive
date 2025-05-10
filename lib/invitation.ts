// lib/invitation.ts
import { setCookie } from 'cookies-next';

/**
 * Function to handle invitation URL parameters
 * This function should be called on the client-side in pages that need to handle invitations
 * @returns {boolean} Whether an invitation was processed
 */
export function handleInvitationParams(): boolean {
  if (typeof window === 'undefined') {
    return false; // Not running in browser
  }
  
  // Get the current URL and parse the search parameters
  const url = new URL(window.location.href);
  const params = url.searchParams;
  
  // Check if invitation_id and email parameters exist
  if (params.has('invitation_id') && params.has('email')) {
    const invitationId = params.get('invitation_id');
    const email = params.get('email');
    const company = params.get('company') || '';
    
    // Store these values in cookies
    setCookie('invitation', invitationId, { maxAge: 86400 });
    setCookie('email', email, { maxAge: 86400 });
    if (company) {
      setCookie('company', company, { maxAge: 86400 });
    }
    
    return true;
  }
  
  return false;
}
