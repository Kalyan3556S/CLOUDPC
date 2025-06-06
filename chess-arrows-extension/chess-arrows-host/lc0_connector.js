const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
let config = {
  enginePath: '',
  weightsPath: '',
  // Default analysis settings
  depth: 20,
  multipv: 3,
  threads: 2
};

// Engine process
let engineProcess = null;
let initialized = false;
let analysisInProgress = false;

// Buffer for incoming data
let buffer = '';

// Enhanced error handling and status management
const engineStatus = {
  connected: false,
  ready: false,
  error: null,
  lastAnalysis: null
};

function updateStatus(update) {
  Object.assign(engineStatus, update);
  // Send status update through native messaging
  process.stdout.write(JSON.stringify({
    type: 'status',
    status: engineStatus
  }) + '\n');
}

// Load configuration
function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const loadedConfig = JSON.parse(data);
      config = { ...config, ...loadedConfig };
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

// Save configuration
function saveConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving configuration:', error);
  }
}

// Initialize engine
function initializeEngine() {
  if (initialized || !config.enginePath) {
    return Promise.resolve(initialized);
  }

  return new Promise((resolve) => {
    try {
      // Spawn LC0 process
      const engineArgs = ['--weights=' + config.weightsPath];
      engineProcess = spawn(config.enginePath, engineArgs);
      
      updateStatus({
        connected: true,
        ready: false,
        error: null
      });

      // Handle engine output
      engineProcess.stdout.on('data', (data) => {
        const output = data.toString();
        buffer += output;
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          processEngineLine(line.trim());
        }
      });
      
      engineProcess.stderr.on('data', (data) => {
        console.error(`Engine stderr: ${data}`);
        updateStatus({
          error: `Engine error: ${data}`
        });
      });
      
      engineProcess.on('error', (error) => {
        console.error('Failed to start engine:', error);
        updateStatus({
          connected: false,
          ready: false,
          error: `Failed to start engine: ${error.message}`
        });
        resolve(false);
      });
      
      engineProcess.on('close', (code) => {
        console.log(`Engine process exited with code ${code}`);
        initialized = false;
        engineProcess = null;
        updateStatus({
          connected: false,
          ready: false,
          error: code ? `Engine exited with code ${code}` : null
        });
      });

      // Send UCI configuration
      engineProcess.stdin.write('uci\n');
      engineProcess.stdin.write(`setoption name Threads value ${config.threads}\n`);
      engineProcess.stdin.write(`setoption name MultiPV value ${config.multipv}\n`);
      engineProcess.stdin.write('ucinewgame\n');
      engineProcess.stdin.write('isready\n');
  
      // Set up initialization timeout
      const initTimeout = setTimeout(() => {
        updateStatus({
          connected: true,
          ready: false,
          error: 'Engine initialization timeout'
        });
        resolve(false);
      }, 10000);

      let uciOk = false;
      let readyOk = false;

      const initHandler = (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.includes('uciok')) {
            uciOk = true;
          } else if (line.includes('readyok')) {
            readyOk = true;
          }

          if (uciOk && readyOk) {
            clearTimeout(initTimeout);
            engineProcess.stdout.removeListener('data', initHandler);
            
            // Configure engine with default settings
            sendToEngine(`setoption name Threads value ${config.threads}`);
            sendToEngine(`setoption name MultiPV value ${config.multipv}`);
            
            initialized = true;
            updateStatus({
              connected: true,
              ready: true,
              error: null
            });
            resolve(true);
          }
        }
      };

      engineProcess.stdout.on('data', initHandler);
      
      // Send initialization commands
      sendToEngine('uci');
      sendToEngine('isready');
    } catch (error) {
      console.error('Error initializing engine:', error);
      updateStatus({
        connected: false,
        ready: false,
        error: `Error initializing engine: ${error.message}`
      });
      resolve(false);
    }
  });
}

