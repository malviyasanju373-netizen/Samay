/**
 * Utilities for member identification and display
 */

export interface MemberIdentifier {
  displayName: string;
  secondaryId: string;
}

/**
 * Get member identification with secondary identifier
 * Priority: email > username > last 6 chars of uid
 * 
 * @param displayName - The primary display name
 * @param uid - The user's unique identifier
 * @param email - The user's email (optional)
 * @param username - The user's username (optional)
 * @returns Object with displayName and secondaryId
 */
export function getMemberIdentification(
  displayName: string | undefined,
  uid: string,
  email?: string,
  username?: string
): MemberIdentifier {
  const name = displayName || "User";
  let secondaryId = "";

  if (email && email.trim()) {
    secondaryId = email;
  } else if (username && username.trim()) {
    secondaryId = username;
  } else {
    // Last 6 characters of uid
    secondaryId = uid.slice(-6);
  }

  return { displayName: name, secondaryId };
}

/**
 * Get only the secondary identifier
 */
export function getSecondaryIdentifier(
  uid: string,
  email?: string,
  username?: string
): string {
  if (email && email.trim()) {
    return email;
  } else if (username && username.trim()) {
    return username;
  }
  return uid.slice(-6);
}
