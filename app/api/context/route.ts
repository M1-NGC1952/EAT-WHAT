import type { Restaurant } from '../../recommendation';
export const dynamic = 'force-dynamic';
const timeoutFetch=(url:string,ms=6500)=>fetch(url,{signal:AbortSignal.timeout(ms),headers:{accept:'application/json'},cache:'no-store'});
function distance(a:number,b:number,c:number,d:number){const rad=(v:number)=>v*Math.PI/180;const k=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return Math.round(6371000*2*Math.atan2(Math.sqrt(k),Math.sqrt(1-k)));}
async function places(lat:number,lon:number,radius:number,system:string) {
  const key=process.env.AMAP_WEB_KEY;
  if(key) {
    try {
      let location=`${lon},${lat}`;
      if(system!=='gcj02'){
        const converted=await (await timeoutFetch(`https://restapi.amap.com/v3/assistant/coordinate/convert?${new URLSearchParams({key,locations:location,coordsys:'gps'})}`,3500)).json();
        if(converted.status!=='1'||typeof converted.locations!=='string')throw Error('conversion');
        location=converted.locations;
      }
      const params=new URLSearchParams({key,location,radius:String(radius),types:'050000',show_fields:'business',page_size:'25',sortrule:'distance'});
      const response=await timeoutFetch(`https://restapi.amap.com/v5/place/around?${params}`);
      const body=await response.json();if(body.status!=='1'||!Array.isArray(body.pois))throw Error('places');
      const restaurants:Restaurant[]=body.pois.flatMap((p:{id:string;name:string;location:string;type?:string;distance?:string;address?:string;business?:{cost?:string;opentime_today?:string}})=>{
        if(typeof p.location!=='string'||!p.name)return [];
        const [longitude,latitude]=p.location.split(',').map(Number);const meters=Number(p.distance),price=Number(p.business?.cost);
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(meters)||meters>radius)return [];
        return [{id:`amap-${p.id}`,name:p.name,cuisine:p.type??'',distance:meters,latitude,longitude,coordinateSystem:'gcj02',openingHours:typeof p.business?.opentime_today==='string'?p.business.opentime_today:null,hoursKind:'today',timeZone:'Asia/Shanghai',price:price>0?price:null,source:'高德地图',sourceUrl:`https://uri.amap.com/marker?position=${longitude},${latitude}&name=${encodeURIComponent(p.name)}&coordinate=gaode`,checkedAt:new Date().toISOString(),address:typeof p.address==='string'?p.address:''}];
      });
      return {restaurants,provider:'高德地图',message:restaurants.length?'':'附近没有查到餐厅，可扩大范围或打开地图查看。'};
    }catch{ if(system==='gcj02')return {restaurants:[],provider:'高德地图',message:'餐饮查询暂不可用，请重试或打开地图。'}; }
  }
  if(system==='gcj02')return {restaurants:[],provider:'OpenStreetMap',message:'此起点需要高德数据服务，请重试或用浏览器定位重新设置起点。'};
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
  catch{return Response.json({restaurants:[],message:'附近餐饮服务暂时不可用，请重试或打开地图查询。'},{status:503,headers:{'cache-control':'no-store'}});}
}
