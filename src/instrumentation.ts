export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Just ensure Prisma client is ready - don't test connection
    // Connection will be tested on first actual query
    console.log('🚀 Application starting...');
  }
}
