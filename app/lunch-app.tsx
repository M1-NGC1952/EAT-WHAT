"use client";

import { useRef, useState } from "react";
import { drawDish, type Dish } from "./dish-draw";

export default function LunchApp() {
  const [dish, setDish] = useState<Dish>();
  const [confirmed, setConfirmed] = useState(false);
  const recent = useRef<Dish[]>([]);

  function draw() {
    const next = drawDish(recent.current);
    recent.current = [...recent.current.slice(-2), next];
    setDish(next);
    setConfirmed(false);
  }

  return (
    <main className="lunch">
      <header className="lunch-brand"><span aria-hidden="true">吃</span> 今天吃什么</header>
      <section className="lunch-card" aria-label="午餐选择器">
        <div className="lunch-content" aria-live="polite" aria-atomic="true">
          <span className="lunch-icon" aria-hidden="true">{dish?.icon ?? "🍽️"}</span>
          {!dish ? (
            <>
              <h1>不知道吃什么？</h1>
              <p>随机一道，看看有没有灵感。</p>
            </>
          ) : (
            <h1>{confirmed ? "好，今天就吃" : "今天试试"}<strong>{dish.name}</strong>{confirmed ? "。" : "？"}</h1>
          )}
        </div>
        <div className="lunch-actions">
          {!dish ? (
            <button className="lunch-primary" onClick={draw}>开始随机 <span aria-hidden="true">→</span></button>
          ) : confirmed ? (
            <>
              <a className="lunch-secondary" href={`https://uri.amap.com/search?keyword=${encodeURIComponent(dish.name)}&src=lunch-picker`} target="_blank" rel="noopener noreferrer">去地图搜{dish.name} ↗</a>
              <button className="lunch-quiet" onClick={draw}>再随机一次</button>
            </>
          ) : (
            <>
              <button className="lunch-primary" onClick={() => setConfirmed(true)}>就吃这个</button>
              <button className="lunch-secondary" onClick={draw}>换一个</button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
