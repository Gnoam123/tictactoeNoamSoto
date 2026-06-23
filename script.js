// script.js

let gameMode = "local";
let board = [];
let numBoard = [];
let currentPlayer = "X";
let gameOver = false;
let rows = 3, cols = 3, winLength = 3;

// --- משתני שרת והתחברות ---
let ws = new WebSocket("ws://192.168.150.151:8765");
let currentUser = null;
let playerXUser = null;
let playerOUser = null;

// --- משתני ניהול תורים אונליין ---
let myRole = null;
let onlineGameStarted = false;

let windows = [];
let cellToWindows = [];

let boardDiv, boardWrap, statusDiv, resetBtn, colsInput, rowsInput, winInput;
let resultModal, resultCard, resultIcon, resultTitle, resultText;
let resizeRaf = null;

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

function syncSettingsToServer() {
    if (ws.readyState === WebSocket.OPEN && myRole === "X" && gameMode === "online") {
        ws.send(JSON.stringify({
            action: "update_settings",
            rows: Number(rowsInput.value),
            cols: Number(colsInput.value),
            winLength: Number(winInput.value)
        }));
    }
}

function handleSettingsChange() {
    if (gameMode === "online") {
        if (myRole === "X") {
            syncSettingsToServer();
            startGame(); // חשוב לבנות מחדש את הלוח גם אצל X
        }
    } else {
        startGame();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    boardDiv = document.getElementById("board");
    boardWrap = document.querySelector(".board-wrap");
    statusDiv = document.getElementById("status");
    resetBtn = document.getElementById("resetBtn");
    rowsInput = document.getElementById("rows");
    colsInput = document.getElementById("cols");
    winInput = document.getElementById("winLength");

    resultModal = document.getElementById("resultModal");
    resultCard = document.getElementById("resultCard");
    resultIcon = document.getElementById("resultIcon");
    resultTitle = document.getElementById("resultTitle");
    resultText = document.getElementById("resultText");
    rowsInput.addEventListener("change", handleSettingsChange);
    colsInput.addEventListener("change", handleSettingsChange);
    winInput.addEventListener("change", handleSettingsChange);

    // שינוי ל-loginForm והאזנה ל-submit
    document.getElementById("loginForm").addEventListener("submit", (e) => {
        e.preventDefault(); // עצור! מונע מהדף להתרענן ולנתק את ה-WebSocket

        const user = document.getElementById("loginUser").value.trim();
        const pass = document.getElementById("loginPass").value;
        document.getElementById("loginError").classList.add("is-hidden");

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "login", username: user, password: pass }));
        } else {
            alert("השרת לא מחובר!");
        }
    });

    // === חיבור אירועים לכפתורי פאנל הניהול והמודאל ===
    // ודא שה-ID האלו תואמים למה שרשמת ב-HTML שלך בכפתורים ובחלון הקופץ
    const adminUsersBtn = document.getElementById("adminUsersBtn");
    if (adminUsersBtn) {
        adminUsersBtn.addEventListener("click", () => requestAdminData("get_users"));
    }

    const adminGamesBtn = document.getElementById("adminGamesBtn");
    if (adminGamesBtn) {
        adminGamesBtn.addEventListener("click", () => requestAdminData("get_games"));
    }

    const closeAdminBtn = document.getElementById("closeAdminBtn");
    if (closeAdminBtn) {
        closeAdminBtn.addEventListener("click", closeAdminModal);
    }

    ws.onmessage = async function (event) {
        try {
            const data = JSON.parse(event.data);

            if (data.action === "login_response") {
                if (data.success) {
                    currentUser = data.username;
                    document.getElementById("loginModal").classList.add("is-hidden");

                    // === תוספת עבור פאנל הניהול ===
                    if (data.is_admin) {
                        document.getElementById("adminPanel").classList.remove("is-hidden");
                        // הופעת פאנל המנהל משנה מעט את רוחב אזור הלוח.
                        requestAnimationFrame(scheduleBoardResize);
                    }
                    // ==================================
                } else {
                    document.getElementById("loginError").classList.remove("is-hidden");
                }
                return;
            }

            // === טיפול בקבלת הנתונים מהשרת לפאנל הניהול ===
            if (data.action === "admin_users_data") {
                renderAdminTable("👥 רשימת משתמשים", ["שם משתמש"], data.data.map(u => [u]));
                return;
            }
            if (data.action === "admin_games_data") {
                renderAdminTable("🎮 היסטוריית משחקים", ["שחקן X", "שחקן O", "מנצח"], data.data.map(g => [g.user1, g.user2, g.winner]));
                return;
            }
            // =========================================================================

            // חסימה: מכאן והלאה, נתעלם מהודעות אם אנחנו לא במצב אונליין
            if (gameMode !== "online") return;

            // שחקן נכנס בהצלחה למצב אונליין וקיבל תפקיד
            if (data.action === "role_assigned") {
                myRole = data.role;
                if (myRole === "X") {
                    syncSettingsToServer();
                    updateStatus("מחובר כ-X. ממתין לשחקן היריב (O)...");
                } else if (myRole === "O") {
                    if (data.settings) {
                        rowsInput.value = data.settings.rows;
                        colsInput.value = data.settings.cols;
                        winInput.value = data.settings.winLength;
                    }
                    updateStatus("מחובר כ-O. הלוח סונכרן לפי שחקן X. ממתין לתחילת המשחק...");
                    startGame();
                } else {
                    updateStatus("החדר מלא, אתה צופה.");
                }
                return;
            }

            // עדכון הגדרות אם שחקן X משנה אותן בזמן אמת
            if (data.action === "update_settings") {
                if (myRole === "O") {
                    rowsInput.value = data.settings.rows;
                    colsInput.value = data.settings.cols;
                    winInput.value = data.settings.winLength;
                    startGame();
                }
                return;
            }

            if (data.action === "start_game") {
                onlineGameStarted = true;
                playerXUser = data.playerX;
                playerOUser = data.playerO;

                if (data.settings) {
                    rowsInput.value = data.settings.rows;
                    colsInput.value = data.settings.cols;
                    winInput.value = data.settings.winLength;
                }

                startGame();
                updateStatus(`המשחק התחיל! תור השחקן: X`);
                return;
            }

            // השחקן השני התנתק או יצא ממצב אונליין
            if (data.action === "player_disconnected") {
                onlineGameStarted = false;
                if (myRole === "X") {
                    updateStatus("שחקן O התנתק או עזב את מצב אונליין. ממתין לשחקן חדש...");
                } else if (myRole === "O") {
                    updateStatus("שחקן X התנתק! המשחק הופסק.");
                }
                return;
            }

            if (data.action === "error") {
                alert(data.message);
                return;
            }

            if (data.action === "move") {
                makeMove(data.r, data.c, data.player);
                if (!gameOver) switchPlayer();
            }
        } catch (e) {
            // התעלמות
        }
    };

    document.querySelectorAll(".mode").forEach(btn => {
        btn.addEventListener("click", () => {
            const oldMode = gameMode;

            document.querySelectorAll(".mode").forEach(b => {
                const isActive = b === btn;
                b.classList.toggle("active", isActive);
                b.setAttribute("aria-selected", String(isActive));
            });

            gameMode = btn.dataset.mode;

            // שליחת בקשות לשרת בעת שינוי מצב משחק
            if (ws.readyState === WebSocket.OPEN) {
                if (gameMode === "online" && oldMode !== "online") {
                    ws.send(JSON.stringify({ action: "join_online" }));
                } else if (gameMode !== "online" && oldMode === "online") {
                    ws.send(JSON.stringify({ action: "leave_online" }));
                    myRole = null;
                    onlineGameStarted = false;
                }
            } else if (gameMode === "online") {
                alert("השרת לא מחובר, ולכן כרגע אי אפשר לעבור למצב אונליין.");
            }

            startGame();
        });
    });

    if (resetBtn) resetBtn.addEventListener("click", () => {
        if (gameMode === "online" && myRole === "O") {
            alert("רק שחקן X יכול לאתחל משחק במצב אונליין.");
            return;
        }
        startGame();
        if (gameMode === "online" && myRole === "X") {
            syncSettingsToServer();
        }
    });

    window.addEventListener("resize", scheduleBoardResize);
    window.addEventListener("orientationchange", scheduleBoardResize);

    startGame();
});

