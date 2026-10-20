const firebaseConfig = {
    apiKey: "AIzaSyCZ9G_megeqZ1GN8zqfGAKuml1LKrhZDHk",
    databaseURL: "https://smart-water-tamco-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let sensorData = {};
let systemRunning = false;
let currentMode = "manual";
let currentStartTime = null;

let valveStates = { valve1: false, valve2: false, valve3: false };
let selectedValves = { valve1: false, valve2: false, valve3: false };

firebase.auth().signInAnonymously().then(() => {
    startFirebaseListeners();
}).catch(error => {
    console.error(error);
    showToast("ไม่สามารถเชื่อมต่อระบบได้");
});

function startFirebaseListeners() {
    db.ref(".info/connected").on("value", snapshot => {
        const connected = snapshot.val() === true;
        const dot = document.getElementById("firebaseDot");
        const text = document.getElementById("firebaseText");
        const badge = document.getElementById("connectionBadge");
        if (connected) {
            if (dot) dot.className = "status-dot online";
            if (text) text.textContent = "ออนไลน์";
            if (badge) { badge.textContent = "ออนไลน์"; badge.className = "mini-status online"; }
        } else {
            if (dot) dot.className = "status-dot offline";
            if (text) text.textContent = "ออฟไลน์";
            if (badge) { badge.textContent = "ออฟไลน์"; badge.className = "mini-status"; }
        }
    });
    db.ref("/sensor").on("value", snapshot => {
        sensorData = snapshot.val() || {};
        updateSensorDisplay();
    });
    db.ref("/control").on("value", snapshot => {
        const data = snapshot.val() || {};
        updateControlDisplay(data);
    });
    db.ref("/settings/auto").on("value", snapshot => {
        loadAutoSettings(snapshot.val() || {});
    });
}

function updateSensorDisplay() {
    const soil = Number(sensorData.soilMoisture);
    if (!isNaN(soil)) {
        document.getElementById("soilValue").textContent = Math.round(soil);
        updateSoilCondition(soil);
    }
    if (sensorData.temperature !== undefined) document.getElementById("tempValue").textContent = Number(sensorData.temperature).toFixed(1);
    if (sensorData.humidity !== undefined) document.getElementById("humidityValue").textContent = Number(sensorData.humidity).toFixed(0);
    if (sensorData.externalTemperature !== undefined) document.getElementById("externalTemp").textContent = Number(sensorData.externalTemperature).toFixed(1);

    const fanStatus = document.getElementById("fanStatus");
    const fanBadge = document.getElementById("fanBadge");
    const fanSettings = document.getElementById("fanSettingsText");
    if (sensorData.fan === true) {
        if (fanStatus) fanStatus.textContent = "กำลังทำงาน";
        if (fanBadge) { fanBadge.textContent = "ทำงาน"; fanBadge.className = "mini-status active"; }
        if (fanSettings) fanSettings.textContent = "กำลังทำงาน";
    } else {
        if (fanStatus) fanStatus.textContent = "ปิดอยู่";
        if (fanBadge) { fanBadge.textContent = "ปิด"; fanBadge.className = "mini-status"; }
        if (fanSettings) fanSettings.textContent = "ปิดอยู่";
    }
    updateDeviceStatus();
    if (sensorData.lastHeartbeat) {
        const date = new Date(Number(sensorData.lastHeartbeat));
        const time = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const lastUpdate = document.getElementById("lastUpdate");
        if (lastUpdate) lastUpdate.textContent = time;
    }
}

function updateDeviceStatus() {
    const dot = document.getElementById("deviceDot");
    const text = document.getElementById("deviceText");
    const settingsText = document.getElementById("deviceSettingsText");
    const ready = sensorData.deviceReady === true;
    let heartbeatOK = false;
    if (sensorData.lastHeartbeat) heartbeatOK = Date.now() - Number(sensorData.lastHeartbeat) < 20000;
    if (ready && heartbeatOK) {
        if (dot) dot.className = "status-dot online";
        if (text) text.textContent = "อุปกรณ์พร้อม";
        if (settingsText) settingsText.textContent = "พร้อมใช้งาน";
    } else {
        if (dot) dot.className = "status-dot offline";
        if (text) text.textContent = "อุปกรณ์ไม่พร้อม";
        if (settingsText) settingsText.textContent = "ไม่พร้อมใช้งาน";
    }
}

function updateSoilCondition(soil) {
    const element = document.getElementById("soilCondition");
    if (!element) return;
    if (soil < 35) element.textContent = "ดินค่อนข้างแห้ง";
    else if (soil < 45) element.textContent = "ความชื้นปานกลาง";
    else element.textContent = "ความชื้นเพียงพอ";
}

function updateControlDisplay(data) {
    const wasRunning = systemRunning;
    systemRunning = data.system === true;
    currentMode = data.mode || "manual";
    valveStates.valve1 = data.valve1 === true;
    valveStates.valve2 = data.valve2 === true;
    valveStates.valve3 = data.valve3 === true;
    if (!wasRunning && systemRunning) currentStartTime = Date.now();
    if (!systemRunning) currentStartTime = null;
    updateSystemDisplay();
    updateValveDisplay();
    updateModeDisplay();
    if (!systemRunning) updateSelectionDisplay();
}

function updateSystemDisplay() {
    const title = document.getElementById("systemStatus");
    const message = document.getElementById("systemSubStatus");
    const zone = document.getElementById("activeZone");
    const active = [];
    if (valveStates.valve1) active.push("วาล์ว 1");
    if (valveStates.valve2) active.push("วาล์ว 2");
    if (valveStates.valve3) active.push("วาล์ว 3");
    if (systemRunning && active.length > 0) {
        if (title) { title.textContent = "กำลังรดน้ำ"; title.className = "system-pill running"; }
        if (message) message.textContent = "ระบบกำลังทำงาน";
        if (zone) zone.textContent = active.join(" + ");
    } else {
        if (title) { title.textContent = "หยุดทำงาน"; title.className = "system-pill"; }
        if (message) message.textContent = "ระบบพร้อมใช้งาน";
        if (zone) zone.textContent = "ยังไม่มีวาล์วทำงาน";
    }
}

function updateValveDisplay() {
    updateHomeValve(1, valveStates.valve1);
    updateHomeValve(2, valveStates.valve2);
    updateHomeValve(3, valveStates.valve3);
    updateControlValveState(1);
    updateControlValveState(2);
    updateControlValveState(3);
}

function updateHomeValve(number, state) {
    const element = document.getElementById("homeZone" + number);
    const stateText = document.getElementById("homeZoneState" + number);
    if (state) {
        if (element) element.classList.add("active");
        if (stateText) stateText.textContent = "กำลังรดน้ำ";
    } else {
        if (element) element.classList.remove("active");
        if (stateText) stateText.textContent = "ปิด";
    }
}

function updateControlValveState(number) {
    const key = "valve" + number;
    const button = document.getElementById("controlZone" + number);
    const stateText = document.getElementById("controlZoneState" + number);
    const switchElement = document.getElementById("valveSwitch" + number);
    const selected = selectedValves[key];
    if (selected) {
        if (button) button.classList.add("selected");
        if (switchElement) switchElement.classList.add("selected");
        if (stateText) stateText.textContent = "เลือกแล้ว";
    } else {
        if (button) button.classList.remove("selected");
        if (switchElement) switchElement.classList.remove("selected");
        if (stateText) stateText.textContent = "ไม่ได้เลือก";
    }
    if (systemRunning && valveStates[key]) {
        if (button) button.classList.add("running");
        if (stateText) stateText.textContent = "กำลังรดน้ำ";
    } else if (button) {
        button.classList.remove("running");
    }
}

function selectValve(number) {
    if (currentMode !== "manual") { showToast("โหมด AUTO ไม่สามารถเลือกวาล์วเองได้"); return; }
    if (systemRunning) { showToast("ระบบกำลังทำงาน กดหยุดก่อน"); return; }
    const key = "valve" + number;
    selectedValves[key] = !selectedValves[key];
    updateSelectionDisplay();
}

function updateSelectionDisplay() {
    updateControlValveState(1); updateControlValveState(2); updateControlValveState(3);
    const selected = [];
    if (selectedValves.valve1) selected.push("วาล์ว 1");
    if (selectedValves.valve2) selected.push("วาล์ว 2");
    if (selectedValves.valve3) selected.push("วาล์ว 3");
    const summary = document.getElementById("selectedSummary");
    const description = document.getElementById("selectionDescription");
    if (selected.length === 0) {
        if (summary) summary.textContent = "ยังไม่ได้เลือกวาล์ว";
        if (description) description.textContent = "แตะวาล์วเพื่อเลือกพื้นที่ที่ต้องการรดน้ำ";
    } else {
        if (summary) summary.textContent = "เลือก: " + selected.join(" + ");
        if (description) description.textContent = "กดปุ่ม เริ่มทำงาน เพื่อเริ่มรดน้ำ";
    }
    updateStartButton();
}

function updateStartButton() {
    const button = document.getElementById("startButton");
    if (!button) return;
    const hasSelection = selectedValves.valve1 || selectedValves.valve2 || selectedValves.valve3;
    if (currentMode !== "manual") {
        button.disabled = true; button.classList.add("disabled"); button.innerHTML = "<span>⚙</span> AUTO ทำงานอัตโนมัติ"; return;
    }
    if (systemRunning) {
        button.disabled = true; button.classList.add("disabled"); button.innerHTML = "<span>●</span> ระบบกำลังทำงาน"; return;
    }
    if (!hasSelection) {
        button.disabled = true; button.classList.add("disabled"); button.innerHTML = "<span>▶</span> เลือกวาล์วก่อนเริ่ม"; return;
    }
    button.disabled = false; button.classList.remove("disabled"); button.innerHTML = "<span>▶</span> เริ่มทำงาน";
}

function startSystem() {
    if (currentMode !== "manual") { showToast("กรุณาใช้ MANUAL สำหรับสั่งวาล์วเอง"); return; }
    if (systemRunning) { showToast("ระบบกำลังทำงานอยู่"); return; }
    const hasSelection = selectedValves.valve1 || selectedValves.valve2 || selectedValves.valve3;
    if (!hasSelection) { showToast("กรุณาเลือกวาล์วก่อนเริ่มทำงาน"); return; }
    const control = { system: true, mode: "manual", valve1: selectedValves.valve1, valve2: selectedValves.valve2, valve3: selectedValves.valve3 };
    db.ref("/control").update(control).then(() => showToast("เริ่มระบบรดน้ำแล้ว")).catch(error => {
        console.error("START ERROR:", error); showToast("ไม่สามารถเริ่มระบบได้");
    });
}

function stopSystem() {
    const control = { system: false, mode: "manual", valve1: false, valve2: false, valve3: false };
    db.ref("/control").update(control).then(() => {
        selectedValves.valve1 = false; selectedValves.valve2 = false; selectedValves.valve3 = false;
        updateSelectionDisplay(); showToast("หยุดระบบทั้งหมดแล้ว");
    }).catch(error => { console.error("STOP ERROR:", error); showToast("ไม่สามารถหยุดระบบได้"); });
}

function setMode(mode) {
    if (systemRunning) { showToast("กรุณาหยุดระบบก่อนเปลี่ยนโหมด"); return; }
    db.ref("/control").update({ mode: mode }).then(() => {
        currentMode = mode;
        if (mode === "auto") {
            selectedValves.valve1 = false; selectedValves.valve2 = false; selectedValves.valve3 = false;
            showToast("เปลี่ยนเป็น AUTO");
        } else showToast("เปลี่ยนเป็น MANUAL");
        updateSelectionDisplay(); updateModeDisplay();
    }).catch(error => { console.error("MODE ERROR:", error); showToast("ไม่สามารถเปลี่ยนโหมดได้"); });
}

function updateModeDisplay() {
    const manual = document.getElementById("manualModeButton");
    const auto = document.getElementById("autoModeButton");
    const description = document.getElementById("modeDescription");
    const modeStatus = document.getElementById("modeStatus");
    if (currentMode === "auto") {
        if (manual) manual.classList.remove("active");
        if (auto) auto.classList.add("active");
        if (description) description.textContent = "ระบบควบคุมการรดน้ำอัตโนมัติ";
        if (modeStatus) modeStatus.textContent = "AUTO";
    } else {
        if (auto) auto.classList.remove("active");
        if (manual) manual.classList.add("active");
        if (description) description.textContent = "เลือกวาล์ว แล้วกดเริ่มทำงาน";
        if (modeStatus) modeStatus.textContent = "MANUAL";
    }
    updateStartButton();
}

function loadAutoSettings(data) {
    if (data.time1) document.getElementById("autoTime1").value = data.time1;
    if (data.time2) document.getElementById("autoTime2").value = data.time2;
    if (data.time3) document.getElementById("autoTime3").value = data.time3;
    if (data.soilSetpoint !== undefined) {
        const value = Number(data.soilSetpoint);
        document.getElementById("soilSetpoint").value = value;
        document.getElementById("thresholdSlider").value = value;
        document.getElementById("thresholdValue").textContent = value + "%";
    }
    if (data.duration !== undefined) document.getElementById("wateringDuration").value = Number(data.duration);
}

function saveAutoSettings() {
    const time1 = document.getElementById("autoTime1").value;
    const time2 = document.getElementById("autoTime2").value;
    const time3 = document.getElementById("autoTime3").value;
    const soilSetpoint = Number(document.getElementById("soilSetpoint").value);
    const duration = Number(document.getElementById("wateringDuration").value);
    if (!time1 || !time2 || !time3) { showToast("กรุณากำหนดเวลาให้ครบ 3 เวลา"); return; }
    if (soilSetpoint < 1 || soilSetpoint > 100) { showToast("ค่าความชื้นต้องอยู่ระหว่าง 1-100%"); return; }
    if (duration < 1 || duration > 120) { showToast("เวลารดน้ำต้องอยู่ระหว่าง 1-120 นาที"); return; }
    db.ref("/settings/auto").update({ time1, time2, time3, soilSetpoint, duration }).then(() => {
        const message = document.getElementById("saveMessage");
        message.textContent = "บันทึกการตั้งค่าเรียบร้อยแล้ว";
        showToast("บันทึกการตั้งค่าแล้ว");
        setTimeout(() => { message.textContent = ""; }, 3000);
    }).catch(error => { console.error("SAVE ERROR:", error); showToast("ไม่สามารถบันทึกการตั้งค่าได้"); });
}

function showPage(page) {
    const pages = { home: "pageHome", control: "pageControl", schedule: "pageSchedule", settings: "pageSettings" };
    Object.values(pages).forEach(id => document.getElementById(id).classList.remove("active"));
    document.getElementById(pages[page]).classList.add("active");
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    const navMap = { home: "navHome", control: "navControl", schedule: "navSchedule", settings: "navSettings" };
    document.getElementById(navMap[page]).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

const thresholdSlider = document.getElementById("thresholdSlider");
const soilSetpoint = document.getElementById("soilSetpoint");
const thresholdValue = document.getElementById("thresholdValue");
if (thresholdSlider && soilSetpoint && thresholdValue) {
    thresholdSlider.addEventListener("input", () => {
        const value = thresholdSlider.value;
        soilSetpoint.value = value;
        thresholdValue.textContent = value + "%";
    });
    soilSetpoint.addEventListener("input", () => {
        let value = Number(soilSetpoint.value);
        if (value < 1) value = 1;
        if (value > 100) value = 100;
        thresholdSlider.value = value;
        thresholdValue.textContent = value + "%";
    });
}

function updateDate() {
    const date = new Date();
    const text = date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const dateElement = document.getElementById("todayDate");
    if (dateElement) dateElement.textContent = text;
}
updateDate();

setInterval(() => {
    const runTime = document.getElementById("runTime");
    if (!runTime) return;
    if (!systemRunning || !currentStartTime) { runTime.textContent = "--"; return; }
    const elapsed = Date.now() - currentStartTime;
    const totalSeconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    runTime.textContent = "ทำงานมา " + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}, 1000);

/* =====================================================
   SMART CONTROL WATER - LOGIN SYSTEM (เพิ่มใหม่ท้ายไฟล์)
   ===================================================== */

// เปลี่ยนข้อความนี้เป็นรหัสผ่านที่ต้องการ
const LOGIN_PASSWORD = "1234";
const LOGIN_DURATION_MS = 10 * 60 * 1000;
const LOGIN_LOCK_REF = db.ref("/webLogin/activeSession");
const LOGIN_TOKEN_KEY = "smartWaterLoginToken";
const LOGIN_EXPIRY_KEY = "smartWaterLoginExpiry";

const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const loginPasswordInput = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

let loginSessionToken = sessionStorage.getItem(LOGIN_TOKEN_KEY) || createLoginToken();
let loginLogoutTimer = null;

function createLoginToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2);
}
function showLoginMessage(message) { if (loginMessage) loginMessage.textContent = message; }
function showLoginOverlay() { if (loginOverlay) loginOverlay.classList.remove("hidden"); }
function hideLoginOverlay() { if (loginOverlay) loginOverlay.classList.add("hidden"); }

