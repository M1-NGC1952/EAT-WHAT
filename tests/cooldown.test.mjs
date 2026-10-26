import assert from 'node:assert/strict';
import test from 'node:test';
import { nextDirection, finalRestaurant, DEFAULTS } from '../app/recommendation.ts';
test('soft cooldown never exhausts available directions',()=>{
 const ids=['rice','noodles','light'];let previous='rice',recent=[];
 for(let n=0;n<100;n++){const next=nextDirection(ids,previous,recent,()=>0);assert.ok(ids.includes(next));assert.notEqual(next,previous);recent=[...recent,previous].slice(-2);previous=next;}
 assert.equal(nextDirection(['rice'],'rice',['rice'],()=>0),'rice');
});
test('last choice respects strict price, range, closing time and explicit session skips',()=>{
 const now=new Date('2026-10-26T07:25:00Z');
 const base={id:'ok',name:'面馆',cuisine:'noodle',latitude:31,longitude:121,distance:500,openingHours:'24/7',hoursKind:'weekly',timeZone:'Asia/Shanghai',price:25,source:'OpenStreetMap',sourceUrl:'',checkedAt:now.toISOString(),address:'',coordinateSystem:'wgs84'};
 const pool=[{...base,id:'cheap-but-closing',distance:10,openingHours:'10:00-15:30'},{...base,id:'expensive',distance:20,price:90},{...base,id:'far',distance:3000},base];
 const c={...DEFAULTS,budget:30,strictBudget:true};
 assert.equal(finalRestaurant(pool,c,now,null).id,'ok');
 assert.equal(finalRestaurant(pool,c,now,null,['noodles']),null);
 assert.equal(finalRestaurant(pool.slice(0,3),c,now,null),null);
 assert.equal(finalRestaurant(pool,c,now,null,[]).id,'ok');
 assert.equal(c.budget,30);assert.equal(c.radius,1200);assert.equal(c.strictBudget,true);
});