function startGame() {
    hideGameResult();

    document.querySelectorAll(".winning-cell").forEach(cell => {
        cell.classList.remove("winning-cell");
    });

    if (gameMode === "online" && myRole === "O") {
        rowsInput.disabled = true;
        colsInput.disabled = true;
        winInput.disabled = true;
    } else {
        rowsInput.disabled = false;
        colsInput.disabled = false;
        winInput.disabled = false;
    }

    const rVal = Number(rowsInput?.value);
    const cVal = Number(colsInput?.value);
    const wVal = Number(winInput?.value);
    if (!isNaN(rVal) && rVal >= 3) rows = rVal;
    if (!isNaN(cVal) && cVal >= 3) cols = cVal;
    if (!isNaN(wVal) && wVal >= 3) winLength = wVal;

    if (winLength > rows && winLength > cols) {
        alert("רצף הניצחון לא יכול להיות גדול גם מהרוחב וגם מהאורך");
        return;
    }

    board = Array.from({ length: rows }, () => Array(cols).fill(""));
    numBoard = Array.from({ length: rows }, () => Array(cols).fill(0));
    currentPlayer = "X";
    gameOver = false;

    if (gameMode !== "online") {
        playerXUser = null;
        playerOUser = null;
    }

    boardDiv.innerHTML = "";
    boardDiv.style.setProperty("--cols", String(cols));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.id = `${r}-${c}`;
            cell.addEventListener("click", () => handleClick(r, c, cell));
            boardDiv.appendChild(cell);
        }
    }

    scheduleBoardResize();

    buildWindows();

    if (gameMode === "online" && currentUser) {
        if (!onlineGameStarted && myRole === "X") updateStatus("ממתין לשחקן נוסף (O)...");
        else if (onlineGameStarted) updateStatus(`${currentPlayer}:תור השחקן `);
    } else {
        updateStatus();
    }
}