function waitForFirebaseLogin() {
    return new Promise((resolve, reject) => {
        let unsubscribe = null;
        const timeout = setTimeout(() => {
            if (unsubscribe) unsubscribe();
            reject(new Error("Firebase authentication timeout"));
        }, 15000);
        unsubscribe = firebase.auth().onAuthStateChanged(user => {
            if (user) {
                clearTimeout(timeout);
                if (unsubscribe) unsubscribe();
                resolve(user);
            }
        }, error => {
            clearTimeout(timeout);
            if (unsubscribe) unsubscribe();
            reject(error);
        });
    });
}

function startLoginLogoutTimer(expiresAt) {
    clearTimeout(loginLogoutTimer);
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) { logoutFromLoginSystem(true); return; }
    loginLogoutTimer = setTimeout(() => logoutFromLoginSystem(true), remaining);
}

async function restoreLoginSession() {
    const savedToken = sessionStorage.getItem(LOGIN_TOKEN_KEY);
    const savedExpiry = Number(sessionStorage.getItem(LOGIN_EXPIRY_KEY));
    if (!savedToken || !savedExpiry || savedExpiry <= Date.now()) {
        sessionStorage.removeItem(LOGIN_TOKEN_KEY);
        sessionStorage.removeItem(LOGIN_EXPIRY_KEY);
        loginSessionToken = createLoginToken();
        showLoginOverlay();
        return;
    }
    try {
        await waitForFirebaseLogin();
        const snapshot = await LOGIN_LOCK_REF.once("value");
        const activeSession = snapshot.val();
        if (activeSession && activeSession.token === savedToken && Number(activeSession.expiresAt) === savedExpiry && Number(activeSession.expiresAt) > Date.now()) {
            loginSessionToken = savedToken;
            hideLoginOverlay();
            startLoginLogoutTimer(savedExpiry);
            return;
        }
        sessionStorage.removeItem(LOGIN_TOKEN_KEY);
        sessionStorage.removeItem(LOGIN_EXPIRY_KEY);
        loginSessionToken = createLoginToken();
        showLoginOverlay();
    } catch (error) {
        console.error("LOGIN RESTORE ERROR:", error);
        showLoginOverlay();
        showLoginMessage("ตรวจสอบสถานะ Login ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและ Firebase Rules");
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const password = loginPasswordInput.value;
    if (password !== LOGIN_PASSWORD) {
        showLoginMessage("รหัสผ่านไม่ถูกต้อง");
        loginPasswordInput.focus();
        loginPasswordInput.select();
        return;
    }
    loginButton.disabled = true;
    loginButton.textContent = "กำลังตรวจสอบ...";
    showLoginMessage("");
    try {
        await waitForFirebaseLogin();
        const now = Date.now();
        const newExpiry = now + LOGIN_DURATION_MS;
        const result = await LOGIN_LOCK_REF.transaction(currentSession => {
            if (currentSession && Number(currentSession.expiresAt) > now && currentSession.token !== loginSessionToken) return;
            return { token: loginSessionToken, expiresAt: newExpiry };
        }, undefined, false);
        if (!result.committed) {
            showLoginMessage("เข้าสู่ระบบไม่สำเร็จ มีผู้ใช้อื่นกำลังใช้งานอยู่");
            return;
        }
        const session = result.snapshot.val();
        if (!session || session.token !== loginSessionToken || Number(session.expiresAt) <= Date.now()) {
            showLoginMessage("ไม่สามารถยืนยัน session ได้ กรุณาลองใหม่");
            return;
        }
        sessionStorage.setItem(LOGIN_TOKEN_KEY, loginSessionToken);
        sessionStorage.setItem(LOGIN_EXPIRY_KEY, String(session.expiresAt));
        loginPasswordInput.value = "";
        showLoginMessage("");
        hideLoginOverlay();
        startLoginLogoutTimer(Number(session.expiresAt));
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        showLoginMessage("ตรวจสอบสิทธิ์ Login ไม่สำเร็จ กรุณาตรวจสอบ Firebase Rules");
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "เข้าสู่ระบบ";
    }
}

let loginIsLoggingOut = false;

async function logoutFromLoginSystem(isTimeout = false) {
    if (loginIsLoggingOut) return;
    loginIsLoggingOut = true;
    clearTimeout(loginLogoutTimer);

    // ใช้ token ที่บันทึกไว้ตอนล็อกอินจริง ไม่สร้าง token ใหม่ก่อนปล่อย lock
    const tokenToRelease = sessionStorage.getItem(LOGIN_TOKEN_KEY) || loginSessionToken;
    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "กำลังออกจากระบบ...";
    }
    showLoginOverlay();
    showLoginMessage("กำลังออกจากระบบ กรุณารอสักครู่...");

    try {
        await waitForFirebaseLogin();
        const result = await LOGIN_LOCK_REF.transaction(currentSession => {
            // ลบเฉพาะ lock ของ session นี้เท่านั้น ห้ามลบของผู้ใช้อื่น
            if (!currentSession || currentSession.token === tokenToRelease) return null;
            return; // มี token คนอื่นอยู่ จึงไม่เขียนทับ
        }, undefined, false);

        const remainingSession = result.snapshot.val();
        if (remainingSession && remainingSession.token === tokenToRelease) {
            throw new Error("Session lock ยังไม่ถูกปล่อย");
        }

        sessionStorage.removeItem(LOGIN_TOKEN_KEY);
        sessionStorage.removeItem(LOGIN_EXPIRY_KEY);
        loginSessionToken = createLoginToken();
        if (loginPasswordInput) loginPasswordInput.value = "";
        showLoginMessage(remainingSession
            ? "ออกจากระบบแล้ว แต่พบ session อื่นกำลังใช้งานอยู่ กรุณารอให้ session นั้นหมดอายุ"
            : (isTimeout ? "หมดเวลาการใช้งาน 10 นาที กรุณาเข้าสู่ระบบใหม่" : "ออกจากระบบแล้ว กรุณาเข้าสู่ระบบอีกครั้ง"));
    } catch (error) {
        console.error("LOGIN LOCK RELEASE ERROR:", error);
        showLoginMessage("ออกจากระบบไม่สำเร็จ จึงยังไม่สามารถปลดล็อกการใช้งานได้ กรุณาตรวจสอบอินเทอร์เน็ตและ Firebase Rules แล้วลองใหม่");
        // คง token เดิมไว้ เพื่อไม่ให้หน้าเว็บเข้าใจผิดว่า lock ถูกปล่อยแล้ว
    } finally {
        loginIsLoggingOut = false;
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = "เข้าสู่ระบบ";
        }
    }
}

