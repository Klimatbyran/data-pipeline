import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { registry } from './openapi/registry'

const generator = new OpenApiGeneratorV3(registry.definitions)

export const swaggerOptions = {
  definition: {
    ...generator.generateDocument({
      openapi: '3.0.0',
      info: {
        title: 'Klimatkollen API',
        version: '1.0.0',
        license: {
          name: 'Apache 2.0',
          url: 'http://www.apache.org/licenses/LICENSE-2.0.html',
        },
        description: `
![Klimatkollen Logo](https://beta.klimatkollen.se/klimatkollen_logo.svg)

The Klimatkollen API provides access to company emissions and economic data. This API allows you to retrieve, create and update information about companies' environmental impact and sustainability initiatives.

## Getting Started

To use the API, you'll need to:

1. Request an API key by contacting our team
2. Include your API key in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Authentication

All endpoints require authentication using a Bearer token. Include your API key in the Authorization header of each request.

## Rate Limiting

PLEAE NOTE: The API is rate limited to 100 requests per minute.

## Resources

* [Klimatkollen Website](https://klimatkollen.se)
* [API Terms of Service](https://klimatkollen.se/terms)
* [Contact Support](mailto:hej@klimatkollen.se)

## Authentication
All endpoints require authentication using a JWT Bearer token. To get a token:
1. Login via GitHub OAuth at \`/api/auth/github\`
2. Use the returned JWT token in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_JWT_TOKEN
\`\`\`

## Examples

### Fetch Company Data

\`\`\`bash
curl -X GET "https://api.klimatkollen.se/api/companies/Q123" \\
     -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

### Update Company Emissions

\`\`\`bash
curl -X POST "https://api.klimatkollen.se/api/companies/Q123/reporting-periods" \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"reportingPeriods": [...]}'
\`\`\`
`,
      },
      servers: [
        {
          url: '/api',
          description: 'API endpoint',
        },
      ],

      security: [
        {
          bearerAuth: [],
        },
      ],
    }),
  },
  apis: ['./src/routes/**/*.ts', './src/routes/companies/*.ts'],
}
