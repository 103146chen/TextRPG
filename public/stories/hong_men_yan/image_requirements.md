# 《鴻門宴》圖片素材需求與 AI 生圖提示詞 (Prompt) 總表

本文件統整《鴻門宴》故事所需的所有背景與立繪素材。
建議風格:**水墨×寫實歷史畫** (Realistic ink-wash historical painting),呼應秦漢題材的厚重感。

## 🎨 圖片風格設定
- **整體風格**: 寫實水墨歷史畫 (Realistic Chinese ink-wash painting with muted colors)、傳統媒材質感。
- **背景圖比例**: 16:9 (`--ar 16:9`)。
- **立繪圖比例**: 1:2 (`--ar 1:2`),白色背景 (`white background`) 方便去背。

---

## 🏞️ 背景圖 (Backgrounds)

| 檔案名稱 | 場景描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- |
| **wuzhong_river.png** | **會稽江畔**<br>秦代江南水鄉,浙江渡口,遠處有帝王儀仗車隊經過,人群伏於道旁。 | `realistic Chinese ink-wash painting, muted colors, Qin dynasty riverside in Jiangnan, ancient ferry crossing, imperial procession with banners in the distance, crowds kneeling by the road, misty atmosphere, highly detailed --ar 16:9` |
| **julu_battlefield.png** | **鉅鹿戰場**<br>秦末古戰場,烽煙四起,破碎的軍旗與戰車,天色昏黃,肅殺悲壯。 | `realistic Chinese ink-wash painting, ancient Chinese battlefield at Julu, burning war banners, broken chariots, smoke and dust, ochre sky, epic and desolate atmosphere, highly detailed --ar 16:9` |
| **hongmen_camp.png** | **鴻門軍營(日)**<br>楚軍大營,連綿的軍帳與旌旗,士兵林立,氣勢威嚴。 | `realistic Chinese ink-wash painting, vast ancient Chinese military camp in daylight, rows of war tents, black and red Chu banners, armed soldiers, imposing atmosphere, highly detailed --ar 16:9` |
| **hongmen_camp_night.png** | **鴻門軍營(夜)**<br>深夜的中軍大帳內部,燭火搖曳,案上有地圖與酒器,光影昏暗壓抑。 | `realistic Chinese ink-wash painting, interior of an ancient Chinese general's war tent at night, flickering candlelight, maps and bronze wine vessels on a low table, dark oppressive shadows, highly detailed --ar 16:9` |
| **banquet_tent.png** | **鴻門宴大帳**<br>宴席大帳內部,漆案分列、酒器羅列,席位分東西南北,帳幕深垂,華貴中透著殺氣。 | `realistic Chinese ink-wash painting, interior of a grand ancient Chinese banquet tent, Qin-Han dynasty style, lacquered low tables with bronze wine vessels, seating mats arranged around, heavy drapery, luxurious yet ominous atmosphere, highly detailed --ar 16:9` |
| **gaixia_night.png** | **垓下之夜**<br>被圍困的楚軍營地,夜色深沉,遠方四面是漢軍營火,天空低垂,絕望蒼涼。 | `realistic Chinese ink-wash painting, besieged ancient military camp at night, distant enemy campfires surrounding on all sides like stars on the horizon, deep blue darkness, tragic and desolate atmosphere, highly detailed --ar 16:9` |
| **wujiang_shore.png** | **烏江岸邊**<br>破曉的江岸,江水滔滔,一葉孤舟泊於岸邊,對岸隱約可見,悲壯遼闊。 | `realistic Chinese ink-wash painting, vast river shore at dawn, turbulent gray river, a single small wooden boat moored by the bank, far shore barely visible in mist, tragic and epic atmosphere, highly detailed --ar 16:9` |

---

## 🧍 立繪 (Sprites)

*註:請將提示詞中的 `[...]` 替換為該次生圖需要的具體表情。*

