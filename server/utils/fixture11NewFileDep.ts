/**
 * Fixture 11: New File Dependency Context
 * Tests escalation ladder when creating a new file that existing code depends on.
 * Error: Cannot find name 'formatPhoneNumber'
 */

export function createContact(name: string, phone: string) {
  // Error: formatPhoneNumber is not imported
  const formatted = formatPhoneNumber(phone);
  
  return { name, phone: formatted };
}
