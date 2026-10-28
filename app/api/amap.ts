export class MapServiceError extends Error {
  code:string;
  constructor(code:string,message:string){super(message);this.code=code;}
}
export function mapKey(){return process.env.AMAP_WEB_KEY?.trim()||null;}
export async function amap(path:string,params:Record<string,string>,timeout=6500){
 const key=mapKey();if(!key)throw new MapServiceError('MAP_NOT_CONFIGURED','具体地址和餐厅查询尚未开通。');
 let response:Response;
 try{response=await fetch(`https://restapi.amap.com${path}?${new URLSearchParams({...params,key})}`,{signal:AbortSignal.timeout(timeout),cache:'no-store'});}catch{throw new MapServiceError('MAP_TIMEOUT','地图服务连接超时，请稍后重试。');}
 if(!response.ok)throw new MapServiceError('MAP_UNAVAILABLE','地图服务暂不可用，请稍后重试。');
 let body;try{body=await response.json();}catch{throw new MapServiceError('MAP_UNAVAILABLE','地图服务响应异常，请稍后重试。');}
 if(body.status!=='1'){
  const quota=['10003','10004','10010','10019','10020','10021','10044'].includes(String(body.infocode));
  throw new MapServiceError(quota?'MAP_QUOTA':'MAP_AUTHORIZATION',quota?'地图服务额度暂不可用，请稍后重试。':'地图服务授权尚未就绪，请联系站点维护者。');
 }
 return body;
}
export async function mapCoordinates(lat:number,lon:number,system:string){
 const location=`${lon.toFixed(6)},${lat.toFixed(6)}`;
 if(system==='gcj02')return location;
 const body=await amap('/v3/assistant/coordinate/convert',{locations:location,coordsys:'gps'},3500);
 const coordinates=typeof body.locations==='string'?body.locations.split(',').map(Number):[];
 if(coordinates.length!==2||!coordinates.every(Number.isFinite))throw new MapServiceError('MAP_COORDINATES','地图坐标转换失败，请重新定位。');
 return coordinates.map((n:number)=>n.toFixed(6)).join(',');
}
