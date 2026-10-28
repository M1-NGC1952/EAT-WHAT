"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, INSPIRATIONS, DEFAULTS, categoryOf, evaluate, mapLink, pickRestaurant, randomCategory, nextDirection, finalRestaurant, type Constraints, type Restaurant } from './recommendation';
import { readJournal, saveJournalEntry, type LunchEntry } from './journal-storage';
type Point={latitude:number;longitude:number;coordinateSystem?:string;label:string};
type LocationResult=Point&{id:string|number;name:string;admin1?:string;country?:string;isCity?:boolean};
const SETTINGS='shifanfou.preferences.v2',PLACE='shifanfou.place.v2';
function today(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
export default function LunchApp(){
 const [tab,setTab]=useState<'choose'|'journal'>('choose');
 const [direction,setDirection]=useState('noodles');
 const [restaurantId,setRestaurantId]=useState<string|null>(null);
 const [restaurants,setRestaurants]=useState<Restaurant[]>([]);
 const [point,setPoint]=useState<Point|null>(null);
 const [query,setQuery]=useState('');const [locations,setLocations]=useState<LocationResult[]>([]);
 const [busy,setBusy]=useState(false),[searching,setSearching]=useState(false),[locating,setLocating]=useState(false);
 const [message,setMessage]=useState(''),[note,setNote]=useState('');
 const [locationMessage,setLocationMessage]=useState('');
 const [nearbyState,setNearbyState]=useState<'idle'|'loading'|'success'|'error'>('idle');
 const placeVersion=useRef(0);
 const [constraints,setConstraints]=useState<Constraints>(DEFAULTS);
 const [zone,setZone]=useState<string|null>(null),[weather,setWeather]=useState<{temperature_2m:number;precipitation:number}|null>(null);
 const [weatherBusy,setWeatherBusy]=useState(false),[now,setNow]=useState(()=>new Date());
 const [seen,setSeen]=useState<string[]>([]),[swaps,setSwaps]=useState(0),[confirmed,setConfirmed]=useState(false);
 const [skipped,setSkipped]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[finalPick,setFinalPick]=useState(false);
 const [loaded,setLoaded]=useState(false);const requestId=useRef(0),searchId=useRef(0);const restored=useRef(false);
 const [entries,setEntries]=useState<LunchEntry[]>([]),[journalMessage,setJournalMessage]=useState('');
 const [form,setForm]=useState({eatenOn:today(),restaurant:'',dish:'',mealMode:'堂食',note:''});
 const [coordText,setCoordText]=useState('');
 const category=CATEGORIES.find(c=>c.id===direction)??{id:'none',name:'这一轮，重新洗牌吧',icon:'🔀',hint:'暂时避开的方向可以一键恢复，预算和其他硬限制会保留。',words:[]};
 const checks=useMemo(()=>restaurants.map(r=>({r,...evaluate(r,constraints,now,zone)})),[restaurants,constraints,now,zone]);
 const hardEligible=checks.filter(x=>x.eligible).map(x=>x.r);
 const eligible=hardEligible.filter(r=>!skipped.includes(categoryOf(r).id));
 const allSoftSkipped=skipped.length>0&&(point&&hardEligible.length>0?eligible.length===0:INSPIRATIONS.every(c=>skipped.includes(c.id)));
 const signature=eligible.map(r=>r.id).join('|');
 const current=eligible.find(r=>r.id===restaurantId&&categoryOf(r).id===direction)??null;
 const currentStatus=current?evaluate(current,constraints,now,zone):null;
 const matching=eligible.filter(r=>categoryOf(r).id===direction);
 const isLoading=busy||locating;
 useEffect(()=>{
  setDirection(INSPIRATIONS[Math.floor(Math.random()*INSPIRATIONS.length)].id);
  try{
   const raw=JSON.parse(localStorage.getItem(SETTINGS)||'null');
   if(raw&&Number.isFinite(raw.radius)&&[600,1200,2000,3000].includes(raw.radius)&&['dine','takeaway','delivery'].includes(raw.mode)){
    setConstraints({...DEFAULTS,...raw,budget:typeof raw.budget==='number'&&raw.budget>0?Math.min(5000,raw.budget):null,excluded:Array.isArray(raw.excluded)?raw.excluded.filter((id:unknown)=>typeof id==='string'&&CATEGORIES.some(c=>c.id===id)):[]});
   }
   const p=JSON.parse(localStorage.getItem(PLACE)||'null');
   if(p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180&&typeof p.label==='string'){selectPoint(p,['当前位置','已取得当前位置'].includes(p.label));}
  }catch{setNote('未能恢复偏好，你仍可以正常随机选择。');}
  restored.current=true;setLoaded(true);
  const timer=setInterval(()=>setNow(new Date()),30000);
  const focus=()=>setNow(new Date());window.addEventListener('focus',focus);
  return()=>{clearInterval(timer);window.removeEventListener('focus',focus);};
 },[]);
 useEffect(()=>{
  if(!loaded)return;try{localStorage.setItem(SETTINGS,JSON.stringify({...constraints,excluded:[]}));}catch{setNote('浏览器未允许保存偏好，本次仍可正常使用。');}
 },[constraints,loaded]);
 async function loadNearby(p:Point,radius:number){
  const id=++requestId.current;setBusy(true);setNearbyState('loading');setRestaurants([]);setRestaurantId(null);setConfirmed(false);setSeen([]);setWeather(null);setZone(null);setWeatherBusy(true);setMessage('正在找真实餐厅，营业和价格有缺失时会明确告诉你。');
  const params=new URLSearchParams({lat:String(p.latitude),lon:String(p.longitude),radius:String(radius),system:p.coordinateSystem??'wgs84'});
  void fetch(`/api/context?${params}&part=weather`,{signal:AbortSignal.timeout(11000)}).then(r=>r.json()).then(body=>{if(id===requestId.current){setWeather(body.weather??null);setZone(body.timeZone??null);}}).catch(()=>{}).finally(()=>{if(id===requestId.current)setWeatherBusy(false);});
  try{
   const response=await fetch(`/api/context?${params}`,{signal:AbortSignal.timeout(28000)});const body=await response.json();
   if(id!==requestId.current)return;
   if(!response.ok)throw Error(body.message||'餐饮服务暂不可用');
   setRestaurants(body.restaurants??[]);setNearbyState('success');setMessage(body.message||`找到了 ${body.restaurants?.length??0} 家真实餐厅。`);setNow(new Date());
  }catch(error){if(id===requestId.current){setNearbyState('error');setMessage(error instanceof Error&&error.name!=='TimeoutError'?error.message:'附近查询超时，请重试或打开地图。');}}
  finally{if(id===requestId.current)setBusy(false);}
 }
 useEffect(()=>{if(point&&loaded)void loadNearby(point,constraints.radius);},[point?.latitude,point?.longitude,point?.coordinateSystem,constraints.radius,loaded]);
 useEffect(()=>{
  if(!eligible.length){
   setRestaurantId(null);setConfirmed(false);
   if(skipped.includes(direction)||constraints.excluded.includes(direction)||direction==='none'){
    const options=INSPIRATIONS.filter(c=>!constraints.excluded.includes(c.id)&&!skipped.includes(c.id)).map(c=>c.id);
    if(allSoftSkipped){setDirection('none');return;}
    setDirection(randomCategory(options,direction)??'none');
   }
   return;
  }
  if(eligible.some(r=>r.id===restaurantId&&categoryOf(r).id===direction))return;
  let pool=eligible.filter(r=>categoryOf(r).id===direction);
  if(!pool.length){
   const preferred=eligible.filter(r=>categoryOf(r).id===constraints.preferred);
   pool=preferred.length?preferred:eligible;
   if(point)setNote('已从附近符合条件的真实候选中，替你换了一个有商家支持的方向。');
  }
  const picked=pickRestaurant(pool,constraints,[]);if(picked){setDirection(categoryOf(picked).id);setRestaurantId(picked.id);setSeen([picked.id]);setConfirmed(false);}
 },[signature,constraints,zone,skipped]);
 function selectPoint(p:Point,reverse=false){
  const version=++placeVersion.current;searchId.current++;setSearching(false);setLocating(false);
  if(point&&point.latitude===p.latitude&&point.longitude===p.longitude&&point.coordinateSystem===p.coordinateSystem&&loaded)void loadNearby(p,constraints.radius);
  setPoint(p);setQuery(p.label);setLocations([]);setLocationMessage(reverse?'已取得定位坐标，正在解析详细地址…':'已确认午餐起点，正在自动查询附近餐厅。');
  try{localStorage.setItem(PLACE,JSON.stringify(p));}catch{setNote('位置仅在本次使用，不会保留。');}
  if(reverse){const params=new URLSearchParams({lat:String(p.latitude),lon:String(p.longitude),system:p.coordinateSystem??'wgs84'});
   void fetch(`/api/reverse?${params}`,{signal:AbortSignal.timeout(12000)}).then(async response=>{
    const body=await response.json();if(version!==placeVersion.current)return;
    if(!response.ok||!body.address){setLocationMessage('已取得定位坐标，但详细地址暂未解析；餐厅查询单独进行。');return;}
    const resolved={...p,label:body.address};setPoint(resolved);setQuery(body.address);setLocationMessage('已显示定位地址。附近餐厅会自动查询，无需再次点查找。');
    try{localStorage.setItem(PLACE,JSON.stringify(resolved));}catch{}
   }).catch(()=>{if(version===placeVersion.current)setLocationMessage('详细地址解析暂不可用，定位坐标已保留。');});
  }
 }
 function locate(){
  if(!navigator.geolocation){setLocationMessage('浏览器不支持定位，请手动设置地点。');return;}
  setLocating(true);setLocationMessage('正在取得位置…');
  const version=++placeVersion.current;
  navigator.geolocation.getCurrentPosition(pos=>{if(version!==placeVersion.current)return;setLocating(false);selectPoint({latitude:pos.coords.latitude,longitude:pos.coords.longitude,coordinateSystem:'wgs84',label:'已取得当前位置'},true);},()=>{if(version!==placeVersion.current)return;setLocating(false);setLocationMessage('没有取得位置。请开启浏览器定位，或手动设置地点。');},{timeout:12000,maximumAge:60000});
 }
 async function search(event:FormEvent){
  event.preventDefault();if(query.trim().length<2)return;const id=++searchId.current;setSearching(true);setLocations([]);
  setLocationMessage('正在查找地点，选中地点后会自动查询餐厅。');
  try{const response=await fetch(`/api/locations?q=${encodeURIComponent(query.trim())}`,{signal:AbortSignal.timeout(11000)});const body=await response.json();if(id!==searchId.current)return;if(!response.ok)throw Error(body.error);setLocations(body.locations??[]);setLocationMessage(body.message||(body.locations?.length?'请点选一个地点，确认后自动查找附近餐厅。':'没有找到地点，可使用定位或经纬度。'));}
  catch(error){if(id===searchId.current)setLocationMessage(error instanceof Error&&error.name!=='TimeoutError'?error.message:'地点查询超时，请重试或使用定位。');}finally{if(id===searchId.current)setSearching(false);}
 }
 function changeDirection(){
  setConfirmed(false);setFinalPick(false);setSwaps(v=>v+1);
  if(allSoftSkipped){resetRound();return;}
  const ids=point&&eligible.length?[...new Set(eligible.map(r=>categoryOf(r).id))]:INSPIRATIONS.filter(c=>!constraints.excluded.includes(c.id)&&!skipped.includes(c.id)).map(c=>c.id);
  const next=nextDirection(ids,direction,recent);if(!next){setNote('当前硬限制下没有可选方向，请调整条件。');return;}
  if(next===direction&&eligible.length){changeRestaurant();return;}
  const pool=eligible.filter(r=>categoryOf(r).id===next);const pick=pickRestaurant(pool,constraints,seen);
  if(point&&pool.length&&!pick){chooseFinal();return;}
  setRecent(v=>[...v,direction].slice(-2));setDirection(next);
  setRestaurantId(pick?.id??null);if(pick)setSeen(s=>[...s,pick.id]);
  setNote(point&&!eligible.length?'先换个灵感；附近暂没有符合全部条件的已核实候选。':'换个方向，也换个午餐心情。');
 }
 function changeRestaurant(){
  const pick=pickRestaurant(matching,constraints,seen);setConfirmed(false);setFinalPick(false);setSwaps(v=>v+1);
  if(!pick){chooseFinal(true);return;}
  setRestaurantId(pick.id);setSeen(s=>[...s,pick.id]);setNote('吃的方向不变，替你换一家。');
 }
 function resetRound(){
  setSkipped([]);setRecent([]);setSeen([]);setSwaps(0);setFinalPick(false);setConfirmed(false);
  const pick=pickRestaurant(hardEligible,constraints,[]);
  if(pick){setDirection(categoryOf(pick).id);setRestaurantId(pick.id);setSeen([pick.id]);}
  else{setDirection(randomCategory(INSPIRATIONS.filter(c=>!constraints.excluded.includes(c.id)).map(c=>c.id),direction)??'none');setRestaurantId(null);}
  setNote('重新洗牌了：只恢复本轮暂时避开的方向，预算、距离和营业时间限制继续保留。');
 }
 function chooseFinal(sameDirection=false){
  const pool=sameDirection?matching:restaurants;
  const pick=finalRestaurant(pool,constraints,new Date(),zone,skipped);
  setConfirmed(false);
  if(pick){setDirection(categoryOf(pick).id);setRestaurantId(pick.id);setFinalPick(true);setNote(sameDirection?'这个方向的店都看过了，先选其中更省事的一家；仍可以重新洗牌。':'这顿先选更省事的一家：优先营业信息明确，再兼顾距离和预算。未知信息仍需核实。');}
  else if(!point){setNote('先确定午餐起点，才能从真实餐厅中替你定一顿。');locate();}
  else{setNote(allSoftSkipped?'这一轮都暂时避开了。重新洗牌即可恢复，硬限制不变。':'附近没有满足硬限制的真实候选，不能强行替你定；可调整条件或打开地图核实。');}
 }
 function accept(){
  setNow(new Date());
  if(!point){locate();return;}
  if(!current){void loadNearby(point,constraints.radius);return;}
  if(!evaluate(current,constraints,new Date(),zone).eligible){setRestaurantId(null);setNote('这家已不适合现在前往，正在替你重新选择。');void loadNearby(point,constraints.radius);return;}
  if(Date.now()-Date.parse(current.checkedAt)>120000){setNote('出发前先刷新商家信息，请确认刷新后的建议。');void loadNearby(point,constraints.radius);return;}
  setConfirmed(true);
 }
 useEffect(()=>{
  if(tab!=='journal')return;try{setEntries(readJournal(localStorage));}catch{setJournalMessage('无法读取手账，请保留已有网站数据并检查浏览器存储权限。');}
 },[tab]);
 function save(event:FormEvent){event.preventDefault();try{setEntries(saveJournalEntry(localStorage,{...form,location:point?.label??''}));setJournalMessage('记好了，这一顿值得被记住。');setForm(v=>({...v,restaurant:'',dish:'',note:''}));}catch{setJournalMessage('未保存成功，请检查必填项和浏览器存储空间。');}}
 function record(){if(!current)return;setForm(v=>({...v,restaurant:current.name,dish:'',mealMode:constraints.mode==='dine'?'堂食':constraints.mode==='takeaway'?'打包':'外卖'}));setJournalMessage('这里只预填餐厅，实际吃过后再填写餐品并保存。');setTab('journal');}
 const searchPlace=point&& !['当前位置','已取得当前位置','手动 GPS 坐标'].includes(point.label)?point.label.replace(' · 城市参考点',''):'附近';
 const mapSearch=`https://uri.amap.com/search?keyword=${encodeURIComponent(`${searchPlace} ${category.name}`)}${point?.coordinateSystem==='gcj02'?`&center=${point.longitude},${point.latitude}`:''}&callnative=0`;
 return <main>
  <header className="topbar"><a className="brand" href="#top" onClick={()=>setTab('choose')}><span className="brand-stamp">吃</span><span>今天吃什么</span></a><nav className="tabs" aria-label="主要导航"><button className={tab==='choose'?'active':''} onClick={()=>setTab('choose')}>替我决定</button><button className={tab==='journal'?'active':''} onClick={()=>setTab('journal')}>午餐手账</button></nav><div className="v2-badge">免登录 · 少纠结一顿</div></header>
  {tab==='choose'?<div className="v2-shell" id="top">
   <section className="v2-intro"><p className="eyebrow"><span>午休有限</span><span>纠结到此为止</span></p><h1>今天，就吃<span>这个吧。</span></h1><p>不用想好吃什么，我们先替你选。<br/>合适就出发，不合适就换一个。</p></section>
   <section className="v2-pick" aria-label="随机午餐建议">
    <div className="v2-card-head"><span>给今天的一点灵感</span><span className="v2-live">{current?'真实商家已找到':isLoading?'正在匹配附近商家':'先选吃的，再找店'}</span></div>
    <div className="v2-food" key={direction}><div className="v2-food-icon" aria-hidden="true">{category.icon}</div><p>今天试试</p><h2>{category.name}</h2><p className="v2-food-hint">{category.hint}</p></div>
    <div className="v2-pick-actions"><button className="v2-primary" onClick={allSoftSkipped?resetRound:accept} disabled={isLoading&&!allSoftSkipped}>{allSoftSkipped?'重新洗牌 · 保留硬限制':isLoading?'正在找附近的店…':!point?'就吃这个 · 找附近的店':current?'就吃这个':'按这个方向再找找'} <span>↗</span></button><button className="v2-secondary" onClick={changeDirection}>{allSoftSkipped?'重新开始一轮':'换个吃的'} <span>⟳</span></button></div>
    <p className="v2-caption">{!point?'这是餐品灵感，设置位置后才能核实附近商家。':'根据品类信息匹配，不代表店内提供某道具体菜品。'}</p>
   </section>
   <section className="v2-location"><div><span className="v2-step">01 · 午餐起点</span><h2>{point?point.label:'附近好吃的，从找到你开始'}</h2>{point&&<p className="v2-caption">纬度 {point.latitude.toFixed(5)} · 经度 {point.longitude.toFixed(5)} · {point.coordinateSystem==='gcj02'?'地图坐标':'GPS 坐标'}</p>}</div><button className="v2-text-button" onClick={locate} disabled={isLoading}>{locating?'正在定位…':'⌖ 使用当前位置'}</button>
    <details><summary>手动设置地点</summary><form className="v2-search" onSubmit={search}><input aria-label="地点名称" placeholder="输入城市、区域或具体地点" value={query} onChange={e=>setQuery(e.target.value)} required minLength={2}/><button type="submit" disabled={searching}>{searching?'查找中…':'查找地点'}</button></form>
     {locations.map(l=><button className="v2-location-result" key={l.id} onClick={()=>selectPoint({latitude:l.latitude,longitude:l.longitude,coordinateSystem:l.coordinateSystem,label:[l.name,l.admin1,l.country].filter(Boolean).join(' · ')+(l.isCity?' · 城市参考点':'')})}><b>{l.name}</b><span>{l.admin1} {l.country}</span><small>{l.isCity?'使用这个城市参考点（并非实际定位）':'确认这里并查附近餐厅'} →</small></button>)}
     <form className="v2-search" onSubmit={e=>{e.preventDefault();const values=coordText.split(/[,，\s]+/).filter(Boolean);const [latitude,longitude]=values.map(Number);if(values.length!==2||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){setMessage('请按“纬度,经度”输入有效的 GPS 坐标。');return;}selectPoint({latitude,longitude,label:'手动 GPS 坐标',coordinateSystem:'wgs84'});}}><input aria-label="GPS经纬度" value={coordText} onChange={e=>setCoordText(e.target.value)} placeholder="GPS 纬度,经度，例如 31.23,121.47"/><button type="submit">确认坐标</button></form><p className="v2-caption">定位仅在点击后请求；位置会发送给餐饮与天气数据服务，用于本次查询。</p></details>
    <p className="v2-status" role="status">{locationMessage||'不授权定位，也能继续换午餐灵感。'} {point&&!busy&&nearbyState!=='error'&&<button className="v2-inline" onClick={()=>loadNearby(point,constraints.radius)}>刷新附近</button>}</p>
   </section>
   <section className="v2-results" aria-label="附近真实餐厅"><div className="v2-section-heading"><div><span className="v2-step">02 · 把想吃的变成吃得到</span><h2>{nearbyState==='error'?'附近查询未完成':current?(confirmed?'这一顿，有着落了':finalPick?'这一顿，替你定一家':'附近这一家，怎么样？'):point?'先确认有合适的店':'真实商家，等你设置起点'}</h2></div>{point&&nearbyState==='success'&&<span className="v2-counter">{eligible.length} 家可考虑 / {restaurants.length} 家找到</span>}</div>
    {nearbyState==='error'?<div className="v2-api-error" role="status"><p>{message}</p><p className="v2-caption">这不代表附近没有餐厅；上方的随机灵感仍可继续使用。</p><div><button className="v2-inline" onClick={()=>point&&loadNearby(point,constraints.radius)}>重试附近查询</button><a className="v2-inline" href={mapSearch} target="_blank" rel="noreferrer">去地图查询 ↗</a></div></div>:isLoading?<div className="v2-empty" role="status">正在查询真实商家…<p>天气单独加载，不影响选餐。</p></div>:current?<article className="v2-restaurant"><div className="v2-restaurant-title"><div><span>{current.source} · {category.name}</span><h3>{current.name}</h3></div><span className={`v2-pill ${currentStatus?.hours.status==='open'?'good':''}`}>{currentStatus?.hours.status==='open'?'按时段预计可前往':'营业待核实'}</span></div>
     <div className="v2-facts"><div><small>距离</small><strong>直线 {current.distance<1000?`${current.distance} m`:`${(current.distance/1000).toFixed(1)} km`}</strong></div><div><small>预算参考</small><strong>{current.price!==null?`人均约 ¥${current.price}`:'价格未知'}</strong></div><div><small>营业信息</small><strong>{current.openingHours||'时段未收录'}</strong></div></div>
     <p className="v2-explain">{constraints.preferred&&constraints.preferred!==direction?'偏好的品类暂未选中，这次替你换个方向。':'从符合当前条件的候选中随机选出，近一点的选择优先。'}{constraints.budget!==null&&current.price!==null&&current.price>constraints.budget?' 参考人均高于期望预算，未突破任何严格上限。':''}</p>
     <p className="v2-caution">{currentStatus?.hours.label}。距离按直线计算，步行时间仅估算；闭餐判断含点餐、等餐及堂食用餐余量，厨房可能提前停止接单。{current.price===null?' 当前没有价格依据，请先核实菜单。':' 参考人均不等于最终账单。'}</p>
     {current.address&&<p className="v2-caption">地址：{current.address}</p>}
     <div className="v2-restaurant-actions">{confirmed?<a className="v2-primary" href={mapLink(current)} target="_blank" rel="noreferrer" onClick={e=>{if(!evaluate(current,constraints,new Date(),zone).eligible||Date.now()-Date.parse(current.checkedAt)>120000){e.preventDefault();setConfirmed(false);setNote('信息已变化，出发前重新确认。');loadNearby(point!,constraints.radius);}}}>{currentStatus?.hours.status==='open'?'打开地图 · 出发':'打开地图 · 先核实'} ↗</a>:<button className="v2-primary" onClick={accept}>就吃这个 ↗</button>}<button className="v2-secondary" onClick={changeRestaurant}>这个想吃，换家店</button></div>
     {confirmed&&<button className="v2-inline" onClick={record}>吃过了？预填餐厅到手账 →</button>}<p className="v2-caption">本次查询 {new Date(current.checkedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · <a href={current.sourceUrl} target="_blank" rel="noreferrer">查看来源</a> · 营业时段为公开信息，非商家实时接单承诺</p>
    </article>:<div className="v2-empty"><span aria-hidden="true">{point?'⌕':'⌖'}</span><h3>{allSoftSkipped?'这一轮都看过了，重新洗牌就好':point?'暂未找到符合全部条件的店':'先给你灵感，不虚构附近餐厅'}</h3><p>{point?(constraints.mode==='delivery'?'配送和接单信息暂未接入，可去平台核实；也可以切换堂食或打包。':constraints.strictBudget&&constraints.budget!==null?'价格未知的商家不会被当作预算内推荐。可查看待核实候选，或由你调整预算规则。':'餐厅可能已闭餐、来不及用餐、被避开或数据覆盖不足。可以调整范围、重试或打开地图。'):'点击上方“就吃这个”获取位置，即可查找真实商家。'}</p>{point&&<div className="v2-empty-actions"><button className="v2-secondary" onClick={()=>loadNearby(point,constraints.radius)}>重试附近查询</button><a className="v2-secondary" href={mapSearch} target="_blank" rel="noreferrer">打开地图搜索 ↗</a></div>}</div>}
    {checks.some(x=>!x.eligible)&&<details className="v2-filtered"><summary>{checks.filter(x=>!x.eligible).length} 家暂未推荐 · 查看原因</summary>{checks.filter(x=>!x.eligible).slice(0,8).map(x=><div className="v2-filter-row" key={x.r.id}><div><b>{x.r.name}</b><p>{x.reasons.join(' · ')} · {x.r.openingHours||'营业时间未知'} · {x.r.price===null?'价格未知':`参考人均 ¥${x.r.price}`}</p></div><a href={mapLink(x.r)} target="_blank" rel="noreferrer">自行核实 ↗</a></div>)}</details>}
   </section>
   <aside className="v2-settings"><details><summary><span>给随机加一点边界</span><small>{constraints.budget?`期望 ¥${constraints.budget}${constraints.strictBudget?' · 严格上限':''}`:'预算不限'} · 直线 {constraints.radius} m <b>调整</b></small></summary><div className="v2-controls"><label>用餐方式<select value={constraints.mode} onChange={e=>setConstraints(c=>({...c,mode:e.target.value as Constraints['mode']}))}><option value="dine">堂食</option><option value="takeaway">打包自取</option><option value="delivery">外卖（需平台核实）</option></select></label><label>期望预算（元）<input type="number" min="1" max="5000" placeholder="不限" value={constraints.budget??''} onChange={e=>setConstraints(c=>({...c,budget:e.target.value&&Number(e.target.value)>0?Math.min(5000,Number(e.target.value)):null}))}/></label><label>直线范围<select value={constraints.radius} onChange={e=>setConstraints(c=>({...c,radius:Number(e.target.value)}))}>{[600,1200,2000,3000].map(n=><option key={n} value={n}>{n} 米</option>)}</select></label><label>偏爱的方向（可跳过）<select value={constraints.preferred} onChange={e=>setConstraints(c=>({...c,preferred:e.target.value}))}><option value="">都可以，替我随机</option>{INSPIRATIONS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><label className="v2-check"><input type="checkbox" checked={constraints.strictBudget} onChange={e=>setConstraints(c=>({...c,strictBudget:e.target.checked}))}/>预算为严格上限：价格未知或参考人均超额时不作为主推荐</label><p className="v2-caption">品类偏好可放宽，严格预算和距离不自动突破。人均仅供参考，无法保证实际账单；过敏与具体食材请向商家核实。</p><button className="v2-inline" onClick={()=>{setConstraints(DEFAULTS);setNote('已恢复默认边界。');}}>恢复默认条件</button></details></aside>
   {(swaps>=3||allSoftSkipped||finalPick)&&<div className="v2-feedback"><b>{allSoftSkipped?'这一轮都暂时避开了，要不要重新洗牌？':finalPick?'不用把所有选项都看完，这顿先有个着落。':'还没心动？这顿按“省事一点”替你定。'}</b><p className="v2-caption">{allSoftSkipped?'一键恢复本轮方向，预算、距离和营业时间限制不变。':'换一个只会短暂冷却，不会永久排除。可以继续换，也可以让我们帮你收敛。'}</p><div>{allSoftSkipped?<button className="selected" onClick={resetRound}>重新洗牌，保留硬限制</button>:<><button className="selected" onClick={()=>chooseFinal()}>替我定一顿</button><button onClick={changeDirection}>继续换</button><button onClick={()=>{setSkipped(v=>[...new Set([...v,direction])]);setConfirmed(false);setFinalPick(false);setSwaps(v=>v+1);setNote('仅本轮暂时避开，重新洗牌可恢复。');}}>今天不想吃这个</button></>}<button onClick={resetRound}>重新随机一轮</button></div></div>}
   {note&&<div className="v2-notice" role="status">{note}{note.includes('候选已看完')&&<button className="v2-inline" onClick={()=>{setSeen([]);const pick=pickRestaurant(matching,constraints,[]);setRestaurantId(pick?.id??null);if(pick)setSeen([pick.id]);setNote('重新挑一轮，之前看过的店也会加入。');}}>重新挑一轮</button>}</div>}
   <div className="v2-weather">{weather?`${weather.precipitation>0?'🌧️ 有降水，出门带伞':'🌤️ 当前天气'} · ${Math.round(weather.temperature_2m)}°C · 仅供出行参考`:weatherBusy?'天气单独查询中…':'天气暂未获取，不影响选餐。'}<span>先替你决定，再帮你出发。</span></div>
  </div>:<section className="journal-page"><div className="journal-intro"><p className="eyebrow"><span>午餐手账</span><span>一点点生活证据</span></p><h1>日子，也可以<br/>按<em>午餐</em>翻阅。</h1><p>记录实际吃过的这一顿，推荐结果不会自动写入。</p><div className="signin-note"><span>📱</span><div><strong>只保存在当前浏览器</strong><p>不跨设备同步，清理网站数据会删除记录。</p></div></div></div><div className="journal-workspace"><form className="journal-form" onSubmit={save}><div className="form-heading">记录一顿午餐</div><div className="form-row"><label>日期<input type="date" value={form.eatenOn} onChange={e=>setForm(v=>({...v,eatenOn:e.target.value}))} required/></label><label>方式<select value={form.mealMode} onChange={e=>setForm(v=>({...v,mealMode:e.target.value}))}><option>堂食</option><option>打包</option><option>外卖</option><option>自带</option></select></label></div><label>餐厅<input value={form.restaurant} onChange={e=>setForm(v=>({...v,restaurant:e.target.value}))} maxLength={80} required/></label><label>实际吃的餐品<input value={form.dish} onChange={e=>setForm(v=>({...v,dish:e.target.value}))} maxLength={80} required/></label><label>随手记<textarea value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} rows={3} maxLength={300}/></label><button className="save-button" type="submit">记下这顿午餐 ＋</button>{journalMessage&&<p role="status">{journalMessage}</p>}</form><div className="journal-list"><div className="list-heading"><span>最近的午餐</span><strong>{entries.length} 条</strong></div>{entries.length?entries.map(e=><article key={e.id}><time>{e.eatenOn}</time><div><h3>{e.dish}</h3><p>{e.restaurant}</p>{e.note&&<blockquote>{e.note}</blockquote>}</div><span>{e.mealMode}</span></article>):<div className="list-empty">还没有记录，普通午餐也值得被记住。</div>}</div></div></section>}
  <footer><span>今天吃什么 · 少纠结一顿</span><span>真实餐厅来自高德地图 / © OpenStreetMap contributors · 信息缺失会明确标注</span></footer>
 </main>;
}
