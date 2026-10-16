// utils.ts
// cn(): merges conditional class names and resolves conflicting Tailwind
// utilities (the later one wins), used by the chart components; and
// FIT_SCREEN, the height cap for charts sized by their width.
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// A chart sized by an aspect ratio grows with the page's width; on a short
// desktop window that pushes its panel past one screen. This caps the chart at
// the window's height less ~300px (the navbar, plus the panel's title, color
// key, and caption), so a whole chart panel fits on screen; it just gets wider
// in proportion. Desktop widths only: a phone turned sideways is too short to cap.
export const FIT_SCREEN = "lg:max-h-[calc(100svh-300px)]"
