# 《鴻門宴》圖片素材需求與 AI 生圖提示詞 (Prompt) 總表

本文件統整《鴻門宴》故事所需的所有背景與立繪素材。
建議風格：**水墨×寫實歷史畫** (Realistic ink-wash historical painting)，呼應秦漢題材的厚重感。

## 🎨 圖片風格設定
- **整體風格**: 寫實水墨歷史畫 (Realistic Chinese ink-wash painting with muted colors)、傳統媒材質感。
- **背景圖比例**: 16:9 寬幅 (使用 `16:9 aspect ratio, wide landscape`)。絕對不能有文字、印章。
- **立繪圖比例**: 1:2 (需在生成後透過影像處理裁切為 512x1024)。
- **立繪背景**: 必須是純白背景 (`pure solid white background`)，且強制排除文字與印章 (`NO text, NO stamps, NO watermarks, NO signatures`) 方便去背。
- **立繪一致性**: 採用「基準圖 + 差分編輯」工作流。

---

## 🏞️ 背景圖 (Backgrounds)

| 檔案名稱 | 場景描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- |
| **wuzhong_river.png** | **會稽江畔**<br>秦代江南水鄉，浙江渡口，遠處有帝王儀仗車隊經過，人群伏於道旁。 | `realistic Chinese ink-wash painting, muted colors, Qin dynasty riverside in Jiangnan, ancient ferry crossing, imperial procession with banners in the distance, crowds kneeling by the road, misty atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **julu_battlefield.png** | **鉅鹿戰場**<br>秦末古戰場，烽煙四起，破碎的軍旗與戰車，天色昏黃，肅殺悲壯。 | `realistic Chinese ink-wash painting, ancient Chinese battlefield at Julu, burning war banners, broken chariots, smoke and dust, ochre sky, epic and desolate atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **hongmen_camp.png** | **鴻門軍營(日)**<br>楚軍大營，連綿的軍帳與旌旗，士兵林立，氣勢威嚴。 | `realistic Chinese ink-wash painting, vast ancient Chinese military camp in daylight, rows of war tents, black and red Chu banners, armed soldiers, imposing atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **hongmen_camp_night.png** | **鴻門軍營(夜)**<br>深夜的中軍大帳內部，燭火搖曳，案上有地圖與酒器，光影昏暗壓抑。 | `realistic Chinese ink-wash painting, interior of an ancient Chinese general's war tent at night, flickering candlelight, maps and bronze wine vessels on a low table, dark oppressive shadows, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **banquet_tent.png** | **鴻門宴大帳**<br>宴席大帳內部，漆案分列、酒器羅列，席位分東西南北，帳幕深垂，華貴中透著殺氣。 | `realistic Chinese ink-wash painting, interior of a grand ancient Chinese banquet tent, Qin-Han dynasty style, lacquered low tables with bronze wine vessels, seating mats arranged around, heavy drapery, luxurious yet ominous atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **gaixia_night.png** | **垓下之夜**<br>被圍困的楚軍營地，夜色深沉，遠方四面是漢軍營火，天空低垂，絕望蒼涼。 | `realistic Chinese ink-wash painting, besieged ancient military camp at night, distant enemy campfires surrounding on all sides like stars on the horizon, deep blue darkness, tragic and desolate atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **wujiang_shore.png** | **烏江岸邊**<br>破曉的江岸，江水滔滔，一葉孤舟泊於岸邊，對岸隱約可見，悲壯遼闊。 | `realistic Chinese ink-wash painting, vast river shore at dawn, turbulent gray river, a single small wooden boat moored by the bank, far shore barely visible in mist, tragic and epic atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **xinan_night.png** | **新安夜營**<br>秦末冬夜軍營，帳篷密集，篝火微弱，二十餘萬降卒的營地，氣氛壓抑陰沉。 | `realistic Chinese ink-wash painting, muted colors, ancient Chinese military camp at night in winter, dense rows of simple tents, dim campfires, oppressive and gloomy atmosphere, cold mist, thousands of prisoners' camp, desolate, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **hangu_pass.png** | **函谷關**<br>黃昏時的函谷關，雄關高聳，城門緊閉，城樓上飄著旗幟，大軍在關前集結。 | `realistic Chinese ink-wash painting, muted colors, Hangu Pass at dusk, towering ancient Chinese fortress gate tightly shut, war banners on the walls, massive army assembling before the gate, imposing cliff walls on both sides, dramatic sky, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **baqiao_camp.png** | **霸上漢營遠眺**<br>從山丘上遠眺霸上的漢軍營地，營火點點，壁壘高築，弓弩上弦，晨光微曦。 | `realistic Chinese ink-wash painting, muted colors, distant view of a fortified Han army camp at Bashang from a hilltop, high palisade walls, rows of tents, faint dawn light, tense military atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **banquet_tent_chaos.png** | **鴻門宴大帳（混亂）**<br>宴帳內部，打翻的酒器、血跡斑斑、帷幕扯裂，殘燭搖曳，殺戮後的混亂場面。 | `realistic Chinese ink-wash painting, muted colors, interior of an ancient Chinese banquet tent in chaos, overturned bronze wine vessels, blood stains on floor, torn drapery, flickering dying candles, aftermath of violence, dark and ominous atmosphere, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **xianyang_fire.png** | **咸陽大火**<br>咸陽宮殿在熊熊烈火中燃燒，火光沖天，濃煙滾滾，壯麗又毀滅的場景。 | `realistic Chinese ink-wash painting, muted colors, grand ancient Chinese palace of Xianyang burning in massive flames, fire reaching the sky, thick black smoke, epic destruction, night sky illuminated by inferno, tragic and magnificent, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **pengcheng_battle.png** | **彭城之戰**<br>激烈的古代戰場，楚軍以少勝多，旌旗翻飛，塵土飛揚，河水中倒下的士兵。 | `realistic Chinese ink-wash painting, muted colors, epic ancient Chinese battle at Pengcheng, small elite Chu cavalry charging against a vast army, flying war banners, dust and chaos, soldiers falling into a river, dramatic and violent, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |
| **gaixia_breakout.png** | **垓下突圍**<br>夜間騎兵突圍的場面，少數騎兵衝出重圍，火把零星，塵土飛揚，緊迫激烈。 | `realistic Chinese ink-wash painting, muted colors, desperate cavalry breakout at night, small group of horsemen charging through enemy lines, scattered torches, dust clouds, urgent and intense atmosphere, deep blue darkness, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures, pure clean painting` |

---

## 🧍 立繪 (Sprites) - 基準圖與差分編輯工作流

為確保同角色的臉部與服裝在不同表情下保持 100% 一致，請採用 **「基準圖 + 局部修改 (Image-to-Image / Inpainting)」** 工作流：
1. 先使用 **基礎立繪提示詞 (Base Prompt)** 生成該角色的 `normal` (普通/預設) 表情。
2. 基準圖確認無誤後，將其作為參考圖 (Image Input) 餵給 AI，並使用對應的 **差分表情修改提示詞 (Edit Prompts)** 僅針對臉部進行表情替換。

| 角色 | 角色描述 | 基礎立繪提示詞 (Base Prompt - Normal) | 差分表情修改提示詞 (Edit Prompts) |
| :--- | :--- | :--- | :--- |
| **項羽** | 二十多歲的楚霸王，重瞳、粗獷劍眉、臉部稜角分明，黑紅色楚式戰甲。 | `realistic Chinese ink-wash painting, pure solid white background, young Chinese warlord in his twenties, Xiang Yu, extremely tall and muscular, distinct heavy eyebrows, double pupils, sharp strong jawline, black and red Chu dynasty armor, imposing and fierce aura, confident and normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **angry**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a furious, roaring expression with intense anger.`<br>**sad**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a tragic, sorrowful expression with deep despair.` |
| **范增** | 七十歲老謀士，白鬚白髮，高額頭，眼神銳利如鷹，深衣高冠。 | `realistic Chinese ink-wash painting, pure solid white background, seventy-year-old Chinese strategist, long white beard and white hair, high forehead, sharp eagle-like piercing eyes, dark Qin-Han dynasty scholar robes, tall hat, jade pendant at waist, perfectly calm calculating expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **urgent**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to an urgent, intense stare with slightly furrowed brows.`<br>**angry**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a furious, indignant expression, glaring angrily.` |
| **劉邦** | 四十八歲男子，面相寬厚，短鬚，高挺鼻樑，樸素深衣。 | `realistic Chinese ink-wash painting, pure solid white background, middle-aged Chinese man around fifty, Liu Bang, broad shrewd face with short beard, prominent nose, plain dark Han dynasty robes, affable and slightly smiling normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **humble**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a deeply apologetic, humble expression with an ingratiating, flattering smile.`<br>**nervous**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a highly nervous, sweating, and fearful expression.` |
| **張良** | 狀貌如婦人好女，清秀瘦削的文雅臉龐，素色深衣。 | `realistic Chinese ink-wash painting, pure solid white background, slender refined Chinese strategist, Zhang Liang, delicate almost feminine handsome features, clean-shaven, pale skin, plain elegant white robes, composed gentle normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **calm**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a perfectly calm, unreadable, and stoic expression.` |
| **項伯** | 忠厚的中年武人臉龐，略顯圓潤，楚甲罩披風。 | `realistic Chinese ink-wash painting, pure solid white background, middle-aged Chinese noble warrior, honest loyal face, slightly round facial features, Chu dynasty armor with cloak, kind sincere normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **earnest**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a highly earnest, pleading, and deeply concerned expression.` |
| **項莊** | 年輕的楚軍武將，精悍冷峻，劍眉星目，手按劍柄。 | `realistic Chinese ink-wash painting, pure solid white background, young lean Chinese swordsman, sharp eyebrows, cold sharp piercing eyes, Chu dynasty armor, hand on sword hilt, perfectly calm and focused normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | *(無其他差分，僅需要 normal 表情)* |
| **樊噲** | 屠狗出身的猛將，虯髯怒目，圓瞪雙眼，粗獷大漢。 | `realistic Chinese ink-wash painting, pure solid white background, massive fierce Chinese warrior, Fan Kuai, bristling thick beard, wide round eyes, holding sword and shield, hair slightly messy, bold hearty normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **fierce**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to eyes blazing with extreme fury, glaring fiercely, and hair standing up in rage.` |
| **虞姬** | 楚地美人，瓜子臉，柳葉眉，漢代曲裾深衣。 | `realistic Chinese ink-wash painting, pure solid white background, beautiful ancient Chinese woman, Consort Yu, oval face, delicate willow-leaf eyebrows, elegant Han dynasty curved-hem robes, graceful and ethereal, gentle serene normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **sad**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a sorrowful, tearful, and heartbroken expression.` |
| **亭長** | 滄桑老船夫，滿臉皺紋，粗布短衣，戴斗笠。 | `realistic Chinese ink-wash painting, pure solid white background, weathered old Chinese boatman, face deeply covered with wrinkles, coarse hemp clothes, bamboo hat, sincere urgent normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | *(無其他差分，僅需要 normal 表情)* |

---

## 🎵 音樂素材需求 (BGM)

| 檔案名稱 | 使用場景 | 氛圍描述 |
| :--- | :--- | :--- |
| **bgm_ambition.mp3** | 第一章(少年) | 開闊、帶少年鋒芒的古風曲，簫與鼓 |
| **bgm_war_drums.mp3** | 第二章(鉅鹿)、追擊/旦日結局 | 急促戰鼓、號角，金戈鐵馬 |
| **bgm_tension.mp3** | 第三~五章、第九章 | 低沉弦樂，暗流洶湧的緊張感 |
| **bgm_banquet.mp3** | 第六章(宴席開場) | 表面雍容的宴樂(編鐘、瑟)，底下藏著不安 |
| **bgm_sword_dance.mp3** | 第七、八章 | 節奏漸緊的琵琶/鼓點，劍拔弩張 |
| **bgm_gaixia.mp3** | 第十章(垓下) | 蒼涼的塤與二胡，四面楚歌的悲愴 |
| **bgm_ending_tragic.mp3** | 烏江、帳中玦、血宴結局 | 悲壯輓歌 |
| **bgm_ending_open.mp3** | 渡江結局 | 留白、開放式的琴音 |
