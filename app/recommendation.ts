export type MealMode = 'dine' | 'takeaway' | 'delivery';
export type Restaurant = {
  id: string; name: string; cuisine: string; latitude: number; longitude: number;
  distance: number; openingHours: string | null; hoursKind: 'weekly' | 'today';
  timeZone: string | null; price: number | null; source: 'OpenStreetMap' | '高德地图';
  sourceUrl: string; checkedAt: string; address: string; coordinateSystem: 'wgs84' | 'gcj02';
};
export const CATEGORIES = [
  { id:'noodles', name:'面食', icon:'🍜', hint:'热乎一碗，把纠结留给昨天。', words:['noodle','ramen','面馆','面食','拉面','粉面','米粉','螺蛳粉','馄饨','饺子'] },
  { id:'rice', name:'中式饭菜', icon:'🍚', hint:'一口饭，一口菜，简单又踏实。', words:['chinese','rice','中餐','中式','快餐','盖饭','湘菜','川菜','粤菜','小炒','炒饭','烧腊'] },
  { id:'light', name:'轻食', icon:'🥗', hint:'今天，给午餐一点清爽。', words:['salad','sandwich','轻食','沙拉','三明治'] },
  { id:'curry', name:'咖喱', icon:'🍛', hint:'浓郁一点，午休也有好心情。', words:['curry','咖喱','印度菜','indian'] },
  { id:'japanese', name:'日式料理', icon:'🍱', hint:'把今天的午餐装进一份小满足。', words:['japanese','sushi','日式','日本','寿司'] },
  { id:'korean', name:'韩式料理', icon:'🥘', hint:'换个口味，给普通的一天加点料。', words:['korean','韩式','韩国'] },
  { id:'western', name:'汉堡或披萨', icon:'🍔', hint:'偶尔换一顿，午餐也有新鲜感。', words:['burger','pizza','italian','汉堡','披萨','意大利','西式'] },
  { id:'hotpot', name:'火锅麻辣烫', icon:'🍲', hint:'热气腾腾，就是这一顿的期待。', words:['hot_pot','火锅','麻辣烫','冒菜','串串'] },
  { id:'local', name:'附近餐饮', icon:'🥣', hint:'从真实找到的附近餐厅里，挑一个新选择。', words:[] as string[] },
];
export const INSPIRATIONS = CATEGORIES.filter(c=>c.id!=='local');
export function categoryOf(r: Pick<Restaurant,'cuisine'|'name'>) {
  const text = `${r.cuisine} ${r.name}`.toLowerCase();
  const specific=CATEGORIES.filter(c=>c.id!=='rice'&&c.id!=='local');
  return specific.find(c=>c.words.some(w=>text.includes(w))) ?? CATEGORIES.find(c=>c.id==='rice'&&c.words.some(w=>text.includes(w))) ?? CATEGORIES[CATEGORIES.length-1];
}
export type Constraints = { budget: number | null; strictBudget: boolean; radius: number; mode: MealMode; preferred: string; excluded: string[] };
export const DEFAULTS: Constraints = {budget:null, strictBudget:false, radius:1200, mode:'dine', preferred:'', excluded:[]};
type Hours = { status:'open'|'closing'|'closed'|'unknown'; label:string; remaining:number|null; walkMinutes:number };
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
function parseDays(value:string): number[] | null {
  if(!value) return [0,1,2,3,4,5,6];
  const result:number[]=[];
  for(const item of value.split(',')) {
    const parts=item.split('-');
    if(parts.length>2 || parts.some(p=>!DAYS.includes(p))) return null;
    const start=DAYS.indexOf(parts[0]), end=DAYS.indexOf(parts[1]??parts[0]);
    for(let d=start,n=0;n<7;n++,d=(d+1)%7) {result.push(d); if(d===end)break;}
  }
  return result;
}
export function assessHours(r:Restaurant, mode:MealMode, now:Date, fallbackZone:string|null=null):Hours {
  const walkMinutes=Math.max(1,Math.ceil(r.distance*1.35/70));
  const unknown=(label='营业时间待确认'):Hours=>({status:'unknown',label,remaining:null,walkMinutes});
  const hours=r.openingHours?.trim(); const zone=r.timeZone||fallbackZone;
  if(!hours||!zone||!Number.isFinite(Date.parse(r.checkedAt))||now.getTime()-Date.parse(r.checkedAt)>600000) return unknown();
  let weekday:number, minutes:number;
  try {
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
    weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.find(p=>p.type==='weekday')!.value);
    minutes=Number(parts.find(p=>p.type==='hour')!.value)*60+Number(parts.find(p=>p.type==='minute')!.value);
  }catch{return unknown();}
  if(r.hoursKind==='today') {
    const fetchedDay=new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(new Date(r.checkedAt));
    if(fetchedDay!==new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(now)) return unknown();
  }
  if(hours==='24/7') return {status:'open',label:'公开时段：全天营业',remaining:1440,walkMinutes};
  // Unsupported holidays, dates, comments or exceptions are deliberately left unverified.
  const rules=hours.split(';').map(s=>s.trim());
  const windows:{days:number[];start:number;end:number}[]=[]; const offDays=new Set<number>();
  for(const rule of rules) {
    const m=rule.match(/^(?:(Su|Mo|Tu|We|Th|Fr|Sa)([A-Za-z,\-]*)\s+)?(off|closed|(?:\d{2}:\d{2}-\d{2}:\d{2})(?:\s*[, ]\s*\d{2}:\d{2}-\d{2}:\d{2})*)$/);
    if(!m) return unknown('营业时段需人工确认');
    const days=parseDays((m[1]??'')+(m[2]??'')); if(!days)return unknown();
    if(m[3]==='off'||m[3]==='closed'){days.forEach(d=>offDays.add(d));continue;}
    for(const span of m[3].split(/[, ]+/)) {
      const match=span.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)!;
      const [sh,sm,eh,em]=match.slice(1).map(Number);
      if(sh>23||eh>24||sm>59||em>59||(eh===24&&em!==0)) return unknown();
      const start=sh*60+sm; let end=eh*60+em;
      if(end===start)return unknown(); if(end<start)end+=1440;
      windows.push({days,start,end});
    }
  }
  if(offDays.has(weekday))return {status:'closed',label:'按公开时段：今天休息',remaining:0,walkMinutes};
  let remaining=0;
  for(const w of windows) {
    if(w.days.includes(weekday)&&minutes>=w.start&&minutes<w.end)remaining=Math.max(remaining,w.end-minutes);
    if(r.hoursKind==='weekly'&&!offDays.has((weekday+6)%7)&&w.end>1440&&w.days.includes((weekday+6)%7)&&minutes<w.end-1440)remaining=Math.max(remaining,w.end-1440-minutes);
  }
  if(!remaining)return {status:'closed',label:'按公开时段：当前未营业',remaining:0,walkMinutes};
  const needed=walkMinutes+(mode==='dine'?45:20);
  return remaining<=needed ? {status:'closing',label:`约 ${remaining} 分钟后结束营业，可能来不及`,remaining,walkMinutes} : {status:'open',label:'按公开时段：预计来得及',remaining,walkMinutes};
}
export function evaluate(r:Restaurant,c:Constraints,now:Date,zone:string|null=null) {
  const hours=assessHours(r,c.mode,now,zone);
  const reasons:string[]=[];
  if(!Number.isFinite(Date.parse(r.checkedAt))||now.getTime()-Date.parse(r.checkedAt)>600000)reasons.push('信息已过期，请刷新后再推荐');
  if(r.distance>c.radius)reasons.push('超出距离范围');
  if(c.excluded.includes(categoryOf(r).id))reasons.push('本轮已避开该品类');
  if(hours.status==='closed'||hours.status==='closing')reasons.push(hours.label);
  if(c.strictBudget&&c.budget!==null&&(r.price===null||r.price>c.budget))reasons.push(r.price===null?'价格未知，无法核实预算':'参考人均超过预算上限');
  if(c.mode==='delivery')reasons.push('配送和接单状态未接入，请到平台核实');
  return {eligible:reasons.length===0,hours,reasons};
}
export function mapLink(r:Restaurant) {
  return `https://uri.amap.com/marker?position=${r.longitude},${r.latitude}&name=${encodeURIComponent(r.name)}&coordinate=${r.coordinateSystem==='gcj02'?'gaode':'wgs84'}&callnative=0`;
}
export function randomCategory(ids:string[],previous:string,random=Math.random) {
  const options=ids.filter(id=>id!==previous);const pool=options.length?options:ids;
  return pool.length?pool[Math.floor(random()*pool.length)]:null;
}
export function nextDirection(ids:string[],previous:string,recent:string[],random=Math.random) {
  const fresh=ids.filter(id=>id!==previous&&!recent.slice(-2).includes(id));
  return randomCategory(fresh.length?fresh:ids,previous,random);
}
export function finalRestaurant(pool:Restaurant[],c:Constraints,now:Date,zone:string|null,skipped:string[]=[]) {
  return pool.filter(r=>evaluate(r,c,now,zone).eligible&&!skipped.includes(categoryOf(r).id))
    .sort((a,b)=>{
      const score=(r:Restaurant)=>r.distance+(assessHours(r,c.mode,now,zone).status==='open'?0:1000)+(c.budget!==null&&r.price!==null&&r.price>c.budget?1500:0);
      return score(a)-score(b);
    })[0]??null;
}
export function pickRestaurant(pool:Restaurant[],c:Constraints,seen:string[],random=Math.random) {
  const remaining=pool.filter(r=>!seen.includes(r.id));
  if(!remaining.length)return null;
  const weights=remaining.map(r=>(1/(1+r.distance/600))*(r.openingHours?1.4:1)*(c.budget!==null&&r.price!==null&&r.price>c.budget?0.35:1));
  let target=random()*weights.reduce((a,b)=>a+b,0);
  return remaining.find((_,i)=>(target-=weights[i])<0)??remaining[remaining.length-1];
}
