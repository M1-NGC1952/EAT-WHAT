export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({version:'soft-rejection-20261026',commit:process.env.COMMIT_REF??process.env.VERCEL_GIT_COMMIT_SHA??'unavailable'}, {headers:{'cache-control':'no-store'}});
}
