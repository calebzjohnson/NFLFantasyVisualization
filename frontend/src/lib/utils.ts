// utils.ts
// cn(): merges conditional class names and resolves conflicting Tailwind
// utilities (the later one wins), used by the chart components.
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
