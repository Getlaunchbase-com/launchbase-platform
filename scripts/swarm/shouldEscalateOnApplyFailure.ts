/**
 * Determines if an apply failure should trigger context escalation.
 */

export function shouldEscalateOnApplyFailure(stderr: string, patchText?: string): boolean {
  const stderrLower = (stderr ?? "").toLowerCase();
  const patch = patchText ?? "";
  
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
  if (patch.includes("new file mode") && patch.includes("--- /dev/null")) {
    return true;
  }
  
  return false;
}
