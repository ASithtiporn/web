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

let valveStates = {
    valve1: false,
    valve2: false,
    valve3: false
};

let selectedValves = {
    valve1: false,
    valve2: false,
    valve3: false
};

firebase.auth()
    .signInAnonymously()
    .then(() => {
        startFirebaseListeners();
    })
    .catch(error => {
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

            if (badge) {
                badge.textContent = "ออนไลน์";
                badge.className = "mini-status online";
            }

        } else {

            if (dot) dot.className = "status-dot offline";
            if (text) text.textContent = "ออฟไลน์";

            if (badge) {
                badge.textContent = "ออฟไลน์";
                badge.className = "mini-status";
            }
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

        document.getElementById("soilValue").textContent =
            Math.round(soil);

        updateSoilCondition(soil);
    }

    if (sensorData.temperature !== undefined) {

        document.getElementById("tempValue").textContent =
            Number(sensorData.temperature).toFixed(1);
    }

    if (sensorData.humidity !== undefined) {

        document.getElementById("humidityValue").textContent =
            Number(sensorData.humidity).toFixed(0);
    }

    if (sensorData.externalTemperature !== undefined) {

        document.getElementById("externalTemp").textContent =
            Number(sensorData.externalTemperature).toFixed(1);
    }

    const fanStatus = document.getElementById("fanStatus");
    const fanBadge = document.getElementById("fanBadge");
    const fanSettings = document.getElementById("fanSettingsText");

    if (sensorData.fan === true) {

        if (fanStatus) fanStatus.textContent = "กำลังทำงาน";

        if (fanBadge) {
            fanBadge.textContent = "ทำงาน";
            fanBadge.className = "mini-status active";
        }

        if (fanSettings) {
            fanSettings.textContent = "กำลังทำงาน";
        }

    } else {

        if (fanStatus) fanStatus.textContent = "ปิดอยู่";

        if (fanBadge) {
            fanBadge.textContent = "ปิด";
            fanBadge.className = "mini-status";
        }

        if (fanSettings) {
            fanSettings.textContent = "ปิดอยู่";
        }
    }

    updateDeviceStatus();

    if (sensorData.lastHeartbeat) {

        const date = new Date(Number(sensorData.lastHeartbeat));

        const time = date.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        const lastUpdate = document.getElementById("lastUpdate");

        if (lastUpdate) {
            lastUpdate.textContent = time;
        }
    }
}

function updateDeviceStatus() {

    const dot = document.getElementById("deviceDot");
    const text = document.getElementById("deviceText");
    const settingsText = document.getElementById("deviceSettingsText");

    const ready = sensorData.deviceReady === true;

    let heartbeatOK = false;

    if (sensorData.lastHeartbeat) {

        heartbeatOK =
            Date.now() - Number(sensorData.lastHeartbeat) < 20000;
    }

    if (ready && heartbeatOK) {

        if (dot) dot.className = "status-dot online";

        if (text) text.textContent = "อุปกรณ์พร้อม";

        if (settingsText) {
            settingsText.textContent = "พร้อมใช้งาน";
        }

    } else {

        if (dot) dot.className = "status-dot offline";

        if (text) text.textContent = "อุปกรณ์ไม่พร้อม";

        if (settingsText) {
            settingsText.textContent = "ไม่พร้อมใช้งาน";
        }
    }
}

function updateSoilCondition(soil) {

    const element =
        document.getElementById("soilCondition");

    if (!element) return;

    if (soil < 35) {

        element.textContent = "ดินค่อนข้างแห้ง";

    } else if (soil < 45) {

        element.textContent = "ความชื้นปานกลาง";

    } else {

        element.textContent = "ความชื้นเพียงพอ";
    }
}

function updateControlDisplay(data) {

    const wasRunning = systemRunning;

    systemRunning = data.system === true;

    currentMode = data.mode || "manual";

    valveStates.valve1 = data.valve1 === true;
    valveStates.valve2 = data.valve2 === true;
    valveStates.valve3 = data.valve3 === true;

    if (!wasRunning && systemRunning) {
        currentStartTime = Date.now();
    }

    if (!systemRunning) {
        currentStartTime = null;
    }

    updateSystemDisplay();
    updateValveDisplay();
    updateModeDisplay();

    if (!systemRunning) {
        updateSelectionDisplay();
    }
}