// Send command to engine
function sendToEngine(command) {
  if (engineProcess && engineProcess.stdin.writable) {
    engineProcess.stdin.write(command + '\n');
    console.log(`Sent to engine: ${command}`);
  } else {
    console.error('Engine not available for command:', command);
  }
}

// Process UCI messages from the engine
function processEngineLine(line) {
  if (!line) return;

  // Parse UCI info messages
  if (line.startsWith('info depth')) {
    try {
      const info = parseUciInfo(line);
      process.stdout.write(JSON.stringify({
        type: 'analysis',
        data: {
          depth: info.depth,
          score: info.score,
          nodes: info.nodes,
          nps: info.nps,
          pv: info.pv
        }
      }) + '\n');
    } catch (error) {
      console.error('Error parsing UCI info:', error);
    }
  } 
  else if (line.includes('uciok')) {
    initialized = true;
    sendCommand('isready');
  }
  else if (line.includes('readyok')) {
    updateStatus({
      ready: true
    });
    // Configure engine
    sendCommand(`setoption name Threads value ${config.threads}`);
    sendCommand(`setoption name MultiPV value ${config.multipv}`);
    sendCommand('ucinewgame');
  }
  else if (line.includes('bestmove')) {
    const match = line.match(/bestmove\s+(\S+)/);
    if (match) {
      process.stdout.write(JSON.stringify({
        type: 'bestmove',
        move: match[1]
      }) + '\n');
    }
    analysisInProgress = false;
  }
}

// Parse UCI info messages
function parseUciInfo(line) {
  const parts = line.split(' ');
  const info = {};
  
  for (let i = 0; i < parts.length; i++) {
    switch (parts[i]) {
      case 'depth':
      case 'seldepth':
      case 'nodes':
      case 'nps':
        info[parts[i]] = parseInt(parts[i + 1]);
        break;
      case 'score':
        info.score = {
          type: parts[i + 1],
          value: parseInt(parts[i + 2])
        };
        break;
      case 'pv':
        info.pv = parts.slice(i + 1).join(' ');
        break;
    }
  }
  return info;
}

// Error handling and logging
function sendError(error) {
  process.stdout.write(JSON.stringify({
    type: 'error',
    error: error.toString()
  }) + '\n');
}

function logDebug(message) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[DEBUG]', message);
  }
}

// Process stdin for messages from the extension
process.stdin.on('readable', () => {
  let input;
  
  try {
    // Read input in chunks
    while ((input = process.stdin.read()) !== null) {
      const messages = input.toString().split('\n').filter(line => line.trim());
      
      for (const message of messages) {
        try {
          const command = JSON.parse(message);
          logDebug('Received command: ' + JSON.stringify(command));
          
          switch (command.type) {
            case 'init':
              initializeEngine().then(success => {
                if (!success) {
                  sendError('Failed to initialize engine');
                }
              });
              break;
              
            case 'analyze':
              if (!engineStatus.ready) {
                sendError('Engine not ready');
                break;
              }
              
              if (!command.fen) {
                sendError('No FEN position provided');
                break;
              }
              
              analyzePosition(command.fen, command.depth || config.depth);
              break;
              
            case 'stop':
              if (engineProcess) {
                sendCommand('stop');
              }
              break;
              
            case 'quit':
              cleanup();
              break;
              
            default:
              sendError(`Unknown command type: ${command.type}`);
          }
        } catch (error) {
          sendError(`Error processing command: ${error.message}`);
        }
      }
    }
  } catch (error) {
    sendError(`Error reading input: ${error.message}`);
  }
});

// Cleanup function
function cleanup() {
  if (engineProcess) {
    try {
      sendCommand('quit');
      setTimeout(() => {
        if (engineProcess) {
          engineProcess.kill();
        }
        process.exit(0);
      }, 1000);
    } catch (error) {
      process.exit(1);
    }
  } else {
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('disconnect', cleanup);

// Initialize on startup
loadConfig();
initializeEngine();

// Handle termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  cleanup();
});
