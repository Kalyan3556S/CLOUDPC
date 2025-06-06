const fs = require('fs');
const path = require('path');

// Set up logging to file
const logFile = path.join(__dirname, 'native_host_test.log');
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
}

// Clear previous log
if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
}

log('Native messaging host test starting...');

// Buffer to store message chunks
let buffer = Buffer.alloc(0);

// Listen for input from Chrome/Edge
process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        buffer = Buffer.concat([buffer, chunk]);
        
        // Process complete messages
        while (buffer.length >= 4) {
            // Read length (first 4 bytes, uint32 little-endian)
            const length = buffer.readUInt32LE(0);
            
            // If we have a complete message
            if (buffer.length >= length + 4) {
                // Extract the message
                const message = buffer.slice(4, length + 4);
                // Remove processed message from buffer
                buffer = buffer.slice(length + 4);
                
                try {
                    // Parse and process the message
                    const data = JSON.parse(message);
                    log(`Received message: ${JSON.stringify(data)}`);
                    
                    // Echo back a response
                    const response = {
                        type: 'response',
                        message: 'Hello from native host!',
                        receivedData: data
                    };
                    
                    // Write message with correct native messaging protocol format
                    const responseStr = JSON.stringify(response);
                    const responseBuffer = Buffer.from(responseStr);
                    const header = Buffer.alloc(4);
                    header.writeUInt32LE(responseBuffer.length, 0);
                    process.stdout.write(Buffer.concat([header, responseBuffer]));
                    log('Sent response');
                } catch (error) {
                    log(`Error processing message: ${error}`);
                    
                    const errorResponse = {
                        type: 'error',
                        error: error.message
                    };
                    
                    const errorStr = JSON.stringify(errorResponse);
                    const errorBuffer = Buffer.from(errorStr);
                    const errorHeader = Buffer.alloc(4);
                    errorHeader.writeUInt32LE(errorBuffer.length, 0);
                    process.stdout.write(Buffer.concat([errorHeader, errorBuffer]));
                    log(`Error sent: ${error.message}`);
                }
            }
        }
    }
});

// Handle disconnection
process.on('disconnect', () => {
    log('Disconnected from browser');
    process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
    log('Received SIGINT signal');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Received SIGTERM signal');
    process.exit(0);
});

log('Native messaging host initialized and waiting for messages...');
