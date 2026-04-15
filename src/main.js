/* ═══════════════════════════════════════════════════════════════
   Web3.js v4 — Localhost DApp
   ═══════════════════════════════════════════════════════════════
   Bu fayl Web3.js kutubxonasi yordamida:
    1) Localhost providerga ulanish
    2) MetaMask orqali wallet ulash
    3) ABI va kontrakt addressdan kontrakt obyekti yaratish
    4) View funksiyani chaqirish (call) va konsolga chiqarish
    5) send metodi orqali tranzaksiya yuborish
    6) Error handling — barcha turdagi xatoliklarni ushlash
    7) Gas limit va gas price parametrlarini sozlash
   ═══════════════════════════════════════════════════════════════ */

import Web3 from "web3";
import "./style.css";

// ── DOM elementlari ──
const $ = (sel) => document.querySelector(sel);

const el = {
  // Header
  connectWallet:   $("#connect-wallet"),
  addNetwork:      $("#add-network"),
  walletStatus:    $("#wallet-status"),
  networkStatus:   $("#network-status"),
  deployStatus:    $("#deploy-status"),

  // Toast
  toast:     $("#app-toast"),
  toastIcon: $("#toast-icon"),
  toastText: $("#toast-text"),
  toastClose:$("#toast-close"),

  // Console
  consoleOutput: $("#console-output"),
  consoleClear:  $("#console-clear"),

  // Error
  errorOutput: $("#error-output"),
  errorClear:  $("#error-clear"),

  // Gas Settings
  gasLimit: $("#gas-limit"),
  gasPrice: $("#gas-price"),

  // Greeting
  greetingCurrent: $("#greeting-current"),
  greetingInput:   $("#greeting-input"),
  greetingRefresh: $("#greeting-refresh"),
  greetingSet:     $("#greeting-set"),

  // Student
  studentId:       $("#student-id"),
  studentAge:      $("#student-age"),
  studentName:     $("#student-name"),
  studentAdd:      $("#student-add"),
  studentSearchId: $("#student-search-id"),
  studentGet:      $("#student-get"),
  studentResult:   $("#student-result"),

  // Voting
  candidateName:   $("#candidate-name"),
  candidateAdd:    $("#candidate-add"),
  voteCandidateId: $("#vote-candidate-id"),
  voteSubmit:      $("#vote-submit"),
  winnerRefresh:   $("#winner-refresh"),
  candidateCount:  $("#candidate-count"),
  winnerResult:    $("#winner-result"),
};

// ── Constants ──
const CHAIN_ID     = 31337;
const CHAIN_ID_HEX = "0x7a69"; // 31337 in hex

// ── Global State ──
const state = {
  config:         null,     // contracts.json dan o'qilgan konfiguratsiya
  web3Read:       null,     // O'qish uchun Web3 instance (localhost RPC)
  web3Write:      null,     // Yozish uchun Web3 instance (MetaMask)
  readContracts:  null,     // RPC provider bilan o'qish uchun kontraktlar
  writeContracts: null,     // MetaMask signer bilan yozish uchun kontraktlar
  account:        null,     // Ulangan wallet address
};

// ═══════════════════════════════════════════
//  YORDAMCHI FUNKSIYALAR
// ═══════════════════════════════════════════

/** Addressni qisqartirish: 0x1234...abcd */
function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Vaqtni HH:mm:ss formatda qaytarish */
function timeNow() {
  return new Date().toLocaleTimeString("uz-UZ", { hour12: false });
}

/** Dashboard stat elementlariga holat atributi o'rnatish */
function setStatState(element, stateName) {
  if (!element) return;
  element.dataset.state = stateName;
}

/** Raqam maydonlaridan musbat butun qiymat olish */
function getPositiveInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

// ═══════════════════════════════════════════
//  TOAST (xabar ko'rsatish)
// ═══════════════════════════════════════════

