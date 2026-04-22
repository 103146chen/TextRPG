---
id: 04a_shared_umbrella
title: 結局 · 共撐一傘
background: street_rain_evening.svg
bgm: warm_piano_ending.mp3
---

@bg street_rain_evening.svg fade=1500

主角: 「那個……其實我沒帶傘。」

@show 小鈴 right normal
她愣了一下，然後笑出聲。

:: if she_offered_coffee
小鈴: 「我就想說，躲了一小時雨跑進來的人，怎麼可能會有傘。」
:: elif talked_about_ritual
小鈴: 「所以剛剛那些話是鋪陳？」她的眼神裡有笑意。
:: else
小鈴: 「真的假的？那你剛剛還說要走？」
:: endif

主角: 「所以……如果妳方便的話，能不能……分我一把傘？或者，一起走一段路？」

她沒有馬上回答。她把書小心地闔上，放進肩背的布袋裡。然後站起來，對我伸出手——手裡拿著一把深藍色的長柄傘。

@show 小鈴 right smile
小鈴: 「我本來就打算這時候走了。」

我們一起走到門口，我幫她扶著門。銅鈴又響了一聲。

@bg street_rain_evening.svg fade=800

雨依然很大，但在傘下感覺沒有那麼冷。她的肩膀靠我很近，兩個人都盡量不讓對方淋到。

:: if chose_bookstore && talked_about_ritual
主角: 「如果下次也下雨……」

她抬頭看我，等我把話說完。

主角: 「妳還會去那家書店嗎？」

小鈴: 「會。」她很快地答。「你也要來的話，下次換我推薦書給你。」
:: else
主角(心聲): 這是我第一次覺得，下雨也沒有那麼糟。

走到十字路口，她指向右邊，我要往左邊。

主角: 「謝謝妳的傘。」

小鈴: 「不客氣。」她把傘推給我。「你拿著，下次還我就好。」

主角: 「……下次？」

她沒有解釋，只是笑。
:: endif

@hide 小鈴 fade=1500

我看著她的身影消失在雨裡，手裡握著一把不屬於我的傘。

主角(心聲): 下次。

這兩個字在心裡轉了很久。

@wait 1000

@ending id="ending_warmth" title="共撐一傘" desc="世界上所有的偶然都暗中有伏筆。你們在傘下走了很遠，而且，還會繼續走下去。"
