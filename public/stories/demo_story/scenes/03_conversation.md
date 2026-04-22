---
id: 03_conversation
title: 第三幕 · 對話
background: bookstore_interior.svg
---

# 對話開始。根據 curious_about_book 的不同，起手式會不同，但會自然匯合

:: if curious_about_book
主角: 「嗯……其實我只是在躲雨。不過看妳讀得那麼專心，有點好奇那是什麼書。」

@show 小鈴 right smile
小鈴: 「就一本小說而已啦。」

她把書翻到封面讓我看——是一本我沒聽過的台灣作家寫的作品。

小鈴: 「講一個在舊書店工作的女生的故事。我每次雨天來，都會讀一點。有點像儀式。」

主角: 「儀式？」

小鈴: 「嗯，大概是這樣。下雨的書店，書裡的女生也在書店，感覺時間會疊在一起。」

@set talked_about_ritual = true
:: else
主角: 「啊，還沒讀過。妳推薦？」

小鈴: 「嗯。」

她點頭的樣子很認真。

小鈴: 「這本是我很喜歡的。第一次讀的時候也是在下雨天，從此就記得了。」

主角: 「妳常來這家書店？」

小鈴: 「天氣不好的時候會來。」她想了一下，補充：「晴天的書店太亮了，字會跑掉。」

主角(心聲): 字會跑掉？這是什麼有趣的說法。

@set talked_about_books = true
:: endif

# 無論哪個分支，都會進入共同的談話段落
窗外雨聲綿密，書店裡只有我們的對話，和遠處店長偶爾翻動報紙的聲響。

小鈴: 「你呢？你是專程來這裡的，還是……」

:: if chose_bookstore
主角: 「我是看到招牌才進來的。覺得這種天氣，應該要有書陪著才對。」

@show 小鈴 right smile
小鈴: 「那我們想的一樣。」

@set shared_taste = true
:: else
主角: 「老實說，我是在對街躲了很久才跑過來的。」

@show 小鈴 right shy
小鈴: 「啊……是嗎？」她笑了，帶著一點不好意思替我覺得不好意思的樣子。「那……應該要先喝點什麼，暖一下身體。店長的咖啡不錯。」

@set she_offered_coffee = true
:: endif

# 這個段落是共同收束
時間在我們的談話間不知不覺流逝。我看了一眼手錶——

@set check_watch = true
主角(心聲): 已經五點半了？

離約定的時間只剩半小時。可是外面的雨，還沒有要停的意思。

@set rain_still_going = true

主角: 「那個……我等一下還有約，得先走了。」

@show 小鈴 right normal
小鈴: 「嗯，路上小心。雨好像變大了。」

她說完又低下頭看書，但我注意到，她的視線並沒有真的落在文字上。

# === 關鍵抉擇：這個選擇會決定結局走向 ===
# 但注意，選項之間的差異不是「好/壞」而是不同的關係形式

我走到門口，手搭在銅把上。回頭看她——

?? choice
- text: 把自己的傘（其實沒有傘）的事情說出來，問她要不要一起走
  set: { offer_to_share: true }
  goto: final_choice
- text: 注意到櫃檯旁有把沒人領的舊傘，想把它留給她
  set: { leave_umbrella: true }
  goto: final_choice
- text: 只是向她揮手道別，走進雨裡
  set: { just_leave: true }
  goto: final_choice
- text: 走回去，問她推薦的那本書在哪裡（純粹想多聊一點）
  set: { ask_about_book: true }
  goto: final_choice
??

:: label final_choice

# 根據選擇走向四個不同的結局場景
:: if offer_to_share
@goto 04a_shared_umbrella
:: elif leave_umbrella
@goto 04b_left_umbrella
:: elif just_leave
@goto 04c_solitude
:: elif ask_about_book
@goto 04d_books
:: endif