function showToast(text, tone = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  el.toastIcon.textContent = icons[tone] || "ℹ️";
  el.toastText.textContent = text;
  el.toast.hidden = false;
  el.toast.dataset.tone = tone;

  // 8 sekunddan keyin avtomatik yashirish
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { el.toast.hidden = true; }, 8000);
}

// ═══════════════════════════════════════════
//  KONSOL LOGLARI
// ═══════════════════════════════════════════

/**
 * Konsolga yangi qator qo'shish
 * @param {string} msg   — Xabar matni
 * @param {"call"|"send"|"info"} tag — Log turi
 */
function logConsole(msg, tag = "info") {
  // Placeholder ni tozalash
  const placeholder = el.consoleOutput.querySelector(".console-placeholder");
  if (placeholder) placeholder.remove();

  const line = document.createElement("p");
  line.className = "console-line";
  line.innerHTML = `
    <span class="timestamp">${timeNow()}</span>
    <span class="tag tag-${tag}">${tag}</span>
    <span class="msg">${msg}</span>
  `;
  el.consoleOutput.appendChild(line);
  el.consoleOutput.scrollTop = el.consoleOutput.scrollHeight;

  // Brauzer konsoliga ham yozish
  console.log(`[${tag.toUpperCase()}] ${msg}`);
}

// ═══════════════════════════════════════════
//  ERROR HANDLING — Xatolik ushlash mexanizmi
// ═══════════════════════════════════════════

/**
 * Xatolikni loglash va foydalanuvchiga ko'rsatish
 * @param {Error|string} error  — Error obyekti yoki string
 * @param {string} context       — Xatolik qayerda yuz berdi
 */
function handleError(error, context = "Noma'lum") {
  // Placeholder ni tozalash
  const placeholder = el.errorOutput.querySelector(".error-placeholder");
  if (placeholder) placeholder.remove();

  // Error xabarini ajratib olish
  let errorMessage = "";
  let errorType = "Error";

  if (typeof error === "string") {
    errorMessage = error;
  } else if (error?.data?.message) {
    // Solidity revert reason (Web3.js)
    errorMessage = error.data.message;
    errorType = "ContractError";
  } else if (error?.message?.includes("execution reverted")) {
    // Revert xatolik
    errorMessage = error.message;
    errorType = "RevertError";
    // Revert reason ni ajratish
    const match = error.message.match(/reason string "(.+?)"/);
    if (match) errorMessage = match[1];
  } else if (error?.code === 4001) {
    // MetaMask — foydalanuvchi rad etdi
    errorMessage = "Foydalanuvchi tranzaksiyani rad etdi (MetaMask)";
    errorType = "UserRejected";
  } else if (error?.code === -32603) {
    // Internal JSON-RPC error
    errorMessage = error?.data?.message || error.message || "Internal RPC xatoligi";
    errorType = "RPCError";
  } else if (error?.code === -32002) {
    // Already processing
    errorMessage = "MetaMask allaqachon so'rov qayta ishlamoqda";
    errorType = "PendingRequest";
  } else if (error?.code === 4902) {
    // Chain not added
    errorMessage = "Bu tarmoq MetaMask-ga qo'shilmagan";
    errorType = "ChainError";
  } else {
    errorMessage = error?.reason || error?.message || String(error);
  }

  // Error panel ga yozish
  const line = document.createElement("div");
  line.className = "error-line";
  line.innerHTML = `
    <span class="err-type">${errorType} — ${context}</span>
    <span class="err-msg">${errorMessage}</span>
    <span class="err-time">${timeNow()}</span>
  `;
  el.errorOutput.appendChild(line);
  el.errorOutput.scrollTop = el.errorOutput.scrollHeight;

  // Toast bilan ham ko'rsatish
  showToast(`${context}: ${errorMessage}`, "error");

  // Brauzer konsoliga
  console.error(`[${errorType}] (${context}):`, error);
}