function scheduleBoardResize() {
    if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);

    resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        resizeBoard();
    });
}

function resizeBoard() {
    if (!boardDiv || !boardWrap || rows < 1 || cols < 1) return;

    const wrapStyle = getComputedStyle(boardWrap);
    const wrapPaddingH =
        (parseFloat(wrapStyle.paddingLeft) || 0) +
        (parseFloat(wrapStyle.paddingRight) || 0);
    const wrapPaddingV =
        (parseFloat(wrapStyle.paddingTop) || 0) +
        (parseFloat(wrapStyle.paddingBottom) || 0);

    const availableWidth = Math.max(120, boardWrap.clientWidth - wrapPaddingH - 2);
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    const isSmallPhone = window.matchMedia("(max-width: 560px)").matches;

    // בלוחות גדולים מצמצמים כמעט לגמרי את הרווחים והמסגרת,
    // כדי שכל פיקסל פנוי יעבור לגודל המשבצות.
    let gap = 3;
    if (cols >= 24 || rows >= 24) gap = 1;
    else if (cols >= 10 || rows >= 10) gap = 2;

    let boardPadding = isSmallPhone ? 2 : (isMobile ? 3 : 5);
    if (cols >= 20 || rows >= 20) boardPadding = 1;

    const widthForCells = availableWidth - (2 * boardPadding) - ((cols - 1) * gap);
    const cellSizeByWidth = Math.floor(widthForCells / cols);

    let cellSizeByHeight = Infinity;
    if (!isMobile) {
        // במחשב אזור הלוח מקבל את כל גובה המסך שנותר. השימוש בגובה
        // האמיתי שלו מאפשר למשבצות לגדול בלי להיחתך.
        const availableHeight = Math.max(120, boardWrap.clientHeight - wrapPaddingV - 2);
        const heightForCells = availableHeight - (2 * boardPadding) - ((rows - 1) * gap);
        cellSizeByHeight = Math.floor(heightForCells / rows);
    }

    const minCell = isSmallPhone ? 7 : 9;
    const maxCell = isMobile ? 140 : 210;

    let cellSize = Math.min(cellSizeByWidth, cellSizeByHeight, maxCell);
    if (!Number.isFinite(cellSize)) cellSize = Math.min(cellSizeByWidth, maxCell);
    cellSize = Math.max(minCell, Math.floor(cellSize));

    boardDiv.style.setProperty("--cols", String(cols));
    boardDiv.style.setProperty("--cell-size", `${cellSize}px`);
    boardDiv.style.setProperty("--board-gap", `${gap}px`);
    boardDiv.style.setProperty("--board-padding", `${boardPadding}px`);
    boardDiv.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    boardDiv.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;
}