if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);
restoreLoginSession();


// const firebaseConfig = {
//     apiKey: "AIzaSyCZ9G_megeqZ1GN8zqfGAKuml1LKrhZDHk",
//     databaseURL: "https://smart-water-tamco-default-rtdb.asia-southeast1.firebasedatabase.app/"
// };

// firebase.initializeApp(firebaseConfig);

// const db = firebase.database();

// let sensorData = {};
// let systemRunning = false;
// let currentMode = "manual";
// let currentStartTime = null;

// let valveStates = {
//     valve1: false,
//     valve2: false,
//     valve3: false
// };

// let selectedValves = {
//     valve1: false,
//     valve2: false,
//     valve3: false
// };

// firebase.auth()
//     .signInAnonymously()
//     .then(() => {
//         startFirebaseListeners();
//     })
//     .catch(error => {
//         console.error(error);
//         showToast("ไม่สามารถเชื่อมต่อระบบได้");
//     });

// function startFirebaseListeners() {

//     db.ref(".info/connected").on("value", snapshot => {

//         const connected = snapshot.val() === true;

//         const dot = document.getElementById("firebaseDot");
//         const text = document.getElementById("firebaseText");
//         const badge = document.getElementById("connectionBadge");

//         if (connected) {

//             if (dot) dot.className = "status-dot online";
//             if (text) text.textContent = "ออนไลน์";

