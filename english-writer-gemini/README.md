# 英文寫作助手 (Gemini)

這是一款 Chrome 擴充功能，讓你在任何網頁的輸入框中輸入繁體中文時，即時顯示對應的英文寫法，並可選擇正式或口語風格。翻譯由 Google Gemini API 提供。

## 主要功能
- 支援即時中翻英（正式/口語）
- 可自訂 Gemini API 金鑰與預設風格
- 支援側邊欄與輸入框下方顯示翻譯
- 可快速啟用/停用插件

## 安裝方式
1. 下載或 clone 此專案到本地資料夾。
2. 打開 Chrome，進入 `chrome://extensions/`。
3. 開啟右上角「開發人員模式」。
4. 點擊「載入未封裝的擴充功能」，選擇本專案資料夾。

## 設定 API 金鑰
1. 右鍵點擊插件圖示，選擇「選項」(Options)，或點擊彈出視窗的「更多設定」。
2. 在選項頁面輸入你的 Gemini API 金鑰，並選擇預設英文風格。

## 專案結構
```
english-writer-gemini/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup.html
├── popup.js
├── options.html
├── options.js
├── background.js
├── content.js
├── styles.css
└── README.md
```

## 注意事項
- 請勿將你的 Gemini API 金鑰公開分享。
- 使用 Gemini API 可能會產生費用，請參閱官方說明。
- 目前僅針對標準 input/textarea，富文本編輯器支援有限。
- 若需更換圖示，請將對應 PNG 檔案放入 `icons/` 資料夾。

## 後續可改進方向
- UI/UX 美化
- 進階錯誤處理
- 富文本支援
- 進階 Gemini 參數設定
- 本地化

---

Created with ❤️ by Micha & AI 