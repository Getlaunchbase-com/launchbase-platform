/**
 * Determines if an apply failure should trigger context escalation.
 */

export function shouldEscalateOnApplyFailure(stderr: string, patchText: string): boolean {
  const stderrLower = stderr.toLowerCase();
  
  // Trigger patterns in stderr
  const triggerPatterns = [
    "depends on old contents",
    "patch does not apply",
    "corrupt patch",
    "rejected hunk",
    "can't find file to patch",
    "unrecognized input",
  ];
  
  if (triggerPatterns.some(pattern => stderrLower.includes(pattern))) {
    return true;
  }
  
  // Check if patch creates new files
  if (patchText.includes("new file mode") && patchText.includes("--- /dev/null")) {
    return true;
  }
  
  return false;
}
