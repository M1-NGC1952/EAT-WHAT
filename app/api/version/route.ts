export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({version:'simple-lunch-v4.1-20261104',commit:process.env.COMMIT_REF??process.env.VERCEL_GIT_COMMIT_SHA??'unavailable'}, {headers:{'cache-control':'no-store'}});
}

