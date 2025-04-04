// Check emails every 5 minutes
const CHECK_INTERVAL = 1 * 60 * 1000;

// Function to check for new emails
async function checkEmails() {
  try {
    // Create a new tab with Yandex Mail
    const tab = await chrome.tabs.create({
      url: 'https://mail.yandex.ru/?extra_cond=only_new',
      active: false // Open in background
    });

    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Execute script to get the title
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        return document.title;
      }
    });

    // Close the tab
    await chrome.tabs.remove(tab.id);

    // Extract unread count from the title
    const title = results[0].result;
    const titleMatch = title.match(/(\d+)\s*·\s*/);
    let unreadCount = 0;

    if (titleMatch && titleMatch[1]) {
      unreadCount = parseInt(titleMatch[1], 10);
    }

    // Update storage with new data
    const updateTime = new Date().toLocaleTimeString();
    await chrome.storage.local.set({
      unreadCount: unreadCount,
      lastUpdate: updateTime
    });

    // Update badge
    chrome.action.setBadgeText({ text: unreadCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });

    // Notify any open popups about the update
    chrome.runtime.sendMessage({
      action: 'updateUnreadCount',
      count: unreadCount,
      updateTime: updateTime
    });

    // Show notification if there are new emails
    if (unreadCount > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'New Yandex Mail',
        message: `You have ${unreadCount} new email${unreadCount > 1 ? 's' : ''}`
      });
    }
  } catch (error) {
    console.error('Error checking emails:', error);
    // Clear the badge on error
    chrome.action.setBadgeText({ text: '' });
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkEmails') {
    checkEmails();
  }
});

// Set up periodic email checking
setInterval(checkEmails, CHECK_INTERVAL);

// Initial check when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  checkEmails();
});
