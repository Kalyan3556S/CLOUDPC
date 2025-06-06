document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.sync.get({
    enableArrows: true,
    bestMoveColor: '#00ff00',
    alternativeMoveColor: '#ff9900',
    arrowWidth: 5,
    numAlternatives: 2,
    showEvaluation: true,
    enginePath: '',
    weightsPath: ''
  }, function(items) {
    document.getElementById('enableArrows').checked = items.enableArrows;
    document.getElementById('bestMoveColor').value = items.bestMoveColor;
    document.getElementById('alternativeMoveColor').value = items.alternativeMoveColor;
    document.getElementById('arrowWidth').value = items.arrowWidth;
    document.getElementById('numAlternatives').value = items.numAlternatives;
    document.getElementById('showEvaluation').checked = items.showEvaluation;
    document.getElementById('enginePath').value = items.enginePath;
    document.getElementById('weightsPath').value = items.weightsPath;
  });
  
  // Check engine status
  function checkEngineStatus() {
    chrome.runtime.sendMessage({ action: 'getEngineStatus' }, function(response) {
      const statusDiv = document.getElementById('engineStatus');
      const statusDot = statusDiv.querySelector('.status-dot');
      const statusText = document.getElementById('statusText');
      
      if (response.connected) {
        statusDiv.className = 'status connected';
        statusDot.className = 'status-dot connected';
        statusText.textContent = response.ready 
          ? 'Engine connected and ready'
          : 'Engine connected, initializing...';
      } else {
        statusDiv.className = 'status disconnected';
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Engine not connected';
      }
    });
  }
  
  // Update engine status display
  function updateEngineStatus(status) {
    const statusDiv = document.getElementById('engineStatus');
    const statusDot = statusDiv.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');
    
    if (status.connected) {
      statusDiv.className = 'status connected';
      statusDot.className = 'status-dot connected';
      statusText.textContent = status.ready 
        ? 'Engine connected and ready'
        : 'Engine connected, initializing...';
    } else {
      statusDiv.className = 'status disconnected';
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = status.error || 'Engine not connected';
    }
  }

  // Check status initially and every 5 seconds
  checkEngineStatus();
  setInterval(checkEngineStatus, 5000);
  
  // Test engine button
  document.getElementById('testEngine').addEventListener('click', function() {
    const button = this;
    const originalText = button.textContent;
    button.textContent = 'Testing...';
    button.disabled = true;
    
    chrome.runtime.sendMessage({
      action: 'getEngineAnalysis',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      timeLimit: 1000
    }, function(response) {
      if (response.error) {
        button.textContent = 'Test Failed';
        button.style.backgroundColor = '#f44336';
      } else {
        button.textContent = 'Test Successful!';
        button.style.backgroundColor = '#4CAF50';
      }
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '#2196F3';
        button.disabled = false;
      }, 2000);
    });
  });
  
  // Add connection test handler
  document.getElementById('testConnection').addEventListener('click', function() {
    const button = this;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Testing...';
    
    // Try to connect to the native host
    chrome.runtime.sendMessage({ action: 'testConnection' }, (response) => {
      if (response && response.success) {
        button.textContent = 'Connection OK!';
        button.style.backgroundColor = '#4CAF50';
      } else {
        button.textContent = 'Connection Failed';
        button.style.backgroundColor = '#f44336';
        console.error('Connection test failed:', response?.error || 'Unknown error');
      }
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '#2196F3';
        button.disabled = false;
      }, 2000);
    });
  });
  
  // Listen for status updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'engineStatus') {
      updateEngineStatus(message.status);
    }
  });

  // Request initial engine status
  chrome.runtime.sendMessage({ action: 'getEngineStatus' }, (response) => {
    if (response && response.status) {
      updateEngineStatus(response.status);
    }
  });
  
  // Save settings
  document.getElementById('saveSettings').addEventListener('click', function() {
    const settings = {
      enableArrows: document.getElementById('enableArrows').checked,
      bestMoveColor: document.getElementById('bestMoveColor').value,
      alternativeMoveColor: document.getElementById('alternativeMoveColor').value,
      arrowWidth: document.getElementById('arrowWidth').value,
      numAlternatives: document.getElementById('numAlternatives').value,
      showEvaluation: document.getElementById('showEvaluation').checked,
      enginePath: document.getElementById('enginePath').value,
      weightsPath: document.getElementById('weightsPath').value
    };
    
    chrome.storage.sync.set(settings, function() {
      // Notify content script of updated settings
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          settings: settings
        });
      });
      
      // Show saved confirmation
      const saveButton = document.getElementById('saveSettings');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Settings Saved!';
      setTimeout(() => {
        saveButton.textContent = originalText;
      }, 1500);
    });
  });
});