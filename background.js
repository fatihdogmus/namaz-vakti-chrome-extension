chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["settings"], ({settings}) => {
        if (settings) {
            return;
        }

        const defaults = {
            location: null,
            autoRefreshMinutes: 30,
            notificationsEnabled: false
        };

        chrome.storage.local.set({settings: defaults});
    });
});

chrome.action.onClicked.addListener(() => {
    // Keep a small log for debugging during early development.
    console.info("Namaz Vakti action clicked");
});
