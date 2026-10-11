import { z } from "zod";

/** Shared by the enquiry form (client) and /api/enquiry (server). */
export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a phone number we can call or WhatsApp")
    .max(30)
    .regex(/^[+()\d\s-]+$/, "Use digits, spaces, + ( ) or - only"),
  email: z.email("Please enter a valid email address").max(200).optional().or(z.literal("")),
  goal: z.string().trim().min(1, "Pick the goal that fits best").max(80),
  time: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Honeypot. Real users never see or fill this. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type Enquiry = z.infer<typeof enquirySchema>;
export type EnquiryErrors = Partial<Record<keyof Enquiry, string>>;

export function fieldErrors(error: z.ZodError): EnquiryErrors {
  const out: EnquiryErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof Enquiry;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
