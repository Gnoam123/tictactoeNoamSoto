// script.js

let gameMode = "local"; // שומר את מצב המשחק הפעיל: מקומי, מחשב או אונליין
let board = []; // יוצר מערך שייצג את סימני המשחק על הלוח
let numBoard = []; // יוצר ייצוג מספרי מקביל של הלוח עבור אלגוריתם ה-AI
let currentPlayer = "X"; // שומר מי השחקן שתורו כעת
let gameOver = false; // שומר האם המשחק כבר הסתיים
let rows = 3, cols = 3, winLength = 3; // שומר את מספר השורות בלוח

// --- משתני שרת והתחברות ---
let ws = new WebSocket("ws://192.168.150.151:8765"); // פותח חיבור WebSocket לשרת המשחק
let currentUser = null; // שומר את שם המשתמש שהתחבר
let playerXUser = null; // שומר את שם המשתמש שמשחק בתפקיד X באונליין
let playerOUser = null; // שומר את שם המשתמש שמשחק בתפקיד O באונליין

// --- משתני ניהול תורים אונליין ---
let myRole = null; // שומר את התפקיד שקיבל המשתמש בחדר האונליין
let onlineGameStarted = false; // שומר האם שני שחקני האונליין כבר מחוברים

let windows = []; // יוצר מערך שיכיל את כל רצפי הניצחון האפשריים
let cellToWindows = []; // יוצר מיפוי מכל משבצת לרצפים שעוברים דרכה

let boardDiv, boardWrap, statusDiv, resetBtn, colsInput, rowsInput, winInput; // מכריז על משתנים שישמרו הפניות לרכיבי הממשק
let resultModal, resultCard, resultIcon, resultTitle, resultText; // מכריז על משתנים לרכיבי הודעת תוצאת המשחק
let resizeRaf = null; // שומר מזהה של בקשת שינוי הגודל המתוזמנת

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]; // מגדיר את ארבעת כיווני הבדיקה: אנכי, אופקי ושני אלכסונים