function updateStatus(text) {
    if (text) statusDiv.textContent = text;
    else statusDiv.textContent = gameOver ? "המשחק נגמר" : `תור השחקן: ${currentPlayer}`;
}

function handleClick(r, c, cell) {
    if (gameOver || board[r][c] !== "") return;

    if (gameMode === "online") {
        if (!myRole || (myRole !== "X" && myRole !== "O")) {
            alert("אתה מחובר כצופה ולכן לא יכול לשחק");
            return;
        }
        if (myRole === "X" && !onlineGameStarted) {
            alert("...עדיין ממתין לשחקן היריב שיתחבר");
            return;
        }
        if (currentPlayer !== myRole) {
            alert("זה לא התור שלך! חכה בסבלנות.");
            return;
        }

        ws.send(JSON.stringify({
            action: "move",
            r: r,
            c: c,
            player: currentPlayer,
            username: currentUser
        }));
    }

    makeMove(r, c, currentPlayer, cell);
    if (gameOver) return;
    switchPlayer();

    if (gameMode === "ai" && currentPlayer === "O") {
        if (rows === 3 && cols === 3 && winLength === 3) {
            setTimeout(() => aiMoveMinimax(), 120);
        } else {
            setTimeout(() => aiMove(), 120);
        }
    }
}

function makeMove(r, c, player, cell = null) {
    board[r][c] = player;
    numBoard[r][c] = mapPieceToNum(player);
    if (!cell) cell = document.getElementById(`${r}-${c}`);
    if (cell) {
        cell.textContent = player;
        cell.classList.add(player);
    }

    updateWindowsOnPlace(r, c, numBoard[r][c]);

    const idx = r * cols + c;
    for (const wi of cellToWindows[idx]) {
        const w = windows[wi];
        if (numBoard[r][c] === 1 && w.countAI >= winLength) {
            gameOver = true;
            updateStatus("O ניצח!");
            highlightWinFromWindow(w);
            showGameResult("win", "O");
            checkAndSaveGame("O");
            return;
        }
        if (numBoard[r][c] === -1 && w.countHuman >= winLength) {
            gameOver = true;
            updateStatus("X ניצח!");
            highlightWinFromWindow(w);
            showGameResult("win", "X");
            checkAndSaveGame("X");
            return;
        }
    }

    if (isDraw()) {
        gameOver = true;
        updateStatus("תיקו!");
        showGameResult("draw");
        checkAndSaveGame("תיקו");
    }
    else updateStatus();
}

function showGameResult(result, winner = null) {
    if (!resultModal || !resultCard) return;

    resultCard.classList.remove("win-x", "win-o", "draw");

    if (result === "draw") {
        resultCard.classList.add("draw");
        resultIcon.textContent = "🤝";
        resultTitle.textContent = "תיקו!";
        resultText.textContent = "המשחק הסתיים ללא מנצח";
    } else {
        resultCard.classList.add(winner === "X" ? "win-x" : "win-o");
        resultIcon.textContent = winner;
        resultTitle.textContent = `${winner} ניצח!`;
        resultText.textContent = "כל הכבוד! נוצר רצף מנצח";
    }

    resultModal.classList.add("show");
}

