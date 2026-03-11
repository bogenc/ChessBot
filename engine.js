function startEngine() {
    console.info("Injected.")
    let isBoardFlipped = document.querySelector(".board").classList.contains("flipped");
    let myColor = isBoardFlipped ? "b" : "w";
    let letterNumberMap = { a:1, b:2, c:3, d:4, e:5, f:6, g:7, h:8 };
    let engineKilled = false;

    // get depth = 2 (about 80% accuracy) more than 6 (92% accuracy)
    const weighted = [2, 2, 2, 3, 3, 3, 4, 4, 5, 6];

    const rng_depth = weighted[Math.floor(Math.random() * weighted.length)];

    let castling = true;



    function replaceLettersWithNumbers(inputString) {
        return inputString.split('').map(char => {
            return letterNumberMap[char] !== undefined ? letterNumberMap[char] : char;
        }).join('');
    }


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

    function replaceLettersWithNumbers(inputString) {
        return inputString.split('').map(char =>
            letterNumberMap[char] !== undefined ? letterNumberMap[char] : char
        ).join('');
    }

    function flipSquare(square) {
    const file = square[0];
    const rank = parseInt(square[1], 10);

    const flippedFile =
        String.fromCharCode('a'.charCodeAt(0) + (7 - (file.charCodeAt(0) - 'a'.charCodeAt(0))));
    const flippedRank = 9 - rank;

    return flippedFile + flippedRank;
}

function highlightMove(target) {
    if (engineKilled) return;

    removeAllHighlights();
    const board = document.querySelector("wc-chess-board");




    function squareToPoint(square) {
        const file = square.charCodeAt(0) - 97; // a=0
        const rank = parseInt(square[1], 10); // convert rank to integer

        console.info((file + 1).toString()+rank.toString())

        return (file + 1).toString()+rank.toString()

        
    }

    function createHighlightElement(target, color) {
        const div = document.createElement("div");

        div.className = `highlight bestmove square-${target}`;
        div.style.backgroundColor = color;
        div.style.opacity = "1";
        div.style.zIndex = "9999999";

        div.setAttribute("data-test-element", "highlight");
        div.setAttribute("data-test-type", "highlight");

        board.appendChild(div);
    }


    const fromSq = target.slice(0, 2);
    const toSq   = target.slice(2, 4);

    const from = squareToPoint(fromSq);
    const to   = squareToPoint(toSq);

    // FROM square
    createHighlightElement(from, "purple")
    // TO square
    createHighlightElement(to, "orange")
}



    // -------------------------------------------------
    // STOCKFISH
    // -------------------------------------------------

        function reportProgress(depth) {
        const loaderHTML = `<div style="position:relative;top:15px;" class="tooltip-container" id="progress-stockfish-chessbot"><div class="tooltip-text">Depth <depth>0</depth>/${depth}<br><a style="text-decoration:underline;color:#404040;cursor:pointer" onclick='alert("If your computer is not the best, Stockfish may have difficulties calculating high ELOs. Try refreshing the page and lower the ELO on the extension.")'>Too slow?</a><a style="text-decoration:underline;color:#404040;cursor:pointer" onclick="document.body.appendChild(Object.assign(document.createElement('input'), { id: 'recompute', type: 'hidden', value: 'true' }));">Recompute turns</a></div><span class="loader"></span><style>.tooltip-text{visibility:hidden;width:120px;background-color:#8c8b8b;color:#4d4d4d;text-align:center;border-radius:5px;padding:5px;position:absolute;z-index:1;top:12.5%;left:10%;margin-top:-16px;opacity:0;transition:opacity .3s}.tooltip-container:hover .tooltip-text{visibility:visible;opacity:1}.loader{border:2px solid #fff;width:32px;height:32px;background:#ff3d00;border-radius:50%;display:inline-block;position:relative;box-sizing:border-box;animation:rotation 2s linear infinite}.loader::after{content:'';box-sizing:border-box;position:absolute;left:50%;top:50%;border:16px solid;border-color:transparent #fff;border-radius:50%;transform:translate(-50%,-50%)}@keyframes rotation{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>`;
      
      // Append the HTML code to the body
      document.getElementById("board-layout-main").insertAdjacentHTML("beforeend",loaderHTML);

    }

    function reportDepthCycle(depth) {
        console.log("report depth")
        document.querySelector('#progress-stockfish-chessbot .tooltip-text depth').innerHTML = depth;
    }

    const engine = new Worker("/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js");
    // very aggressive, does sacrifices a lot more
    const contempt = Math.floor(Math.random() * (120 - 60 + 1)) + 60;

    engine.postMessage(`setoption name Contempt value ${contempt}`);

    engine.onmessage = function(event) {
        if (engineKilled) return;
        try {
            if (event.data.startsWith('bestmove')) {
                const bestMove = event.data.split(' ')[1];
                console.log(event.data)
                if (bestMove) highlightMove(bestMove);
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
            reportProgress(rng_depth)
        } else {
            console.log("Progress element exists.")
            console.log("Visibility visible")
            progress.style.visibility = "visible";
        }
        engine.postMessage(`position fen ${fen}`)
        
        engine.postMessage('go wtime 300000 btime 300000 winc 2000 binc 2000');
        engine.postMessage(`go depth ${rng_depth}`);
    }

    // -------------------------------------------------
    // MOVE LIST OBSERVER
    // -------------------------------------------------
    const movesObserver = new MutationObserver(() => {
        console.log("move detected")
        if (engineKilled) return;
        console.log("engine alive")
        removeAllHighlights();
        const moveElements = document.querySelectorAll(".timestamps-with-base-time .offset-for-annotation-icon");
        if (!moveElements.length) return;
        const totalMoves = moveElements.length;
        const lastMoveByOpponent = (myColor === 'w' && totalMoves % 2 === 0) || (myColor === 'b' && totalMoves % 2 === 1);

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

        console.info("your turn")
        if (lastMoveByOpponent) feedStockfish(getFEN());
    });

    const moveListContainer = document.querySelector(".timestamps-with-base-time");
    if (moveListContainer) movesObserver.observe(moveListContainer, { childList:true, subtree:true });

    // -------------------------------------------------
    // INITIAL CHECK: EXISTING MOVES OR FIRST MOVE
    // -------------------------------------------------
    const initialMoves = document.querySelectorAll(".timestamps-with-base-time .offset-for-annotation-icon");
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


const wrongTurn = new MutationObserver((mutationsList) => {
    if (engineKilled) return;

    for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
            // Check if the value of the hidden input has changed
            const hiddenInput = document.querySelector("input[type='hidden']#recompute");
            if (hiddenInput && hiddenInput.value === 'true') {
                console.log("Hidden input value is true.");
                feedStockfish(getFEN());
            } else {
                console.log("Hidden input value is not true.");
            }
        }
    }

    });
    wrongTurn.observe(document.body, { childList:true, subtree:true });

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
