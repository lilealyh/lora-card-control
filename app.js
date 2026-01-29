import init, { SlipDecoder, OtaManager, build_rf_cfg, parse_packet_to_json, create_packet } from './pkg/slip_wasm.js';

const CMD_ID = { RDY: 0x01, LINK: 0x02, VERSION: 0x03, PRJ: 0x04, RF_CFG: 0x05, RF_ACT: 0x06, RF_RSSI: 0x07, RF_SUBCARD: 0x08, PRODUCT: 0x0A, DEV_FUN: 0x0B, DEV_FACTORY_CFG: 0xCD, DFU_ENTRY: 0xD0, DFU_INFO: 0xD2, DFU_DATA: 0xD5, DFU_STATE: 0xD8, CERT: 0xDA, FT_MODE: 0xC0, FT_LED: 0xC2, RF_LINK_TEST: 0x35, RFM_PERF: 0x31 };
const PKT_TYPE = { GET: 0x01, SET: 0x02, ACK: 0x10 };

let slip, port, reader, keepReading = true, wasmReady = false;

const elements = {
    connectBtn: document.getElementById('connectBtn'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    logContainer: document.getElementById('logContainer'),
    baudRate: document.getElementById('baudRate'),
    valHardVer: document.getElementById('valHardVer'),
    valAppVer: document.getElementById('valAppVer'),
    valSysStatus: document.getElementById('valSysStatus'),
    valLink: document.getElementById('valLink'),
    valRSSI: document.getElementById('valRSSI'),
    valAct: document.getElementById('valAct'),
    refreshAllBtn: document.getElementById('refreshAllBtn'),
    rfPower: document.getElementById('rfPower'),
    rfSF: document.getElementById('rfSF'),
    rfFreqRX: document.getElementById('rfFreqRX'),
    rfFreqTX0: document.getElementById('rfFreqTX0'),
    rfFreqTX1: document.getElementById('rfFreqTX1'),
    rfNet: document.getElementById('rfNet'),
    rfPeriod: document.getElementById('rfPeriod'),
    rfAntenna: document.getElementById('rfAntenna'),
    rfType: document.getElementById('rfType'),
    readRFBtn: document.getElementById('readRFBtn'),
    saveRFBtn: document.getElementById('saveRFBtn'),
    devMAC: document.getElementById('devMAC'),
    devSN: document.getElementById('devSN'),
    devUID: document.getElementById('devUID'),
    funReg: document.getElementById('funReg'),
    funCall: document.getElementById('funCall'),
    funSecLink: document.getElementById('funSecLink'),
    funElevMode: document.getElementById('funElevMode'),
    devActSet: document.getElementById('devActSet'),
    readDevBtn: document.getElementById('readDevBtn'),
    saveDevBtn: document.getElementById('saveDevBtn'),
    resetBtn: document.getElementById('resetBtn'),
    dfuBtn: document.getElementById('dfuBtn'),
    enterFtyBtn: document.getElementById('enterFtyBtn'),
    exitFtyBtn: document.getElementById('exitFtyBtn'),
    ledOnBtn: document.getElementById('ledOnBtn'),
    ledOffBtn: document.getElementById('ledOffBtn'),
    ltSlaveAddr: document.getElementById('ltSlaveAddr'),
    ltStartBtn: document.getElementById('ltStartBtn'),
    ltStopBtn: document.getElementById('ltStopBtn'),
    ltResult: document.getElementById('ltResult'),
    perfStartBtn: document.getElementById('perfStartBtn'),
    perfStopBtn: document.getElementById('perfStopBtn'),
    perfResult: document.getElementById('perfResult'),
    certRole: document.getElementById('certRole'),
    certType: document.getElementById('certType'),
    certCarrier: document.getElementById('certCarrier'),
    certFreq: document.getElementById('certFreq'),
    certPower: document.getElementById('certPower'),
    certPeriod: document.getElementById('certPeriod'),
    certStartBtn: document.getElementById('certStartBtn'),
    certStopBtn: document.getElementById('certStopBtn'),
    fwdCmdId: document.getElementById('fwdCmdId'),
    fwdType: document.getElementById('fwdType'),
    fwdData: document.getElementById('fwdData'),
    fwdSendBtn: document.getElementById('fwdSendBtn'),
    otaFile: document.getElementById('otaFile'),
    otaUrl: document.getElementById('otaUrl'),
    otaStartBtn: document.getElementById('otaStartBtn'),
    otaDownloadBtn: document.getElementById('otaDownloadBtn'),
    otaStatusContainer: document.getElementById('otaStatusContainer'),
    otaStatusText: document.getElementById('otaStatusText'),
    otaProgressText: document.getElementById('otaProgressText'),
    otaProgressBar: document.getElementById('otaProgressBar'),
    clearLogBtn: document.getElementById('clearLogBtn')
};

async function run() {
    if (!navigator.serial) { elements.connectBtn.disabled = true; elements.connectBtn.innerText = '浏览器不支持串口'; return; }
    try {
        await init(); slip = new SlipDecoder(); wasmReady = true;
        addLog('sys', 'SYSTEM', 'WASM 核心已就绪', '#22c55e');
    } catch (e) { addLog('sys', 'ERROR', 'WASM 加载失败', '#ef4444'); }
}
run();

function addLog(type, label, data, color = '') {
    const entry = document.createElement('div'); entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    let content = (data instanceof Uint8Array) ? Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ') : data;
    const style = color ? `style="color: ${color}"` : '';
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-dir-${type}" ${style}>${label}</span> <span class="log-data">${content}</span>`;
    elements.logContainer.appendChild(entry); elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    if (elements.logContainer.children.length > 500) elements.logContainer.removeChild(elements.logContainer.firstChild);
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active'); document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
    });
});

