## Permission Justifications for English Writer with Gemini

Here are the justifications for the permissions requested by the "English Writer with Gemini" Chrome extension:

1.  **Permission: `storage`**

    *   **Justification:** "To securely save your personal Google Gemini API key and your preferred English writing style (e.g., Formal or Conversational). This allows the extension to remember your settings across different browsing sessions, so you don't have to re-enter them each time you use the extension, ensuring a seamless and personalized experience."

2.  **Permission: `activeTab`**

    *   **Justification:** "To enable certain features when you directly interact with the extension, such as clicking its toolbar icon. This permission allows the extension to perform actions on the web page you are currently viewing and have explicitly activated the extension on, without needing access to other tabs unless also activated there."

3.  **Permission: `scripting` (used with content scripts on all websites `<all_urls>`)**

    *   **Justification:** "This permission is **essential** for the core feature of providing real-time, as-you-type English writing assistance directly within input fields on **any website** you visit. Here's why it's crucial:
        *   **Real-time, In-Page Assistance:** To offer instant translations and style suggestions while you are typing, the extension must be able to add its helping functionality directly into the text fields of web pages (like emails, social media, forums, etc.). `scripting` allows this integration.
        *   **Works Everywhere You Type:** The goal is to provide assistance wherever you write online. Access to `<all_urls>` ensures the extension is available on any site you might be using, rather than being limited to a predefined list.
        *   **Why `activeTab` Isn't Enough for This Core Feature:** While `activeTab` grants access when you click the extension's icon, it doesn't allow for the *automatic, as-you-type* detection and interaction with text fields that is central to our extension's primary purpose. The 'always-ready' assistance in any input field requires broader scripting capabilities.
        *   **Responsible Use:** The extension is designed with your privacy in mind. While it needs to be present on pages to detect when you're typing, its full analytical and page-modification features for translation and style suggestions only become active when you actually start typing in a recognized input field or textarea. It does not passively collect data or interfere with your browsing otherwise."

4.  **Permission: `contextMenus`** (Right-click menu)

    *   **Justification:** "To add a convenient 'Translate with English Writer' option to your right-click menu. This allows you to quickly select Chinese text anywhere on a webpage and get an English translation with style suggestions, offering an alternative way to access writing help without typing."

5.  **Host Permission: `https://generativelanguage.googleapis.com/`**

    *   **Justification:** "To securely connect to and communicate with Google's Gemini API. This permission is vital as it allows the extension to send the Chinese text you've typed or selected to the Gemini service and receive back the high-quality English translation and style suggestions that form the core of its assistance."
