import { isAxiosError } from "axios";
import type { ApiErrorBody } from "../types";

/** Extract the backend's `message` from an axios error, or fall back. */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (isAxiosError<ApiErrorBody>(err)) {
    const serverMessage = err.response?.data?.message;
    if (serverMessage) return serverMessage;

    // No JSON body: explain the common causes instead of a generic failure
    if (!err.response) return `${fallback}: the server is unreachable (it may be waking up, try again)`;
    if (err.response.status === 404) return `${fallback}: this feature isn't available on the server yet`;
    return `${fallback} (error ${err.response.status})`;
  }
  return fallback;
};

/** socket.io's emitWithAck timeout error. */
export const isAckTimeout = (err: unknown) =>
  err instanceof Error && /timed out/i.test(err.message);

export const getErrorStatus = (err: unknown): number | undefined =>
  isAxiosError(err) ? err.response?.status : undefined;
