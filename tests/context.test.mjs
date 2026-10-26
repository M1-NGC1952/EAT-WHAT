import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../app/api/context/route.ts';
test('invalid coordinates are rejected without querying providers',async()=>{
 const response=await GET(new Request('https://example.test/api/context?lat=&lon='));assert.equal(response.status,400);
});
test('real provider records retain source, unknown price and opening hours; fallback uses bounded POST',async()=>{
 const previous=globalThis.fetch;const key=process.env.AMAP_WEB_KEY;delete process.env.AMAP_WEB_KEY;const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return calls.length===1?new Response('busy',{status:503}):Response.json({elements:[{id:123,type:'node',lat:31.2304,lon:121.4737,tags:{name:'Provider fixture restaurant',cuisine:'noodle',opening_hours:'Mo-Su 10:00-15:30'}},{id:124,type:'node',lat:31.2304,lon:121.4737,tags:{name:'Closed fixture',disused:'yes'}}]});};
 try{
  const response=await GET(new Request('https://example.test/api/context?lat=31.2304&lon=121.4737'));
  const payload=await response.json();assert.equal(response.status,200);assert.equal(payload.restaurants.length,1);
  const r=payload.restaurants[0];assert.equal(r.id,'node-123');assert.equal(r.price,null);assert.equal(r.openingHours,'Mo-Su 10:00-15:30');assert.equal(r.source,'OpenStreetMap');assert.equal(r.coordinateSystem,'wgs84');assert.equal(calls.length,2);assert.ok(calls.every(c=>c.options.method==='POST'));assert.equal('delivery' in r,false);
 }finally{globalThis.fetch=previous;if(key!==undefined)process.env.AMAP_WEB_KEY=key;}
});
test('provider outage returns explicit error and no invented restaurants',async()=>{
 const previous=globalThis.fetch;const key=process.env.AMAP_WEB_KEY;delete process.env.AMAP_WEB_KEY;globalThis.fetch=async()=>{throw Error('offline')};
 try{const response=await GET(new Request('https://example.test/api/context?lat=31&lon=121'));assert.equal(response.status,503);assert.deepEqual((await response.json()).restaurants,[]);}
 finally{globalThis.fetch=previous;if(key!==undefined)process.env.AMAP_WEB_KEY=key;}
});