// ═══════════════════════════════════════════
//  GAS PARAMETRLARINI OLISH
// ═══════════════════════════════════════════

/**
 * Foydalanuvchi kiritgan gas limit va gas price ni olish.
 * Bo'sh bo'lsa — undefined qaytaradi (Web3 avtomatik hisoblaydi).
 */
function getGasOptions() {
  const opts = {};

  const limitVal = el.gasLimit.value.trim();
  if (limitVal && Number(limitVal) > 0) {
    opts.gas = String(Number(limitVal));
    logConsole(`Gas limit qo'lda belgilandi: ${opts.gas}`, "info");
  }

  const priceVal = el.gasPrice.value.trim();
  if (priceVal && Number(priceVal) > 0) {
    // Gwei dan Wei ga o'tkazish: 1 gwei = 1e9 wei
    opts.gasPrice = Web3.utils.toWei(priceVal, "gwei");
    logConsole(`Gas price qo'lda belgilandi: ${priceVal} Gwei = ${opts.gasPrice} Wei`, "info");
  }

  return opts;
}

// ═══════════════════════════════════════════
//  KONTRAKT YARATISH — ABI va ADDRESS orqali
// ═══════════════════════════════════════════

/**
 * Berilgan ABI va address orqali Web3 kontrakt obyektini yaratish.
 *
 * @param {Web3} web3Instance — Web3 instance
 * @param {Array} abi         — Kontrakt ABI (JSON massiv)
 * @param {string} address    — Kontrakt manzili (0x...)
 * @returns {Contract}        — Web3 kontrakt obyekti
 */
function createContract(web3Instance, abi, address) {
  // Web3.js v4 sintaksisi: new web3.eth.Contract(abi, address)
  return new web3Instance.eth.Contract(abi, address);
}

/**
 * Barcha kontraktlar uchun obyektlar yaratish
 */
function buildContracts(web3Instance) {
  const { contracts } = state.config;
  return {
    greeting: createContract(
      web3Instance,
      contracts.Greeting.abi,
      contracts.Greeting.address
    ),
    studentRegistry: createContract(
      web3Instance,
      contracts.StudentRegistry.abi,
      contracts.StudentRegistry.address
    ),
    voting: createContract(
      web3Instance,
      contracts.Voting.abi,
      contracts.Voting.address
    ),
  };
}

// ═══════════════════════════════════════════
//  KONFIGURATSIYANI YUKLASH
// ═══════════════════════════════════════════

async function loadConfig() {
  try {
    const resp = await fetch("/contracts.json", { cache: "no-store" });
    if (!resp.ok) throw new Error("contracts.json faylini topib bo'lmadi");

    const config = await resp.json();
    if (!config.deployed) throw new Error("Kontraktlar hali deploy qilinmagan");

    state.config = config;

    // ── Web3.js ni localhost RPC provider bilan yaratish ──
    state.web3Read = new Web3(new Web3.providers.HttpProvider(config.rpcUrl));
    logConsole(`Web3.js localhost providerga ulandi: ${config.rpcUrl}`, "info");

    // ── Kontrakt obyektlarini yaratish ──
    state.readContracts = buildContracts(state.web3Read);
    logConsole(
      `Kontraktlar yaratildi — Greeting: ${shortAddr(config.contracts.Greeting.address)}, ` +
      `StudentRegistry: ${shortAddr(config.contracts.StudentRegistry.address)}, ` +
      `Voting: ${shortAddr(config.contracts.Voting.address)}`,
      "info"
    );

    el.deployStatus.textContent = "Tayyor ✓";
    el.networkStatus.textContent = "Localhost 31337";
    setStatState(el.deployStatus, "ok");
    setStatState(el.networkStatus, "info");
    showToast("Kontraktlar muvaffaqiyatli yuklandi!", "success");

  } catch (err) {
    el.deployStatus.textContent = "Topilmadi";
    setStatState(el.deployStatus, "error");
    handleError(err, "Config yuklash");
    throw err;
  }
}

