function startEngine() {
    console.info("Injected.")
    document.documentElement.setAttribute('data-chessbot-engine-stop', 'false');
    let isBoardFlipped = document.querySelector(".board").classList.contains("flipped");
    let myColor = isBoardFlipped ? "b" : "w";
    let engineKilled = false;
    let castling = true;

    function removeAllHighlights() {
        document.querySelectorAll(".bestmove").forEach(e=>e.remove());
    }

    function stopEngine() {
        if (engineKilled) return;
        engineKilled = true;
        console.log("Stopping engine...");
        try { engine.terminate(); } catch {}
        try { movesObserver.disconnect(); } catch {}
        try { gameoverObserver.disconnect(); } catch {}
        try { document.removeEventListener('customMessage', customMessageHandler); } catch {}
        try { if (window.disableAudioMonitor) window.disableAudioMonitor(); } catch {}
        document
            .getElementById("progress-stockfish-chessbot")
            ?.remove();
        removeAllHighlights();
        console.log("Engine stopped cleanly.");
    }

    function flipSquare(square) {
    const file = square[0];
    const rank = parseInt(square[1], 10);

    const flippedFile =
        String.fromCharCode('a'.charCodeAt(0) + (7 - (file.charCodeAt(0) - 'a'.charCodeAt(0))));
    const flippedRank = 9 - rank;

    return flippedFile + flippedRank;
}

    function highlightMoveArrow(target){
        const SVG_NS = "http://www.w3.org/2000/svg";
        const CELL = 12.5;

        if (myColor === "b") {
            const from = flipSquare(target.slice(0, 2));
            const to   = flipSquare(target.slice(2, 4));
            target = from + to;
        }


        function squareToPoint(square) {
        const file = square.charCodeAt(0) - 97; // a=0
        const rank = parseInt(square[1], 10) - 1;

        return {
            x: (file + 0.5) * CELL,
            y: 100 - (rank + 0.5) * CELL
        };
        }

        function rotation(from, to) {
            const dx = to.x - from.x;
            const dy = to.y - from.y;

            /*if (Math.abs(dx) > Math.abs(dy)) {
                return dx > 0 ? 270 : 90;
            } else {
                return dy > 0 ? 0 : 180;
            }*/
            const angle = (Math.atan2(dx, -dy) * 180 / Math.PI)-180;
            return angle;

        }

        // reverse engineered from chess.com's official arrow function
        function drawArrow(svg, fromSq, toSq, {
            color = "rgba(255,170,0,0.8)",
            opacity = 0.8
            } = {}) {
            
            const from = squareToPoint(fromSq);
            const to = squareToPoint(toSq);

            const rot = rotation(from, to);
            const length = Math.hypot(to.x - from.x, to.y - from.y);

            const baseY = from.y + 4.5;
            const tipY = baseY + length - 6;

            const points = `
                ${from.x - 1.375} ${baseY},
                ${from.x - 1.375} ${tipY},
                ${from.x - 3.25}  ${tipY},
                ${from.x}         ${tipY + 4.5},
                ${from.x + 3.25}  ${tipY},
                ${from.x + 1.375} ${tipY},
                ${from.x + 1.375} ${baseY}
            `;

            const poly = document.createElementNS(SVG_NS, "polygon");
            poly.classList.add("arrow", "bestmove");
            poly.setAttribute("data-arrow", `${fromSq}${toSq}`);
            poly.setAttribute("id", `arrow-${fromSq}${toSq}`);
            poly.setAttribute("points", points.trim());
            poly.setAttribute(
                "transform",
                `rotate(${rot} ${from.x} ${from.y})`
            );

            poly.style.fill = color;
            poly.style.opacity = opacity;

            svg.appendChild(poly);
            return poly;
            }

            // removed redundant function, highlights already removed at move detection
            //removeAllHighlights()
            drawArrow(document.getElementsByClassName("coordinates")[0], target[0]+target[1], target[2]+target[3])
    }

    // -------------------------------------------------
    // STOCKFISH
    // -------------------------------------------------

        function reportProgress(depth) {
            const loaderHTML = `<div style="position:relative;top:15px;" class="tooltip-container" id="progress-stockfish-chessbot">
                <div class="tooltip-text">
                    Depth
                    <depth>0</depth>/${depth}<br>
                    <a style="text-decoration:underline;cursor:pointer" onclick="document.documentElement.setAttribute('data-chessbot-engine-stop', 'true');">Stop</a>
                </div>
                <span class="loader"></span>
            <style>
                .tooltip-text {
                    visibility: hidden;
                    width: 120px;
                    background-color: #3c3a37;
                    color: #8c8b8b;
                    text-align: center;
                    border-radius: 5px;
                    padding: 5px;
                    position: absolute;
                    z-index: 1;
                    top: 12.5%;
                    left: 19%;
                    font-size: smaller;
                    margin-top: -16px;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .tooltip-container:hover .tooltip-text {
                    visibility: visible;
                    opacity: 1;
                }
                .loader { /* loader from https://cssloaders.github.io/ */
                    width: 5.5px;
                    height: 12px;
                    display: block;
                    left: 5.5%;
                    position: relative;
                    border-radius: 4px;
                    box-sizing: border-box;
                    animation: animloader 1s linear infinite alternate;
                    }


                    @keyframes animloader {
                    0% {
                        box-shadow: 20px 0 rgba(255, 255, 255, 0.25), 30px 0 white, 40px 0 white;
                    }
                    50% {
                        box-shadow: 20px 0 white, 30px 0 rgba(255, 255, 255, 0.25), 40px 0 white;
                    }
                    100% {
                        box-shadow: 20px 0 white, 30px 0 white, 40px 0 rgba(255, 255, 255, 0.25);
                    }
                }
    
                   
            </style>`;
      
      // Append the HTML code to the body
      document.getElementById("board-layout-main").insertAdjacentHTML("beforeend",loaderHTML);

    }

    function reportDepthCycle(depth) {
        console.log("report depth")
        document.querySelector('#progress-stockfish-chessbot .tooltip-text depth').innerHTML = depth;
    }

    const engine = new Worker("/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js");

    engine.onmessage = function(event) {
        if (engineKilled) return;
        try {
            if (event.data.startsWith('bestmove')) {
                const bestMove = event.data.split(' ')[1];
                console.log(event.data)
                if (bestMove) highlightMoveArrow(bestMove);
            } else if (event.data.startsWith('info')) {
                console.log(event.data)
                reportDepthCycle(event.data.match(/depth (\d+)/)[1])

            }
        } catch (e) { console.error(e); }
    };

        let board = document.querySelector(".board");
    let pieceMap = {
        "br": "r", // Black rook
        "bn": "n", // Black knight
        "bb": "b", // Black bishop
        "bq": "q", // Black queen
        "bk": "k", // Black king
        "bp": "p", // Black pawn
        "wr": "R", // White rook
        "wn": "N", // White knight
        "wb": "B", // White bishop
        "wq": "Q", // White queen
        "wk": "K", // White king
        "wp": "P", // White pawn
    };

    function getFEN() {
        let fen = '';

        // Get all pieces
        let pieces = board.querySelectorAll('.piece');

        // Create a map to track piece positions
        let boardArray = Array(8).fill(null).map(() => Array(8).fill(''));

        pieces.forEach(piece => {
            let classList = piece.classList;
            let squareClass = Array.from(classList).find(cls => cls.startsWith('square-'));

            if (squareClass) {
                // Extract the numeric square ID
                let squareId = parseInt(squareClass.split('-')[1]);
                let file = Math.floor(squareId / 10) - 1; // 0-indexed file (a-h)
                let rank = (squareId % 10) - 1; // 0-indexed rank (1-8)

                // Get the piece class
                let pieceClass = Array.from(classList).find(cls => cls.startsWith('w') || cls.startsWith('b'));
                if (pieceClass) {
                    // Place the piece on the board array
                    boardArray[rank][file] = pieceMap[pieceClass];
                }
            }
        });

        // Construct FEN from black pieces first (rank 8 to rank 1)
        for (let rank = 7; rank >= 0; rank--) {
            let emptyCount = 0;
            for (let file = 0; file < 8; file++) {
                if (boardArray[rank][file]) {
                    if (emptyCount > 0) {
                        fen += emptyCount; // Add empty squares count
                        emptyCount = 0;
                    }
                    fen += boardArray[rank][file];
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount; // Add remaining empty squares count
            }
            fen += '/'; // End of rank
        }

        // Remove the trailing slash
        if (fen.endsWith('/')) {
            fen = fen.slice(0, -1);
        }

        // Add additional FEN components (turn, castling, en passant, halfmove, fullmove)

        console.info(`getFEN for ${myColor}`)

        if (castling) {
            fen += ` ${myColor} KQkq - 0 1`; // ${myColor} to move, castling available, no en passant, 0 half moves, 1 full move
        } else {
            fen += ` ${myColor} - - 0 1`; // ${myColor} to move, castling unavailable, no en passant, 0 half moves, 1 full move
        }

        return fen;
    }


    function feedStockfish(fen) {
        if (engineKilled) return;
        const progress = document.getElementById("progress-stockfish-chessbot")
        if (progress === null){
            reportProgress(window.args?.depth || 15)
        } else {
            console.log("Progress element exists.")
            console.log("Visibility visible")
            progress.style.visibility = "visible";
        }

        // Map stance to Stockfish Contempt: 0=defensive (-150), 1=neutral (0), 2=aggressive (150)
        const stanceContemptMap = { '0': -150, '1': 0, '2': 150 };
        const stance = window.args?.stance ?? '1';
        const contempt = stanceContemptMap[stance] ?? 0;
        engine.postMessage(`setoption name Contempt value ${contempt}`);

        engine.postMessage(`position fen ${fen}`)
        engine.postMessage('go wtime 300000 btime 300000 winc 2000 binc 2000');
        engine.postMessage(`go depth ${window.args?.depth || 15}`);
    }

    // -------------------------------------------------
    // MOVE LIST OBSERVER
    // -------------------------------------------------
    const movesObserver = new MutationObserver(() => {
        console.log("move detected")
        if (engineKilled) return;
        // stop engine manually
        if (document.documentElement.getAttribute('data-chessbot-engine-stop') === 'true') {
            stopEngine();
        }

        console.log("engine alive")
        // remove all highlights (prepare for next highlight)
        removeAllHighlights()
        // Get every move in move list (Cross compatible with bots, coach & online gameplay)
        const moveElements = document.querySelectorAll("wc-simple-move-list div[data-node]")
        if (!moveElements.length) return;
        const totalMoves = moveElements.length;
        const lastMoveByOpponent = (myColor === 'w' && totalMoves % 2 === 0) || (myColor === 'b' && totalMoves % 2 === 1);
        console.info("your turn")

        // CASTLING AVAILABILITY CHECK
        if (castling) {

            // get all moves with piece prefix (e.g Kf7)
            const allMoves = [...moveElements].map(el => {
                const piece = el.querySelector(':scope > .icon-font-chess[data-figurine]')?.dataset.figurine || '';
                return piece + el.textContent.trim();
            });

            // only save moves made by you
            const filtered = allMoves.filter((_, i) => i % 2 === (myColor === "w" ? 1 : 0));


            // if king has moved or already castled 
            if (filtered.some(v => v.startsWith("K")) || "O-O" in filtered || "O-O-O" in filtered) {
                castling = false;
            }
        }


        // allow 200ms for animations to settle
        if (lastMoveByOpponent) setTimeout(() => feedStockfish(getFEN()), 200);
    });

    const moveListContainer = document.querySelector("wc-simple-move-list");
    if (moveListContainer) movesObserver.observe(moveListContainer, { childList:true, subtree:true });

    // -------------------------------------------------
    // INITIAL CHECK: EXISTING MOVES OR FIRST MOVE
    // -------------------------------------------------
    const initialMoves = document.querySelectorAll("wc-simple-move-list div[data-node]");
    if (initialMoves.length) {
        console.log("continuing game")
        const totalMoves = initialMoves.length;

        const lastMoveByOpponent = (myColor === 'w' && totalMoves % 2 === 0) || (myColor === 'b' && totalMoves % 2 === 1);
        console.info(`Is opponent's turn: ${!lastMoveByOpponent}`)
        console.info("myColor: ", myColor)
        console.info("totalMoves: ", totalMoves)
        if (lastMoveByOpponent) feedStockfish(getFEN());
    } else if (!isBoardFlipped && myColor==='w') {
        console.info("First move")
        feedStockfish(getFEN()); // first move
    }


    // -------------------------------------------------
    // GAME OVER OBSERVER
    // -------------------------------------------------
    const gameoverObserver = new MutationObserver((mutationsList) => {
        if (engineKilled) return;
        for (const mutation of mutationsList) {
            if (mutation.type !== 'childList') continue;
            if (document.querySelector(".game-over-modal-content")) {
                stopEngine();
                alert("The game has ended. The engine has been stopped.");
                break;
            }
        }
    });
    gameoverObserver.observe(document.body, { childList:true, subtree:true });
}

setTimeout(startEngine, 500);