function hideGameResult() {
    if (resultModal) resultModal.classList.remove("show");
}

function checkAndSaveGame(winnerPiece) {
    if (gameMode !== "online" || !currentUser) return;

    let p1 = playerXUser || "Unknown";
    let p2 = playerOUser || "Unknown";

    // טיפול במצב של תיקו
    if (winnerPiece === "תיקו") {
        if (myRole === "X") {
            ws.send(JSON.stringify({
                action: "save_game",
                user1: p1,
                user2: p2,
                winner: "תיקו"
            }));
        }
        return;
    }

    // ניצחון של אחד השחקנים
    let winnerName = (winnerPiece === "X") ? p1 : p2;

    if (currentUser === winnerName) {
        ws.send(JSON.stringify({
            action: "save_game",
            user1: p1,
            user2: p2,
            winner: winnerName
        }));
    }
}

function switchPlayer() { currentPlayer = currentPlayer === "X" ? "O" : "X"; updateStatus(); }
function isDraw() { return board.flat().every(c => c !== ""); }
function inBounds(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols; }
function mapPieceToNum(p) { if (p === 'O') return 1; if (p === 'X') return -1; return 0; }

function highlightWinFromWindow(win) {
    win.cells.forEach(idx => {
        const r = Math.floor(idx / cols), c = idx % cols;
        const el = document.getElementById(`${r}-${c}`);
        if (el) {
            const player = numBoard[r][c] === 1 ? 'O' : 'X';
            el.style.backgroundColor = player === 'X' ? '#3b82f6' : '#ef4444';
            el.style.color = '#fff';
            el.classList.add("winning-cell");
        }
    });
}

function buildWindows() {
    windows = [];
    cellToWindows = Array(rows * cols).fill(null).map(() => []);

    for (const [dr, dc] of DIRS) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cells = [];
                let ok = true;
                for (let k = 0; k < winLength; k++) {
                    const rr = r + dr * k, cc = c + dc * k;
                    if (!inBounds(rr, cc)) { ok = false; break; }
                    cells.push(rr * cols + cc);
                }
                if (!ok) continue;
                const w = { cells, countAI: 0, countHuman: 0, empties: 0 };
                for (const idx of cells) {
                    const rr = Math.floor(idx / cols), cc = idx % cols;
                    const v = numBoard[rr][cc];
                    if (v === 1) w.countAI++; else if (v === -1) w.countHuman++; else w.empties++;
                }
                const winIdx = windows.length;
                windows.push(w);
                for (const idx of cells) cellToWindows[idx].push(winIdx);
            }
        }
    }
}

function updateWindowsOnPlace(r, c, val) {
    const idx = r * cols + c;
    for (const wi of cellToWindows[idx]) {
        const w = windows[wi];
        w.empties = Math.max(0, w.empties - 1);
        if (val === 1) w.countAI++; else if (val === -1) w.countHuman++;
    }
}

function updateWindowsOnRemove(r, c, val) {
    const idx = r * cols + c;
    for (const wi of cellToWindows[idx]) {
        const w = windows[wi];
        w.empties = w.empties + 1;
        if (val === 1) w.countAI = Math.max(0, w.countAI - 1); else if (val === -1) w.countHuman = Math.max(0, w.countHuman - 1);
    }
}

