import { GET as getDisputes, POST as createDispute } from '@/app/api/disputes/route';

// Legacy compatibility endpoint.
// Keep /api/litiges mapped to the canonical disputes workflow.
export const GET = getDisputes;
export const POST = createDispute;
