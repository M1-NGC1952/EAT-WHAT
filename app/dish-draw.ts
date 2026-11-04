export type Dish = { name: string; group: string; icon: string };

const dishes: Dish[] = [
  { name: "牛肉面", group: "面粉", icon: "🍜" },
  { name: "番茄鸡蛋面", group: "面粉", icon: "🍜" },
  { name: "桂林米粉", group: "面粉", icon: "🍜" },
  { name: "黄焖鸡饭", group: "米饭", icon: "🍚" },
  { name: "番茄炒蛋盖饭", group: "米饭", icon: "🍚" },
  { name: "咖喱鸡饭", group: "米饭", icon: "🍛" },
  { name: "扬州炒饭", group: "米饭", icon: "🍚" },
  { name: "猪肉白菜饺子", group: "饺馄饨", icon: "🥟" },
  { name: "鲜肉馄饨", group: "饺馄饨", icon: "🥟" },
  { name: "鸡肉卷", group: "饼卷", icon: "🌯" },
  { name: "鸡肉汉堡", group: "饼卷", icon: "🍔" },
  { name: "麻辣烫", group: "汤锅", icon: "🥘" },
  { name: "番茄肥牛锅", group: "汤锅", icon: "🥘" },
  { name: "皮蛋瘦肉粥", group: "粥", icon: "🥣" },
  { name: "鸡胸肉沙拉", group: "轻食", icon: "🥗" },
  { name: "重庆小面", group: "面粉", icon: "🍜" },
  { name: "武汉热干面", group: "面粉", icon: "🍜" },
  { name: "担担面", group: "面粉", icon: "🍜" },
  { name: "新疆拌面", group: "面粉", icon: "🍜" },
  { name: "云南过桥米线", group: "面粉", icon: "🍜" },
  { name: "黑椒牛柳意面", group: "面粉", icon: "🍝" },
  { name: "广式烧鸭饭", group: "米饭", icon: "🍚" },
  { name: "台式卤肉饭", group: "米饭", icon: "🍚" },
  { name: "鸡腿照烧饭", group: "米饭", icon: "🍚" },
  { name: "韩式石锅拌饭", group: "米饭", icon: "🍚" },
  { name: "海南鸡饭", group: "米饭", icon: "🍚" },
  { name: "鱼香肉丝盖饭", group: "米饭", icon: "🍚" },
  { name: "腊味煲仔饭", group: "米饭", icon: "🍚" },
  { name: "新疆手抓饭", group: "米饭", icon: "🍚" },
  { name: "韭菜鸡蛋饺子", group: "饺馄饨", icon: "🥟" },
  { name: "鲜肉小笼包", group: "包点", icon: "🥟" },
  { name: "生煎包", group: "包点", icon: "🥟" },
  { name: "陕西肉夹馍", group: "饼卷", icon: "🥙" },
  { name: "鸡蛋灌饼", group: "饼卷", icon: "🌯" },
  { name: "牛肉墨西哥卷", group: "饼卷", icon: "🌯" },
  { name: "酸菜鱼", group: "汤锅", icon: "🥘" },
  { name: "番茄鱼片汤饭", group: "汤锅", icon: "🥘" },
  { name: "羊肉汤泡饼", group: "汤锅", icon: "🥘" },
  { name: "鸡丝粥", group: "粥", icon: "🥣" },
  { name: "金枪鱼三明治", group: "轻食", icon: "🥪" },
];

export function drawDish(recent: readonly Dish[], random = Math.random): Dish {
  const current = recent.at(-1);
  const fresh = dishes.filter(dish => !recent.some(previous => previous.name === dish.name));
  const differentGroup = fresh.filter(dish => dish.group !== current?.group);
  const pool = differentGroup.length ? differentGroup : fresh;

  if (pool.length) return pool[Math.floor(random() * pool.length)];

  // When the history covers the pool, bring back the oldest alternative.
  return recent.find(dish => dish.name !== current?.name) ?? dishes[0];
}
