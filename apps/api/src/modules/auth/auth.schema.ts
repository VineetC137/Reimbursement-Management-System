import { z } from "zod";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

export const signupSchema = z.object({
  companyName: z.string().trim().min(3, "Company name must be at least 3 characters").max(150, "Company name is too long"),
  countryCode: z.string().trim().min(2, "Select a country").max(3, "Country code is invalid"),
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(60, "First name is too long"),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(60, "Last name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password is too long")
    .regex(passwordRule, "Password must contain uppercase, lowercase, and a number")
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
