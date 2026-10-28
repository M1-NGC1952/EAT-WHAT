import { amap,mapKey,MapServiceError } from '../amap.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams.get('q')?.trim()??'';
 if(q.length<2)return Response.json({error:'请输入至少两个字的地点名称。'},{status:400});
 try{
  if(mapKey()){
   const body=await amap('/v3/place/text',{keywords:q.slice(0,80),offset:'5',page:'1',extensions:'base'});
   const locations=(Array.isArray(body.pois)?body.pois:[]).flatMap((p:{id:string;name:string;location:string;address?:string;pname?:string;cityname?:string;adname?:string})=>{
    if(typeof p.location!=='string'||!p.name)return [];const [longitude,latitude]=p.location.split(',').map(Number);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return [];
    return [{id:p.id,name:p.name,admin1:[p.pname,p.cityname,p.adname,p.address].filter(x=>typeof x==='string'&&x).join(' '),latitude,longitude,coordinateSystem:'gcj02',isCity:false}];
   });
   return Response.json({locations,provider:'高德地图',searchScope:'places',message:locations.length?'请选择一个地点，确认后将自动查找附近餐厅。':'没有匹配的具体地点，请加上城市或区县再查找。'},{headers:{'cache-control':'no-store'}});
  }
  const params=new URLSearchParams({name:q.slice(0,80),count:'5',language:'zh',format:'json'});
  const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`,{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error('search');const body=await response.json();
  return Response.json({locations:(body.results??[]).map((p:{id:number;name:string;admin1?:string;country?:string;latitude:number;longitude:number})=>({...p,coordinateSystem:'wgs84',isCity:true})),provider:'Open-Meteo',searchScope:'cities',message:'当前仅支持城市参考点，不能查询小区、街道或商场。请使用浏览器定位获取实际起点。'},{headers:{'cache-control':'no-store'}});
 }catch(error){return Response.json({code:error instanceof MapServiceError?error.code:'SEARCH_UNAVAILABLE',error:error instanceof MapServiceError?error.message:'地点查询暂不可用，可以重试或使用定位。'},{status:503});}
}