//             if (badge) {
//                 badge.textContent = "ออนไลน์";
//                 badge.className = "mini-status online";
//             }

//         } else {

//             if (dot) dot.className = "status-dot offline";
//             if (text) text.textContent = "ออฟไลน์";

//             if (badge) {
//                 badge.textContent = "ออฟไลน์";
//                 badge.className = "mini-status";
//             }
//         }
//     });

//     db.ref("/sensor").on("value", snapshot => {

//         sensorData = snapshot.val() || {};

//         updateSensorDisplay();
//     });

//     db.ref("/control").on("value", snapshot => {

//         const data = snapshot.val() || {};

//         updateControlDisplay(data);
//     });

//     db.ref("/settings/auto").on("value", snapshot => {

//         loadAutoSettings(snapshot.val() || {});
//     });
// }

// function updateSensorDisplay() {

//     const soil = Number(sensorData.soilMoisture);

//     if (!isNaN(soil)) {

//         document.getElementById("soilValue").textContent =
//             Math.round(soil);

//         updateSoilCondition(soil);
//     }

//     if (sensorData.temperature !== undefined) {

//         document.getElementById("tempValue").textContent =
//             Number(sensorData.temperature).toFixed(1);
//     }

//     if (sensorData.humidity !== undefined) {

//         document.getElementById("humidityValue").textContent =
//             Number(sensorData.humidity).toFixed(0);
//     }

