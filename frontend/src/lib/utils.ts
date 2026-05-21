import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { AxiosError } from "axios";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as AxiosError<{ detail?: string }>;
    return axiosErr.response?.data?.detail ?? axiosErr.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