function updateSystemDisplay() {

    const title =
        document.getElementById("systemStatus");

    const message =
        document.getElementById("systemSubStatus");

    const zone =
        document.getElementById("activeZone");

    const active = [];

    if (valveStates.valve1) active.push("วาล์ว 1");
    if (valveStates.valve2) active.push("วาล์ว 2");
    if (valveStates.valve3) active.push("วาล์ว 3");

    if (systemRunning && active.length > 0) {

        if (title) {
            title.textContent = "กำลังรดน้ำ";
            title.className = "system-pill running";
        }

        if (message) {
            message.textContent = "ระบบกำลังทำงาน";
        }

        if (zone) {
            zone.textContent = active.join(" + ");
        }

    } else {

        if (title) {
            title.textContent = "หยุดทำงาน";
            title.className = "system-pill";
        }

        if (message) {
            message.textContent = "ระบบพร้อมใช้งาน";
        }

        if (zone) {
            zone.textContent = "ยังไม่มีวาล์วทำงาน";
        }
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

    const element =
        document.getElementById("homeZone" + number);

    const stateText =
        document.getElementById("homeZoneState" + number);

    if (state) {

        if (element) {
            element.classList.add("active");
        }

        if (stateText) {
            stateText.textContent = "กำลังรดน้ำ";
        }

    } else {

        if (element) {
            element.classList.remove("active");
        }

        if (stateText) {
            stateText.textContent = "ปิด";
        }
    }
}

function updateControlValveState(number) {

    const key = "valve" + number;

    const button =
        document.getElementById("controlZone" + number);

    const stateText =
        document.getElementById("controlZoneState" + number);

    const switchElement =
        document.getElementById("valveSwitch" + number);

    const selected = selectedValves[key];

    if (selected) {

        if (button) {
            button.classList.add("selected");
        }

        if (switchElement) {
            switchElement.classList.add("selected");
        }

        if (stateText) {
            stateText.textContent = "เลือกแล้ว";
        }

    } else {

        if (button) {
            button.classList.remove("selected");
        }

        if (switchElement) {
            switchElement.classList.remove("selected");
        }

        if (stateText) {
            stateText.textContent = "ไม่ได้เลือก";
        }
    }

    if (systemRunning && valveStates[key]) {

        if (button) {
            button.classList.add("running");
        }

        if (stateText) {
            stateText.textContent = "กำลังรดน้ำ";
        }

    } else {

        if (button) {
            button.classList.remove("running");
        }
    }
}

function selectValve(number) {

    if (currentMode !== "manual") {

        showToast("โหมด AUTO ไม่สามารถเลือกวาล์วเองได้");

        return;
    }

    if (systemRunning) {

        showToast("ระบบกำลังทำงาน กดหยุดก่อน");

        return;
    }

    const key = "valve" + number;

    selectedValves[key] =
        !selectedValves[key];

    updateSelectionDisplay();
}

function updateSelectionDisplay() {

    updateControlValveState(1);
    updateControlValveState(2);
    updateControlValveState(3);

    const selected = [];

    if (selectedValves.valve1) {
        selected.push("วาล์ว 1");
    }

    if (selectedValves.valve2) {
        selected.push("วาล์ว 2");
    }

    if (selectedValves.valve3) {
        selected.push("วาล์ว 3");
    }

    const summary =
        document.getElementById("selectedSummary");

    const description =
        document.getElementById("selectionDescription");

    if (selected.length === 0) {

        if (summary) {
            summary.textContent =
                "ยังไม่ได้เลือกวาล์ว";
        }

        if (description) {
            description.textContent =
                "แตะวาล์วเพื่อเลือกพื้นที่ที่ต้องการรดน้ำ";
        }

    } else {

        if (summary) {
            summary.textContent =
                "เลือก: " + selected.join(" + ");
        }

        if (description) {
            description.textContent =
                "กดปุ่ม เริ่มทำงาน เพื่อเริ่มรดน้ำ";
        }
    }

    updateStartButton();
}

function updateStartButton() {

    const button =
        document.getElementById("startButton");

    if (!button) return;

    const hasSelection =
        selectedValves.valve1 ||
        selectedValves.valve2 ||
        selectedValves.valve3;

    if (currentMode !== "manual") {

        button.disabled = true;
        button.classList.add("disabled");
        button.innerHTML = "<span>⚙</span> AUTO ทำงานอัตโนมัติ";

        return;
    }

    if (systemRunning) {

        button.disabled = true;
        button.classList.add("disabled");
        button.innerHTML = "<span>●</span> ระบบกำลังทำงาน";

        return;
    }

    if (!hasSelection) {

        button.disabled = true;
        button.classList.add("disabled");
        button.innerHTML = "<span>▶</span> เลือกวาล์วก่อนเริ่ม";

        return;
    }

    button.disabled = false;
    button.classList.remove("disabled");
    button.innerHTML = "<span>▶</span> เริ่มทำงาน";
}

function startSystem() {

    if (currentMode !== "manual") {

        showToast("กรุณาใช้ MANUAL สำหรับสั่งวาล์วเอง");

        return;
    }

    if (systemRunning) {

        showToast("ระบบกำลังทำงานอยู่");

        return;
    }

    const hasSelection =
        selectedValves.valve1 ||
        selectedValves.valve2 ||
        selectedValves.valve3;

    if (!hasSelection) {

        showToast("กรุณาเลือกวาล์วก่อนเริ่มทำงาน");

        return;
    }

    const control = {
        system: true,
        mode: "manual",
        valve1: selectedValves.valve1,
        valve2: selectedValves.valve2,
        valve3: selectedValves.valve3
    };

    db.ref("/control")
        .update(control)
        .then(() => {

            showToast("เริ่มระบบรดน้ำแล้ว");

        })
        .catch(error => {

            console.error("START ERROR:", error);

            showToast("ไม่สามารถเริ่มระบบได้");
        });
}

function stopSystem() {

    const control = {
        system: false,
        mode: "manual",
        valve1: false,
        valve2: false,
        valve3: false
    };

    db.ref("/control")
        .update(control)
        .then(() => {

            selectedValves.valve1 = false;
            selectedValves.valve2 = false;
            selectedValves.valve3 = false;

            updateSelectionDisplay();

            showToast("หยุดระบบทั้งหมดแล้ว");

        })
        .catch(error => {

            console.error("STOP ERROR:", error);

            showToast("ไม่สามารถหยุดระบบได้");
        });
}

function setMode(mode) {

    if (systemRunning) {

        showToast("กรุณาหยุดระบบก่อนเปลี่ยนโหมด");

        return;
    }

    db.ref("/control")
        .update({
            mode: mode
        })
        .then(() => {

            currentMode = mode;

            if (mode === "auto") {

                selectedValves.valve1 = false;
                selectedValves.valve2 = false;
                selectedValves.valve3 = false;

                showToast("เปลี่ยนเป็น AUTO");

            } else {

                showToast("เปลี่ยนเป็น MANUAL");
            }

            updateSelectionDisplay();
            updateModeDisplay();
        })
        .catch(error => {

            console.error("MODE ERROR:", error);

            showToast("ไม่สามารถเปลี่ยนโหมดได้");
        });
}

function updateModeDisplay() {

    const manual =
        document.getElementById("manualModeButton");

    const auto =
        document.getElementById("autoModeButton");

    const description =
        document.getElementById("modeDescription");

    const modeStatus =
        document.getElementById("modeStatus");

    if (currentMode === "auto") {

        if (manual) {
            manual.classList.remove("active");
        }

        if (auto) {
            auto.classList.add("active");
        }

        if (description) {
            description.textContent =
                "ระบบควบคุมการรดน้ำอัตโนมัติ";
        }

        if (modeStatus) {
            modeStatus.textContent = "AUTO";
        }

    } else {

        if (auto) {
            auto.classList.remove("active");
        }

        if (manual) {
            manual.classList.add("active");
        }

        if (description) {
            description.textContent =
                "เลือกวาล์ว แล้วกดเริ่มทำงาน";
        }

        if (modeStatus) {
            modeStatus.textContent = "MANUAL";
        }
    }

    updateStartButton();
}

function loadAutoSettings(data) {

    if (data.time1) {

        document.getElementById("autoTime1").value =
            data.time1;
    }

    if (data.time2) {

        document.getElementById("autoTime2").value =
            data.time2;
    }

    if (data.time3) {

        document.getElementById("autoTime3").value =
            data.time3;
    }

    if (data.soilSetpoint !== undefined) {

        const value =
            Number(data.soilSetpoint);

        document.getElementById("soilSetpoint").value =
            value;

        document.getElementById("thresholdSlider").value =
            value;

        document.getElementById("thresholdValue").textContent =
            value + "%";
    }

    if (data.duration !== undefined) {

        document.getElementById("wateringDuration").value =
            Number(data.duration);
    }
}

function saveAutoSettings() {

    const time1 =
        document.getElementById("autoTime1").value;

    const time2 =
        document.getElementById("autoTime2").value;

    const time3 =
        document.getElementById("autoTime3").value;

    const soilSetpoint =
        Number(document.getElementById("soilSetpoint").value);

    const duration =
        Number(document.getElementById("wateringDuration").value);

    if (!time1 || !time2 || !time3) {

        showToast("กรุณากำหนดเวลาให้ครบ 3 เวลา");

        return;
    }

    if (soilSetpoint < 1 || soilSetpoint > 100) {

        showToast("ค่าความชื้นต้องอยู่ระหว่าง 1-100%");

        return;
    }

    if (duration < 1 || duration > 120) {

        showToast("เวลารดน้ำต้องอยู่ระหว่าง 1-120 นาที");

        return;
    }

    db.ref("/settings/auto")
        .update({
            time1: time1,
            time2: time2,
            time3: time3,
            soilSetpoint: soilSetpoint,
            duration: duration
        })
        .then(() => {

            const message =
                document.getElementById("saveMessage");

            message.textContent =
                "บันทึกการตั้งค่าเรียบร้อยแล้ว";

            showToast("บันทึกการตั้งค่าแล้ว");

            setTimeout(() => {

                message.textContent = "";

            }, 3000);
        })
        .catch(error => {

            console.error("SAVE ERROR:", error);

            showToast("ไม่สามารถบันทึกการตั้งค่าได้");
        });
}

function showPage(page) {

    const pages = {
        home: "pageHome",
        control: "pageControl",
        schedule: "pageSchedule",
        settings: "pageSettings"
    };

    Object.values(pages).forEach(id => {

        document
            .getElementById(id)
            .classList.remove("active");
    });

    document
        .getElementById(pages[page])
        .classList.add("active");

    document
        .querySelectorAll(".nav-item")
        .forEach(item => {
            item.classList.remove("active");
        });

    const navMap = {
        home: "navHome",
        control: "navControl",
        schedule: "navSchedule",
        settings: "navSettings"
    };

    document
        .getElementById(navMap[page])
        .classList.add("active");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2200);
}

const thresholdSlider =
    document.getElementById("thresholdSlider");

const soilSetpoint =
    document.getElementById("soilSetpoint");

const thresholdValue =
    document.getElementById("thresholdValue");

thresholdSlider.addEventListener("input", () => {

    const value =
        thresholdSlider.value;

    soilSetpoint.value =
        value;

    thresholdValue.textContent =
        value + "%";
});

soilSetpoint.addEventListener("input", () => {

    let value =
        Number(soilSetpoint.value);

    if (value < 1) value = 1;

    if (value > 100) value = 100;

    thresholdSlider.value =
        value;

    thresholdValue.textContent =
        value + "%";
});

function updateDate() {

    const date = new Date();

    const text =
        date.toLocaleDateString("th-TH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    document.getElementById("todayDate").textContent =
        text;
}

updateDate();

setInterval(() => {

    const runTime =
        document.getElementById("runTime");

    if (!systemRunning || !currentStartTime) {

        runTime.textContent = "--";

        return;
    }

    const elapsed =
        Date.now() - currentStartTime;

    const totalSeconds =
        Math.floor(elapsed / 1000);

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;

    runTime.textContent =
        "ทำงานมา " +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");

}, 1000);