//     if (sensorData.externalTemperature !== undefined) {

//         document.getElementById("externalTemp").textContent =
//             Number(sensorData.externalTemperature).toFixed(1);
//     }

//     const fanStatus = document.getElementById("fanStatus");
//     const fanBadge = document.getElementById("fanBadge");
//     const fanSettings = document.getElementById("fanSettingsText");

//     if (sensorData.fan === true) {

//         if (fanStatus) fanStatus.textContent = "กำลังทำงาน";

//         if (fanBadge) {
//             fanBadge.textContent = "ทำงาน";
//             fanBadge.className = "mini-status active";
//         }

//         if (fanSettings) {
//             fanSettings.textContent = "กำลังทำงาน";
//         }

//     } else {

//         if (fanStatus) fanStatus.textContent = "ปิดอยู่";

//         if (fanBadge) {
//             fanBadge.textContent = "ปิด";
//             fanBadge.className = "mini-status";
//         }

//         if (fanSettings) {
//             fanSettings.textContent = "ปิดอยู่";
//         }
//     }

//     updateDeviceStatus();

//     if (sensorData.lastHeartbeat) {

//         const date = new Date(Number(sensorData.lastHeartbeat));

//         const time = date.toLocaleTimeString("th-TH", {
//             hour: "2-digit",
//             minute: "2-digit",
//             second: "2-digit"
//         });