// ═══════════════════════════════════════════
//  METAMASK TARMOQNI QO'SHISH / ALMASHTIRISH
// ═══════════════════════════════════════════

async function addLocalhostNetwork() {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask topilmadi! Iltimos, MetaMask kengaytmasini o'rnating.");
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_ID_HEX,
        chainName: "Hardhat Localhost",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["http://127.0.0.1:8545"],
      }],
    });

    logConsole("Localhost tarmoq MetaMask ga qo'shildi (chainId: 31337)", "info");
    showToast("Localhost tarmoq MetaMask ga qo'shildi!", "success");

  } catch (err) {
    handleError(err, "Tarmoq qo'shish");
  }
}

async function switchToLocalhost() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (switchErr) {
    if (switchErr.code === 4902) {
      await addLocalhostNetwork();
    } else {
      throw switchErr;
    }
  }
}

// ═══════════════════════════════════════════
//  WALLET ULASH (MetaMask)
// ═══════════════════════════════════════════

async function connectWallet() {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask topilmadi! Brauzeringizga MetaMask kengaytmasini o'rnating.");
    }

    // Config yuklanmagan bo'lsa — yuklash
    if (!state.config) {
      await loadConfig();
    }

    // Tarmoqni tekshirish va almashtirish
    await switchToLocalhost();

    // ── MetaMask orqali Web3.js instance yaratish ──
    state.web3Write = new Web3(window.ethereum);

    // Accountlarni so'rash
    const accounts = await state.web3Write.eth.requestAccounts();
    if (!accounts || accounts.length === 0) {
      throw new Error("MetaMask dan hech qanday account olinmadi");
    }

    state.account = accounts[0];

    // Chain ID ni tekshirish
    const chainId = await state.web3Write.eth.getChainId();
    if (Number(chainId) !== CHAIN_ID) {
      throw new Error(`Noto'g'ri tarmoq! Kutilgan: ${CHAIN_ID}, hozirgi: ${chainId}`);
    }

    // ── Yozish kontraktlarini MetaMask provider bilan yaratish ──
    state.writeContracts = buildContracts(state.web3Write);

    // UI yangilash
    el.walletStatus.textContent = shortAddr(state.account);
    el.networkStatus.textContent = "MetaMask + Localhost";
    setStatState(el.walletStatus, "ok");
    setStatState(el.networkStatus, "ok");
    setWriteButtonsEnabled(true);

    logConsole(`Wallet ulandi: ${state.account}`, "info");
    logConsole(`Chain ID: ${chainId} — Tarmoq to'g'ri`, "info");

    // Account balansini tekshirish va konsolga chiqarish
    const balanceWei = await state.web3Write.eth.getBalance(state.account);
    const balanceEth = Web3.utils.fromWei(balanceWei, "ether");
    logConsole(`Wallet balansi: ${Number(balanceEth).toFixed(4)} ETH`, "info");

    showToast("Wallet muvaffaqiyatli ulandi! Endi tranzaksiya yuborishingiz mumkin.", "success");

  } catch (err) {
    setStatState(el.walletStatus, "error");
    handleError(err, "Wallet ulash");
  }
}

// ═══════════════════════════════════════════
//  YOZISH TUGMALARINI BOSHQARISH
// ═══════════════════════════════════════════

function setWriteButtonsEnabled(enabled) {
  const buttons = [el.greetingSet, el.studentAdd, el.candidateAdd, el.voteSubmit];
  buttons.forEach(btn => { btn.disabled = !enabled; });
}

// ═══════════════════════════════════════════
//  GREETING KONTRAKTI
// ═══════════════════════════════════════════