function setControlsEnabled(enabled) {
    const inputs = document.querySelectorAll('main input, main select, main textarea, main button');
    inputs.forEach(el => {
        if (el.id !== 'connectBtn') {
            el.disabled = !enabled;
            // 确保没有被意外屏蔽
            if (enabled) el.style.pointerEvents = 'auto';
        }
    });
}

function handlePacket(pkt) {
    const data = new Uint8Array(pkt.data);
    const idKey = Object.keys(CMD_ID).find(k => CMD_ID[k] === pkt.cmd_id) || pkt.cmd_id.toString(16);
    addLog('in', 'PACKET', `ID:${idKey} | Data: ${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}`, '#4facfe');

    const parsed = parse_packet_to_json(pkt.cmd_id, data);
    if (parsed) {
        console.log("Parsed Data:", parsed); // 关键调试信息
        if (parsed.hard_ver) {
            elements.valHardVer.innerText = String(parsed.hard_ver);
            elements.valAppVer.innerText = String(parsed.app_ver);
        }
        if (parsed.power !== undefined) {
            elements.rfPower.value = parsed.power;
            elements.rfFreqRX.value = parsed.freq_rx.toFixed(3);
            elements.rfFreqTX0.value = parsed.freq_tx0.toFixed(3);
            elements.rfFreqTX1.value = parsed.freq_tx1.toFixed(3);
            elements.rfSF.value = parsed.sf;
            elements.rfNet.value = parsed.net;
            elements.rfPeriod.value = parsed.period;
            elements.rfType.value = parsed.dev_type;
        }
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    switch (pkt.cmd_id) {
        case CMD_ID.RDY: elements.valSysStatus.innerText = data[0] === 1 ? 'Ready' : 'Normal'; break;
        case CMD_ID.LINK: elements.valLink.innerText = data[0] === 2 ? '已注册' : '未注册'; break;
        case CMD_ID.RF_ACT: elements.valAct.innerText = data[0] === 1 ? '已激活' : '未激活'; break;
        case CMD_ID.RF_RSSI: if (data.length >= 3) elements.valRSSI.innerText = `${view.getInt16(1, true)} dBm`; break;
        case CMD_ID.RF_SUBCARD: if (data.length >= 4) { elements.rfAntenna.value = data[0]; addLog('sys', 'SUBCARD', `Ant: ${data[0]}, FEM: ${data[1]}, Power: ${data[2]}~${data[3]}`); } break;
        case CMD_ID.DEV_FUN: if (data.length >= 2) { elements.funReg.checked = !!(data[0] & 0x01); elements.funCall.checked = !!(data[0] & 0x02); elements.funSecLink.checked = !(data[0] & 0x04); elements.funElevMode.value = data[1]; } break;
        case CMD_ID.DEV_FACTORY_CFG: if (data.length >= 32) {
            elements.devMAC.value = Array.from(data.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).reverse().join('').toUpperCase();
            const snData = data.slice(4, 20); const firstNull = snData.indexOf(0);
            elements.devSN.value = new TextDecoder().decode(firstNull === -1 ? snData : snData.slice(0, firstNull));
            elements.devUID.value = Array.from(data.slice(20, 32)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        } break;
        case CMD_ID.DFU_INFO: if (otaManager) sendCmd(CMD_ID.DFU_INFO, 0x10, Array.from(otaManager.get_info_resp()), pkt.sid); break;
        case CMD_ID.DFU_DATA: handleDfuDataReq(pkt); break;
        case CMD_ID.DFU_STATE: if (data.length >= 2) updateDfuState(data[1]); break;
    }
}

async function sendCmd(id, type, data = [], sid = 0xFE) {
    if (!port || !port.writable) return;
    const raw = create_packet(id, type, new Uint8Array(data), sid);
    const writer = port.writable.getWriter();
    await writer.write(new Uint8Array(raw)); writer.releaseLock();
    addLog('out', 'SEND', `ID:${id} | SID:0x${sid.toString(16).toUpperCase()} | Data:[${data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}]`, '#f59e0b');
}

function resetUIData() {
    // Stat cards
    elements.valHardVer.innerText = '--';
    elements.valAppVer.innerText = '--';
    elements.valSysStatus.innerText = '--';
    elements.valLink.innerText = '--';
    elements.valRSSI.innerText = '--';
    elements.valAct.innerText = '--';

    // RF Config
    elements.rfPower.value = '22';
    elements.rfSF.value = '9';
    elements.rfFreqRX.value = '2400.000';
    elements.rfFreqTX0.value = '2400.000';
    elements.rfFreqTX1.value = '2400.000';
    elements.rfNet.value = '0';
    elements.rfPeriod.value = '10';
    elements.rfAntenna.value = '0';
    elements.rfType.value = '0';

    // Device Info
    elements.devMAC.value = '';
    elements.devSN.value = '';
    elements.devUID.value = '';
    elements.funReg.checked = false;
    elements.funCall.checked = false;
    elements.funSecLink.checked = false;
    elements.funElevMode.value = '0';
    elements.devActSet.value = '0';

    // Test items
    elements.ltSlaveAddr.value = '00000000';
    elements.ltResult.innerText = '等待测试...';
    elements.perfResult.innerText = '速率: -- | PktCnt: -- | RxPktCnt: --';

    // OTA
    elements.otaProgressBar.style.width = '0%';
    elements.otaProgressBar.style.backgroundColor = 'var(--primary)';
    elements.otaProgressText.innerText = '0%';
    elements.otaStatusText.innerText = '等待升级';
    elements.otaStatusContainer.style.display = 'none';
}

elements.connectBtn.onclick = async () => {
    if (port) {
        keepReading = false; if (reader) await reader.cancel();
        await port.close(); port = null; elements.statusDot.classList.remove('connected');
        elements.statusText.innerText = '未连接'; elements.connectBtn.innerText = '连接设备';
        setControlsEnabled(false);
        resetUIData();
    } else {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: parseInt(elements.baudRate.value), flowControl: 'none' });
            elements.statusDot.classList.add('connected'); elements.statusText.innerText = '已连接';
            elements.connectBtn.innerText = '断开连接'; keepReading = true;
            (async () => {
                while (port && port.readable && keepReading) {
                    reader = port.readable.getReader();
                    try {
                        while (keepReading) {
                            const { value, done } = await reader.read(); if (done) break;
                            addLog('in', 'RAW RX', value, '#94a3b8');
                            for (const b of value) { const pkt = slip.decode_byte(b); if (pkt) handlePacket(pkt); }
                        }
                    } catch (e) { } finally { reader.releaseLock(); reader = null; }
                }
            })();
            setControlsEnabled(true); setTimeout(refreshAll, 500);
        } catch (e) { alert("连接失败: " + e.message); }
    }
};

