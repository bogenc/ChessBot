(() => {
    console.info("Analytics ready.")
    const DEFAULT_ENDPOINT = "https://chessbot.bogenc.workers.dev/ingest";
    const SCHEMA_VERSION = "1.1.0";
    const STORAGE_INSTALL_ID_KEY = "chessbotAnalyticsInstallId";
    const ANALYTICS_MESSAGE_TYPE = "CHESSBOT_ANALYTICS_LOG";

    const now = () => Date.now();
    const round = (value, digits = 2) => {
        const factor = 10 ** digits;
        return Math.round((Number(value) || 0) * factor) / factor;
    };
    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const randomId = () => {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll("-", "");
        const bytes = new Uint8Array(16);
        globalThis.crypto?.getRandomValues?.(bytes);
        return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    };

    function requestEval(fen, move) {
        return new Promise((resolve) => {
            const id = Math.random().toString(36).slice(2);

            function handler(event) {
                if (event.data?.type === "CHESSBOT_EVAL_RESULT" && event.data.id === id) {
                    window.removeEventListener("message", handler);
                    resolve(event.data.evalCP);
                }
            }

            window.addEventListener("message", handler);

            window.postMessage({
                type: "CHESSBOT_REQUEST_EVAL",
                fen,
                move,
                id
            });
        });
    }

        // ─── SAN → UCI Conversion ─────────────────────────────────────────────────
    // Given a FEN and a SAN move string, produce a 4-5 char UCI string (e.g. "e2e4", "e7e8q").
    // This is needed because the move list DOM gives SAN notation, but we need UCI for
    // consistent move recording. The FEN at the time the arrow was shown is stored and
    // passed here so we can resolve disambiguation and find the source square.

    function parseFenBoard(fen) {
        const parts = (fen || "").split(" ");
        const ranks = (parts[0] || "").split("/");
        const turn = parts[1] || "w";
        const squares = Array.from({ length: 8 }, () => Array(8).fill(""));
        for (let r = 0; r < 8; r++) {
            let f = 0;
            for (const ch of (ranks[7 - r] || "")) {
                if (/\d/.test(ch)) { f += parseInt(ch, 10); }
                else { squares[r][f++] = ch; }
            }
        }
        return { squares, turn };
    }

    function isPathClear(squares, f0, r0, f1, r1) {
        const sf = Math.sign(f1 - f0), sr = Math.sign(r1 - r0);
        let f = f0 + sf, r = r0 + sr;
        while (f !== f1 || r !== r1) {
            if (squares[r]?.[f]) return false;
            f += sf; r += sr;
        }
        return true;
    }

    function pieceCanReach(squares, f0, r0, f1, r1, pt, color) {
        if (f0 === f1 && r0 === r1) return false;
        const target = squares[r1]?.[f1];
        // Can't capture own piece
        if (target && ((color === "w") === (target === target.toUpperCase()))) return false;
        const df = f1 - f0, dr = r1 - r0, adf = Math.abs(df), adr = Math.abs(dr);
        switch (pt.toUpperCase()) {
            case "P": {
                const dir = color === "w" ? 1 : -1;
                const startR = color === "w" ? 1 : 6;
                if (df === 0 && dr === dir && !target) return true;
                if (df === 0 && dr === 2 * dir && r0 === startR && !target && !squares[r0 + dir]?.[f0]) return true;
                if (adf === 1 && dr === dir && target) return true; // diagonal capture
                return false;
            }
            case "N": return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
            case "B": return adf === adr && adf > 0 && isPathClear(squares, f0, r0, f1, r1);
            case "R": return (df === 0 || dr === 0) && isPathClear(squares, f0, r0, f1, r1);
            case "Q": return ((adf === adr && adf > 0) || df === 0 || dr === 0) && isPathClear(squares, f0, r0, f1, r1);
            case "K": return adf <= 1 && adr <= 1;
        }
        return false;
    }

    function sanToUci(san, fen) {
        if (!san || !fen) return null;
        try {
            const { squares, turn } = parseFenBoard(fen);

            // Castling
            if (/^(O-O-O|0-0-0)/.test(san)) return turn === "w" ? "e1c1" : "e8c8";
            if (/^(O-O|0-0)/.test(san)) return turn === "w" ? "e1g1" : "e8g8";

            const clean = san.replace(/[+#!?]/g, "");

            // Promotion suffix (e.g. "e8=Q" or "e8Q")
            const promMatch = clean.match(/=?([QRBN])$/i);
            const promo = promMatch ? promMatch[1].toLowerCase() : "";
            const base = promo ? clean.replace(/=?[QRBN]$/i, "") : clean;

            // Pattern: [KQRBN]? [a-h]? [1-8]? x? [a-h][1-8]
            const m = base.match(/^([KQRBN])?([a-h])?([1-8])?x?([a-h][1-8])$/i);
            if (!m) return null;

            const pt = m[1] || "P";
            const fileHint = m[2] ? m[2].toLowerCase() : null;
            const rankHint = m[3] || null;
            const toSq = m[4].toLowerCase();
            const toF = toSq.charCodeAt(0) - 97;
            const toR = parseInt(toSq[1], 10) - 1;

            // Match piece character for this color
            const colorPiece = turn === "w" ? pt.toUpperCase() : pt.toLowerCase();
            const candidates = [];

            for (let r = 0; r < 8; r++) {
                for (let f = 0; f < 8; f++) {
                    if (squares[r][f] !== colorPiece) continue;
                    if (fileHint && String.fromCharCode(97 + f) !== fileHint) continue;
                    if (rankHint && (r + 1).toString() !== rankHint) continue;
                    if (pieceCanReach(squares, f, r, toF, toR, pt, turn)) {
                        candidates.push(String.fromCharCode(97 + f) + (r + 1));
                    }
                }
            }

            if (candidates.length !== 1) return null;
            return candidates[0] + toSq + promo;
        } catch (e) {
            console.warn("sanToUci failed:", san, e);
            return san;
        }
    }

    function getExtensionVersion(fallback) {
        try {
            return fallback || chrome.runtime.getManifest().version || "unknown";
        } catch {
            return fallback || "unknown";
        }
    }

    function getEndpoint(config = {}) {
        return (
            config.endpoint ||
            globalThis.CHESSBOT_ANALYTICS_ENDPOINT ||
            globalThis.args?.analyticsEndpoint ||
            localStorage.getItem("chessbotAnalyticsEndpoint") ||
            DEFAULT_ENDPOINT
        );
    }

    async function uploadAnalytics(endpoint, payload, useBeacon = false) {
        console.info("Initiate analytics upload")
        const body = JSON.stringify(payload);

        if (parseInt(payload.game.totalMoves) < 7) {
            console.warn(`Payload with ${payload.game.totalMoves} moves insignificant; discarded.`)
            return;
        }

        if (useBeacon && navigator.sendBeacon) {
            const blob = new Blob([body], { type: "application/json" });
            if (navigator.sendBeacon(endpoint, blob)) {
                return { ok: true, transport: "beacon", status: "queued" };
            }
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true
        });
        const responseText = await response.text().catch(() => "");

        if (!response.ok) {
            throw new Error(`Analytics upload failed with ${response.status}: ${responseText.slice(0, 300)}`);
        }

        return { ok: true, transport: "direct", status: response.status, body: responseText };
    }

    function getInstallId() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([STORAGE_INSTALL_ID_KEY], (stored) => {
                    let installId = stored?.[STORAGE_INSTALL_ID_KEY];
                    if (installId) {
                        resolve(installId);
                        return;
                    }

                    installId = randomId();
                    chrome.storage.local.set({ [STORAGE_INSTALL_ID_KEY]: installId }, () => resolve(installId));
                });
            } catch {
                let installId = localStorage.getItem(STORAGE_INSTALL_ID_KEY);
                if (!installId) {
                    installId = randomId();
                    localStorage.setItem(STORAGE_INSTALL_ID_KEY, installId);
                }
                resolve(installId);
            }
        });
    }

    function normalizeColor(color) {
        if (color === "b" || color === "black") return "black";
        return "white";
    }

    function currentMoveNumber(ply = 0) {
        return Math.floor((Number(ply) || 0) / 2) + 1;
    }

    function movePhase(moveNumber) {
        if (moveNumber <= 10) return "opening";
        if (moveNumber <= 30) return "middlegame";
        return "endgame";
    }

    function isUserPly(ply, playerColor) {
        return normalizeColor(playerColor) === "white" ? ply % 2 === 1 : ply % 2 === 0;
    }

    function extractSanTarget(moveText) {
        const sanitized = String(moveText || "")
            .replace(/[+#?!x=]/g, "")
            .replace(/ep\.?/i, "")
            .trim();

        if (/O-O-O|0-0-0/.test(sanitized)) return "queenside-castle";
        if (/O-O|0-0/.test(sanitized)) return "kingside-castle";

        const match = sanitized.match(/([a-h][1-8])(?:[QRBN])?$/i);
        return match ? match[1].toLowerCase() : "";
    }

    function didFollowArrow(moveText, topMove) {
        if (!topMove) return false;

        const expectedTo = topMove.slice(2, 4);
        const sanTarget = extractSanTarget(moveText);

        if (sanTarget === expectedTo) return true;
        if (sanTarget === "kingside-castle") return /e[18]g[18]/.test(topMove);
        if (sanTarget === "queenside-castle") return /e[18]c[18]/.test(topMove);

        return false;
    }

    function inferGameTermination(reason, gameOverText = "") {
        const modalText = String(gameOverText || "").toLowerCase();
        if (/checkmate/.test(modalText)) return "checkmate";
        if (/resign/.test(modalText)) return "resignation";
        if (/timeout|time/.test(modalText)) return "timeout";
        if (/draw|stalemate|repetition|insufficient/.test(modalText)) return "draw";
        if (/abandon/.test(modalText)) return "abandoned";
        return reason || "unknown";
    }

    function parseEngineInfo(line) {
        const depth = Number(line.match(/\bdepth\s+(\d+)/)?.[1]);
        const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
        const multipv = Number(line.match(/\bmultipv\s+(\d+)/)?.[1] || 1);
        let evalCP = null;

        if (cpMatch) evalCP = Number(cpMatch[1]);
        if (mateMatch) evalCP = Number(mateMatch[1]) > 0 ? 100000 : -100000;

        return {
            depth: Number.isFinite(depth) ? depth : null,
            evalCP,
            multipv
        };
    }

    function estimateComplexity(evalCP, spread) {
        const evalBalance = 1 - clamp(Math.abs(evalCP || 0) / 1000, 0, 1);
        const spreadSignal = clamp((Number(spread) || 0) / 300, 0, 1);
        return round((evalBalance * 0.7) + (spreadSignal * 0.3), 2);
    }

    function accuracyFromCentipawnLoss(loss) {
        return round(clamp(1 - ((Number(loss) || 0) / 300), 0, 1), 2);
    }

    class AnalyticsSession {
        constructor(config = {}) {
            this.endpoint = getEndpoint(config);
            this.installIdPromise = getInstallId();
            this.extensionVersion = getExtensionVersion(config.extensionVersion);
            this.playerColor = normalizeColor(config.playerColor);
            this.playerRating = config.playerRating || "unknown";
            this.opponentRating = config.opponentRating || "unknown";
            this.selectedDepth = Number(config.depth || globalThis.args?.depth || 15);
            this.sessionId = randomId();
            this.startedAt = now();
            this.currentPly = Number(config.currentPly || config.initialPly || 0);
            this.lastPly = this.currentPly;
            this.lastMoveText = config.lastMoveText || "";
            this.lastMoves = Array.isArray(config.moves) ? config.moves : [];
            this.timeControl = config.timeControl || "unknown";
            this.gameOverText = "";
            this.lastOpponentMoveAt = null;
            this.lastEvalCP = 0;
            this.latestDepth = this.selectedDepth;
            this.engineSession = null;
            this.currentSearch = null;
            this.pendingArrow = null;
            this.engineSessions = [];
            this.engineDepthSamples = [];
            this.recommendations = [];
            this.multipvScores = new Map();
            this.stopped = false;
            this.flushed = false;
            this.terminationReason = null;
            this.engineKilledBeforeGameEnd = false;
            this.pagehideHandler = () => this.flush("pagehide", true);
            globalThis.addEventListener("pagehide", this.pagehideHandler);
        }

        dispose() {
            try { globalThis.removeEventListener("pagehide", this.pagehideHandler); } catch {}
        }

        getCurrentMoveNumber(ply = this.currentPly) {
            return currentMoveNumber(ply);
        }

        recordMoveList(snapshot = {}) {
            if (this.stopped) return;

            const observedAt = snapshot.observedAt || now();
            const ply = Number(snapshot.ply ?? snapshot.totalMoves ?? this.currentPly ?? 0);
            const moveText = snapshot.lastMoveText || this.lastMoveText || "";

            if (Array.isArray(snapshot.moves)) this.lastMoves = snapshot.moves;
            this.currentPly = Number.isFinite(ply) ? ply : this.currentPly;
            this.lastMoveText = moveText;

            if (snapshot.initial) {
                this.lastPly = this.currentPly;
                return;
            }

            if (this.currentPly <= this.lastPly) return;

            const moveByUser = typeof snapshot.moveByUser === "boolean"
                ? snapshot.moveByUser
                : isUserPly(this.currentPly, this.playerColor);
            const moveByOpponent = typeof snapshot.lastMoveByOpponent === "boolean"
                ? snapshot.lastMoveByOpponent
                : !moveByUser;

            if (moveByOpponent) this.lastOpponentMoveAt = observedAt;
            if (moveByUser) this.completePendingArrow({ ply: this.currentPly, moveText, observedAt });

            this.lastPly = this.currentPly;
        }

        recordEngineSearch(search = {}) {
            if (this.stopped) return;

            const observedAt = search.observedAt || now();
            const ply = Number(search.ply ?? this.currentPly ?? 0);
            const depth = Number(search.depth || this.selectedDepth);
            if (Number.isFinite(ply)) this.currentPly = ply;
            if (search.fen) this.currentFen = search.fen;

            this.finishCurrentSearch(observedAt);
            this.multipvScores.clear();

            if (!this.engineSession) {
                this.engineSession = {
                    startedAt: observedAt,
                    startedOnMove: search.moveNumber || this.getCurrentMoveNumber(),
                    depthSelected: depth,
                    stoppedOnMove: this.getCurrentMoveNumber(),
                    stoppedAt: observedAt
                };
                this.engineSessions = [this.engineSession];
            }

            this.engineDepthSamples.push({
                depth,
                startedAt: observedAt,
                stoppedAt: observedAt
            });

            this.currentSearch = {
                startedAt: observedAt,
                startedOnMove: search.moveNumber || this.getCurrentMoveNumber(),
                depthSelected: depth,
                evalAtStart: round(this.lastEvalCP / 100, 2)
            };
        }

        recordEngineOutput(message, metadata = {}) {
            if (this.stopped || typeof message !== "string") return;

            if (message.startsWith("info ")) {
                const info = parseEngineInfo(message);
                if (info.depth !== null) this.latestDepth = info.depth;
                if (info.evalCP !== null) {
                    this.multipvScores.set(info.multipv, info.evalCP);

                    if (info.multipv === 1) {
                        this.lastEvalCP = info.evalCP;
                    }
                }
                return;
            }

            if (message.startsWith("bestmove ")) {
                const bestMove = message.split(/\s+/)[1];
                if (bestMove && bestMove !== "(none)") this.recordArrow(bestMove, metadata.observedAt);
            }
        }

        finishCurrentSearch(stoppedAt = now()) {
            const latestDepthSample = this.engineDepthSamples[this.engineDepthSamples.length - 1];
            if (latestDepthSample) latestDepthSample.stoppedAt = stoppedAt;

            if (!this.currentSearch) return;
            this.currentSearch = null;
        }

        finishCurrentEngineSession(stoppedAt = now()) {
            this.finishCurrentSearch(stoppedAt);
            if (!this.engineSession) return;

            this.engineSession.stoppedOnMove = this.getCurrentMoveNumber();
            this.engineSession.stoppedAt = stoppedAt;
        }

        recordArrow(bestMove, observedAt = now()) {
            const searchStartedAt = this.currentSearch?.startedAt || observedAt;
            const scores = [...this.multipvScores.values()].filter((value) => Number.isFinite(value));
            const spread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
            const moveNumber = this.getCurrentMoveNumber();
            if (this.engineSession && this.engineSession.evalAtStart === undefined) {
                this.engineSession.evalAtStart = round(this.lastEvalCP / 100, 2);
            }

            this.pendingArrow = {
                moveNumber,
                phase: movePhase(moveNumber),
                engineOnAtTurn: true,
                arrowShownDelayMs: Math.max(0, observedAt - searchStartedAt),
                arrowShownAt: observedAt,
                movePlayed: "",
                fen: this.currentFen,
                engineTopMove: bestMove,
                alternativeMoveQualityCP: null,
                evalAfterMoveCP: Math.round(this.lastEvalCP || 0),
                positionComplexity: estimateComplexity(this.lastEvalCP, spread),
                evalSpreadTop3: round(spread / 100, 2),
                opponentMoveTimeMs: this.lastOpponentMoveAt ? Math.max(0, searchStartedAt - this.lastOpponentMoveAt) : 0,
                depthChangedThisTurn: this.currentSearch ? this.currentSearch.depthSelected !== this.selectedDepth : false,
                newDepth: this.currentSearch?.depthSelected || this.selectedDepth
            };

            this.finishCurrentSearch(observedAt);
        }

        completePendingArrow({ ply = this.currentPly, moveText = this.lastMoveText, observedAt = now() } = {}) {
            if (!this.pendingArrow) return;

            const uciMove = sanToUci(moveText, this.pendingArrow.fen);
            const playedMove = uciMove || moveText || "unknown";

            const followedArrow = uciMove
                ? this.pendingArrow.engineTopMove === uciMove
                : didFollowArrow(moveText, this.pendingArrow.engineTopMove);
            const reactionTimeMs = Math.max(0, observedAt - this.pendingArrow.arrowShownAt);
            //const qualityLoss = followedArrow ? 0 : Math.min(300, Math.abs(this.lastEvalCP - this.pendingArrow.evalAfterMoveCP));

            const base = {
                moveNumber: this.pendingArrow.moveNumber || this.getCurrentMoveNumber(ply),
                phase: this.pendingArrow.phase,
                engineOnAtTurn: true,
                arrowShownDelayMs: this.pendingArrow.arrowShownDelayMs,
                reactionTimeMs,
                followedArrow,
                movePlayed: playedMove,
                engineTopMove: this.pendingArrow.engineTopMove,
                evalAfterMoveCP: this.pendingArrow.evalAfterMoveCP,
                positionComplexity: this.pendingArrow.positionComplexity,
                evalSpreadTop3: this.pendingArrow.evalSpreadTop3,
                opponentMoveTimeMs: this.pendingArrow.opponentMoveTimeMs,
                depthChangedThisTurn: this.pendingArrow.depthChangedThisTurn,
                newDepth: this.pendingArrow.newDepth
            };

            // --- ALWAYS PUSH IMMEDIATELY ---
            const record = {
                ...base,
                alternativeMoveQualityCP: followedArrow ? null : undefined // undefined value is updated later
            };

            this.recommendations.push(record);

            // --- ASYNC PATCH ---
            if (!followedArrow && uciMove) {
                requestEval(this.pendingArrow.fen, uciMove).then((playerEvalRaw) => {
                    const playerEval = -playerEvalRaw;
                    
                    // Read from the local 'base' object instead of 'this.pendingArrow'
                    const bestEval = base.evalAfterMoveCP;

                    const loss = Math.min(300, Math.abs(bestEval - playerEval));

                    // mutate existing record instead of pushing new one
                    record.alternativeMoveQualityCP = Math.round(loss);
                });
            }

            this.pendingArrow = null;
        }

        stop(reason, options = {}) {
            console.info("Stop called")
            if (this.stopped && !options.flush) return;

            this.stopped = true;
            this.terminationReason = reason || this.terminationReason || "engine_stopped";
            this.engineKilledBeforeGameEnd = Boolean(options.killedBeforeGameEnd);
            if (options.gameOverText) this.gameOverText = options.gameOverText;
            this.finishCurrentEngineSession();

            if (options.flush) this.flush(this.terminationReason, options.beacon);
        }

        buildEngineLifecycle() {
            const sessions = this.engineSessions.map((session) => ({
                startedOnMove: session.startedOnMove,
                stoppedOnMove: session.stoppedOnMove,
                depthSelected: session.depthSelected,
                evalAtStart: session.evalAtStart
            }));
            const durations = this.engineSessions.map((session) => Math.max(0, session.stoppedAt - session.startedAt));
            const totalEngineActiveMs = Math.round(durations.reduce((sum, duration) => sum + duration, 0));
            const depthValues = this.engineDepthSamples.length
                ? this.engineDepthSamples.map((sample) => sample.depth)
                : this.engineSessions.map((session) => session.depthSelected);
            const depthDurations = this.engineDepthSamples.map((sample) => Math.max(0, sample.stoppedAt - sample.startedAt));
            const totalDepthSampleMs = depthDurations.reduce((sum, duration) => sum + duration, 0);
            const weightedDepth = totalEngineActiveMs
                ? (
                    totalDepthSampleMs
                        ? this.engineDepthSamples.reduce((sum, sample, index) => sum + (sample.depth * depthDurations[index]), 0) / totalDepthSampleMs
                        : average(depthValues)
                )
                : average(depthValues);

            return {
                sessions,
                sessionCount: sessions.length,
                engineKilledBeforeGameEnd: this.engineKilledBeforeGameEnd,
                totalEngineActiveMs,
                avgDepth: round(average(depthValues), 2),
                weightedDepth: round(weightedDepth, 2)
            };
        }

        buildArrowInteraction() {
            const moves = this.recommendations;
            const followed = moves.filter((move) => move.followedArrow);
            const ignored = moves.filter((move) => !move.followedArrow);
            const reactionTimes = moves.map((move) => move.reactionTimeMs);
            const avgReaction = average(reactionTimes);
            const variance = average(reactionTimes.map((value) => (value - avgReaction) ** 2));
            const byGamePhase = {};

            for (const phase of ["opening", "middlegame", "endgame"]) {
                const phaseMoves = moves.filter((move) => move.phase === phase);
                byGamePhase[phase] = {
                    followRate: round(phaseMoves.length ? phaseMoves.filter((move) => move.followedArrow).length / phaseMoves.length : 0, 2),
                    avgReactionTimeMs: Math.round(average(phaseMoves.map((move) => move.reactionTimeMs)))
                };
            }

            return {
                globalFollowRate: round(moves.length ? followed.length / moves.length : 0, 2),
                avgReactionTimeMsWhenFollowing: Math.round(average(followed.map((move) => move.reactionTimeMs))),
                avgReactionTimeMsWhenIgnoring: Math.round(average(ignored.map((move) => move.reactionTimeMs))),
                reactionTimeVariance: round(variance / 1000000, 2),
                byGamePhase,
                moves
            };
        }

        buildAccuracyProfile() {
            const followedLosses = this.recommendations
                .filter((move) => move.followedArrow)
                .map((move) => Math.max(0, move.alternativeMoveQualityCP || 0));
            const ignoredLosses = this.recommendations
                .filter((move) => !move.followedArrow)
                .map((move) => Math.max(0, move.alternativeMoveQualityCP || 0));
            const engineOnLoss = average(followedLosses);
            const engineOffLoss = ignoredLosses.length ? average(ignoredLosses) : engineOnLoss;
            const engineOnAccuracy = accuracyFromCentipawnLoss(engineOnLoss);
            const engineOffAccuracy = accuracyFromCentipawnLoss(engineOffLoss);

            return {
                engineOn: {
                    avgCentipawnLoss: round(engineOnLoss, 2),
                    accuracy: engineOnAccuracy
                },
                engineOff: {
                    avgCentipawnLoss: round(engineOffLoss, 2),
                    accuracy: engineOffAccuracy
                },
                accuracyDelta: round(engineOnAccuracy - engineOffAccuracy, 2)
            };
        }

        async buildPayload(reason) {
            this.finishCurrentEngineSession();
            return {
                meta: {
                    installId: await this.installIdPromise,
                    schemaVersion: SCHEMA_VERSION,
                    extensionVersion: this.extensionVersion
                },
                game: {
                    sessionId: this.sessionId,
                    timeControl: this.timeControl,
                    playerColor: this.playerColor,
                    totalMoves: this.currentPly,
                    gameTermination: inferGameTermination(reason || this.terminationReason, this.gameOverText),
                    finalEvalCP: Math.round(this.lastEvalCP || 0),
                    playerRating: this.playerRating,
                    opponentRating: this.opponentRating
                },
                engineLifecycle: this.buildEngineLifecycle(),
                arrowInteraction: this.buildArrowInteraction(),
                accuracyProfile: this.buildAccuracyProfile()
            };
        }

        async flush(reason, useBeacon = false) {
            console.info("ChessBot flush called", { reason, flushed: this.flushed });
            if (this.flushed) return;
            this.flushed = true;
            this.terminationReason = reason || this.terminationReason || "unknown";

            const payload = await this.buildPayload(this.terminationReason);

            try {
                const result = await uploadAnalytics(this.endpoint, payload, useBeacon);
                console.info("ChessBot analytics uploaded.", result);
            } catch (error) {
                console.warn("ChessBot analytics upload failed.", error);
                this.flushed = false;
            } finally {
                this.dispose();
            }
        }
    }

    let activeSession = null;

    function start(config = {}) {
        activeSession?.stop("restarted", { flush: true, killedBeforeGameEnd: true });
        activeSession = new AnalyticsSession(config);
        return activeSession;
    }

    globalThis.ChessBotAnalytics = {
        start,
        recordMoveList: (snapshot) => activeSession?.recordMoveList(snapshot),
        recordEngineSearch: (search) => activeSession?.recordEngineSearch(search),
        recordEngineOutput: (message, metadata) => activeSession?.recordEngineOutput(message, metadata),
        stop: (reason, options = {}) => activeSession?.stop(reason, {
            flush: true,
            killedBeforeGameEnd: reason !== "gameover",
            ...options
        }),
        flush: (reason) => activeSession?.flush(reason),
        version: "1.0.0"
    };

})();