function syncSettingsToServer() { // מגדיר פונקציה ששולחת לשרת את הגדרות הלוח של שחקן X
    if (ws.readyState === WebSocket.OPEN && myRole === "X" && gameMode === "online") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        ws.send(JSON.stringify({ // ממיר נתונים ל-JSON ושולח אותם לשרת
            action: "update_settings", // מגדיר שדה וערך בתוך אובייקט JavaScript
            rows: Number(rowsInput.value), // מגדיר שדה וערך בתוך אובייקט JavaScript
            cols: Number(colsInput.value), // מגדיר שדה וערך בתוך אובייקט JavaScript
            winLength: Number(winInput.value) // מגדיר שדה וערך בתוך אובייקט JavaScript
        })); // סוגר את פונקציית החזרה ואת הקריאה שפתחה אותה
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function handleSettingsChange() { // מגדיר פונקציה שמטפלת בשינוי מידות הלוח ורצף הניצחון
    if (gameMode === "online") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        if (myRole === "X") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            syncSettingsToServer(); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
            startGame(); // חשוב לבנות מחדש את הלוח גם אצל X
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
        startGame(); // מאתחל את המשחק ובונה מחדש את הלוח
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

document.addEventListener("DOMContentLoaded", () => { // ממתין לסיום טעינת ה-HTML לפני חיבור הקוד לממשק
    boardDiv = document.getElementById("board"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    boardWrap = document.querySelector(".board-wrap"); // מאתר את רכיב ה-HTML הראשון שמתאים לבורר
    statusDiv = document.getElementById("status"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    resetBtn = document.getElementById("resetBtn"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    rowsInput = document.getElementById("rows"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    colsInput = document.getElementById("cols"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    winInput = document.getElementById("winLength"); // שומר הפניה לרכיב HTML לפי המזהה שלו

    resultModal = document.getElementById("resultModal"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    resultCard = document.getElementById("resultCard"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    resultIcon = document.getElementById("resultIcon"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    resultTitle = document.getElementById("resultTitle"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    resultText = document.getElementById("resultText"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    rowsInput.addEventListener("change", handleSettingsChange); // מחבר פעולה שתופעל כאשר ערך השדה ישתנה
    colsInput.addEventListener("change", handleSettingsChange); // מחבר פעולה שתופעל כאשר ערך השדה ישתנה
    winInput.addEventListener("change", handleSettingsChange); // מחבר פעולה שתופעל כאשר ערך השדה ישתנה

    // שינוי ל-loginForm והאזנה ל-submit
    document.getElementById("loginForm").addEventListener("submit", (e) => { // מחבר פעולה שתופעל בעת שליחת טופס ההתחברות
        e.preventDefault(); // עצור! מונע מהדף להתרענן ולנתק את ה-WebSocket

        const user = document.getElementById("loginUser").value.trim(); // שומר הפניה לרכיב HTML לפי המזהה שלו
        const pass = document.getElementById("loginPass").value; // שומר הפניה לרכיב HTML לפי המזהה שלו
        document.getElementById("loginError").classList.add("is-hidden"); // שומר הפניה לרכיב HTML לפי המזהה שלו

        if (ws.readyState === WebSocket.OPEN) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            ws.send(JSON.stringify({ action: "login", username: user, password: pass })); // ממיר נתונים ל-JSON ושולח אותם לשרת
        } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
            alert("השרת לא מחובר!"); // מציג למשתמש הודעה קופצת
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    // === חיבור אירועים לכפתורי פאנל הניהול והמודאל ===
    // ודא שה-ID האלו תואמים למה שרשמת ב-HTML שלך בכפתורים ובחלון הקופץ
    const adminUsersBtn = document.getElementById("adminUsersBtn"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    if (adminUsersBtn) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        adminUsersBtn.addEventListener("click", () => requestAdminData("get_users")); // מחבר פעולה שתופעל כאשר המשתמש ילחץ על הרכיב
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    const adminGamesBtn = document.getElementById("adminGamesBtn"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    if (adminGamesBtn) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        adminGamesBtn.addEventListener("click", () => requestAdminData("get_games")); // מחבר פעולה שתופעל כאשר המשתמש ילחץ על הרכיב
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    const closeAdminBtn = document.getElementById("closeAdminBtn"); // שומר הפניה לרכיב HTML לפי המזהה שלו
    if (closeAdminBtn) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        closeAdminBtn.addEventListener("click", closeAdminModal); // מחבר פעולה שתופעל כאשר המשתמש ילחץ על הרכיב
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    ws.onmessage = async function (event) { // מגדיר את הפעולה שתטפל בכל הודעה שמתקבלת מהשרת
        try { // מתחיל ניסיון להריץ קוד שעלול להחזיר שגיאה
            const data = JSON.parse(event.data); // ממיר את הודעת ה-JSON מהשרת לאובייקט JavaScript

            if (data.action === "login_response") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                if (data.success) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                    currentUser = data.username; // מעדכן את הערך של currentUser
                    document.getElementById("loginModal").classList.add("is-hidden"); // שומר הפניה לרכיב HTML לפי המזהה שלו

                    // === תוספת עבור פאנל הניהול ===
                    if (data.is_admin) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                        document.getElementById("adminPanel").classList.remove("is-hidden"); // שומר הפניה לרכיב HTML לפי המזהה שלו
                        // הופעת פאנל המנהל משנה מעט את רוחב אזור הלוח.
                        requestAnimationFrame(scheduleBoardResize); // מתזמן את הפעולה לפריים הציור הבא של הדפדפן
                    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                    // ==================================
                } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
                    document.getElementById("loginError").classList.remove("is-hidden"); // שומר הפניה לרכיב HTML לפי המזהה שלו
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            // === טיפול בקבלת הנתונים מהשרת לפאנל הניהול ===
            if (data.action === "admin_users_data") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                renderAdminTable("👥 רשימת משתמשים", ["שם משתמש"], data.data.map(u => [u])); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
            if (data.action === "admin_games_data") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                renderAdminTable("🎮 היסטוריית משחקים", ["שחקן X", "שחקן O", "מנצח"], data.data.map(g => [g.user1, g.user2, g.winner])); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
            // =========================================================================

            // חסימה: מכאן והלאה, נתעלם מהודעות אם אנחנו לא במצב אונליין
            if (gameMode !== "online") return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

            // שחקן נכנס בהצלחה למצב אונליין וקיבל תפקיד
            if (data.action === "role_assigned") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                myRole = data.role; // מעדכן את הערך של myRole
                if (myRole === "X") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                    syncSettingsToServer(); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
                    updateStatus("מחובר כ-X. ממתין לשחקן היריב (O)..."); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
                } else if (myRole === "O") { // בודק תנאי חלופי כאשר התנאי הקודם לא התקיים
                    if (data.settings) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                        rowsInput.value = data.settings.rows; // מעדכן את הערך של rowsInput.value
                        colsInput.value = data.settings.cols; // מעדכן את הערך של colsInput.value
                        winInput.value = data.settings.winLength; // מעדכן את הערך של winInput.value
                    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                    updateStatus("מחובר כ-O. הלוח סונכרן לפי שחקן X. ממתין לתחילת המשחק..."); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
                    startGame(); // מאתחל את המשחק ובונה מחדש את הלוח
                } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
                    updateStatus("החדר מלא, אתה צופה."); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            // עדכון הגדרות אם שחקן X משנה אותן בזמן אמת
            if (data.action === "update_settings") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                if (myRole === "O") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                    rowsInput.value = data.settings.rows; // מעדכן את הערך של rowsInput.value
                    colsInput.value = data.settings.cols; // מעדכן את הערך של colsInput.value
                    winInput.value = data.settings.winLength; // מעדכן את הערך של winInput.value
                    startGame(); // מאתחל את המשחק ובונה מחדש את הלוח
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            if (data.action === "start_game") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                onlineGameStarted = true; // מעדכן את הערך של onlineGameStarted
                playerXUser = data.playerX; // מעדכן את הערך של playerXUser
                playerOUser = data.playerO; // מעדכן את הערך של playerOUser

                if (data.settings) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                    rowsInput.value = data.settings.rows; // מעדכן את הערך של rowsInput.value
                    colsInput.value = data.settings.cols; // מעדכן את הערך של colsInput.value
                    winInput.value = data.settings.winLength; // מעדכן את הערך של winInput.value
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

                startGame(); // מאתחל את המשחק ובונה מחדש את הלוח
                updateStatus(`המשחק התחיל! תור השחקן: X`); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            // השחקן השני התנתק או יצא ממצב אונליין
            if (data.action === "player_disconnected") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                onlineGameStarted = false; // מעדכן את הערך של onlineGameStarted
                if (myRole === "X") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                    updateStatus("שחקן O התנתק או עזב את מצב אונליין. ממתין לשחקן חדש..."); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
                } else if (myRole === "O") { // בודק תנאי חלופי כאשר התנאי הקודם לא התקיים
                    updateStatus("שחקן X התנתק! המשחק הופסק."); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            if (data.action === "error") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                alert(data.message); // מציג למשתמש הודעה קופצת
                return; // מסיים מיד את הפונקציה הנוכחית
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            if (data.action === "move") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                makeMove(data.r, data.c, data.player); // מבצע את המהלך על הלוח ומפעיל בדיקות סיום
                if (!gameOver) switchPlayer(); // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        } catch (e) { // מטפל בשגיאה כדי שהקוד ימשיך לפעול
            // התעלמות
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    }; // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    document.querySelectorAll(".mode").forEach(btn => { // מאתר את כל רכיבי ה-HTML שמתאימים לבורר
        btn.addEventListener("click", () => { // מחבר פעולה שתופעל כאשר המשתמש ילחץ על הרכיב
            const oldMode = gameMode; // מחשב ושומר ערך במשתנה oldMode

            document.querySelectorAll(".mode").forEach(b => { // מאתר את כל רכיבי ה-HTML שמתאימים לבורר
                const isActive = b === btn; // מחשב ושומר ערך במשתנה isActive
                b.classList.toggle("active", isActive); // מוסיף או מסיר מחלקת CSS לפי התנאי שנמסר
                b.setAttribute("aria-selected", String(isActive)); // מעדכן מאפיין HTML של הרכיב
            }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            gameMode = btn.dataset.mode; // מעדכן את הערך של gameMode

            // שליחת בקשות לשרת בעת שינוי מצב משחק
            if (ws.readyState === WebSocket.OPEN) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                if (gameMode === "online" && oldMode !== "online") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                    ws.send(JSON.stringify({ action: "join_online" })); // ממיר נתונים ל-JSON ושולח אותם לשרת
                } else if (gameMode !== "online" && oldMode === "online") { // בודק תנאי חלופי כאשר התנאי הקודם לא התקיים
                    ws.send(JSON.stringify({ action: "leave_online" })); // ממיר נתונים ל-JSON ושולח אותם לשרת
                    myRole = null; // מעדכן את הערך של myRole
                    onlineGameStarted = false; // מעדכן את הערך של onlineGameStarted
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
            } else if (gameMode === "online") { // בודק תנאי חלופי כאשר התנאי הקודם לא התקיים
                alert("השרת לא מחובר, ולכן כרגע אי אפשר לעבור למצב אונליין."); // מציג למשתמש הודעה קופצת
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

            startGame(); // מאתחל את המשחק ובונה מחדש את הלוח
        }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    if (resetBtn) resetBtn.addEventListener("click", () => { // מחבר פעולה שתופעל כאשר המשתמש ילחץ על הרכיב
        if (gameMode === "online" && myRole === "O") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            alert("רק שחקן X יכול לאתחל משחק במצב אונליין."); // מציג למשתמש הודעה קופצת
            return; // מסיים מיד את הפונקציה הנוכחית
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        startGame(); // מאתחל את המשחק ובונה מחדש את הלוח
        if (gameMode === "online" && myRole === "X") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            syncSettingsToServer(); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    window.addEventListener("resize", scheduleBoardResize); // מחבר מאזין לאירוע של הדפדפן או של רכיב בממשק
    window.addEventListener("orientationchange", scheduleBoardResize); // מחבר מאזין לאירוע של הדפדפן או של רכיב בממשק

    startGame(); // מאתחל את המשחק ובונה מחדש את הלוח
}); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function startGame() { // מגדיר פונקציה שמאתחלת משחק חדש ובונה מחדש את הלוח
    hideGameResult(); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק

    document.querySelectorAll(".winning-cell").forEach(cell => { // מאתר את כל רכיבי ה-HTML שמתאימים לבורר
        cell.classList.remove("winning-cell"); // מסיר מחלקת CSS מהרכיב
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    if (gameMode === "online" && myRole === "O") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        rowsInput.disabled = true; // מעדכן את הערך של rowsInput.disabled
        colsInput.disabled = true; // מעדכן את הערך של colsInput.disabled
        winInput.disabled = true; // מעדכן את הערך של winInput.disabled
    } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
        rowsInput.disabled = false; // מעדכן את הערך של rowsInput.disabled
        colsInput.disabled = false; // מעדכן את הערך של colsInput.disabled
        winInput.disabled = false; // מעדכן את הערך של winInput.disabled
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    const rVal = Number(rowsInput?.value); // מחשב ושומר ערך במשתנה rVal
    const cVal = Number(colsInput?.value); // מחשב ושומר ערך במשתנה cVal
    const wVal = Number(winInput?.value); // מחשב ושומר ערך במשתנה wVal
    if (!isNaN(rVal) && rVal >= 3) rows = rVal; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    if (!isNaN(cVal) && cVal >= 3) cols = cVal; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    if (!isNaN(wVal) && wVal >= 3) winLength = wVal; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    if (winLength > rows && winLength > cols) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        alert("רצף הניצחון לא יכול להיות גדול גם מהרוחב וגם מהאורך"); // מציג למשתמש הודעה קופצת
        return; // מסיים מיד את הפונקציה הנוכחית
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    board = Array.from({ length: rows }, () => Array(cols).fill("")); // מעדכן את הערך של board
    numBoard = Array.from({ length: rows }, () => Array(cols).fill(0)); // מעדכן את הערך של numBoard
    currentPlayer = "X"; // מעדכן את הערך של currentPlayer
    gameOver = false; // מעדכן את הערך של gameOver

    if (gameMode !== "online") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        playerXUser = null; // מעדכן את הערך של playerXUser
        playerOUser = null; // מעדכן את הערך של playerOUser
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    boardDiv.innerHTML = ""; // מחליף את תוכן ה-HTML שבתוך הרכיב
    boardDiv.style.setProperty("--cols", String(cols)); // מעדכן משתנה CSS שמשפיע על מבנה הלוח

    for (let r = 0; r < rows; r++) { // עובר בלולאה על טווח או אוסף של ערכים
        for (let c = 0; c < cols; c++) { // עובר בלולאה על טווח או אוסף של ערכים
            const cell = document.createElement("div"); // יוצר רכיב HTML חדש בזיכרון
            cell.className = "cell"; // מעדכן את הערך של cell.className
            cell.id = `${r}-${c}`; // מעדכן את הערך של cell.id
            cell.addEventListener("click", () => handleClick(r, c, cell)); // מחבר פעולה שתופעל כאשר המשתמש ילחץ על הרכיב
            boardDiv.appendChild(cell); // מוסיף את הרכיב החדש לתוך העמוד
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    scheduleBoardResize(); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק

    buildWindows(); // בונה מחדש את רשימת כל רצפי הניצחון האפשריים

    if (gameMode === "online" && currentUser) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        if (!onlineGameStarted && myRole === "X") updateStatus("ממתין לשחקן נוסף (O)..."); // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        else if (onlineGameStarted) updateStatus(`${currentPlayer}:תור השחקן `); // בודק תנאי חלופי כאשר התנאי הקודם לא התקיים
    } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
        updateStatus(); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function scheduleBoardResize() { // מגדיר פונקציה שמתזמנת התאמת גודל של הלוח למסך
    if (resizeRaf !== null) cancelAnimationFrame(resizeRaf); // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    resizeRaf = requestAnimationFrame(() => { // מתזמן את הפעולה לפריים הציור הבא של הדפדפן
        resizeRaf = null; // מעדכן את הערך של resizeRaf
        resizeBoard(); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function resizeBoard() { // מגדיר פונקציה שמחשבת ומעדכנת את גודל המשבצות
    if (!boardDiv || !boardWrap || rows < 1 || cols < 1) return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    const wrapStyle = getComputedStyle(boardWrap); // מחשב ושומר ערך במשתנה wrapStyle
    const wrapPaddingH = // מחשב ושומר ערך במשתנה wrapPaddingH
        (parseFloat(wrapStyle.paddingLeft) || 0) + // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        (parseFloat(wrapStyle.paddingRight) || 0); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    const wrapPaddingV = // מחשב ושומר ערך במשתנה wrapPaddingV
        (parseFloat(wrapStyle.paddingTop) || 0) + // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        (parseFloat(wrapStyle.paddingBottom) || 0); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק

    const availableWidth = Math.max(120, boardWrap.clientWidth - wrapPaddingH - 2); // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח
    const isMobile = window.matchMedia("(max-width: 900px)").matches; // מחשב ושומר ערך במשתנה isMobile
    const isSmallPhone = window.matchMedia("(max-width: 560px)").matches; // מחשב ושומר ערך במשתנה isSmallPhone

    // בלוחות גדולים מצמצמים כמעט לגמרי את הרווחים והמסגרת,
    // כדי שכל פיקסל פנוי יעבור לגודל המשבצות.
    let gap = 3; // מחשב ושומר ערך במשתנה gap
    if (cols >= 24 || rows >= 24) gap = 1; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    else if (cols >= 10 || rows >= 10) gap = 2; // בודק תנאי חלופי כאשר התנאי הקודם לא התקיים

    let boardPadding = isSmallPhone ? 2 : (isMobile ? 3 : 5); // מחשב ושומר ערך במשתנה boardPadding
    if (cols >= 20 || rows >= 20) boardPadding = 1; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    const widthForCells = availableWidth - (2 * boardPadding) - ((cols - 1) * gap); // מחשב ושומר ערך במשתנה widthForCells
    const cellSizeByWidth = Math.floor(widthForCells / cols); // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח

    let cellSizeByHeight = Infinity; // מחשב ושומר ערך במשתנה cellSizeByHeight
    if (!isMobile) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        // במחשב אזור הלוח מקבל את כל גובה המסך שנותר. השימוש בגובה
        // האמיתי שלו מאפשר למשבצות לגדול בלי להיחתך.
        const availableHeight = Math.max(120, boardWrap.clientHeight - wrapPaddingV - 2); // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח
        const heightForCells = availableHeight - (2 * boardPadding) - ((rows - 1) * gap); // מחשב ושומר ערך במשתנה heightForCells
        cellSizeByHeight = Math.floor(heightForCells / rows); // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    const minCell = isSmallPhone ? 7 : 9; // מחשב ושומר ערך במשתנה minCell
    const maxCell = isMobile ? 140 : 210; // מחשב ושומר ערך במשתנה maxCell

    let cellSize = Math.min(cellSizeByWidth, cellSizeByHeight, maxCell); // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח
    if (!Number.isFinite(cellSize)) cellSize = Math.min(cellSizeByWidth, maxCell); // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    cellSize = Math.max(minCell, Math.floor(cellSize)); // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח

    boardDiv.style.setProperty("--cols", String(cols)); // מעדכן משתנה CSS שמשפיע על מבנה הלוח
    boardDiv.style.setProperty("--cell-size", `${cellSize}px`); // מעדכן משתנה CSS שמשפיע על מבנה הלוח
    boardDiv.style.setProperty("--board-gap", `${gap}px`); // מעדכן משתנה CSS שמשפיע על מבנה הלוח
    boardDiv.style.setProperty("--board-padding", `${boardPadding}px`); // מעדכן משתנה CSS שמשפיע על מבנה הלוח
    boardDiv.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`; // מעדכן ישירות מאפיין עיצוב של רכיב בלוח
    boardDiv.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`; // מעדכן ישירות מאפיין עיצוב של רכיב בלוח
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function updateStatus(text) { // מגדיר פונקציה שמעדכנת את הודעת המצב שמתחת ללוח
    if (text) statusDiv.textContent = text; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    else statusDiv.textContent = gameOver ? "המשחק נגמר" : `תור השחקן: ${currentPlayer}`; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function handleClick(r, c, cell) { // מגדיר פונקציה שמטפלת בלחיצה של המשתמש על משבצת
    if (gameOver || board[r][c] !== "") return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    if (gameMode === "online") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        if (!myRole || (myRole !== "X" && myRole !== "O")) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            alert("אתה מחובר כצופה ולכן לא יכול לשחק"); // מציג למשתמש הודעה קופצת
            return; // מסיים מיד את הפונקציה הנוכחית
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        if (myRole === "X" && !onlineGameStarted) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            alert("...עדיין ממתין לשחקן היריב שיתחבר"); // מציג למשתמש הודעה קופצת
            return; // מסיים מיד את הפונקציה הנוכחית
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        if (currentPlayer !== myRole) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            alert("זה לא התור שלך! חכה בסבלנות."); // מציג למשתמש הודעה קופצת
            return; // מסיים מיד את הפונקציה הנוכחית
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

        ws.send(JSON.stringify({ // ממיר נתונים ל-JSON ושולח אותם לשרת
            action: "move", // מגדיר שדה וערך בתוך אובייקט JavaScript
            r: r, // מגדיר שדה וערך בתוך אובייקט JavaScript
            c: c, // מגדיר שדה וערך בתוך אובייקט JavaScript
            player: currentPlayer, // מגדיר שדה וערך בתוך אובייקט JavaScript
            username: currentUser // מגדיר שדה וערך בתוך אובייקט JavaScript
        })); // סוגר את פונקציית החזרה ואת הקריאה שפתחה אותה
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    makeMove(r, c, currentPlayer, cell); // מבצע את המהלך על הלוח ומפעיל בדיקות סיום
    if (gameOver) return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    switchPlayer(); // מעביר את התור לשחקן השני ומעדכן את ההודעה

    if (gameMode === "ai" && currentPlayer === "O") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        aiMove() // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function makeMove(r, c, player, cell = null) { // מגדיר פונקציה שמבצעת מהלך, בודקת ניצחון ומעדכנת את המסך
    board[r][c] = player; // מעדכן את הערך של board[r][c]
    numBoard[r][c] = mapPieceToNum(player); // מעדכן את הערך של numBoard[r][c]
    if (!cell) cell = document.getElementById(`${r}-${c}`); // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    if (cell) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        cell.textContent = player; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
        cell.classList.add(player); // מוסיף מחלקת CSS לרכיב כדי לשנות את מצבו או עיצובו
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    updateWindowsOnPlace(r, c, numBoard[r][c]); // מעדכן את נתוני רצפי הניצחון לאחר הנחת הסימן

    const idx = r * cols + c; // מחשב ושומר ערך במשתנה idx
    for (const wi of cellToWindows[idx]) { // עובר בלולאה על טווח או אוסף של ערכים
        const w = windows[wi]; // מחשב ושומר ערך במשתנה w
        if (numBoard[r][c] === 1 && w.countAI >= winLength) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            gameOver = true; // מעדכן את הערך של gameOver
            updateStatus("O ניצח!"); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
            highlightWinFromWindow(w); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
            showGameResult("win", "O"); // מציג במרכז הלוח את תוצאת המשחק
            checkAndSaveGame("O"); // בודק האם יש לשמור את תוצאת משחק האונליין
            return; // מסיים מיד את הפונקציה הנוכחית
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        if (numBoard[r][c] === -1 && w.countHuman >= winLength) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            gameOver = true; // מעדכן את הערך של gameOver
            updateStatus("X ניצח!"); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
            highlightWinFromWindow(w); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
            showGameResult("win", "X"); // מציג במרכז הלוח את תוצאת המשחק
            checkAndSaveGame("X"); // בודק האם יש לשמור את תוצאת משחק האונליין
            return; // מסיים מיד את הפונקציה הנוכחית
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    if (isDraw()) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        gameOver = true; // מעדכן את הערך של gameOver
        updateStatus("תיקו!"); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
        showGameResult("draw"); // מציג במרכז הלוח את תוצאת המשחק
        checkAndSaveGame("תיקו"); // בודק האם יש לשמור את תוצאת משחק האונליין
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    else updateStatus(); // מעדכן את הודעת מצב המשחק שמוצגת למשתמש
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function showGameResult(result, winner = null) { // מגדיר פונקציה שמציגה הודעת ניצחון או תיקו במרכז הלוח
    if (!resultModal || !resultCard) return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    resultCard.classList.remove("win-x", "win-o", "draw"); // מסיר מחלקת CSS מהרכיב

    if (result === "draw") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        resultCard.classList.add("draw"); // מוסיף מחלקת CSS לרכיב כדי לשנות את מצבו או עיצובו
        resultIcon.textContent = "🤝"; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
        resultTitle.textContent = "תיקו!"; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
        resultText.textContent = "המשחק הסתיים ללא מנצח"; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
    } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
        resultCard.classList.add(winner === "X" ? "win-x" : "win-o"); // מוסיף מחלקת CSS לרכיב כדי לשנות את מצבו או עיצובו
        resultIcon.textContent = winner; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
        resultTitle.textContent = `${winner} ניצח!`; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
        resultText.textContent = "כל הכבוד! נוצר רצף מנצח"; // מעדכן את הטקסט שמוצג בתוך רכיב HTML
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    resultModal.classList.add("show"); // מוסיף מחלקת CSS לרכיב כדי לשנות את מצבו או עיצובו
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function hideGameResult() { // מגדיר פונקציה שמסתירה את הודעת התוצאה
    if (resultModal) resultModal.classList.remove("show"); // בודק האם התנאי מתקיים לפני ביצוע הבלוק
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function checkAndSaveGame(winnerPiece) { // מגדיר פונקציה ששומרת משחק אונליין שהסתיים
    if (gameMode !== "online" || !currentUser) return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    let p1 = playerXUser || "Unknown"; // מחשב ושומר ערך במשתנה p1
    let p2 = playerOUser || "Unknown"; // מחשב ושומר ערך במשתנה p2

    // טיפול במצב של תיקו
    if (winnerPiece === "תיקו") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        if (myRole === "X") { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            ws.send(JSON.stringify({ // ממיר נתונים ל-JSON ושולח אותם לשרת
                action: "save_game", // מגדיר שדה וערך בתוך אובייקט JavaScript
                user1: p1, // מגדיר שדה וערך בתוך אובייקט JavaScript
                user2: p2, // מגדיר שדה וערך בתוך אובייקט JavaScript
                winner: "תיקו" // מגדיר שדה וערך בתוך אובייקט JavaScript
            })); // סוגר את פונקציית החזרה ואת הקריאה שפתחה אותה
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        return; // מסיים מיד את הפונקציה הנוכחית
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    // ניצחון של אחד השחקנים
    let winnerName = (winnerPiece === "X") ? p1 : p2; // מחשב ושומר ערך במשתנה winnerName

    if (currentUser === winnerName) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        ws.send(JSON.stringify({ // ממיר נתונים ל-JSON ושולח אותם לשרת
            action: "save_game", // מגדיר שדה וערך בתוך אובייקט JavaScript
            user1: p1, // מגדיר שדה וערך בתוך אובייקט JavaScript
            user2: p2, // מגדיר שדה וערך בתוך אובייקט JavaScript
            winner: winnerName // מגדיר שדה וערך בתוך אובייקט JavaScript
        })); // סוגר את פונקציית החזרה ואת הקריאה שפתחה אותה
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function switchPlayer() { currentPlayer = currentPlayer === "X" ? "O" : "X"; updateStatus(); } // מגדיר פונקציה שמחליפה בין התור של X לתור של O
function isDraw() { return board.flat().every(c => c !== ""); } // מגדיר פונקציה שבודקת האם כל המשבצות מלאות ולכן יש תיקו
function inBounds(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols; } // מגדיר פונקציה שבודקת האם מיקום נמצא בתוך גבולות הלוח
function mapPieceToNum(p) { if (p === 'O') return 1; if (p === 'X') return -1; return 0; } // מגדיר פונקציה שממירה X ו-O לערכים מספריים עבור האלגוריתם

function highlightWinFromWindow(win) { // מגדיר פונקציה שמדגישה את המשבצות שיצרו את הרצף המנצח
    win.cells.forEach(idx => { // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        const r = Math.floor(idx / cols), c = idx % cols; // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח
        const el = document.getElementById(`${r}-${c}`); // שומר הפניה לרכיב HTML לפי המזהה שלו
        if (el) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            const player = numBoard[r][c] === 1 ? 'O' : 'X'; // מחשב ושומר ערך במשתנה player
            el.style.backgroundColor = player === 'X' ? '#3b82f6' : '#ef4444'; // מעדכן ישירות מאפיין עיצוב של רכיב בלוח
            el.style.color = '#fff'; // מעדכן ישירות מאפיין עיצוב של רכיב בלוח
            el.classList.add("winning-cell"); // מוסיף מחלקת CSS לרכיב כדי לשנות את מצבו או עיצובו
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function buildWindows() { // מגדיר פונקציה שבונה את כל רצפי הניצחון האפשריים בלוח
    windows = []; // מעדכן את הערך של windows
    cellToWindows = Array(rows * cols).fill(null).map(() => []); // מעדכן את הערך של cellToWindows

    for (const [dr, dc] of DIRS) { // עובר בלולאה על טווח או אוסף של ערכים
        for (let r = 0; r < rows; r++) { // עובר בלולאה על טווח או אוסף של ערכים
            for (let c = 0; c < cols; c++) { // עובר בלולאה על טווח או אוסף של ערכים
                const cells = []; // מחשב ושומר ערך במשתנה cells
                let ok = true; // מחשב ושומר ערך במשתנה ok
                for (let k = 0; k < winLength; k++) { // עובר בלולאה על טווח או אוסף של ערכים
                    const rr = r + dr * k, cc = c + dc * k; // מחשב ושומר ערך במשתנה rr
                    if (!inBounds(rr, cc)) { ok = false; break; } // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                    cells.push(rr * cols + cc); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                if (!ok) continue; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                const w = { cells, countAI: 0, countHuman: 0, empties: 0 }; // מחשב ושומר ערך במשתנה w
                for (const idx of cells) { // עובר בלולאה על טווח או אוסף של ערכים
                    const rr = Math.floor(idx / cols), cc = idx % cols; // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח
                    const v = numBoard[rr][cc]; // מחשב ושומר ערך במשתנה v
                    if (v === 1) w.countAI++; else if (v === -1) w.countHuman++; else w.empties++; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
                } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
                const winIdx = windows.length; // מחשב ושומר ערך במשתנה winIdx
                windows.push(w); // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
                for (const idx of cells) cellToWindows[idx].push(winIdx); // עובר בלולאה על טווח או אוסף של ערכים
            } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function updateWindowsOnPlace(r, c, val) { // מגדיר פונקציה שמעדכנת את הרצפים לאחר הנחת סימן
    const idx = r * cols + c; // מחשב ושומר ערך במשתנה idx
    for (const wi of cellToWindows[idx]) { // עובר בלולאה על טווח או אוסף של ערכים
        const w = windows[wi]; // מחשב ושומר ערך במשתנה w
        w.empties = Math.max(0, w.empties - 1); // מבצע חישוב מתמטי הדרוש להערכת המהלך או גודל הלוח
        if (val === 1) w.countAI++; else if (val === -1) w.countHuman++; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function updateWindowsOnRemove(r, c, val) { // מגדיר פונקציה שמחזירה את מצב הרצפים לאחר הסרת מהלך זמני
    const idx = r * cols + c; // מחשב ושומר ערך במשתנה idx
    for (const wi of cellToWindows[idx]) { // עובר בלולאה על טווח או אוסף של ערכים
        const w = windows[wi]; // מחשב ושומר ערך במשתנה w
        w.empties = w.empties + 1; // מעדכן את הערך של w.empties
        if (val === 1) w.countAI = Math.max(0, w.countAI - 1); else if (val === -1) w.countHuman = Math.max(0, w.countHuman - 1); // בודק האם התנאי מתקיים לפני ביצוע הבלוק
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function simulatePlacementMetrics(r, c, playerNumeric) { // מגדיר פונקציה שמעריכה מה יקרה אם סימן יונח במשבצת מסוימת
    const idx = r * cols + c; // מחשב ושומר ערך במשתנה idx
    let immediateWin = false; // מחשב ושומר ערך במשתנה immediateWin
    let near = 0; // מחשב ושומר ערך במשתנה near
    let open3 = 0; // מחשב ושומר ערך במשתנה open3
    let neighbours = 0; // מחשב ושומר ערך במשתנה neighbours

    for (const wi of cellToWindows[idx]) { // עובר בלולאה על טווח או אוסף של ערכים
        const w = windows[wi]; // מחשב ושומר ערך במשתנה w
        const newAI = w.countAI + (playerNumeric === 1 ? 1 : 0); // מחשב ושומר ערך במשתנה newAI
        const newHuman = w.countHuman + (playerNumeric === -1 ? 1 : 0); // מחשב ושומר ערך במשתנה newHuman
        const newEmpties = w.empties - 1; // מחשב ושומר ערך במשתנה newEmpties
        if (playerNumeric === 1) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            if (newAI >= winLength && newHuman === 0) immediateWin = true; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            if (newAI === winLength - 1 && newHuman === 0 && newEmpties >= 1) near++; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            if (newAI === winLength - 2 && newHuman === 0 && newEmpties >= 2) open3++; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        } else { // מפעיל את החלופה כאשר התנאי הקודם לא התקיים
            if (newHuman >= winLength && newAI === 0) immediateWin = true; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            if (newHuman === winLength - 1 && newAI === 0 && newEmpties >= 1) near++; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
            if (newHuman === winLength - 2 && newAI === 0 && newEmpties >= 2) open3++; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    for (const [dr, dc] of DIRS) { // עובר בלולאה על טווח או אוסף של ערכים
        let cnt = 0; // מחשב ושומר ערך במשתנה cnt
        for (let k = 1; k <= winLength - 1; k++) { // עובר בלולאה על טווח או אוסף של ערכים
            const rr = r + dr * k, cc = c + dc * k; if (!inBounds(rr, cc)) break; // מחשב ושומר ערך במשתנה rr
            if (numBoard[rr][cc] === playerNumeric) cnt++; else break; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        for (let k = 1; k <= winLength - 1; k++) { // עובר בלולאה על טווח או אוסף של ערכים
            const rr = r - dr * k, cc = c - dc * k; if (!inBounds(rr, cc)) break; // מחשב ושומר ערך במשתנה rr
            if (numBoard[rr][cc] === playerNumeric) cnt++; else break; // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        neighbours += cnt; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    return { immediateWin, near, open3, neighbours }; // מחזיר תוצאה מהפונקציה אל המקום שקרא לה
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function aiMove() { // מגדיר פונקציה שמבצעת את המהלך שנבחר עבור המחשב
    if (gameOver) return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    const move = blackAlgorithm(); // מפעיל את אלגוריתם ה-AI לבחירת המהלך הבא
    if (!move) return; // בודק האם התנאי מתקיים לפני ביצוע הבלוק

    const { r, c } = move; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    const cell = document.getElementById(`${r}-${c}`); // שומר הפניה לרכיב HTML לפי המזהה שלו
    makeMove(r, c, "O", cell); // מבצע את המהלך על הלוח ומפעיל בדיקות סיום

    if (!gameOver) switchPlayer(); // בודק האם התנאי מתקיים לפני ביצוע הבלוק
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

function getCandidateMoves() {
    // אין הגבלת רדיוס: כל משבצת ריקה בלוח היא מהלך חוקי אפשרי.
    const candidates = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (numBoard[r][c] === 0) {
                candidates.push({ r, c });
            }
        }
    }

    return candidates;
}

// ערך גדול מאוד למצבי ניצחון והפסד בחיפוש.
const SEARCH_WIN_SCORE = 1_000_000_000_000_000;

function indexToMove(idx) {
    return {
        r: Math.floor(idx / cols),
        c: idx % cols
    };
}

function getCenterBonus(r, c) {
    const centerR = (rows - 1) / 2;
    const centerC = (cols - 1) / 2;
    const maxDist = Math.max(1, centerR + centerC);
    const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
    return ((maxDist - dist) / maxDist) * 8;
}

function getPatternValue(count) {
    if (count <= 0) return 0;

    // הגבלה על החזקה מונעת מספרים עצומים מדי בלוחות עם רצף גדול.
    const cappedCount = Math.min(count, 12);
    const extraCount = Math.max(0, count - 12);
    return Math.pow(4, cappedCount) * (1 + extraCount * 4);
}

function evaluateWindowScore(w) {
    if (w.countAI >= winLength) return SEARCH_WIN_SCORE;
    if (w.countHuman >= winLength) return -SEARCH_WIN_SCORE;

    // רצף שמכיל גם X וגם O כבר חסום לשני הצדדים.
    if (w.countAI > 0 && w.countHuman > 0) return 0;

    if (w.countAI > 0) {
        const openness = 1 + (w.empties / Math.max(1, winLength)) * 0.12;
        return getPatternValue(w.countAI) * openness;
    }

    if (w.countHuman > 0) {
        const openness = 1 + (w.empties / Math.max(1, winLength)) * 0.12;
        // נותנים מעט יותר משקל להגנה, כדי שהמחשב לא יתעלם מאיום של X.
        return -getPatternValue(w.countHuman) * openness * 1.12;
    }

    return 0;
}

function evaluateBoardHeuristic() {
    let score = 0;

    for (const w of windows) {
        const windowScore = evaluateWindowScore(w);

        if (windowScore >= SEARCH_WIN_SCORE) return SEARCH_WIN_SCORE;
        if (windowScore <= -SEARCH_WIN_SCORE) return -SEARCH_WIN_SCORE;

        score += windowScore;
    }

    return score;
}

function evaluateWindowsContainingCell(r, c) {
    const idx = r * cols + c;
    let score = 0;

    for (const wi of cellToWindows[idx]) {
        score += evaluateWindowScore(windows[wi]);
    }

    return score;
}

function placeTemporaryMove(r, c, playerNumeric) {
    numBoard[r][c] = playerNumeric;
    board[r][c] = playerNumeric === 1 ? "O" : "X";
    updateWindowsOnPlace(r, c, playerNumeric);
}

function removeTemporaryMove(r, c, playerNumeric) {
    updateWindowsOnRemove(r, c, playerNumeric);
    numBoard[r][c] = 0;
    board[r][c] = "";
}

// מחזירה את יעדי הניצחון שייווצרו בתור הבא אם השחקן יניח עכשיו ב-r,c.
// כל רצף נספר בנפרד, גם אם שני רצפים שונים מסתיימים באותה משבצת.
function getFutureWinningCellIndexesAfterPlacement(r, c, playerNumeric, stopAt = Infinity) {
    if (!inBounds(r, c) || numBoard[r][c] !== 0) return [];

    const placedIdx = r * cols + c;
    const winningCells = [];

    for (const wi of cellToWindows[placedIdx]) {
        const w = windows[wi];
        const ownCount = playerNumeric === 1 ? w.countAI : w.countHuman;
        const opponentCount = playerNumeric === 1 ? w.countHuman : w.countAI;
        const newOwnCount = ownCount + 1;
        const newEmptyCount = w.empties - 1;

        if (newOwnCount === winLength - 1 && opponentCount === 0 && newEmptyCount === 1) {
            for (const idx of w.cells) {
                if (idx === placedIdx) continue;

                const rr = Math.floor(idx / cols);
                const cc = idx % cols;

                if (numBoard[rr][cc] === 0) {
                    winningCells.push(idx);
                    break;
                }
            }
        }

        if (winningCells.length >= stopAt) break;
    }

    return winningCells;
}

// לאחר שכבר הונח סימן ב-r,c, הפונקציה מחזירה את יעדי הניצחון המיידי
// שנוצרו ברצפים העוברים דרך המהלך האחרון. כל רצף נספר בנפרד.
function getImmediateWinningCellIndexesThroughMove(r, c, playerNumeric, stopAt = Infinity) {
    const moveIdx = r * cols + c;
    const winningCells = [];

    for (const wi of cellToWindows[moveIdx]) {
        const w = windows[wi];
        const ownCount = playerNumeric === 1 ? w.countAI : w.countHuman;
        const opponentCount = playerNumeric === 1 ? w.countHuman : w.countAI;

        if (ownCount === winLength - 1 && opponentCount === 0 && w.empties === 1) {
            for (const idx of w.cells) {
                const rr = Math.floor(idx / cols);
                const cc = idx % cols;

                if (numBoard[rr][cc] === 0) {
                    winningCells.push(idx);
                    break;
                }
            }
        }

        if (winningCells.length >= stopAt) break;
    }

    return winningCells;
}

// סורקת את מצב הלוח הנוכחי ומחזירה יעדי ניצחון מיידיים.
// כל רצף מנצח אפשרי נספר בנפרד, גם אם היעד שלו זהה ליעד של רצף אחר.
function getImmediateWinningCellIndexes(playerNumeric, stopAt = Infinity) {
    const winningCells = [];

    for (const w of windows) {
        const ownCount = playerNumeric === 1 ? w.countAI : w.countHuman;
        const opponentCount = playerNumeric === 1 ? w.countHuman : w.countAI;

        if (ownCount === winLength - 1 && opponentCount === 0 && w.empties === 1) {
            for (const idx of w.cells) {
                const rr = Math.floor(idx / cols);
                const cc = idx % cols;

                if (numBoard[rr][cc] === 0) {
                    winningCells.push(idx);
                    break;
                }
            }
        }

        if (winningCells.length >= stopAt) break;
    }

    return winningCells;
}

function getMovePriorityScore(r, c) {
    const attack = simulatePlacementMetrics(r, c, 1);
    const defence = simulatePlacementMetrics(r, c, -1);

    // סופרים רצפי ניצחון עתידיים; כל חלון near נספר בנפרד.
    const attackWinningCells = getFutureWinningCellIndexesAfterPlacement(r, c, 1, 2);
    const defenceWinningCells = getFutureWinningCellIndexesAfterPlacement(r, c, -1, 2);

    let score = 0;

    // סדרי הגודל נועדו לכך שמצבים טקטיים יהיו חשובים יותר מעיצוב עמדה כללי.
    if (defence.immediateWin) score += 900_000_000_000;

    // יצירת כמה איומי ניצחון או חסימתם מקבלות עדיפות עצומה.
    if (attackWinningCells.length >= 2) score += 700_000_000_000;
    if (defenceWinningCells.length >= 2) score += 650_000_000_000;

    // משקל near של המחשב נשאר בדיוק שני מיליון, כפי שביקשת.
    score += attack.near * 2_000_000;
    score += defence.near * 1_850_000;
    score += attack.open3 * 45_000;
    score += defence.open3 * 42_000;
    score += attack.neighbours * 220;
    score += defence.neighbours * 200;
    score += getCenterBonus(r, c);

    return score;
}

function getMinimaxCandidateLimit(numberOfEmptyCells) {
    // בלוחות קטנים, ובפרט 3x3, בודקים את כל המהלכים של O.
    if (numberOfEmptyCells <= 16) return numberOfEmptyCells;

    const boardSize = rows * cols;
    if (boardSize <= 100) return 18;
    if (boardSize <= 400) return 14;
    return 10;
}

// מדמה חסימה כפויה של איום יחיד של X ומחזירה את הציון לאחר החסימה.
function evaluateForcedAIBlock(baseScore, winningCellIdx) {
    const blockMove = indexToMove(winningCellIdx);

    if (numBoard[blockMove.r][blockMove.c] !== 0) {
        return -SEARCH_WIN_SCORE / 2;
    }

    const blockMetrics = simulatePlacementMetrics(blockMove.r, blockMove.c, 1);
    const oldAffectedScore = evaluateWindowsContainingCell(blockMove.r, blockMove.c);

    placeTemporaryMove(blockMove.r, blockMove.c, 1);

    const newAffectedScore = evaluateWindowsContainingCell(blockMove.r, blockMove.c);
    let valueAfterBlock = baseScore - oldAffectedScore + newAffectedScore;

    if (blockMetrics.immediateWin) {
        valueAfterBlock = SEARCH_WIN_SCORE;
    } else {
        const aiThreats = getImmediateWinningCellIndexesThroughMove(
            blockMove.r,
            blockMove.c,
            1,
            2
        );

        if (aiThreats.length >= 2) valueAfterBlock = SEARCH_WIN_SCORE / 2;
    }

    removeTemporaryMove(blockMove.r, blockMove.c, 1);
    return valueAfterBlock;
}

function chooseMoveWithDepthTwo(candidates) {
    const rankedMoves = candidates
        .map(move => ({
            ...move,
            priority: getMovePriorityScore(move.r, move.c)
        }))
        .sort((a, b) => b.priority - a.priority);

    const candidateLimit = getMinimaxCandidateLimit(rankedMoves.length);
    const topMoves = rankedMoves.slice(0, candidateLimit);

    let bestValue = -Infinity;
    let bestMoves = [];

    for (const move of topMoves) {
        placeTemporaryMove(move.r, move.c, 1);

        let moveValue;
        const boardScoreAfterAI = evaluateBoardHeuristic();
        const humanImmediateWinsAfterAI = getImmediateWinningCellIndexes(-1, 1);

        if (boardScoreAfterAI >= SEARCH_WIN_SCORE) {
            moveValue = SEARCH_WIN_SCORE;
        } else if (humanImmediateWinsAfterAI.length > 0) {
            // X יכול לנצח מיד בתורו, ולכן המהלך של O מפסיד.
            moveValue = -SEARCH_WIN_SCORE;
        } else {
            // לאחר מהלך O בודקים את כל התגובות החוקיות של X.
            // אין טיפול מיוחד באיום יחיד של O שמכריח חסימה.
            const humanReplies = getCandidateMoves();

            if (humanReplies.length === 0) {
                moveValue = boardScoreAfterAI;
            } else {
                // X בוחר את התגובה שמביאה לציון הנמוך ביותר עבור O.
                let worstReplyValue = Infinity;

                for (const reply of humanReplies) {
                    if (numBoard[reply.r][reply.c] !== 0) continue;

                    const replyMetrics = simulatePlacementMetrics(reply.r, reply.c, -1);
                    const oldAffectedScore = evaluateWindowsContainingCell(reply.r, reply.c);

                    placeTemporaryMove(reply.r, reply.c, -1);

                    const newAffectedScore = evaluateWindowsContainingCell(reply.r, reply.c);
                    let replyValue = boardScoreAfterAI - oldAffectedScore + newAffectedScore;

                    if (replyMetrics.immediateWin) {
                        replyValue = -SEARCH_WIN_SCORE;
                    } else {
                        const humanThreatsAfterReply = getImmediateWinningCellIndexesThroughMove(
                            reply.r,
                            reply.c,
                            -1,
                            2
                        );

                        if (humanThreatsAfterReply.length >= 2) {
                            // X יצר לפחות שני רצפי ניצחון אפשריים לתור הבא.
                            replyValue = -SEARCH_WIN_SCORE / 2;
                        } else if (humanThreatsAfterReply.length === 1) {
                            // O ייאלץ לחסום את האיום היחיד, ולכן מדמים גם את החסימה הזאת.
                            replyValue = evaluateForcedAIBlock(
                                replyValue,
                                humanThreatsAfterReply[0]
                            );
                        } else {
                            // כאשר אין הכרעה טקטית, משתמשים בקנסות היוריסטיים הרגילים.
                            replyValue -= replyMetrics.near * 120_000;
                            replyValue -= replyMetrics.open3 * 3_500;
                            replyValue -= replyMetrics.neighbours * 18;
                            replyValue -= getCenterBonus(reply.r, reply.c) * 0.4;
                        }
                    }

                    removeTemporaryMove(reply.r, reply.c, -1);

                    if (replyValue < worstReplyValue) {
                        worstReplyValue = replyValue;
                    }

                    // לא עוצרים לפני שבודקים את כל תגובות X. הדבר חשוב במיוחד
                    // משום שבסוף מתווסף ציון עדיפות, ולכן גיזום מוקדם עלול לפספס מזלג מאוחר.
                }

                moveValue = worstReplyValue;
            }
        }

        removeTemporaryMove(move.r, move.c, 1);

        // עדיפות קטנה לציון המיידי משמשת רק כששני ערכי Minimax כמעט זהים.
        moveValue += move.priority * 0.000001;

        if (moveValue > bestValue + 1e-7) {
            bestValue = moveValue;
            bestMoves = [{ r: move.r, c: move.c }];
        } else if (Math.abs(moveValue - bestValue) <= 1e-7) {
            bestMoves.push({ r: move.r, c: move.c });
        }
    }

    if (bestMoves.length === 0) return null;
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function blackAlgorithm() {
    const candidates = getCandidateMoves();
    if (candidates.length === 0) return null;

    // 1. אם O יכול לנצח עכשיו, אין צורך להמשיך לחפש.
    for (const move of candidates) {
        if (simulatePlacementMetrics(move.r, move.c, 1).immediateWin) {
            return { r: move.r, c: move.c, reason: "win-immediate" };
        }
    }

    // 2. אם ל-X יש מהלך ניצחון יחיד, חייבים לחסום אותו מיד.
    const immediateHumanWins = [];
    for (const move of candidates) {
        if (simulatePlacementMetrics(move.r, move.c, -1).immediateWin) {
            immediateHumanWins.push(move);
        }
    }

    if (immediateHumanWins.length === 1) {
        return {
            r: immediateHumanWins[0].r,
            c: immediateHumanWins[0].c,
            reason: "block-opponent-win"
        };
    }

    // 3. אם אין ל-X ניצחון מיידי, מחפשים קודם מהלך שיוצר ל-O כמה איומי ניצחון.
    if (immediateHumanWins.length === 0) {
        const forcedWinMoves = candidates
            .map(move => ({
                ...move,
                winningCells: getFutureWinningCellIndexesAfterPlacement(
                    move.r,
                    move.c,
                    1,
                    2
                ),
                priority: getMovePriorityScore(move.r, move.c)
            }))
            .filter(move => move.winningCells.length >= 2)
            .sort((a, b) => b.priority - a.priority);

        if (forcedWinMoves.length > 0) {
            return {
                r: forcedWinMoves[0].r,
                c: forcedWinMoves[0].c,
                reason: "create-multiple-winning-threats"
            };
        }
    }

    // 4. בשאר המצבים משתמשים ב-Minimax בעומק 2,
    //    עם העמקה טקטית נוספת לאיומים ולחסימות.
    const minimaxMove = chooseMoveWithDepthTwo(candidates);
    if (minimaxMove) {
        return { ...minimaxMove, reason: "tactical-minimax" };
    }

    // גיבוי למקרה חריג.
    return candidates[0];
}


// שליחת בקשה לשרת
function requestAdminData(actionType) { // מגדיר פונקציה שמבקשת מהשרת נתונים לפאנל המנהל
    if (ws && ws.readyState === WebSocket.OPEN) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        ws.send(JSON.stringify({ action: actionType })); // ממיר נתונים ל-JSON ושולח אותם לשרת
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

// סגירת החלון
function closeAdminModal() { // מגדיר פונקציה שסוגרת את חלון נתוני המנהל
    document.getElementById("adminModal").classList.add("is-hidden"); // שומר הפניה לרכיב HTML לפי המזהה שלו
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

// פונקציית עזר לציור הטבלה
function renderAdminTable(title, headers, rows) { // מגדיר פונקציה שבונה ומציגה טבלה בחלון המנהל
    document.getElementById("adminModalTitle").innerText = title; // שומר הפניה לרכיב HTML לפי המזהה שלו
    const table = document.getElementById("adminTable"); // שומר הפניה לרכיב HTML לפי המזהה שלו

    let html = "<thead><tr>"; // מחשב ושומר ערך במשתנה html
    headers.forEach(h => { // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        html += `<th>${h}</th>`; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
    html += "</tr></thead><tbody>"; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק

    rows.forEach(row => { // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        html += "<tr>"; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        row.forEach(cell => { // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
            html += `<td>${cell || '-'}</td>`; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
        }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
        html += "</tr>"; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    }); // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    if (rows.length === 0) { // בודק האם התנאי מתקיים לפני ביצוע הבלוק
        html += `<tr><td colspan="${headers.length}" class="empty-table">אין נתונים להצגה</td></tr>`; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    } // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות

    html += "</tbody>"; // מבצע שלב נוסף בלוגיקת המשחק או בעדכון הממשק
    table.innerHTML = html; // מחליף את תוכן ה-HTML שבתוך הרכיב

    // מציג את החלון
    document.getElementById("adminModal").classList.remove("is-hidden"); // שומר הפניה לרכיב HTML לפי המזהה שלו
} // סוגר את הבלוק או הקריאה שנפתחו בשורות הקודמות
