import { cva } from "class-variance-authority"

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",

        // Customer Type Variants
        "customer-retail":
          "border-transparent text-white hover:opacity-80",
        "customer-grocer":
          "border-transparent text-white hover:opacity-80",
        "customer-restaurant":
          "border-transparent text-white hover:opacity-80",
        "customer-distributor":
          "border-transparent text-white hover:opacity-80",

        // Status Indicator Variants
        "status-pending":
          "border-transparent hover:opacity-80",
        "status-packed":
          "border-transparent hover:opacity-80",
        "status-delivered":
          "border-transparent hover:opacity-80",
        "status-collected":
          "border-transparent hover:opacity-80",
        "status-sent":
          "border-transparent hover:opacity-80",
        "status-invoiced":
          "border-transparent hover:opacity-80",
        "status-paid":
          "border-transparent hover:opacity-80",

        // GoCardless Status Variants
        "gc-success":
          "border-transparent bg-green-100 text-green-800 hover:opacity-80",
        "gc-pending":
          "border-transparent bg-yellow-100 text-yellow-800 hover:opacity-80",
        "gc-failed":
          "border-transparent bg-red-100 text-red-800 hover:opacity-80",
        "gc-cancelled":
          "border-transparent bg-gray-100 text-gray-800 hover:opacity-80",

        // Payment Source Variants (neutral gray per Style Guide)
        "payment-source-xero":
          "border-transparent bg-gray-100 text-gray-800 hover:opacity-80",
        "payment-source-gocardless":
          "border-transparent bg-gray-100 text-gray-800 hover:opacity-80",
        "payment-source-manual":
          "border-transparent bg-gray-100 text-gray-800 hover:opacity-80",
        "payment-source-bank":
          "border-transparent bg-gray-100 text-gray-800 hover:opacity-80",

        // Recurring Order Variant (green to indicate standing/scheduled)
        "recurring":
          "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",

        // Generic Status Variants
        "success":
          "border-transparent bg-green-100 text-green-800 hover:opacity-80",
        "warning":
          "border-transparent bg-amber-100 text-amber-800 hover:opacity-80",
        "error":
          "border-transparent bg-red-100 text-red-800 hover:opacity-80",
        "info":
          "border-transparent bg-blue-100 text-blue-800 hover:opacity-80",

        // Invoice Status Variants (US-REC-001)
        "invoice-draft":
          "border-transparent bg-gray-100 text-gray-700 hover:opacity-80",
        "invoice-sent":
          "border-transparent bg-blue-100 text-blue-800 hover:opacity-80",
        "invoice-unpaid":
          "border-transparent bg-amber-100 text-amber-800 hover:opacity-80",
        "invoice-partially-paid":
          "border-transparent bg-purple-100 text-purple-800 hover:opacity-80",
        "invoice-paid":
          "border-transparent bg-green-100 text-green-800 hover:opacity-80",
        "invoice-written-off":
          "border-transparent bg-slate-100 text-slate-700 hover:opacity-80",
        "invoice-voided":
          "border-transparent bg-red-100 text-red-800 hover:opacity-80",
        "invoice-failed":
          "border-transparent bg-red-100 text-red-800 hover:opacity-80",

        // Credit Note Type Variants (US-REC-001)
        "credit-note-write-off":
          "border-transparent bg-slate-100 text-slate-700 hover:opacity-80",
        "credit-note-adjustment":
          "border-transparent bg-amber-100 text-amber-800 hover:opacity-80",
        "credit-note-refund":
          "border-transparent bg-blue-100 text-blue-800 hover:opacity-80",
        "credit-note-goodwill":
          "border-transparent bg-green-100 text-green-800 hover:opacity-80",
        "credit-note-legacy-settlement":
          "border-transparent bg-purple-100 text-purple-800 hover:opacity-80",

        // Strain Origin Variants
        "strain-native":
          "border-emerald-200 bg-emerald-100 text-emerald-700 hover:opacity-80",
        "strain-commercial":
          "border-sky-200 bg-sky-100 text-sky-700 hover:opacity-80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)