//         const lastUpdate = document.getElementById("lastUpdate");

//         if (lastUpdate) {
//             lastUpdate.textContent = time;
//         }
//     }
// }

// function updateDeviceStatus() {

//     const dot = document.getElementById("deviceDot");
//     const text = document.getElementById("deviceText");
//     const settingsText = document.getElementById("deviceSettingsText");

//     const ready = sensorData.deviceReady === true;

//     let heartbeatOK = false;

//     if (sensorData.lastHeartbeat) {

//         heartbeatOK =
//             Date.now() - Number(sensorData.lastHeartbeat) < 20000;
//     }

//     if (ready && heartbeatOK) {

//         if (dot) dot.className = "status-dot online";

//         if (text) text.textContent = "อุปกรณ์พร้อม";

//         if (settingsText) {
//             settingsText.textContent = "พร้อมใช้งาน";
//         }

//     } else {

//         if (dot) dot.className = "status-dot offline";

//         if (text) text.textContent = "อุปกรณ์ไม่พร้อม";

//         if (settingsText) {
//             settingsText.textContent = "ไม่พร้อมใช้งาน";
//         }
//     }
// }

// function updateSoilCondition(soil) {

//     const element =
//         document.getElementById("soilCondition");

//     if (!element) return;

//     if (soil < 35) {

//         element.textContent = "ดินค่อนข้างแห้ง";

//     } else if (soil < 45) {

//         element.textContent = "ความชื้นปานกลาง";

//     } else {

//         element.textContent = "ความชื้นเพียงพอ";
//     }
// }

// function updateControlDisplay(data) {

//     const wasRunning = systemRunning;

//     systemRunning = data.system === true;

//     currentMode = data.mode || "manual";

//     valveStates.valve1 = data.valve1 === true;
//     valveStates.valve2 = data.valve2 === true;
//     valveStates.valve3 = data.valve3 === true;

//     if (!wasRunning && systemRunning) {
//         currentStartTime = Date.now();
//     }

//     if (!systemRunning) {
//         currentStartTime = null;
//     }

//     updateSystemDisplay();
//     updateValveDisplay();
//     updateModeDisplay();

//     if (!systemRunning) {
//         updateSelectionDisplay();
//     }
// }

// function updateSystemDisplay() {

//     const title =
//         document.getElementById("systemStatus");

//     const message =
//         document.getElementById("systemSubStatus");

//     const zone =
//         document.getElementById("activeZone");

//     const active = [];

//     if (valveStates.valve1) active.push("วาล์ว 1");
//     if (valveStates.valve2) active.push("วาล์ว 2");
//     if (valveStates.valve3) active.push("วาล์ว 3");

//     if (systemRunning && active.length > 0) {

//         if (title) {
//             title.textContent = "กำลังรดน้ำ";
//             title.className = "system-pill running";
//         }

//         if (message) {
//             message.textContent = "ระบบกำลังทำงาน";
//         }

//         if (zone) {
//             zone.textContent = active.join(" + ");
//         }

//     } else {

//         if (title) {
//             title.textContent = "หยุดทำงาน";
//             title.className = "system-pill";
//         }

//         if (message) {
//             message.textContent = "ระบบพร้อมใช้งาน";
//         }

//         if (zone) {
//             zone.textContent = "ยังไม่มีวาล์วทำงาน";
//         }
//     }
// }

// function updateValveDisplay() {

//     updateHomeValve(1, valveStates.valve1);
//     updateHomeValve(2, valveStates.valve2);
//     updateHomeValve(3, valveStates.valve3);

//     updateControlValveState(1);
//     updateControlValveState(2);
//     updateControlValveState(3);
// }

// function updateHomeValve(number, state) {

//     const element =
//         document.getElementById("homeZone" + number);

//     const stateText =
//         document.getElementById("homeZoneState" + number);

//     if (state) {

//         if (element) {
//             element.classList.add("active");
//         }

//         if (stateText) {
//             stateText.textContent = "กำลังรดน้ำ";
//         }

//     } else {

//         if (element) {
//             element.classList.remove("active");
//         }

//         if (stateText) {
//             stateText.textContent = "ปิด";
//         }
//     }
// }

// function updateControlValveState(number) {

//     const key = "valve" + number;

//     const button =
//         document.getElementById("controlZone" + number);

//     const stateText =
//         document.getElementById("controlZoneState" + number);

//     const switchElement =
//         document.getElementById("valveSwitch" + number);

//     const selected = selectedValves[key];

//     if (selected) {

//         if (button) {
//             button.classList.add("selected");
//         }

//         if (switchElement) {
//             switchElement.classList.add("selected");
//         }

//         if (stateText) {
//             stateText.textContent = "เลือกแล้ว";
//         }

//     } else {

//         if (button) {
//             button.classList.remove("selected");
//         }

//         if (switchElement) {
//             switchElement.classList.remove("selected");
//         }

//         if (stateText) {
//             stateText.textContent = "ไม่ได้เลือก";
//         }
//     }

//     if (systemRunning && valveStates[key]) {

//         if (button) {
//             button.classList.add("running");
//         }

//         if (stateText) {
//             stateText.textContent = "กำลังรดน้ำ";
//         }

//     } else {

//         if (button) {
//             button.classList.remove("running");
//         }
//     }
// }

// function selectValve(number) {

//     if (currentMode !== "manual") {

//         showToast("โหมด AUTO ไม่สามารถเลือกวาล์วเองได้");

//         return;
//     }

//     if (systemRunning) {