/** VIEW funksiyani chaqirish va natijani konsolga chiqarish */
async function refreshGreeting() {
  if (!state.readContracts) {
    handleError("Kontraktlar hali yuklanmagan", "Greeting o'qish");
    return;
  }

  try {
    // ── call metodi — view funksiyani chaqirish ──
    const message = await state.readContracts.greeting.methods.getMessage().call();

    el.greetingCurrent.textContent = message;
    logConsole(`getMessage() natijasi: "${message}"`, "call");
    console.log("📌 Greeting getMessage() natijasi:", message);

  } catch (err) {
    el.greetingCurrent.textContent = "O'qib bo'lmadi";
    handleError(err, "Greeting o'qish");
  }
}

/** SEND metodi orqali kontraktga tranzaksiya yuborish */
async function setGreeting() {
  const newMsg = el.greetingInput.value.trim();
  if (!newMsg) {
    handleError("Yangi xabar maydoni bo'sh!", "Greeting yozish");
    return;
  }
  if (!state.writeContracts || !state.account) {
    handleError("Avval MetaMask wallet ulang!", "Greeting yozish");
    return;
  }

  el.greetingSet.disabled = true;
  el.greetingSet.classList.add("loading");

  try {
    const gasOpts = getGasOptions();

    logConsole(`setMessage("${newMsg}") tranzaksiyasi yuborilmoqda...`, "send");

    // ── send metodi — tranzaksiya yuborish ──
    const receipt = await state.writeContracts.greeting.methods
      .setMessage(newMsg)
      .send({
        from: state.account,
        ...gasOpts,
      });

    logConsole(
      `✅ setMessage() muvaffaqiyat! Tx: ${shortAddr(receipt.transactionHash)}, ` +
      `Block: ${receipt.blockNumber}, Gas ishlatildi: ${receipt.gasUsed}`,
      "send"
    );
    console.log("📌 Greeting setMessage() receipt:", receipt);

    el.greetingInput.value = "";
    showToast("Xabar muvaffaqiyatli yangilandi!", "success");

    // Yangilangan xabarni o'qish
    await refreshGreeting();

  } catch (err) {
    handleError(err, "Greeting yozish");
  } finally {
    el.greetingSet.disabled = false;
    el.greetingSet.classList.remove("loading");
  }
}

// ═══════════════════════════════════════════
//  STUDENT REGISTRY KONTRAKTI
// ═══════════════════════════════════════════

/** send orqali yangi talaba qo'shish */
async function addStudent() {
  const id   = getPositiveInt(el.studentId.value);
  const name = el.studentName.value.trim();
  const age  = getPositiveInt(el.studentAge.value);

  if (!id || !name || !age) {
    handleError("Barcha maydonlarni to'ldiring (ID, Ism, Yosh)", "Student qo'shish");
    return;
  }
  if (!state.writeContracts || !state.account) {
    handleError("Avval MetaMask wallet ulang!", "Student qo'shish");
    return;
  }

  el.studentAdd.disabled = true;
  el.studentAdd.classList.add("loading");

  try {
    const gasOpts = getGasOptions();

    logConsole(`addStudent(${id}, "${name}", ${age}) tranzaksiyasi yuborilmoqda...`, "send");

    const receipt = await state.writeContracts.studentRegistry.methods
      .addStudent(id, name, age)
      .send({
        from: state.account,
        ...gasOpts,
      });

    logConsole(
      `✅ addStudent() muvaffaqiyat! Tx: ${shortAddr(receipt.transactionHash)}, ` +
      `Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`,
      "send"
    );
    console.log("📌 StudentRegistry addStudent() receipt:", receipt);

    el.studentId.value = "";
    el.studentName.value = "";
    el.studentAge.value = "";
    showToast("Talaba muvaffaqiyatli qo'shildi!", "success");

  } catch (err) {
    handleError(err, "Student qo'shish");
  } finally {
    el.studentAdd.disabled = false;
    el.studentAdd.classList.remove("loading");
  }
}

