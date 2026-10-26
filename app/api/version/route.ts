export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({version:'random-first-20261026',commit:process.env.COMMIT_REF??process.env.VERCEL_GIT_COMMIT_SHA??'local'}, {headers:{'cache-control':'no-store'}});
}
