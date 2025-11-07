import { z } from 'zod';

export const productSchema = z.object({
  // Required fields
  title: z.string().min(1, "Title is required"),
  brand: z.string().min(1, "Brand is required"),
  price: z.number().positive("Price must be greater than 0"),
  model_number: z.string().min(1, "Model number is required"),
  
  // Optional fields - strings
  type: z.string().optional(),
  configuration: z.string().optional(),
  fuel: z.string().optional(),
  unit_type: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  description_long: z.string().optional(),
  
  // Optional fields - numbers
  capacity: z.number().optional(),
  
  // Optional fields - JSON/objects
  dimensions: z.any().optional(),  // We'll refine this later if needed
  features: z.any().optional(),    // We'll refine this later if needed
});

// This creates a TypeScript type from the schema
export type ProductFormData = z.infer<typeof productSchema>;
