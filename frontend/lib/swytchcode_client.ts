import { api } from "./api";

/**
 * Frontend Swytchcode execution layer wrapper.
 * Delegates canonical emergency workflows and alerts through Swytchcode runtime / API proxy.
 */
export async function executeSwytchcodeAction(
  canonicalId: string,
  args: Record<string, any>
) {
  try {
    const result = await api.dispatchSwytchcodeEmergency({
      method: canonicalId,
      ...args,
    });
    return result;
  } catch (error) {
    console.error(`[Swytchcode Error] Failed to execute ${canonicalId}:`, error);
    throw error;
  }
}
