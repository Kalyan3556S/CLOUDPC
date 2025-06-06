const spawn = require('cross-spawn');
const fs = require('fs');
const path = require('path');

// Set up logging
const logFile = path.join(__dirname, 'engine_test.log');
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(`[LOG] ${message}`);
}

// Clear previous log
if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
}

log('Starting engine test...');

// Load config file
const configPath = path.join(__dirname, 'config.json');
let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Loaded config:', config);
} catch (error) {
    console.error('Error loading config:', error);
    process.exit(1);
}

const enginePath = config.enginePath;
const weightsPath = config.weightsPath;

// Check if engine and weights exist
console.log('Checking engine path:', enginePath);
if (!fs.existsSync(enginePath)) {
    console.error('ERROR: Engine not found at specified path');
    process.exit(1);
}

console.log('Checking weights path:', weightsPath);
if (!fs.existsSync(weightsPath)) {
    console.error('ERROR: Weights file not found at specified path');
    process.exit(1);
}

console.log('Starting LC0 test...');

const engine = spawn(enginePath, ['--weights=' + weightsPath]);

engine.stdout.on('data', (data) => {
  log('stdout: ' + data.toString().trim());
});

engine.stderr.on('data', (data) => {
  log('stderr: ' + data.toString().trim());
});

engine.on('error', (error) => {
  log('Failed to start engine: ' + error.toString());
  process.exit(1);
});

engine.on('close', (code) => {
  log('Engine process exited with code ' + code);
  process.exit(code);
});

// Keep track of engine state
let uciOk = false;
let readyOk = false;

// Send command to engine
function sendCommand(cmd) {
  log('[CMD] ' + cmd);
  engine.stdin.write(cmd + '\n');
}

// Process engine output
let stdoutBuffer = '';

// Process and parse UCI info lines
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

engine.stdout.on('data', (data) => {
  stdoutBuffer += data.toString();
  
  while (stdoutBuffer.includes('\n')) {
    const newlineIndex = stdoutBuffer.indexOf('\n');
    const line = stdoutBuffer.substring(0, newlineIndex).trim();
    stdoutBuffer = stdoutBuffer.substring(newlineIndex + 1);
    
    if (!line) continue;    // Filter out noise and only show important messages
    if (line.startsWith('info depth')) {
      const info = parseUciInfo(line);
      log(`[ENGINE] depth: ${info.depth}, score: ${info.score?.value} cp, nodes: ${info.nodes}, nps: ${info.nps}`);
    } else if (line.includes('bestmove') || 
              line.includes('uciok') || 
              line.includes('readyok')) {
      log('[ENGINE] ' + line);
    }
    
    if (line.includes('uciok')) {
      uciOk = true;
      sendCommand('isready');
    }
    else if (line.includes('readyok')) {
      readyOk = true;
      // Engine is ready, start analysis
      sendCommand('setoption name MultiPV value 3');
      sendCommand('position startpos');
      sendCommand('go depth 15');
    }
    else if (line.includes('bestmove')) {
      // Analysis complete, quit
      setTimeout(() => {
        sendCommand('quit');
      }, 1000);
    }
  }
});

// Start UCI initialization
sendCommand('uci');