function simulatePlacementMetrics(r, c, playerNumeric) {
    const idx = r * cols + c;
    let immediateWin = false;
    let near = 0;
    let open3 = 0;
    let neighbours = 0;

    for (const wi of cellToWindows[idx]) {
        const w = windows[wi];
        const newAI = w.countAI + (playerNumeric === 1 ? 1 : 0);
        const newHuman = w.countHuman + (playerNumeric === -1 ? 1 : 0);
        const newEmpties = w.empties - 1;
        if (playerNumeric === 1) {
            if (newAI >= winLength && newHuman === 0) immediateWin = true;
            if (newAI === winLength - 1 && newHuman === 0 && newEmpties >= 1) near++;
            if (newAI === winLength - 2 && newHuman === 0 && newEmpties >= 2) open3++;
        } else {
            if (newHuman >= winLength && newAI === 0) immediateWin = true;
            if (newHuman === winLength - 1 && newAI === 0 && newEmpties >= 1) near++;
            if (newHuman === winLength - 2 && newAI === 0 && newEmpties >= 2) open3++;
        }
    }

    for (const [dr, dc] of DIRS) {
        let cnt = 0;
        for (let k = 1; k <= winLength - 1; k++) {
            const rr = r + dr * k, cc = c + dc * k; if (!inBounds(rr, cc)) break;
            if (numBoard[rr][cc] === playerNumeric) cnt++; else break;
        }
        for (let k = 1; k <= winLength - 1; k++) {
            const rr = r - dr * k, cc = c - dc * k; if (!inBounds(rr, cc)) break;
            if (numBoard[rr][cc] === playerNumeric) cnt++; else break;
        }
        neighbours += cnt;
    }

    return { immediateWin, near, open3, neighbours };
}

function aiMove() {
    if (gameOver) return;
    const move = blackAlgorithm();
    if (!move) return;
    const { r, c } = move;
    const cell = document.getElementById(`${r}-${c}`);
    makeMove(r, c, 'O', cell);
    if (!gameOver) switchPlayer();
}

function getCandidateMoves(radius = 2) {
    const candidates = new Set();
    let anyStone = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (numBoard[r][c] !== 0) anyStone = true;
    if (!anyStone) {
        const cr = Math.floor((rows - 1) / 2), cc = Math.floor((cols - 1) / 2);
        return [{ r: cr, c: cc }];
    }
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (numBoard[r][c] !== 0) {
                for (let dr = -radius; dr <= radius; dr++) {
                    for (let dc = -radius; dc <= radius; dc++) {
                        const rr = r + dr, cc = c + dc;
                        if (!inBounds(rr, cc)) continue;
                        if (numBoard[rr][cc] === 0) candidates.add(rr * cols + cc);
                    }
                }
            }
        }
    }
    return Array.from(candidates).map(idx => ({ r: Math.floor(idx / cols), c: idx % cols }));
}

function blackAlgorithm() {
    const candidates = getCandidateMoves();
    if (!candidates || candidates.length === 0) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (numBoard[r][c] === 0) return { r, c, reason: 'fallback-empty' };
        return null;
    }

    for (const m of candidates) {
        const sim = simulatePlacementMetrics(m.r, m.c, 1);
        if (sim.immediateWin) return { r: m.r, c: m.c, reason: 'win-immediate' };
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (numBoard[r][c] !== 0) continue;
            const simOpp = simulatePlacementMetrics(r, c, -1);
            if (simOpp.immediateWin) {
                for (const m of candidates) { if (simulatePlacementMetrics(m.r, m.c, 1).immediateWin) return { r: m.r, c: m.c, reason: 'win-immediate' } }
                return { r, c, reason: 'block-opponent-win' };
            }
        }
    }

    for (const m of candidates) {
        const sim = simulatePlacementMetrics(m.r, m.c, 1);
        if (sim.near >= 2) return { r: m.r, c: m.c, reason: 'double-four-ai' };
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (numBoard[r][c] !== 0) continue;
            const simOpp = simulatePlacementMetrics(r, c, -1);
            if (simOpp.near >= 2) return { r, c, reason: 'block-double-four-opponent' };
        }
    }

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const m of candidates) {
        const simAI = simulatePlacementMetrics(m.r, m.c, 1);
        const simOppIfAI = simulatePlacementMetrics(m.r, m.c, -1);
        const scoreAttack = simAI.near * 100 + simAI.open3 * 30 + simAI.neighbours * 5;
        const scoreDefend = simOppIfAI.near * 100 + simOppIfAI.open3 * 30 + simOppIfAI.neighbours * 5;
        let score = scoreAttack + scoreDefend * 0.9;

        const centerR = (rows - 1) / 2, centerC = (cols - 1) / 2;
        const maxDist = centerR + centerC;
        const dist = Math.abs(m.r - centerR) + Math.abs(m.c - centerC);
        score += ((maxDist - dist) / Math.max(1, maxDist)) * 5;

        score += Math.random() * 0.0001;

        if (score > bestScore + 1e-9) { bestScore = score; bestMoves = [{ r: m.r, c: m.c }]; }
        else if (Math.abs(score - bestScore) < 1e-9) bestMoves.push({ r: m.r, c: m.c });
    }

    if (bestMoves.length > 0) return bestMoves[Math.floor(Math.random() * bestMoves.length)];

    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (numBoard[r][c] === 0) return { r, c, reason: 'fallback' };
    return null;
}

