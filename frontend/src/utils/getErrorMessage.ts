import { isAxiosError } from "axios";
import type { ApiErrorBody } from "../types";

/** Extract the backend's `message` from an axios error, or fall back. */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (isAxiosError<ApiErrorBody>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
};

export const getErrorStatus = (err: unknown): number | undefined =>
  isAxiosError(err) ? err.response?.status : undefined;