async function refreshAll() {
    const sequence = [{ id: CMD_ID.VERSION, sid: 0xC9 }, { id: CMD_ID.DEV_FACTORY_CFG, sid: 0xCA }, { id: CMD_ID.RF_CFG, sid: 0xCB }, { id: CMD_ID.DEV_FUN, sid: 0xCC }, { id: CMD_ID.RF_ACT, sid: 0xCD }, { id: CMD_ID.RF_SUBCARD, sid: 0xCE }];
    for (const item of sequence) { await sendCmd(item.id, PKT_TYPE.GET, [], item.sid); await new Promise(r => setTimeout(r, 100)); }
}
elements.refreshAllBtn.onclick = refreshAll;
elements.clearLogBtn.onclick = () => { elements.logContainer.innerHTML = ''; };
elements.readRFBtn.onclick = () => sendCmd(CMD_ID.RF_CFG, PKT_TYPE.GET, [], 0xCB);
elements.saveRFBtn.onclick = () => {
    const raw = build_rf_cfg(parseInt(elements.rfPower.value), parseFloat(elements.rfFreqRX.value), parseFloat(elements.rfFreqTX0.value), parseFloat(elements.rfFreqTX1.value), parseInt(elements.rfSF.value), parseInt(elements.rfNet.value), parseInt(elements.rfPeriod.value), parseInt(elements.rfType.value));
    sendRaw(raw); addLog('out', 'SEND', `SAVE_RF_CFG`, '#f59e0b');
};
async function sendRaw(raw) { if (!port || !port.writable) return; const w = port.writable.getWriter(); await w.write(new Uint8Array(raw)); w.releaseLock(); }
elements.readDevBtn.onclick = () => sendCmd(CMD_ID.DEV_FACTORY_CFG, PKT_TYPE.GET, [], 0xCA);
elements.saveDevBtn.onclick = () => {
    const mac = elements.devMAC.value.padStart(8, '0').match(/.{2}/g).map(b => parseInt(b, 16)).reverse();
    const sn = Array.from(new TextEncoder().encode(elements.devSN.value.padEnd(16, '\0').substring(0, 16)));
    sendCmd(CMD_ID.DEV_FACTORY_CFG, PKT_TYPE.SET, [...mac, ...sn], 0xCA);
};
elements.resetBtn.onclick = () => sendCmd(CMD_ID.RDY, PKT_TYPE.SET, [0]);
elements.dfuBtn.onclick = () => sendCmd(CMD_ID.DFU_ENTRY, PKT_TYPE.SET, [0x01]);
elements.enterFtyBtn.onclick = () => sendCmd(CMD_ID.FT_MODE, PKT_TYPE.SET, [1]);
elements.exitFtyBtn.onclick = () => sendCmd(CMD_ID.FT_MODE, PKT_TYPE.SET, [0]);
elements.ledOnBtn.onclick = () => sendCmd(CMD_ID.FT_LED, PKT_TYPE.SET, [1]);
elements.ledOffBtn.onclick = () => sendCmd(CMD_ID.FT_LED, PKT_TYPE.SET, [0]);
elements.ltStartBtn.onclick = () => { const adr = elements.ltSlaveAddr.value.padStart(8, '0').match(/.{2}/g).map(b => parseInt(b, 16)).reverse(); sendCmd(CMD_ID.RF_LINK_TEST, PKT_TYPE.SET, [1, 0, 0, 0, 0, 0, ...adr, 0, 3, 10, 100, 0, 16]); };
elements.ltStopBtn.onclick = () => sendCmd(CMD_ID.RF_LINK_TEST, PKT_TYPE.SET, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
elements.perfStartBtn.onclick = () => sendCmd(CMD_ID.RFM_PERF, PKT_TYPE.SET, [1, 1]);
elements.perfStopBtn.onclick = () => sendCmd(CMD_ID.RFM_PERF, PKT_TYPE.SET, [1, 0]);
elements.fwdSendBtn.onclick = () => {
    const id = parseInt(elements.fwdCmdId.value, 16);
    const d = elements.fwdType.value === 'hex' ? elements.fwdData.value.trim().split(/\s+/).map(b => parseInt(b, 16)) : Array.from(new TextEncoder().encode(elements.fwdData.value));
    sendCmd(id, PKT_TYPE.SET, d);
};

// --- OTA and Mode State ---
let otaManager = null, otaResultShown = false, isOtaRunning = false, isCertRunning = false;

function setOtaUIState(active) {
    isOtaRunning = active;
    elements.otaStartBtn.disabled = active;
    elements.otaDownloadBtn.disabled = active;
    elements.otaFile.disabled = active;
    elements.otaUrl.disabled = active;
    if (active) elements.otaStatusContainer.style.display = 'block';
}

function setCertUIState(active) {
    isCertRunning = active;
    elements.certStartBtn.disabled = active;
    elements.certStopBtn.disabled = !active;
    elements.certRole.disabled = active;
    elements.certType.disabled = active;
    elements.certCarrier.disabled = active;
    elements.certFreq.disabled = active;
    elements.certPower.disabled = active;
    elements.certPeriod.disabled = active;
}

function updateDfuState(s) {
    const msg = { 3: '正在擦除...', 4: '传输数据...', 5: '升级成功！设备即将复位', 6: '升级失败' };
    elements.otaStatusText.innerText = msg[s] || `状态:${s}`;
    if (s === 5 && !otaResultShown) {
        otaResultShown = true;
        setOtaUIState(false);
        elements.otaProgressBar.style.backgroundColor = 'var(--success)';
        alert("升级完成");
        setTimeout(() => sendCmd(CMD_ID.VERSION, PKT_TYPE.GET, [], 0xC9), 2000);
    } else if (s === 6 && !otaResultShown) {
        otaResultShown = true;
        setOtaUIState(false);
        elements.otaProgressBar.style.backgroundColor = 'var(--error)';
    }
}

async function handleDfuDataReq(pkt) {
    if (!otaManager) return;
    const v = new DataView(new Uint8Array(pkt.data).buffer), idx = v.getUint32(1, true), len = v.getUint16(5, true);
    const chk = otaManager.get_data_chunk(idx, len);
    if (!chk) return;
    const p = otaManager.get_progress(idx, len);
    elements.otaProgressBar.style.width = `${p}%`;
    elements.otaProgressText.innerText = `${p}%`;
    elements.otaStatusText.innerText = '正在传输数据...';
    await sendCmd(CMD_ID.DFU_DATA, 0x10, Array.from(chk), pkt.sid);
}

elements.otaFile.onchange = () => { otaManager = null; };

elements.otaStartBtn.onclick = async () => {
    if (isOtaRunning) return;
    if (!otaManager) {
        if (elements.otaFile.files.length === 0) { alert("请先选择固件文件"); return; }
        const buf = new Uint8Array(await elements.otaFile.files[0].arrayBuffer());
        otaManager = new OtaManager(buf, 0x01);
    }
    otaResultShown = false;
    setOtaUIState(true);
    await sendCmd(CMD_ID.DFU_ENTRY, PKT_TYPE.SET, [0x01]);
};

elements.otaDownloadBtn.onclick = async () => {
    if (isOtaRunning) return;
    const url = elements.otaUrl.value.trim();
    if (!url) { alert("请输入固件 URL"); return; }
    try {
        setOtaUIState(true);
        elements.otaStatusText.innerText = '正在下载固件...';
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("下载失败");
        const buf = new Uint8Array(await resp.arrayBuffer());
        otaManager = new OtaManager(buf, 0x01);
        elements.otaStatusText.innerText = '下载成功，通知设备进入升级模式...';
        otaResultShown = false;
        await sendCmd(CMD_ID.DFU_ENTRY, PKT_TYPE.SET, [0x01]);
    } catch (e) {
        setOtaUIState(false);
        alert("下载或升级准备失败: " + e.message);
    }
};

elements.certStartBtn.onclick = () => {
    if (isCertRunning) return;
    const fhz = Math.floor(parseFloat(elements.certFreq.value) * 1000000);
    const d = new Uint8Array(20), v = new DataView(d.buffer);
    v.setUint8(0, parseInt(elements.certRole.value) === 1 ? 0x80 : 0x00);
    v.setUint8(1, 1);
    v.setUint8(2, parseInt(elements.certType.value));
    v.setUint8(3, parseInt(elements.certCarrier.value));
    v.setInt8(4, parseInt(elements.certPower.value) || 0);
    v.setUint32(5, fhz, true);
    v.setUint16(11, parseInt(elements.certPeriod.value) || 0, true);
    v.setUint32(13, fhz, true);
    sendCmd(CMD_ID.CERT, PKT_TYPE.SET, Array.from(d));
    setCertUIState(true);
};

elements.certStopBtn.onclick = () => {
    sendCmd(CMD_ID.CERT, PKT_TYPE.SET, [0, 0]);
    setCertUIState(false);
};

setControlsEnabled(false);