//         showToast("ระบบกำลังทำงาน กดหยุดก่อน");

//         return;
//     }

//     const key = "valve" + number;

//     selectedValves[key] =
//         !selectedValves[key];

//     updateSelectionDisplay();
// }

// function updateSelectionDisplay() {

//     updateControlValveState(1);
//     updateControlValveState(2);
//     updateControlValveState(3);

//     const selected = [];

//     if (selectedValves.valve1) {
//         selected.push("วาล์ว 1");
//     }

//     if (selectedValves.valve2) {
//         selected.push("วาล์ว 2");
//     }

//     if (selectedValves.valve3) {
//         selected.push("วาล์ว 3");
//     }

//     const summary =
//         document.getElementById("selectedSummary");

//     const description =
//         document.getElementById("selectionDescription");

//     if (selected.length === 0) {

//         if (summary) {
//             summary.textContent =
//                 "ยังไม่ได้เลือกวาล์ว";
//         }

//         if (description) {
//             description.textContent =
//                 "แตะวาล์วเพื่อเลือกพื้นที่ที่ต้องการรดน้ำ";
//         }

//     } else {

//         if (summary) {
//             summary.textContent =
//                 "เลือก: " + selected.join(" + ");
//         }

//         if (description) {
//             description.textContent =
//                 "กดปุ่ม เริ่มทำงาน เพื่อเริ่มรดน้ำ";
//         }
//     }

//     updateStartButton();
// }

// function updateStartButton() {

//     const button =
//         document.getElementById("startButton");

//     if (!button) return;

//     const hasSelection =
//         selectedValves.valve1 ||
//         selectedValves.valve2 ||
//         selectedValves.valve3;

//     if (currentMode !== "manual") {

//         button.disabled = true;
//         button.classList.add("disabled");
//         button.innerHTML = "<span>⚙</span> AUTO ทำงานอัตโนมัติ";

//         return;
//     }

//     if (systemRunning) {

//         button.disabled = true;
//         button.classList.add("disabled");
//         button.innerHTML = "<span>●</span> ระบบกำลังทำงาน";

//         return;
//     }

//     if (!hasSelection) {

//         button.disabled = true;
//         button.classList.add("disabled");
//         button.innerHTML = "<span>▶</span> เลือกวาล์วก่อนเริ่ม";

//         return;
//     }

//     button.disabled = false;
//     button.classList.remove("disabled");
//     button.innerHTML = "<span>▶</span> เริ่มทำงาน";
// }

// function startSystem() {

//     if (currentMode !== "manual") {

//         showToast("กรุณาใช้ MANUAL สำหรับสั่งวาล์วเอง");

//         return;
//     }

//     if (systemRunning) {

//         showToast("ระบบกำลังทำงานอยู่");

//         return;
//     }

//     const hasSelection =
//         selectedValves.valve1 ||
//         selectedValves.valve2 ||
//         selectedValves.valve3;

//     if (!hasSelection) {

//         showToast("กรุณาเลือกวาล์วก่อนเริ่มทำงาน");

//         return;
//     }

//     const control = {
//         system: true,
//         mode: "manual",
//         valve1: selectedValves.valve1,
//         valve2: selectedValves.valve2,
//         valve3: selectedValves.valve3
//     };

//     db.ref("/control")
//         .update(control)
//         .then(() => {

//             showToast("เริ่มระบบรดน้ำแล้ว");

//         })
//         .catch(error => {

//             console.error("START ERROR:", error);

//             showToast("ไม่สามารถเริ่มระบบได้");
//         });
// }

// function stopSystem() {

//     const control = {
//         system: false,
//         mode: "manual",
//         valve1: false,
//         valve2: false,
//         valve3: false
//     };

//     db.ref("/control")
//         .update(control)
//         .then(() => {

//             selectedValves.valve1 = false;
//             selectedValves.valve2 = false;
//             selectedValves.valve3 = false;

//             updateSelectionDisplay();

//             showToast("หยุดระบบทั้งหมดแล้ว");

//         })
//         .catch(error => {

//             console.error("STOP ERROR:", error);

//             showToast("ไม่สามารถหยุดระบบได้");
//         });
// }

// function setMode(mode) {

//     if (systemRunning) {

//         showToast("กรุณาหยุดระบบก่อนเปลี่ยนโหมด");

//         return;
//     }

//     db.ref("/control")
//         .update({
//             mode: mode
//         })
//         .then(() => {

//             currentMode = mode;

//             if (mode === "auto") {

//                 selectedValves.valve1 = false;
//                 selectedValves.valve2 = false;
//                 selectedValves.valve3 = false;

//                 showToast("เปลี่ยนเป็น AUTO");

//             } else {

//                 showToast("เปลี่ยนเป็น MANUAL");
//             }

//             updateSelectionDisplay();
//             updateModeDisplay();
//         })
//         .catch(error => {

//             console.error("MODE ERROR:", error);

//             showToast("ไม่สามารถเปลี่ยนโหมดได้");
//         });
// }

// function updateModeDisplay() {

//     const manual =
//         document.getElementById("manualModeButton");

//     const auto =
//         document.getElementById("autoModeButton");

//     const description =
//         document.getElementById("modeDescription");

//     const modeStatus =
//         document.getElementById("modeStatus");

//     if (currentMode === "auto") {

//         if (manual) {
//             manual.classList.remove("active");
//         }

//         if (auto) {
//             auto.classList.add("active");
//         }

//         if (description) {
//             description.textContent =
//                 "ระบบควบคุมการรดน้ำอัตโนมัติ";
//         }

//         if (modeStatus) {
//             modeStatus.textContent = "AUTO";
//         }