function aiMoveMinimax() {
    if (gameOver) return;
    const best = minimaxRoot();
    if (!best) return;
    makeMove(best.r, best.c, 'O', document.getElementById(`${best.r}-${best.c}`));
    if (!gameOver) switchPlayer();
}

function minimaxRoot() {
    let bestVal = -Infinity;
    let bestMove = null;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (numBoard[r][c] !== 0) continue;
            board[r][c] = 'O'; numBoard[r][c] = 1; updateWindowsOnPlace(r, c, 1);
            const val = minimax(0, false);
            updateWindowsOnRemove(r, c, 1); board[r][c] = ''; numBoard[r][c] = 0;
            if (val > bestVal + 1e-9) { bestVal = val; bestMove = { r, c }; }
        }
    }
    return bestMove;
}

function minimax(depth, isMaximizing) {
    const term = checkTerminalFast();
    if (term !== null) {
        if (term > 0) return term - depth;
        if (term < 0) return term + depth;
        return 0;
    }

    if (isMaximizing) {
        let best = -Infinity;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (numBoard[r][c] !== 0) continue;
                board[r][c] = 'O'; numBoard[r][c] = 1; updateWindowsOnPlace(r, c, 1);
                const val = minimax(depth + 1, false);
                updateWindowsOnRemove(r, c, 1); board[r][c] = ''; numBoard[r][c] = 0;
                if (val > best) best = val;
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (numBoard[r][c] !== 0) continue;
                board[r][c] = 'X'; numBoard[r][c] = -1; updateWindowsOnPlace(r, c, -1);
                const val = minimax(depth + 1, true);
                updateWindowsOnRemove(r, c, -1); board[r][c] = ''; numBoard[r][c] = 0;
                if (val < best) best = val;
            }
        }
        return best;
    }
}

function checkTerminalFast() {
    for (const w of windows) { if (w.countAI >= winLength) return 100; if (w.countHuman >= winLength) return -100; }
    let anyEmpty = false; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (numBoard[r][c] === 0) anyEmpty = true;
    if (!anyEmpty) return 0;
    return null;
}

// שליחת בקשה לשרת
function requestAdminData(actionType) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: actionType }));
    }
}

// סגירת החלון
function closeAdminModal() {
    document.getElementById("adminModal").classList.add("is-hidden");
}

// פונקציית עזר לציור הטבלה
function renderAdminTable(title, headers, rows) {
    document.getElementById("adminModalTitle").innerText = title;
    const table = document.getElementById("adminTable");

    let html = "<thead><tr>";
    headers.forEach(h => {
        html += `<th>${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    rows.forEach(row => {
        html += "<tr>";
        row.forEach(cell => {
            html += `<td>${cell || '-'}</td>`;
        });
        html += "</tr>";
    });

    if (rows.length === 0) {
        html += `<tr><td colspan="${headers.length}" class="empty-table">אין נתונים להצגה</td></tr>`;
    }

    html += "</tbody>";
    table.innerHTML = html;

    // מציג את החלון
    document.getElementById("adminModal").classList.remove("is-hidden");
}
