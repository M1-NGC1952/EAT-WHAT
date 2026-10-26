export const dynamic='force-dynamic';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams.get('q')?.trim()??'';
 if(q.length<2)return Response.json({error:'请输入至少两个字的地点名称。'},{status:400});
 try{
  if(process.env.AMAP_WEB_KEY){
   const params=new URLSearchParams({key:process.env.AMAP_WEB_KEY,keywords:q.slice(0,80),page_size:'5'});
   const body=await (await fetch(`https://restapi.amap.com/v5/place/text?${params}`,{signal:AbortSignal.timeout(7000),cache:'no-store'})).json();
   if(body.status!=='1')throw Error('search');
   return Response.json({locations:(body.pois??[]).filter((p:{location?:string})=>typeof p.location==='string').map((p:{id:string;name:string;location:string;address?:string;pname?:string;cityname?:string})=>{const [longitude,latitude]=p.location.split(',').map(Number);return {id:p.id,name:p.name,admin1:[p.pname,p.cityname,p.address].filter(Boolean).join(' '),latitude,longitude,coordinateSystem:'gcj02',isCity:false};})},{headers:{'cache-control':'no-store'}});
  }
  const params=new URLSearchParams({name:q.slice(0,80),count:'5',language:'zh',format:'json'});
  const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`,{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error('search');const body=await response.json();
  return Response.json({locations:(body.results??[]).map((p:{id:number;name:string;admin1?:string;country?:string;latitude:number;longitude:number})=>({...p,coordinateSystem:'wgs84',isCity:true}))},{headers:{'cache-control':'no-store'}});
 }catch{return Response.json({error:'地点查询暂不可用，可以重试、使用定位或输入经纬度。'},{status:503});}
}
