import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  company: z.string().optional(),
  value: z.number().optional(),
  notes: z.string().optional(),
});



export const addActivitySchema = z.object({
  type: z.string().min(1, 'Type is required'),
  text: z.string().min(1, 'Text is required'),
});
