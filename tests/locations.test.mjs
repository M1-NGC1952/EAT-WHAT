import test from 'node:test';
import assert from 'node:assert/strict';
import {GET as reverse} from '../app/api/reverse/route.ts';
import {GET as locations} from '../app/api/locations/route.ts';
import {GET as context} from '../app/api/context/route.ts';
async function mock(key,fetcher,run){const before=globalThis.fetch,oldKey=process.env.AMAP_WEB_KEY;if(key)process.env.AMAP_WEB_KEY=key;else delete process.env.AMAP_WEB_KEY;globalThis.fetch=fetcher;try{await run();}finally{globalThis.fetch=before;if(oldKey===undefined)delete process.env.AMAP_WEB_KEY;else process.env.AMAP_WEB_KEY=oldKey;}}
test('missing address provider returns explicit setup error, without a fabricated address',async()=>{
 await mock(null,async()=>{throw Error('must not fetch')},async()=>{const r=await reverse(new Request('https://test/api/reverse?lat=31&lon=121'));const body=await r.json();assert.equal(r.status,503);assert.equal(body.code,'MAP_NOT_CONFIGURED');assert.equal(body.address,null);});
});
test('GPS coordinates are converted once and reverse result contains actual formatted address',async()=>{
 const calls=[];await mock('test-only-key',async input=>{const url=new URL(input);calls.push(url);return Response.json(url.pathname.includes('coordinate')?{status:'1',locations:'121.004000,31.005000'}:{status:'1',regeocode:{formatted_address:'测试市测试路1号'}})},async()=>{const r=await reverse(new Request('https://test/api/reverse?lat=31.123456789&lon=121.123456789'));const body=await r.json();assert.equal(r.status,200);assert.equal(body.address,'测试市测试路1号');assert.equal(calls[0].searchParams.get('locations'),'121.123457,31.123457');assert.equal(calls[1].searchParams.get('location'),'121.004000,31.005000');assert.ok(!JSON.stringify(body).includes('test-only-key'));});
});
test('concrete location search uses standard POI endpoint, not city geocoding',async()=>{
 await mock('test-only-key',async input=>{assert.equal(new URL(input).pathname,'/v3/place/text');return Response.json({status:'1',pois:[{id:'p',name:'测试商场',location:'121.47,31.23',address:'测试路1号',cityname:'上海市'}]})},async()=>{const r=await locations(new Request('https://test/api/locations?q=测试商场'));const b=await r.json();assert.equal(b.searchScope,'places');assert.equal(b.locations[0].isCity,false);assert.equal(b.locations[0].coordinateSystem,'gcj02');assert.equal(b.locations[0].latitude,31.23);});
});
test('restaurant POI response is usable without inventing unsupported hours',async()=>{
 await mock('test-only-key',async input=>{const url=new URL(input);assert.equal(url.pathname,'/v3/place/around');assert.equal(url.searchParams.get('extensions'),'all');return Response.json({status:'1',pois:[{id:'r',name:'测试面馆',location:'121.47,31.23',distance:'125',type:'餐饮服务;面馆',biz_ext:{cost:'25'}}]})},async()=>{const r=await context(new Request('https://test/api/context?lat=31.23&lon=121.47&system=gcj02'));const b=await r.json();assert.equal(r.status,200);assert.equal(b.restaurants.length,1);assert.equal(b.restaurants[0].price,25);assert.equal(b.restaurants[0].openingHours,null);});
});
test('provider permission failure is not disguised as an empty successful search',async()=>{
 await mock('test-only-key',async()=>Response.json({status:'0',infocode:'10001'}),async()=>{const r=await context(new Request('https://test/api/context?lat=31&lon=121&system=gcj02'));const b=await r.json();assert.equal(r.status,503);assert.equal(b.state,'error');assert.equal(b.code,'MAP_AUTHORIZATION');assert.deepEqual(b.restaurants,[]);assert.ok(!JSON.stringify(b).includes('test-only-key'));});
});
test('city fallback explicitly labels limited search scope',async()=>{
 await mock(null,async()=>Response.json({results:[]}),async()=>{const r=await locations(new Request('https://test/api/locations?q=测试商场'));const b=await r.json();assert.equal(b.searchScope,'cities');assert.equal(b.locations.length,0);assert.ok(b.message.includes('不能查询小区'));});
});
