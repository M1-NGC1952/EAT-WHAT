import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCategory,categoryOf,swapRestaurant,DEFAULTS} from '../app/recommendation.ts';
import {GET} from '../app/api/context/route.ts';
const shop=(id,name='测试拉面')=>({id,name,cuisine:'餐饮服务;中餐厅',distance:100,price:null});
test('dumpling, noodles, burger and pizza have separate evidence',()=>{
 assert.equal(categoryOf(shop('d','饺子馆')).id,'dumplings');
 assert.equal(matchCategory(shop('d','饺子馆'),'noodles'),null);
 assert.equal(matchCategory(shop('b','中餐厅'),'noodles'),null);
 assert.equal(categoryOf(shop('p','披萨店')).id,'pizza');
 assert.equal(categoryOf(shop('b','汉堡店')).id,'burger');
 assert.equal(matchCategory(shop('n'),'noodles').kind,'name');
 assert.equal(matchCategory({...shop('n'),cuisine:'餐饮;面馆'},'noodles').kind,'classification');
 assert.equal(matchCategory(shop('n'),'noodles').raw,'测试拉面');
});
test('swap never returns current, and single and exhausted are distinct',()=>{
 const a=shop('a'),b=shop('b'),c=shop('c');
 assert.equal(swapRestaurant([a],DEFAULTS,[],'a').state,'single');
 assert.equal(swapRestaurant([a,b],DEFAULTS,['a','b'],'b').state,'exhausted');
 assert.equal(swapRestaurant([a,b,c],DEFAULTS,['a'],'a',()=>0).restaurant.id,'b');
 assert.notEqual(swapRestaurant([a,b],DEFAULTS,[],'a',()=>0).restaurant.id,'a');
});
test('direction search sends keywords and bounded pagination, rejects unrelated POIs',async()=>{
 const old=globalThis.fetch, key=process.env.AMAP_WEB_KEY;process.env.AMAP_WEB_KEY='test-only-key';
 globalThis.fetch=async input=>{const u=new URL(input);assert.equal(u.searchParams.get('page'),'3');assert.equal(u.searchParams.get('offset'),'25');assert.ok(u.searchParams.get('keywords').includes('面馆'));return Response.json({status:'1',pois:[{id:'n',name:'真实拉面',type:'中餐厅',location:'121,31',distance:'100'},{id:'d',name:'饺子馆',type:'中餐厅',location:'121,31',distance:'120'}]});};
 try{const r=await GET(new Request('https://test/api/context?lat=31&lon=121&system=gcj02&category=noodles&page=3'));const b=await r.json();assert.equal(r.status,200);assert.equal(b.restaurants.length,1);assert.equal(b.inspected,2);assert.equal(b.unmatched,1);assert.equal(b.hasMore,false);
 for(const query of ['category=unknown','category=noodles&page=4','category=noodles&page=1.5'])assert.equal((await GET(new Request('https://test/api/context?lat=31&lon=121&'+query))).status,400);
 }finally{globalThis.fetch=old;if(key===undefined)delete process.env.AMAP_WEB_KEY;else process.env.AMAP_WEB_KEY=key;}
});
