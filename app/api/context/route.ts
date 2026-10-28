import { amap,mapKey,mapCoordinates,MapServiceError } from '../amap.ts';
import type { Restaurant } from '../../recommendation';
export const dynamic = 'force-dynamic';
const timeoutFetch=(url:string,ms=6500)=>fetch(url,{signal:AbortSignal.timeout(ms),headers:{accept:'application/json'},cache:'no-store'});
function distance(a:number,b:number,c:number,d:number){const rad=(v:number)=>v*Math.PI/180;const k=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return Math.round(6371000*2*Math.atan2(Math.sqrt(k),Math.sqrt(1-k)));}
async function places(lat:number,lon:number,radius:number,system:string) {
  if(mapKey()) {
    const location=await mapCoordinates(lat,lon,system);
    const body=await amap('/v3/place/around',{location,radius:String(radius),types:'050000',extensions:'all',offset:'25',page:'1',sortrule:'distance'});
    if(!Array.isArray(body.pois))throw new MapServiceError('MAP_UNAVAILABLE','餐厅服务响应异常，请稍后重试。');
    const restaurants:Restaurant[]=body.pois.flatMap((p:{id:string;name:string;location:string;type?:string;distance?:string;address?:string;biz_ext?:{cost?:string}})=>{
      if(typeof p.location!=='string'||typeof p.name!=='string')return [];
      const [longitude,latitude]=p.location.split(',').map(Number);const meters=Number(p.distance),price=Number(p.biz_ext?.cost);
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(meters)||meters<0||meters>radius)return [];
      return [{id:`amap-${p.id}`,name:p.name,cuisine:p.type??'',distance:meters,latitude,longitude,coordinateSystem:'gcj02',openingHours:null,hoursKind:'weekly',timeZone:'Asia/Shanghai',price:price>0?price:null,source:'高德地图',sourceUrl:`https://uri.amap.com/marker?position=${longitude},${latitude}&name=${encodeURIComponent(p.name)}&coordinate=gaode`,checkedAt:new Date().toISOString(),address:typeof p.address==='string'?p.address:''}];
    });
    return {restaurants,provider:'高德地图',state:restaurants.length?'ready':'empty',message:restaurants.length?'已取得真实餐厅。营业时段未返回时，请出发前核实。':'查询成功，但这个范围内没有返回餐厅，可以扩大范围再查。'};
  }
  if(system==='gcj02')throw new MapServiceError('MAP_NOT_CONFIGURED','此起点的餐厅查询服务尚未开通，请联系站点维护者。');
  const query=`[out:json][timeout:5];nwr["amenity"~"^(restaurant|fast_food|food_court)$"](around:${radius},${lat},${lon});out center tags 60;`;
  let body:{elements?:unknown[];remark?:string}|null=null;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
    try{
      const response=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers:{accept:'application/json','user-agent':'LunchPicker/2.0 (https://github.com/M1-NGC1952/EAT-WHAT)'},signal:AbortSignal.timeout(7000),cache:'no-store'});
      if(!response.ok)continue;
      const result=await response.json();if(Array.isArray(result.elements)&&!result.remark){body=result;break;}
    }catch{}
  }
  if(!body)throw Error('places');
  const restaurants:Restaurant[]=(body.elements??[]).flatMap<Restaurant>((item)=>{
    const p=item as {id:number;type:string;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};
    const t=p.tags??{},latitude=p.lat??p.center?.lat,longitude=p.lon??p.center?.lon;
    if(!t.name||latitude===undefined||longitude===undefined||t.disused==='yes'||t['disused:amenity']||t['abandoned:amenity'])return [];
    const meters=distance(lat,lon,latitude,longitude);if(meters>radius)return [];
    return [{id:`${p.type}-${p.id}`,name:t.name,cuisine:t.cuisine??'',latitude,longitude,distance:meters,coordinateSystem:'wgs84',openingHours:t.opening_hours??null,hoursKind:'weekly',timeZone:null,price:null,source:'OpenStreetMap',sourceUrl:`https://www.openstreetmap.org/${p.type}/${p.id}`,checkedAt:new Date().toISOString(),address:t['addr:full']??[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(' ')}];
  }).sort((a:Restaurant,b:Restaurant)=>a.distance-b.distance);
  return {restaurants,provider:'OpenStreetMap',message:restaurants.length?'公开数据可能缺少价格及营业时段，出发前请核实。':'公开数据暂未覆盖附近餐厅，可扩大范围或打开地图查找。'};
}
export async function GET(request:Request){
  const p=new URL(request.url).searchParams;
  const lat=Number(p.get('lat')),lon=Number(p.get('lon'));
  if(!p.has('lat')||!p.has('lon')||!p.get('lat')?.trim()||!p.get('lon')?.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return Response.json({error:'定位坐标无效。'},{status:400});
  const radius=Math.min(3000,Math.max(300,Number(p.get('radius'))||1200));
  if(p.get('part')==='weather'){
    try{
      const params=new URLSearchParams({latitude:String(lat),longitude:String(lon),current:'temperature_2m,precipitation,weather_code',timezone:'auto',forecast_days:'1'});
      const response=await timeoutFetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if(!response.ok)throw Error('weather');const body=await response.json();
      return Response.json({weather:body.current??null,timeZone:typeof body.timezone==='string'?body.timezone:null},{headers:{'cache-control':'no-store'}});
    }catch{return Response.json({weather:null,timeZone:null},{headers:{'cache-control':'no-store'}});}
  }
  try{return Response.json(await places(lat,lon,radius,p.get('system')??'wgs84'),{headers:{'cache-control':'no-store'}});}
  catch(error){return Response.json({restaurants:[],state:'error',code:error instanceof MapServiceError?error.code:(!mapKey()?'MAP_NOT_CONFIGURED':'NEARBY_UNAVAILABLE'),message:error instanceof MapServiceError?error.message:(!mapKey()?'附近餐厅查询暂不可用，站点尚未开通国内地图数据服务。':'附近餐饮服务暂时不可用，请稍后重试。')},{status:503,headers:{'cache-control':'no-store'}});}
}
