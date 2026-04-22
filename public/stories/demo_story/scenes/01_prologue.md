---
id: 01_prologue
title: 序章 · 雨聲
background: street_rain.svg
bgm: rain_piano.mp3
next: 02_bookstore
---

@bg street_rain.svg fade=1200
午後的雨來得毫無預警。
我站在騎樓下，看著灰濛濛的天空把整條街染成水墨畫的顏色。
主角: 「真倒楣……傘不是前天才帶回家的嗎？」
手錶指著四點半，離約定的見面時間還有兩個小時。

?? choice
- text: 往前走到對街那家舊書店躲雨
  set: { chose_bookstore: true }
  goto: continue
- text: 留在騎樓，等待雨停
  set: { chose_bookstore: false }
  goto: continue
??

:: label continue

:: if chose_bookstore
我記得這條街的轉角有間舊書店，招牌是手寫的，店面小小的，總是亮著暖黃的燈。
主角(心聲): 與其站在這裡淋風，不如進去看看吧。
我深吸一口氣，頂著外套衝進了雨裡。短短的距離，衣服下擺還是濕了一片。
:: else
我靠著柱子，看雨水從屋簷滑落，在地上敲出密集的節奏。
主角(心聲): 反正，也沒地方可去。
十分鐘過去，雨沒有要停的意思。我開始後悔。二十分鐘過去，對街書店的燈光看起來越來越誘人。
終於，我忍不住了。頂著外套衝進了雨裡。
:: endif
@set entered_bookstore = true
