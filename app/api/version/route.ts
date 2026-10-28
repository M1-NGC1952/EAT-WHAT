export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({version:'guided-lunch-v3-20261028',commit:process.env.COMMIT_REF??process.env.VERCEL_GIT_COMMIT_SHA??'unavailable'}, {headers:{'cache-control':'no-store'}});
}