//     } else {

//         if (auto) {
//             auto.classList.remove("active");
//         }

//         if (manual) {
//             manual.classList.add("active");
//         }

//         if (description) {
//             description.textContent =
//                 "เลือกวาล์ว แล้วกดเริ่มทำงาน";
//         }

//         if (modeStatus) {
//             modeStatus.textContent = "MANUAL";
//         }
//     }

//     updateStartButton();
// }

// function loadAutoSettings(data) {

//     if (data.time1) {

//         document.getElementById("autoTime1").value =
//             data.time1;
//     }

//     if (data.time2) {

//         document.getElementById("autoTime2").value =
//             data.time2;
//     }

//     if (data.time3) {

//         document.getElementById("autoTime3").value =
//             data.time3;
//     }

//     if (data.soilSetpoint !== undefined) {

//         const value =
//             Number(data.soilSetpoint);

//         document.getElementById("soilSetpoint").value =
//             value;

//         document.getElementById("thresholdSlider").value =
//             value;

//         document.getElementById("thresholdValue").textContent =
//             value + "%";
//     }

//     if (data.duration !== undefined) {

//         document.getElementById("wateringDuration").value =
//             Number(data.duration);
//     }
// }

// function saveAutoSettings() {

//     const time1 =
//         document.getElementById("autoTime1").value;

//     const time2 =
//         document.getElementById("autoTime2").value;

//     const time3 =
//         document.getElementById("autoTime3").value;

//     const soilSetpoint =
//         Number(document.getElementById("soilSetpoint").value);

//     const duration =
//         Number(document.getElementById("wateringDuration").value);

//     if (!time1 || !time2 || !time3) {

//         showToast("กรุณากำหนดเวลาให้ครบ 3 เวลา");

//         return;
//     }

//     if (soilSetpoint < 1 || soilSetpoint > 100) {

//         showToast("ค่าความชื้นต้องอยู่ระหว่าง 1-100%");

//         return;
//     }

//     if (duration < 1 || duration > 120) {

//         showToast("เวลารดน้ำต้องอยู่ระหว่าง 1-120 นาที");

//         return;
//     }

//     db.ref("/settings/auto")
//         .update({
//             time1: time1,
//             time2: time2,
//             time3: time3,
//             soilSetpoint: soilSetpoint,
//             duration: duration
//         })
//         .then(() => {

//             const message =
//                 document.getElementById("saveMessage");

//             message.textContent =
//                 "บันทึกการตั้งค่าเรียบร้อยแล้ว";

//             showToast("บันทึกการตั้งค่าแล้ว");

//             setTimeout(() => {

//                 message.textContent = "";

//             }, 3000);
//         })
//         .catch(error => {

//             console.error("SAVE ERROR:", error);

//             showToast("ไม่สามารถบันทึกการตั้งค่าได้");
//         });
// }

// function showPage(page) {

//     const pages = {
//         home: "pageHome",
//         control: "pageControl",
//         schedule: "pageSchedule",
//         settings: "pageSettings"
//     };

//     Object.values(pages).forEach(id => {

//         document
//             .getElementById(id)
//             .classList.remove("active");
//     });

//     document
//         .getElementById(pages[page])
//         .classList.add("active");

//     document
//         .querySelectorAll(".nav-item")
//         .forEach(item => {
//             item.classList.remove("active");
//         });

//     const navMap = {
//         home: "navHome",
//         control: "navControl",
//         schedule: "navSchedule",
//         settings: "navSettings"
//     };

//     document
//         .getElementById(navMap[page])
//         .classList.add("active");

//     window.scrollTo({
//         top: 0,
//         behavior: "smooth"
//     });
// }

// function showToast(message) {

//     const toast =
//         document.getElementById("toast");

//     toast.textContent = message;

//     toast.classList.add("show");

//     clearTimeout(window.toastTimer);

//     window.toastTimer =
//         setTimeout(() => {

//             toast.classList.remove("show");

//         }, 2200);
// }

// const thresholdSlider =
//     document.getElementById("thresholdSlider");

// const soilSetpoint =
//     document.getElementById("soilSetpoint");

// const thresholdValue =
//     document.getElementById("thresholdValue");

// thresholdSlider.addEventListener("input", () => {

//     const value =
//         thresholdSlider.value;

//     soilSetpoint.value =
//         value;

//     thresholdValue.textContent =
//         value + "%";
// });

// soilSetpoint.addEventListener("input", () => {

//     let value =
//         Number(soilSetpoint.value);

//     if (value < 1) value = 1;

//     if (value > 100) value = 100;

//     thresholdSlider.value =
//         value;

//     thresholdValue.textContent =
//         value + "%";
// });

// function updateDate() {

//     const date = new Date();

//     const text =
//         date.toLocaleDateString("th-TH", {
//             weekday: "long",
//             day: "numeric",
//             month: "long",
//             year: "numeric"
//         });

//     document.getElementById("todayDate").textContent =
//         text;
// }

// updateDate();

// setInterval(() => {

//     const runTime =
//         document.getElementById("runTime");

//     if (!systemRunning || !currentStartTime) {

//         runTime.textContent = "--";

//         return;
//     }

//     const elapsed =
//         Date.now() - currentStartTime;

//     const totalSeconds =
//         Math.floor(elapsed / 1000);

//     const minutes =
//         Math.floor(totalSeconds / 60);

//     const seconds =
//         totalSeconds % 60;

//     runTime.textContent =
//         "ทำงานมา " +
//         String(minutes).padStart(2, "0") +
//         ":" +
//         String(seconds).padStart(2, "0");

// }, 1000);
