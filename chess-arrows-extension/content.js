(function() {
  // Current settings
  let settings = {
    enableArrows: true,
    bestMoveColor: '#00ff00',
    alternativeMoveColor: '#ff9900',
    arrowWidth: 5,
    numAlternatives: 2,
    showEvaluation: true
  };
  
  // Store the current board state (FEN)
  let currentFEN = '';
  
  // SVG namespace
  const SVG_NS = 'http://www.w3.org/2000/svg';
  
  // Container for arrows
  let arrowLayer = null;
  
  // Initialize
  function init() {
    // Load settings
    chrome.storage.sync.get(settings, function(items) {
      settings = items;
      
      // Find the chess board
      detectBoard();
      
      // Monitor for board changes (moves)
      setupBoardObserver();
    });
    
    // Listen for settings updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateSettings') {
        settings = message.settings;
        updateArrows(); // Redraw arrows with new settings
      }
    });
  }
  
  // Detect which chess site we're on and find the board
  function detectBoard() {
    if (window.location.hostname.includes('lichess.org')) {
      setupLichessBoard();
    } else if (window.location.hostname.includes('chess.com')) {
      setupChessComBoard();
    }
  }
  
  // Setup for Lichess
  function setupLichessBoard() {
    const board = document.querySelector('cg-board');
    if (board) {
      // Create arrow layer
      createArrowLayer(board);
      
      // Initial analysis
      getFEN().then(updateAnalysis);
    } else {
      // Retry if board isn't loaded yet
      setTimeout(setupLichessBoard, 1000);
    }
  }
  
  // Setup for Chess.com
  function setupChessComBoard() {
    const board = document.querySelector('.board-board');
    if (board) {
      // Create arrow layer
      createArrowLayer(board);
      
      // Initial analysis
      getFEN().then(updateAnalysis);
    } else {
      // Retry if board isn't loaded yet
      setTimeout(setupChessComBoard, 1000);
    }
  }
  
  // Create the SVG layer for drawing arrows
  function createArrowLayer(board) {
    // Remove any existing arrow layer
    if (arrowLayer) {
      arrowLayer.remove();
    }
    
    // Create a new SVG element
    arrowLayer = document.createElementNS(SVG_NS, 'svg');
    arrowLayer.setAttribute('class', 'chess-arrows-layer');
    arrowLayer.setAttribute('width', '100%');
    arrowLayer.setAttribute('height', '100%');
    arrowLayer.style.position = 'absolute';
    arrowLayer.style.top = '0';
    arrowLayer.style.left = '0';
    arrowLayer.style.pointerEvents = 'none';
    arrowLayer.style.zIndex = '10';
    
    // Add to the board
    board.appendChild(arrowLayer);
  }
  
  // Get current FEN position from the board
  async function getFEN() {
    if (window.location.hostname.includes('lichess.org')) {
      return getLichessFEN();
    } else if (window.location.hostname.includes('chess.com')) {
      return getChessComFEN();
    }
    return null;
  }
  
  // Get FEN from Lichess
  function getLichessFEN() {
    const game = document.querySelector('chess-board');
    if (game && game.dataset.fen) {
      return game.dataset.fen;
    }
    // Alternative method using __LIBS
    if (window.__LIBS && window.__LIBS.chess) {
      return window.__LIBS.chess.getFen();
    }
    return null;
  }
  
  // Get FEN from Chess.com
  function getChessComFEN() {
    // Try getting from the board API
    if (window.board && window.board.getFen) {
      return window.board.getFen();
    }
    // Alternative method using game object
    if (window.game && window.game.getFen) {
      return window.game.getFen();
    }
    return null;
  }
  
  // Draw arrow on the board
  function drawArrow(from, to, color, width) {
    if (!arrowLayer) return;
    
    const squares = arrowLayer.parentElement.getBoundingClientRect();
    const squareSize = squares.width / 8;
    
    // Calculate start and end positions
    const fromPos = getSquareCenter(from, squareSize);
    const toPos = getSquareCenter(to, squareSize);
    
    // Create arrow path
    const arrow = document.createElementNS(SVG_NS, 'path');
    const path = createArrowPath(fromPos, toPos, width);
    
    arrow.setAttribute('d', path);
    arrow.setAttribute('stroke', color);
    arrow.setAttribute('stroke-width', width);
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('marker-end', `url(#arrowhead-${color.substring(1)})`);
    
    // Add to SVG layer
    arrowLayer.appendChild(arrow);
  }
  
  // Calculate square center coordinates
  function getSquareCenter(square, squareSize) {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1]);
    
    return {
      x: (file + 0.5) * squareSize,
      y: (rank + 0.5) * squareSize
    };
  }
  
  // Create SVG path for arrow
  function createArrowPath(from, to, width) {
    // Calculate arrow head size based on line width
    const headLen = width * 3;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    
    // Shorten the line to make room for arrow head
    const lineEndX = to.x - (headLen * Math.cos(angle));
    const lineEndY = to.y - (headLen * Math.sin(angle));
    
    return `M ${from.x},${from.y} L ${lineEndX},${lineEndY}`;
  }
  
  // Update analysis when board changes
  function updateAnalysis(fen) {
    if (!fen || !settings.enableArrows) return;
    
    // Clear previous arrows
    if (arrowLayer) {
      while (arrowLayer.firstChild) {
        arrowLayer.removeChild(arrowLayer.firstChild);
      }
    }
    
    // Request new analysis
    chrome.runtime.sendMessage({
      action: 'getEngineAnalysis',
      fen: fen,
      timeLimit: 1000
    }, response => {
      if (response.error) {
        console.error('Analysis error:', response.error);
        return;
      }
      
      // Draw best move arrow
      if (response.bestMove) {
        const [from, to] = [
          response.bestMove.substring(0, 2),
          response.bestMove.substring(2, 4)
        ];
        drawArrow(from, to, settings.bestMoveColor, settings.arrowWidth);
      }
      
      // Draw alternative moves
      if (response.alternativeMoves) {
        response.alternativeMoves
          .slice(0, settings.numAlternatives)
          .forEach(move => {
            const [from, to] = [
              move.substring(0, 2),
              move.substring(2, 4)
            ];
            drawArrow(from, to, settings.alternativeMoveColor, settings.arrowWidth);
          });
      }
      
      // Show evaluation if enabled
      if (settings.showEvaluation && response.evaluation) {
        updateEvaluation(response.evaluation);
      }
    });
  }
  
  // Update the evaluation display
  function updateEvaluation(eval) {
    let evalElement = document.querySelector('.chess-arrows-eval');
    if (!evalElement) {
      evalElement = document.createElement('div');
      evalElement.className = 'chess-arrows-eval';
      document.body.appendChild(evalElement);
    }
    
    evalElement.textContent = typeof eval === 'number' 
      ? eval > 0 ? `+${eval.toFixed(1)}` : eval.toFixed(1)
      : eval;
  }
  
  // Set up observer to detect board changes
  function setupBoardObserver() {
    let lastFEN = '';
    
    // Create mutation observer
    const observer = new MutationObserver(async () => {
      const fen = await getFEN();
      if (fen && fen !== lastFEN) {
        lastFEN = fen;
        updateAnalysis(fen);
      }
    });
    
    // Start observing
    const board = document.querySelector('cg-board, .board-board');
    if (board) {
      observer.observe(board, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  }
  
  // Initialize
  init();
})();