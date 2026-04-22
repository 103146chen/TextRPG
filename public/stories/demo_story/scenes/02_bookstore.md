---
id: 02_bookstore
title: 第二幕 · 書店
background: bookstore_interior.svg
bgm: warm_cafe.mp3
---

@bg bookstore_interior.svg fade=1000
@bgm warm_cafe

推開門，門上的銅鈴輕輕響了一下。空氣裡有紙張老去的味道，還有一絲咖啡香。

@show 店長 center smile
店長: 「歡迎。」

店長是個戴眼鏡的中年男子，從吧台後抬起頭。

:: if chose_bookstore
他的笑容裡帶著點了然——大概是看過太多像我這樣為了躲雨而衝進來的客人。
:: else
他看了看我濕漉漉的頭髮，又看了看我的表情。

店長: 「淋到了？先擦擦頭髮吧，櫃子裡有毛巾。」

主角: 「謝謝……」

我接過毛巾的時候，突然有點不好意思——為自己在外面猶豫那麼久而感到不好意思。
:: endif

@hide 店長 fade=600

書店比想像中深。木頭書架一路延伸進去，最裡面還有個小小的閱讀區。我隨意沿著書架走著，目光掃過那些書脊。

:: if chose_bookstore
@set book_mood = calm
主角(心聲): 真是個舒服的地方。雨聲被隔在門外，時間好像也慢了下來。
:: else
@set book_mood = wet
我的袖子還在滴水。我往最裡面走，想找個不會弄濕書的地方站著。
:: endif

# === 這裡是關鍵的相遇場景 ===
# 小鈴的登場會依據前面的 book_mood 有微妙不同

@show 小鈴 right normal
就在這時，我注意到閱讀區靠窗的位置，坐著一個女孩。

她大約二十出頭，短髮，穿著米色的針織衫，膝上攤著一本很厚的書。陽光——不，是雨天透過玻璃的微光——落在她的側臉。

:: if book_mood == "calm"
她感受到我的視線，抬起頭，對我微微點了點頭。算不上是打招呼，更像是一種「我注意到你了」的禮貌。
:: elif book_mood == "wet"
我的袖口滴了一滴水到地板上，啪的一聲。她抬起頭看向我，眼神裡沒有責備，只有一絲擔心。
@show 小鈴 right shy
小鈴: 「你、你沒事吧？淋了好多雨……」

主角: 「啊，沒事沒事。我自己會小心。」
:: endif

我在距離她兩個書架的位置停下，假裝在看書脊。視線卻不自覺地飄過去。

@set met_ling = true

# 她手上的書
主角(心聲): 她在看什麼呢？

書的封面我看不清，只能看到側面一排很細的燙金字。

?? choice
- text: 走近一點，想看清楚她在讀什麼
  set: { curious_about_book: true }
  goto: interaction
- text: 把注意力拉回書架，不打擾別人
  set: { curious_about_book: false }
  goto: interaction
??

:: label interaction

:: if curious_about_book
我往她的方向走了兩步，刻意保持在合理的距離。

她似乎察覺了，抬起頭來。四目相對的那一刻，我心虛地把視線移到她旁邊那個書架。

@show 小鈴 right smile
小鈴: 「……你在找什麼書嗎？」

她的聲音比想像中柔軟，尾音微微上揚。
:: else
我強迫自己把注意力放回眼前的書架。是一排舊的文學譯本，書脊都已經泛黃了。

我伸手抽出一本，隨手翻開。

但不知道為什麼，書頁上的字一個也讀不進去。

@show 小鈴 right normal
: 「那本書……」

我嚇了一跳。她不知道什麼時候走過來的，站在書架的另一側，隔著空隙看著我手裡的書。

小鈴: 「抱歉，嚇到你了。只是那本書我讀過，想說……如果你沒讀過，蠻推薦的。」
:: endif

@goto 03_conversation