/** VIEW funksiya — talaba ma'lumotini o'qish */
async function getStudent() {
  const id = getPositiveInt(el.studentSearchId.value);
  if (!id) {
    handleError("Qidirish uchun ID kiriting!", "Student qidirish");
    return;
  }
  if (!state.readContracts) {
    handleError("Kontraktlar yuklanmagan", "Student qidirish");
    return;
  }

  try {
    // ── call — view funksiyani chaqirish ──
    const result = await state.readContracts.studentRegistry.methods
      .getStudent(id).call();

    const display = `ID: ${result[0]} | Ism: ${result[1]} | Yosh: ${result[2]}`;
    el.studentResult.textContent = display;
    logConsole(`getStudent(${id}) natijasi: ${display}`, "call");
    console.log("📌 StudentRegistry getStudent() natijasi:", result);

    showToast("Talaba ma'lumoti olindi!", "success");

  } catch (err) {
    el.studentResult.textContent = "Topilmadi";
    handleError(err, "Student qidirish");
  }
}

// ═══════════════════════════════════════════
//  VOTING KONTRAKTI
// ═══════════════════════════════════════════

/** VIEW — nomzodlar sonini va g'olib ni o'qish */
async function refreshVoting() {
  if (!state.readContracts) return;

  try {
    const count = await state.readContracts.voting.methods.getCandidateCount().call();
    el.candidateCount.textContent = count.toString();
    logConsole(`getCandidateCount() = ${count}`, "call");
    console.log("📌 Voting getCandidateCount():", count);
  } catch {
    el.candidateCount.textContent = "0";
  }

  try {
    const winner = await state.readContracts.voting.methods.getWinner().call();
    const display = `ID: ${winner[0]} | ${winner[1]} | Ovozlar: ${winner[2]}`;
    el.winnerResult.textContent = display;
    logConsole(`getWinner() = ${display}`, "call");
    console.log("📌 Voting getWinner():", winner);
  } catch {
    el.winnerResult.textContent = "Hozircha g'olib yo'q";
  }
}

/** SEND — nomzod qo'shish */
async function addCandidate() {
  const name = el.candidateName.value.trim();
  if (!name) {
    handleError("Nomzod ismini kiriting!", "Nomzod qo'shish");
    return;
  }
  if (!state.writeContracts || !state.account) {
    handleError("Avval MetaMask wallet ulang!", "Nomzod qo'shish");
    return;
  }

  el.candidateAdd.disabled = true;
  el.candidateAdd.classList.add("loading");

  try {
    const gasOpts = getGasOptions();

    logConsole(`addCandidate("${name}") tranzaksiyasi yuborilmoqda...`, "send");

    const receipt = await state.writeContracts.voting.methods
      .addCandidate(name)
      .send({
        from: state.account,
        ...gasOpts,
      });

    logConsole(
      `✅ addCandidate() muvaffaqiyat! Tx: ${shortAddr(receipt.transactionHash)}, ` +
      `Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`,
      "send"
    );
    console.log("📌 Voting addCandidate() receipt:", receipt);

    el.candidateName.value = "";
    showToast("Nomzod qo'shildi!", "success");
    await refreshVoting();

  } catch (err) {
    handleError(err, "Nomzod qo'shish");
  } finally {
    el.candidateAdd.disabled = false;
    el.candidateAdd.classList.remove("loading");
  }
}

