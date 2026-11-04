export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({version:'simple-lunch-v4.1-1000-dishes',commit:process.env.COMMIT_REF??process.env.VERCEL_GIT_COMMIT_SHA??'unavailable'}, {headers:{'cache-control':'no-store'}});
}



