let port = null;
let analysisQueue = new Map();
let engineStatus = {
  connected: false,
  ready: false,
  error: null,
  lastConnectionAttempt: 0,
  connectionAttempts: 0
};

// Constants for connection retry
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Initialize native messaging port with retry logic
function connectToNativeHost() {
  const now = Date.now();
  
  // Don't retry too frequently
  if (now - engineStatus.lastConnectionAttempt < RETRY_DELAY) {
    return;
  }
  
  // Update connection attempt tracking
  engineStatus.lastConnectionAttempt = now;
  engineStatus.connectionAttempts++;
  
  try {
    if (port) {
      try {
        port.disconnect();
      } catch (e) {
        console.warn('Error disconnecting existing port:', e);
      }
      port = null;
    }
    
    console.log('Attempting to connect to native host...');
    port = chrome.runtime.connectNative('com.chess.arrows.host');
    
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError;
      console.error('Connection error:', error.message);
      
      // Update status with detailed error
      updateEngineStatus({
        connected: false,
        ready: false,
        error: `Connection failed: ${error.message}`
      });
      
      // Schedule retry if under max attempts
      if (engineStatus.connectionAttempts < MAX_RETRY_COUNT) {
        const delay = Math.min(RETRY_DELAY * engineStatus.connectionAttempts, MAX_RETRY_DELAY);
        console.log(`Scheduling retry in ${delay}ms...`);
        setTimeout(connectToNativeHost, delay);
      } else {
        console.error('Max connection attempts reached');
        updateEngineStatus({
          error: 'Failed to connect after multiple attempts. Please check native messaging host installation.'
        });
      }
      return;
    }
    
    console.log('Successfully connected to native messaging host');
    
    // Reset connection attempts on success
    engineStatus.connectionAttempts = 0;
    
    // Set up connection status
    updateEngineStatus({
      connected: true,
      ready: false,
      error: null
    });
    
    port.onMessage.addListener((response) => {
      console.log('Received message from host:', response);
      if (response.type === 'error') {
        console.error('Error from native host:', response.error);
        updateEngineStatus({
          connected: true,
          ready: false,
          error: response.error
        });
      } else {
        handleEngineResponse(response);
      }
    });

    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.error('Disconnected from native messaging host:', error?.message || 'unknown error');
      port = null;
      
      // Update status with disconnect error
      updateEngineStatus({
        connected: false,
        ready: false,
        error: error?.message || 'Disconnected from native messaging host'
      });
      
      // Try to reconnect after delay if not max attempts
      if (engineStatus.connectionAttempts < MAX_RETRY_COUNT) {
        const delay = Math.min(RETRY_DELAY * engineStatus.connectionAttempts, MAX_RETRY_DELAY);
        setTimeout(connectToNativeHost, delay);
      }
    });

    // Send test message to verify connection
    port.postMessage({ 
      type: 'test',
      message: 'Testing native messaging connection'
    });
  } catch (error) {
    console.error('Failed to connect to native messaging host:', error);
    updateEngineStatus({
      connected: false,
      ready: false,
      error: error.message
    });
    
    // Try to reconnect after delay if not max attempts
    if (engineStatus.connectionAttempts < MAX_RETRY_COUNT) {
      const delay = Math.min(RETRY_DELAY * engineStatus.connectionAttempts, MAX_RETRY_DELAY);
      setTimeout(connectToNativeHost, delay);
    }
  }
}

// Update engine status and notify content scripts
function updateEngineStatus(status) {
  engineStatus = { ...engineStatus, ...status };
  notifyEngineStatus();
}

// Notify all tabs about engine status changes
function notifyEngineStatus() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'engineStatus',
        status: engineStatus
      }).catch(() => {}); // Ignore errors for inactive tabs
    });
  });
}

function handleEngineResponse(response) {
  if (!response) return;

  switch (response.type) {
    case 'status':
      updateEngineStatus(response.status);
      break;

    case 'analysis':
      // Broadcast analysis to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'engineAnalysis',
            data: response.data
          });
        }
      });
      break;

    case 'bestmove':
      // Notify tab that requested the analysis
      if (analysisQueue.has(response.tabId)) {
        const callback = analysisQueue.get(response.tabId);
        analysisQueue.delete(response.tabId);
        callback({
          bestMove: response.move
        });
      }
      break;

    case 'error':
      console.error('Engine error:', response.error);
      updateEngineStatus({
        error: response.error
      });
      break;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings
  chrome.storage.sync.set({
    enableArrows: true,
    bestMoveColor: '#00ff00',
    alternativeMoveColor: '#ff9900',
    arrowWidth: 5,
    numAlternatives: 2,
    showEvaluation: true
  });

  // Connect to native messaging host
  connectToNativeHost();
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getEngineAnalysis') {
    if (!port || !engineStatus.ready) {
      sendResponse({ error: 'Engine not ready' });
      return true;
    }

    const { fen, timeLimit } = message;
    const tabId = sender.tab.id;

    // Store the callback in the queue
    analysisQueue.set(tabId, sendResponse);

    // Request analysis from engine
    port.postMessage({
      command: 'analyze',
      fen: fen,
      timeLimit: timeLimit || 1000, // Default to 1 second if not specified
      tabId: tabId
    });

    return true; // Will respond asynchronously
  }

  if (message.action === 'stopAnalysis') {
    if (port) {
      port.postMessage({ command: 'stop' });
      const tabId = sender.tab.id;
      if (analysisQueue.has(tabId)) {
        analysisQueue.delete(tabId);
      }
    }
    sendResponse({ success: true });
    return true;
  }

  // Return stat information about engine connection
  if (message.action === 'getEngineStatus') {
      sendResponse({
        connected: port !== null,
        ready: engineStatus.ready
      });
    return true;
  }

  // Handle test command
  if (message.action === 'testConnection') {
    if (!port) {
      connectToNativeHost();
    }
    
    if (port) {
      try {
        port.postMessage({ type: 'test' });
        sendResponse({ success: true, status: 'Message sent to native host' });
      } catch (error) {
        console.error('Error sending test message:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'Not connected to native host' });
    }
    return true;
  }

  return false;
});

// Queue to manage multiple analysis requests
class AnalysisQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  add(request) {
    this.queue.push(request);
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const request = this.queue.shift();
    if (!port || !engineStatus.ready) {
      request.callback({ error: 'Engine not ready' });
      this.processNext();
      return;
    }

    port.postMessage({
      command: 'analyze',
      fen: request.fen,
      timeLimit: request.timeLimit || 1000,
      tabId: request.tabId
    });

    // Set a timeout to prevent hanging
    setTimeout(() => {
      if (analysisQueue.has(request.tabId)) {
        analysisQueue.delete(request.tabId);
        request.callback({ error: 'Analysis timeout' });
        this.processNext();
      }
    }, request.timeLimit + 1000);
  }
}

const queue = new AnalysisQueue();

// Periodically check engine connection and reconnect if needed
setInterval(() => {
  if (!port || !engineStatus.ready) {
    connectToNativeHost();
  }
}, 30000);

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(() => {
  // Clean up before update
  if (port) {
    port.postMessage({ command: 'quit' });
    port.disconnect();
  }
  chrome.runtime.reload();
});