/** SEND — ovoz berish */
async function vote() {
  const candidateId = getPositiveInt(el.voteCandidateId.value);
  if (!candidateId) {
    handleError("Ovoz berish uchun candidate ID kiriting!", "Ovoz berish");
    return;
  }
  if (!state.writeContracts || !state.account) {
    handleError("Avval MetaMask wallet ulang!", "Ovoz berish");
    return;
  }

  el.voteSubmit.disabled = true;
  el.voteSubmit.classList.add("loading");

  try {
    const gasOpts = getGasOptions();

    logConsole(`vote(${candidateId}) tranzaksiyasi yuborilmoqda...`, "send");

    const receipt = await state.writeContracts.voting.methods
      .vote(candidateId)
      .send({
        from: state.account,
        ...gasOpts,
      });

    logConsole(
      `✅ vote() muvaffaqiyat! Tx: ${shortAddr(receipt.transactionHash)}, ` +
      `Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`,
      "send"
    );
    console.log("📌 Voting vote() receipt:", receipt);

    showToast("Ovoz muvaffaqiyatli berildi!", "success");
    await refreshVoting();

  } catch (err) {
    handleError(err, "Ovoz berish");
  } finally {
    el.voteSubmit.disabled = false;
    el.voteSubmit.classList.remove("loading");
  }
}

// ═══════════════════════════════════════════
//  EVENT LISTENER LAR
// ═══════════════════════════════════════════

function registerEvents() {
  // Wallet
  el.connectWallet.addEventListener("click", connectWallet);
  el.addNetwork.addEventListener("click", addLocalhostNetwork);

  // Toast
  el.toastClose.addEventListener("click", () => { el.toast.hidden = true; });

  // Console
  el.consoleClear.addEventListener("click", () => {
    el.consoleOutput.innerHTML = '<p class="console-placeholder">Konsol tozalandi.</p>';
  });

  // Error
  el.errorClear.addEventListener("click", () => {
    el.errorOutput.innerHTML = '<p class="error-placeholder">Xatoliklar tozalandi.</p>';
  });

  // Greeting
  el.greetingRefresh.addEventListener("click", refreshGreeting);
  el.greetingSet.addEventListener("click", setGreeting);
  el.greetingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setGreeting();
  });

  // Student
  el.studentAdd.addEventListener("click", addStudent);
  el.studentGet.addEventListener("click", getStudent);
  el.studentSearchId.addEventListener("keydown", (e) => {
    if (e.key === "Enter") getStudent();
  });

  // Voting
  el.candidateAdd.addEventListener("click", addCandidate);
  el.voteSubmit.addEventListener("click", vote);
  el.winnerRefresh.addEventListener("click", refreshVoting);
  el.candidateName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addCandidate();
  });
  el.voteCandidateId.addEventListener("keydown", (e) => {
    if (e.key === "Enter") vote();
  });

  // MetaMask events — account yoki chain o'zgarganda sahifani yangilash
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
      logConsole(`Account o'zgardi: ${accounts[0] || "Ulanmagan"}`, "info");
      window.location.reload();
    });
    window.ethereum.on("chainChanged", (chainId) => {
      logConsole(`Chain o'zgardi: ${chainId}`, "info");
      window.location.reload();
    });
  }
}

// ═══════════════════════════════════════════
//  ILOVANI ISHGA TUSHIRISH
// ═══════════════════════════════════════════

async function bootstrap() {
  logConsole("Web3.js DApp ishga tushirilmoqda...", "info");
  setStatState(el.walletStatus, "idle");
  setStatState(el.networkStatus, "idle");
  setStatState(el.deployStatus, "idle");

  // Yozish tugmalarini o'chirib qo'yish (wallet ulanmaguncha)
  setWriteButtonsEnabled(false);

  // Eventlarni ro'yxatdan o'tkazish
  registerEvents();

  try {
    // Konfiguratsiya va kontraktlarni yuklash
    await loadConfig();

    // View funksiyalarni chaqirish va konsolga chiqarish
    logConsole("── View funksiyalar chaqirilmoqda ──", "info");
    await refreshGreeting();
    await refreshVoting();

  } catch {
    el.greetingCurrent.textContent = "Deploy kutilmoqda";
    el.studentResult.textContent = "Deploy kutilmoqda";
    el.winnerResult.textContent = "Deploy kutilmoqda";
  }
}

// Ilovani boshlash
bootstrap();
