import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes (shadcn-style utility). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
