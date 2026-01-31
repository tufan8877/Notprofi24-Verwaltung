import { z } from 'zod';
import { 
  insertPropertyManagerSchema, 
  insertPrivateCustomerSchema, 
  insertCompanySchema, 
  insertJobSchema, 
  propertyManagers, 
  privateCustomers, 
  companies, 
  jobs, 
  invoices
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  })
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/me',
      responses: {
        200: z.object({ email: z.string() }),
        401: errorSchemas.unauthorized,
      }
    }
  },
  propertyManagers: {
    list: {
      method: 'GET' as const,
      path: '/api/property-managers',
      responses: {
        200: z.array(z.custom<typeof propertyManagers.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/property-managers',
      input: insertPropertyManagerSchema,
      responses: {
        201: z.custom<typeof propertyManagers.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/property-managers/:id',
      input: insertPropertyManagerSchema.partial(),
      responses: {
        200: z.custom<typeof propertyManagers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/property-managers/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  privateCustomers: {
    list: {
      method: 'GET' as const,
      path: '/api/private-customers',
      responses: {
        200: z.array(z.custom<typeof privateCustomers.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/private-customers',
      input: insertPrivateCustomerSchema,
      responses: {
        201: z.custom<typeof privateCustomers.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/private-customers/:id',
      input: insertPrivateCustomerSchema.partial(),
      responses: {
        200: z.custom<typeof privateCustomers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/private-customers/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  companies: {
    list: {
      method: 'GET' as const,
      path: '/api/companies',
      responses: {
        200: z.array(z.custom<typeof companies.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/companies',
      input: insertCompanySchema,
      responses: {
        201: z.custom<typeof companies.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/companies/:id',
      input: insertCompanySchema.partial(),
      responses: {
        200: z.custom<typeof companies.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/companies/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  jobs: {
    list: {
      method: 'GET' as const,
      path: '/api/jobs',
      responses: {
        200: z.array(z.custom<typeof jobs.$inferSelect & { company?: typeof companies.$inferSelect, propertyManager?: typeof propertyManagers.$inferSelect, privateCustomer?: typeof privateCustomers.$inferSelect }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/jobs/:id',
      responses: {
        200: z.custom<typeof jobs.$inferSelect & { company?: typeof companies.$inferSelect, propertyManager?: typeof propertyManagers.$inferSelect, privateCustomer?: typeof privateCustomers.$inferSelect }>(),
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/jobs',
      input: insertJobSchema,
      responses: {
        201: z.custom<typeof jobs.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/jobs/:id',
      input: insertJobSchema.partial(),
      responses: {
        200: z.custom<typeof jobs.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    generatePdf: {
      method: 'POST' as const,
      path: '/api/jobs/:id/pdf',
      responses: {
        200: z.any(), // Binary PDF
      }
    },
    sendEmail: {
      method: 'POST' as const,
      path: '/api/jobs/:id/email',
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
      }
    }
  },
  invoices: {
    list: {
      method: 'GET' as const,
      path: '/api/invoices',
      responses: {
        200: z.array(z.custom<typeof invoices.$inferSelect & { company: typeof companies.$inferSelect }>()),
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/invoices/generate',
      input: z.object({ monthYear: z.string() }),
      responses: {
        200: z.object({ generatedCount: z.number(), message: z.string() }),
      }
    },
    markPaid: {
      method: 'POST' as const,
      path: '/api/invoices/:id/paid',
      responses: {
        200: z.custom<typeof invoices.$inferSelect>(),
      }
    },
    generatePdf: {
      method: 'POST' as const,
      path: '/api/invoices/:id/pdf',
      responses: {
        200: z.any(), // Binary PDF
      }
    },
    sendEmail: {
      method: 'POST' as const,
      path: '/api/invoices/:id/email',
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
      }
    }
  },
  stats: {
    dashboard: {
      method: 'GET' as const,
      path: '/api/stats/dashboard',
      responses: {
        200: z.object({
          openJobs: z.number(),
          doneJobsMonth: z.number(),
          unpaidInvoices: z.number(),
          monthlyRevenue: z.number(),
        })
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
