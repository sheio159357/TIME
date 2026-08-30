# TIME — 24 小時生活狀態時間追蹤

一個極簡的個人狀態時間追蹤 App。點一下狀態按鈕，系統自動記錄「上一個狀態結束、下一個狀態開始」，永遠不會有時間空白。

這個專案是一個 **PWA（Progressive Web App）**：純 HTML/CSS/JS，沒有任何 build 工具或後端，可以直接放上 GitHub Pages，然後在手機瀏覽器打開、加到主畫面，當成一個 App 使用。

---

## ⚠️ 請先看：關於「Widget」的重要說明

需求文件中的 Phase 9（手機桌面 Widget）**無法用純網頁技術做到**。

- iOS 的主畫面 Widget（WidgetKit）必須用 Swift 寫成原生 App，透過 Xcode 編譯、上架或用 TestFlight/側載安裝。
- Android 的主畫面 Widget（App Widget / Glance）必須用 Kotlin 寫成原生 App，透過 Android Studio 編譯成 APK。
- 純 HTML/CSS/JS 檔案（不管放在 GitHub 上還是任何網站）都無法在手機主畫面放置一個「持續即時更新」的原生 Widget。這是作業系統層級的限制，不是程式碼寫法的問題。

**這個專案做到的事**：
- 一個功能完整的 App（Phase 1–8 全部實作），可以「加到主畫面」變成一個有圖示、全螢幕、離線可用的 App。
- 打開 App 的 NOW 頁面，就能立刻看到目前狀態 + 即時計時，效果等同於 Widget 想呈現的資訊，只是需要點開 App，而不是在桌面上直接看到。

**如果你之後真的需要原生 Widget**，有兩條路：
1. 用 React Native + Expo 搭配原生 Widget 套件（例如 `react-native-android-widget`、iOS 需另外寫 WidgetKit extension），這仍然需要 Xcode / Android Studio 編譯環境，不是單純上傳 GitHub 就能完成的。
2. 先用這個 PWA 版本驗證整套「狀態→時間→歷史→統計」邏輯是否符合你的使用習慣，之後再決定是否要投入原生開發成本做 Widget。

---

## 這個版本做了什麼（對照需求文件）

- ✅ 六種固定狀態、固定顏色、固定順序，首頁 2×3 大按鈕
- ✅ 點擊新狀態 = 自動結束上一狀態 + 開始新狀態，以 **Timestamp** 為準（不是每秒 +1），關閉 App / 重開手機都能正確回復
- ✅ 重複點擊目前狀態不會重新計時（Rule 4）
- ✅ 第一次啟動的「What are you doing now?」引導畫面
- ✅ 跨午夜不中斷狀態，只在 History / Stats 做每日切割（Rule 6/7）
- ✅ History 頁面：可看任一天的完整時間軸，可點擊區段編輯（狀態／開始／結束時間）、可 Split 切割
- ✅ 編輯或切割時，資料模型保證不會產生時間空白或重疊（技術細節見下方）
- ✅ Stats 頁面：固定順序的橫向柱狀圖，已完整結束的日期會顯示 24:00:00／100%；今天則標示為「非正式即時預覽」
- ✅ Local-first：所有資料存在手機瀏覽器的 localStorage，原始時間區段（change points）為唯一真實資料來源，每日統計永遠是重新計算出來的
- ⚠️ 桌面 Widget：見上方說明

---

## 資料模型（給之後維護的人看）

沒有用「一堆 segment」互相對齊的方式儲存，而是用一條**排序好的「狀態改變時間點」清單**（change points）：

```
[{ time: t0, state: "Sleep" }, { time: t1, state: "Work" }, { time: t2, state: "Evolution" }, ...]
```

- 第 i 段的狀態 = `changePoints[i].state`，時間範圍 = `[changePoints[i].time, changePoints[i+1].time)`
- 最後一個點代表「現在正在進行」的狀態，結束時間永遠是 `now`
- 因為每一段的結束時間就是下一段的開始時間（同一個數字），**時間空白與重疊在資料結構上就不可能發生**，不需要額外驗證程式碼去「補洞」
- 編輯某一段的開始/結束時間，等於直接修改對應的 change point，系統會檢查新時間不能超過前後鄰居的範圍
- Split 就是在中間插入一個新的 change point

---

## 部署到 GitHub Pages（下載到手機安裝的完整步驟）

1. 在 GitHub 上新增一個 repository（例如叫 `time-app`）
2. 把這個資料夾裡的所有檔案（`index.html`、`styles.css`、`app.js`、`manifest.webmanifest`、`sw.js`、`icons/`）上傳到 repo 的根目錄
   - 用網頁介面：repo 頁面點 **Add file → Upload files**，把檔案拖進去，Commit
   - 或用 git 指令：
     ```bash
     git init
     git add .
     git commit -m "TIME app v1"
     git branch -M main
     git remote add origin https://github.com/<你的帳號>/time-app.git
     git push -u origin main
     ```
3. 到 repo 的 **Settings → Pages**
4. Source 選擇 **Deploy from a branch**，Branch 選 `main`，資料夾選 `/ (root)`，按 Save
5. 等 1–2 分鐘，GitHub 會給你一個網址，通常是：
   `https://<你的帳號>.github.io/time-app/`

### 在手機安裝

**iPhone (Safari)**
1. 用 Safari 打開上面那個網址（一定要用 Safari，不能用 Chrome/Line 內建瀏覽器，不然沒有「加入主畫面」）
2. 點下方分享圖示 → **加入主畫面**
3. 之後就會在主畫面看到 TIME 的圖示，點開是全螢幕的 App，沒有網址列

**Android (Chrome)**
1. 用 Chrome 打開網址
2. 點右上角選單 → **安裝應用程式** / **加到主畫面**
3. 之後主畫面會有 TIME 的圖示，點開是全螢幕的 App

安裝後資料會存在手機本機（該瀏覽器的儲存空間），不會同步到雲端，也不會因為關閉 App 而遺失（清除瀏覽器資料/解除安裝才會消失）。

---

## 測試檢查表（對照需求文件第 30 節）

打開 App 後可以自己驗證：

1. **正常切換**：點 Work，等一下再點 Evolution → History 應該出現「Work 開始–切換時間」與「Evolution 切換時間–現在」兩段，中間沒有空白
2. **重複點擊**：Work 開始後再點一次 Work → NOW 頁面的計時不會重置
3. **關閉 App**：切到某狀態後，把瀏覽器分頁關掉或把 App 移到背景，過一段時間再打開 → 計時應該是連續的（因為用 Timestamp 計算，不是靠 App 一直執行）
4. **跨午夜**：晚上選 Sleep，隔天早上選別的狀態 → History 在前一天會看到 Sleep 到 24:00，隔天會看到 Sleep 從 00:00 開始接續
5. **每日結算**：完整過完一天後，到 Stats 選那一天 → 六個狀態時間加總會剛好是 24:00:00 / 100%
6. **修改歷史**：在 History 點一段紀錄，改開始/結束時間或狀態，或用 Split 切成兩段 → 儲存後 Stats 會立刻重新計算
7. **Widget 對照組**：NOW 頁面本身就是「目前狀態 + 本次已持續多久」，行為對應需求文件裡 Widget 該顯示的內容
