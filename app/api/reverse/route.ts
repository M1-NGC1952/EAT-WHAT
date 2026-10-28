import { amap,mapCoordinates,MapServiceError } from '../amap.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;const lat=Number(p.get('lat')),lon=Number(p.get('lon'));
 if(!p.get('lat')?.trim()||!p.get('lon')?.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return Response.json({error:'坐标无效。'},{status:400});
 try{
  const location=await mapCoordinates(lat,lon,p.get('system')??'wgs84');
  const body=await amap('/v3/geocode/regeo',{location,extensions:'base'});
  const address=body.regeocode?.formatted_address;
  if(typeof address!=='string'||!address.trim())throw new MapServiceError('ADDRESS_EMPTY','已取得定位坐标，暂未解析出详细地址。');
  return Response.json({address:address.trim(),provider:'高德地图'},{headers:{'cache-control':'no-store'}});
 }catch(error){return Response.json({address:null,code:error instanceof MapServiceError?error.code:'MAP_UNAVAILABLE',error:error instanceof MapServiceError?error.message:'详细地址暂未取得，定位坐标仍可使用。'},{status:503,headers:{'cache-control':'no-store'}});}
}
