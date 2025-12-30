import { defineCollection, z } from 'astro:content';

const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    category: z.enum(['buying-guides', 'tutorials', 'comparisons', 'news']),
    tags: z.array(z.string()).optional(),
    featuredImage: z.string().optional(),
    readingTime: z.number().optional(),
    author: z.string().optional(),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { guides };
