document.addEventListener('DOMContentLoaded', function() {
  const mailContent = document.getElementById('mailContent');
  const unreadCountElement = document.getElementById('unreadCount');
  const countValueElement = unreadCountElement.querySelector('.count-value');
  const loadingSpinnerElement = unreadCountElement.querySelector('.loading-spinner');
  const lastUpdateElement = document.getElementById('lastUpdate');
  const loadingTextElement = lastUpdateElement.querySelector('.loading-text');
  const openMailButton = document.getElementById('openMail');
  const statusMessage = document.getElementById('statusMessage');

  // Immediately load cached data when popup opens
  function loadCachedData() {
    chrome.storage.local.get(['unreadCount', 'lastUpdate'], function(data) {
      if (data.unreadCount !== undefined) {
        updateMailInfo(data.unreadCount, data.lastUpdate);
        mailContent.style.display = 'block';
        statusMessage.style.display = 'none';
      }
    });
  }

  // Check if user is logged in to Yandex Mail
  async function checkLoginStatus() {
    try {
      // First check if we have recent data in storage
      const data = await chrome.storage.local.get(['unreadCount', 'lastUpdate']);
      const now = new Date();
      const lastUpdateTime = data.lastUpdate ? new Date(data.lastUpdate) : null;
      const isRecentData = lastUpdateTime && (now - lastUpdateTime < 60000); // Less than 1 minute old
      
      if (isRecentData && data.unreadCount !== undefined) {
        // Use cached data if it's recent
        mailContent.style.display = 'block';
        statusMessage.style.display = 'none';
        updateMailInfo(data.unreadCount, data.lastUpdate);
      } else {
        // Show loading state while keeping the current count
        showLoadingState();
        
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
        const titleMatch = title.match(/(\d+)\s*·\s*Inbox\s*—\s*Yandex Mail/);
        let count = 0;
        
        if (titleMatch && titleMatch[1]) {
          count = parseInt(titleMatch[1], 10);
        }
        
        // User is logged in
        mailContent.style.display = 'block';
        statusMessage.style.display = 'none';
        
        // Update the UI with the count
        const updateTime = new Date().toLocaleTimeString();
        updateMailInfo(count, updateTime);
        
        // Store the data
        chrome.storage.local.set({
          unreadCount: count,
          lastUpdate: updateTime
        });
      }
      
      // Trigger email check in background
      chrome.runtime.sendMessage({ action: 'checkEmails' });
    } catch (error) {
      console.error('Error checking login status:', error);
      // Even if there's an error, we'll still show the mail content with the open button
      mailContent.style.display = 'block';
      statusMessage.style.display = 'block';
      statusMessage.textContent = 'Unable to check email count. You can still open Yandex Mail.';
      
      // Try to get any cached data
      chrome.storage.local.get(['unreadCount', 'lastUpdate'], function(data) {
        if (data.unreadCount !== undefined) {
          updateMailInfo(data.unreadCount, data.lastUpdate);
        } else {
          updateMailInfo(0, 'Never');
        }
      });
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateUnreadCount') {
      updateMailInfo(message.count, message.updateTime);
    }
  });

  // Open mail button click handler
  openMailButton.addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://mail.yandex.ru' });
  });

  function showLoadingState() {
    // Show loading spinner while keeping the current count visible
    loadingSpinnerElement.style.display = 'inline-block';
    loadingTextElement.textContent = 'Loading...';
  }

  function updateMailInfo(count, updateTime) {
    // Hide loading spinner
    loadingSpinnerElement.style.display = 'none';
    
    // Update count value
    countValueElement.textContent = count || 0;
    
    // Update last checked time
    loadingTextElement.textContent = updateTime || 'Never';
  }

  // Load cached data immediately when popup opens
  loadCachedData();
  
  // Then check login status and update if needed
  checkLoginStatus();
}); 