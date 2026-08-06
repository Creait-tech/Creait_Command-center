"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/**
 * Toolbar for the Executive Blueprint. Hidden in print — browser
 * print-to-PDF is the delivery mechanism.
 */
export function ReportToolbar({ assessmentId }: { assessmentId: string }) {
  return (
    <div className="no-print fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-3 bg-[#0a0e1a] px-4 py-2.5 text-sm text-white shadow-md">
      <Link
        href={`/assessments/${assessmentId}`}
        className="inline-flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to workbench
      </Link>
      <span className="hidden sm:block text-xs text-white/60">
        Print → Save as PDF is the delivery mechanism
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] px-3.5 py-1.5 font-semibold text-white hover:bg-[#2f6fdd] transition-colors"
      >
        <Printer className="size-4" /> Print / Save PDF
      </button>
    </div>
  );
}