| 角色 | 需要的表情 | 角色描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- | :--- |
| **項羽** | 1. `normal`<br>2. `angry`<br>3. `sad` | 二十多歲的楚國霸王,身材魁梧(八尺餘、力能扛鼎),重瞳,黑紅色楚式戰甲,氣勢懾人。 | `realistic Chinese ink-wash painting, character design, white background, young Chinese warlord in his twenties, Xiang Yu, extremely tall and muscular, black and red Chu dynasty armor, imposing and fierce aura, [confident expression / furious roaring expression / tragic sorrowful expression] --ar 1:2` |
| **范增** | 1. `normal`<br>2. `urgent`<br>3. `angry` | 七十歲的老謀士,白鬚白髮,深衣高冠,眼神銳利,腰間佩玉玦。 | `realistic Chinese ink-wash painting, character design, white background, seventy-year-old Chinese strategist, long white beard, dark Qin-Han dynasty scholar robes, tall hat, jade pendant at waist, sharp piercing eyes, [calm calculating expression / urgent intense stare / furious indignant expression] --ar 1:2` |
| **劉邦** | 1. `normal`<br>2. `humble`<br>3. `nervous` | 四十八歲左右的男子,面相寬厚帶世故,鬚髯,樸素的深衣,擅長賠笑與示弱。 | `realistic Chinese ink-wash painting, character design, white background, middle-aged Chinese man around fifty, Liu Bang, broad shrewd face with beard, plain dark Han dynasty robes, [affable smiling expression / deeply bowing apologetic expression with ingratiating smile / nervous sweating expression] --ar 1:2` |
| **張良** | 1. `normal`<br>2. `calm` | 清瘦文雅的謀士,狀貌如婦人好女,素色深衣,沉著冷靜。 | `realistic Chinese ink-wash painting, character design, white background, slender refined Chinese strategist, Zhang Liang, delicate almost feminine handsome features, plain elegant robes, [composed gentle expression / perfectly calm unreadable expression] --ar 1:2` |
| **項伯** | 1. `normal`<br>2. `earnest` | 中年楚國貴族武人,項羽的叔父,面容忠厚,楚式甲胄外罩披風。 | `realistic Chinese ink-wash painting, character design, white background, middle-aged Chinese noble warrior, honest loyal face, Chu dynasty armor with cloak, [kind sincere expression / earnest pleading expression] --ar 1:2` |
| **項莊** | 1. `normal` | 年輕的楚軍武將,項羽堂弟,精悍冷峻,手按劍柄。 | `realistic Chinese ink-wash painting, character design, white background, young lean Chinese swordsman in Chu dynasty armor, cold sharp expression, hand on sword hilt --ar 1:2` |
| **樊噲** | 1. `fierce`<br>2. `normal` | 屠狗出身的猛將,虯髯怒目,持劍擁盾,粗獷豪邁,頭髮上指、目眥盡裂的氣勢。 | `realistic Chinese ink-wash painting, character design, white background, massive fierce Chinese warrior, Fan Kuai, bristling beard, holding sword and shield, hair standing up, [eyes blazing with fury, glaring / bold hearty expression] --ar 1:2` |
| **虞姬** | 1. `sad`<br>2. `normal` | 楚地美人,漢代曲裾深衣,清麗絕俗,眼含悲意。 | `realistic Chinese ink-wash painting, character design, white background, beautiful ancient Chinese woman, Consort Yu, elegant Han dynasty curved-hem robes, graceful and ethereal, [sorrowful tearful expression / gentle serene expression] --ar 1:2` |
| **亭長** | 1. `normal` | 烏江亭長,滄桑的老船夫模樣,粗布短衣,斗笠,面容懇切。 | `realistic Chinese ink-wash painting, character design, white background, weathered old Chinese boatman, coarse hemp clothes, bamboo hat, sincere urgent expression --ar 1:2` |

---

## 🎵 音樂素材需求 (BGM)

| 檔案名稱 | 使用場景 | 氛圍描述 |
| :--- | :--- | :--- |
| **bgm_ambition.mp3** | 第一章(少年) | 開闊、帶少年鋒芒的古風曲,簫與鼓 |
| **bgm_war_drums.mp3** | 第二章(鉅鹿)、追擊/旦日結局 | 急促戰鼓、號角,金戈鐵馬 |
| **bgm_tension.mp3** | 第三~五章、第九章 | 低沉弦樂,暗流洶湧的緊張感 |
| **bgm_banquet.mp3** | 第六章(宴席開場) | 表面雍容的宴樂(編鐘、瑟),底下藏著不安 |
| **bgm_sword_dance.mp3** | 第七、八章 | 節奏漸緊的琵琶/鼓點,劍拔弩張 |
| **bgm_gaixia.mp3** | 第十章(垓下) | 蒼涼的塤與二胡,四面楚歌的悲愴 |
| **bgm_ending_tragic.mp3** | 烏江、帳中玦、血宴結局 | 悲壯輓歌 |
| **bgm_ending_open.mp3** | 渡江結局 | 留白、開放式的琴音 |
