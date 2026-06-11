const AVAILABLE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MIN_CATEGORIES = 5;
const MAX_CATEGORIES = 20;
const MIN_LETTERS = 3;

const state = {
  room: null,
  playerId: localStorage.getItem("stop.playerId"),
  socket: null,
  categories: ["Nome", "CEP", "Animal", "Comida", "Cor", "Objeto"],
  letters: [...AVAILABLE_LETTERS],
  maxRounds: 6,
  roundDurationSeconds: 120,
  reviewCategoryIndex: 0,
  timerInterval: null,
  reviewTimerInterval: null,
  reviewAdvanceKey: null,
  autoStopRound: null,
  lastStatus: null,
  stopModalRound: null,
  saveTimeout: null,
  debugPanel: new URLSearchParams(window.location.search).get("debug") === "1"
    || localStorage.getItem("stop.debugPanel") === "true",
};

const elements = {
  entryView: document.querySelector("#entryView"),
  lobbyView: document.querySelector("#lobbyView"),
  roundView: document.querySelector("#roundView"),
  reviewView: document.querySelector("#reviewView"),
  podiumView: document.querySelector("#podiumView"),
  playerName: document.querySelector("#playerName"),
  roomCodeInput: document.querySelector("#roomCodeInput"),
  roomQrCode: document.querySelector("#roomQrCode"),
  roomQrHint: document.querySelector("#roomQrHint"),
  lobbyRoomCode: document.querySelector("#lobbyRoomCode"),
  copyRoomCodeBtn: document.querySelector("#copyRoomCodeBtn"),
  lobbyRoundNumber: document.querySelector("#lobbyRoundNumber"),
  lobbyPlayerCount: document.querySelector("#lobbyPlayerCount"),
  maxRoundsInput: document.querySelector("#maxRoundsInput"),
  roundDurationInput: document.querySelector("#roundDurationInput"),
  categoriesChips: document.querySelector("#categoriesChips"),
  categoriesLimit: document.querySelector("#categoriesLimit"),
  categoryFeedback: document.querySelector("#categoryFeedback"),
  lettersChips: document.querySelector("#lettersChips"),
  letterFeedback: document.querySelector("#letterFeedback"),
  categoryInput: document.querySelector("#categoryInput"),
  currentLetter: document.querySelector("#currentLetter"),
  reviewLetters: document.querySelectorAll(".reviewLetter"),
  roundCounter: document.querySelector("#roundCounter"),
  roundTimer: document.querySelector("#roundTimer"),
  answersForm: document.querySelector("#answersForm"),
  lobbyPlayersList: document.querySelector("#lobbyPlayersList"),
  participantsLists: document.querySelectorAll(".participantsList"),
  activityLogs: document.querySelectorAll(".activityLog"),
  chatForms: document.querySelectorAll(".chatForm"),
  chatInputs: document.querySelectorAll(".chatInput"),
  votesPanel: document.querySelector("#votesPanel"),
  reviewCategoryTitle: document.querySelector("#reviewCategoryTitle"),
  reviewTimer: document.querySelector("#reviewTimer"),
  podiumTitle: document.querySelector("#podiumTitle"),
  podiumList: document.querySelector("#podiumList"),
  stopModal: document.querySelector("#stopModal"),
  stopMessage: document.querySelector("#stopMessage"),
  leaveRoomModal: document.querySelector("#leaveRoomModal"),
  createRoomBtn: document.querySelector("#createRoomBtn"),
  joinRoomBtn: document.querySelector("#joinRoomBtn"),
  leaveRoomBtn: document.querySelector("#leaveRoomBtn"),
  addCategoryBtn: document.querySelector("#addCategoryBtn"),
  startRoundBtn: document.querySelector("#startRoundBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  newRoundBtn: document.querySelector("#newRoundBtn"),
  closeStopModalBtn: document.querySelector("#closeStopModalBtn"),
  cancelLeaveRoomBtn: document.querySelector("#cancelLeaveRoomBtn"),
  confirmLeaveRoomBtn: document.querySelector("#confirmLeaveRoomBtn"),
  devOpsPanel: document.querySelector("#devOpsPanel"),
  devDsmStatus: document.querySelector("#devDsmStatus"),
  devRedisStatus: document.querySelector("#devRedisStatus"),
  devRedisLatency: document.querySelector("#devRedisLatency"),
  devCacheState: document.querySelector("#devCacheState"),
  devOpsCount: document.querySelector("#devOpsCount"),
  devRefreshBtn: document.querySelector("#devRefreshBtn"),
  devForceMissBtn: document.querySelector("#devForceMissBtn"),
  devClearCacheBtn: document.querySelector("#devClearCacheBtn"),
  devDiagnostics: document.querySelector("#devDiagnostics"),
};

elements.createRoomBtn.addEventListener("click", () => runAction(createRoom));
elements.joinRoomBtn.addEventListener("click", () => runAction(joinRoom));
elements.startRoundBtn.addEventListener("click", () => runAction(startRound));
elements.stopBtn.addEventListener("click", () => runAction(stopRound));
elements.newRoundBtn.addEventListener("click", () => runAction(startRound));
elements.closeStopModalBtn.addEventListener("click", hideStopModal);
elements.leaveRoomBtn.addEventListener("click", showLeaveRoomModal);
elements.cancelLeaveRoomBtn.addEventListener("click", hideLeaveRoomModal);
elements.confirmLeaveRoomBtn.addEventListener("click", () => runAction(leaveRoom));
elements.copyRoomCodeBtn.addEventListener("click", () => runAction(copyRoomCode));
elements.devRefreshBtn.addEventListener("click", () => runAction(refreshDevOpsPanel));
elements.devForceMissBtn.addEventListener("click", () => runAction(forceCacheMiss));
elements.devClearCacheBtn.addEventListener("click", () => runAction(clearRoomCache));
elements.answersForm.addEventListener("input", scheduleAutoSave);
elements.addCategoryBtn.addEventListener("click", addCategory);
elements.categoryInput.addEventListener("keydown", (event) => addChipOnEnter(event, addCategory));
elements.roomCodeInput.addEventListener("input", updateEntryQrCode);
elements.maxRoundsInput.addEventListener("input", updateMaxRounds);
elements.roundDurationInput.addEventListener("input", updateRoundDuration);
elements.chatForms.forEach((form) => form.addEventListener("submit", sendChatMessage));
window.addEventListener("beforeunload", notifyPlayerLeft);

renderConfigChips();
applyRoomCodeFromUrl();
updateEntryQrCode();
initDevOpsPanel();

async function createRoom() {
  const hostName = requirePlayerName();
  const payload = {
    host_name: hostName,
    categories: state.categories,
    letters: state.letters,
    max_rounds: getMaxRounds(),
    round_duration_seconds: getRoundDurationSeconds(),
  };
  const response = await request("/api/v1/rooms", "POST", payload);
  setPlayer(response.playerId);
  setRoom(response.data);
  connectSocket(response.data.id);
}

async function joinRoom() {
  const roomId = elements.roomCodeInput.value.trim().toUpperCase();
  if (!roomId) {
    alert("Informe o codigo da sala.");
    return;
  }

  const response = await request(`/api/v1/rooms/${roomId}/players`, "POST", {
    player_name: requirePlayerName(),
  });
  setPlayer(response.playerId);
  setRoom(response.data);
  connectSocket(response.data.id);
}

function applyRoomCodeFromUrl() {
  const roomId = new URLSearchParams(window.location.search).get("room");
  if (!roomId) {
    return;
  }
  elements.roomCodeInput.value = roomId.trim().toUpperCase().slice(0, 6);
}

function updateEntryQrCode() {
  const roomId = elements.roomCodeInput.value.trim().toUpperCase();
  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set("room", roomId);
    elements.roomQrHint.textContent = `Escaneie para abrir a sala ${roomId} no celular.`;
  } else {
    url.searchParams.delete("room");
    elements.roomQrHint.textContent = "Digite um codigo de sala para gerar o QR Code.";
  }
  elements.roomQrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=FFFFFF&bgcolor=052268&margin=12&data=${encodeURIComponent(url.toString())}`;
}

async function saveConfig() {
  if (!state.room) return alert("Crie ou entre em uma sala.");
  const response = await request(`/api/v1/rooms/${state.room.id}`, "PATCH", {
    categories: state.categories,
    letters: state.letters,
    max_rounds: getMaxRounds(),
    round_duration_seconds: getRoundDurationSeconds(),
  });
  setRoom(response.data);
  return response.data;
}

async function startRound() {
  if (!ensureRoomAndPlayer()) return;
  if (state.room.host_id && state.room.host_id !== state.playerId) {
    alert("Apenas o dono da sala pode começar rodadas.");
    return;
  }
  if (state.room.status === "lobby") {
    await saveConfig();
  }
  const response = await request(`/api/v1/rooms/${state.room.id}/rounds`, "POST", {
    player_id: state.playerId,
  });
  setRoom(response.data);
}

async function submitAnswers(updateUi = true) {
  if (!ensureRoomAndPlayer()) return;
  if (state.room.status !== "playing") return;
  const response = await request(`/api/v1/rooms/${state.room.id}/answers`, "POST", {
    player_id: state.playerId,
    answers: collectAnswers(),
  });
  if (updateUi) {
    setRoom(response.data);
  }
}

async function stopRound(force = false) {
  if (!ensureRoomAndPlayer()) return;
  if (!force && !hasFilledAllAnswers(state.room)) {
    alert("Preencha todos os campos antes de pedir STOP.");
    return;
  }
  const response = await request(`/api/v1/rooms/${state.room.id}/stop`, "POST", {
    player_id: state.playerId,
    answers: collectAnswers(),
    force,
  });
  setRoom(response.data);
}

async function voteAnswer(targetPlayerId, category, valid) {
  if (!ensureRoomAndPlayer()) return;
  const response = await request(`/api/v1/rooms/${state.room.id}/votes`, "POST", {
    voter_id: state.playerId,
    target_player_id: targetPlayerId,
    category,
    valid,
  });
  setRoom(response.data);
}

async function finishRound() {
  if (!ensureRoomAndPlayer()) return;
  const response = await request(`/api/v1/rooms/${state.room.id}/finish`, "POST", {
    player_id: state.playerId,
  });
  setRoom(response.data);
}

function connectSocket(roomId) {
  if (state.socket) {
    state.socket.close();
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  state.socket = new WebSocket(`${protocol}://${window.location.host}/ws/rooms/${roomId}`);
  state.socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    setRoom(message.data);
  };
}

async function request(url, method = "GET", body) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  const dsmToken = localStorage.getItem("stop.dsmToken");
  if (dsmToken) {
    options.headers["X-Dsm-Token"] = dsmToken;
  }
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Erro inesperado.");
  }
  return data;
}

function setPlayer(playerId) {
  state.playerId = playerId;
  localStorage.setItem("stop.playerId", playerId);
}

function setRoom(room) {
  const previousStatus = state.room?.status || state.lastStatus;
  state.room = room;
  if (previousStatus === "playing" && room.status === "voting") {
    state.reviewCategoryIndex = 0;
  }
  if (room.status === "voting") {
    state.reviewCategoryIndex = room.review_category_index || 0;
  }
  render();
  maybeShowStopModal(previousStatus, room);
  state.lastStatus = room.status;
}

function render() {
  const room = state.room;
  elements.currentLetter.textContent = room?.current_letter || "-";
  elements.reviewLetters.forEach((letter) => {
    letter.textContent = room?.current_letter || "-";
  });
  elements.roundCounter.textContent = room ? `${room.round_number || 1}/${room.max_rounds || 6}` : "1/6";

  if (!room) {
    showView("entry");
    return;
  }

  state.categories = [...room.categories];
  state.letters = [...room.letters];
  state.maxRounds = room.max_rounds || 6;
  state.roundDurationSeconds = room.round_duration_seconds || 120;
  elements.maxRoundsInput.value = state.maxRounds;
  elements.roundDurationInput.value = state.roundDurationSeconds;
  elements.lobbyRoomCode.textContent = room.id;
  elements.lobbyRoundNumber.textContent = `${room.round_number || 0}/${state.maxRounds}`;
  elements.lobbyPlayerCount.textContent = Object.keys(room.players).length;
  renderConfigChips();

  renderCurrentView(room);
  renderAnswers(room);
  renderPlayers(room, elements.lobbyPlayersList);
  renderParticipants(room);
  renderActivity(room);
  renderVotes(room);
  renderPodium(room);
  updateButtons(room);
  startTimer(room);
  startReviewTimer(room);
  refreshDevOpsPanel(true);
}

function renderCurrentView(room) {
  if (room.winner_id || room.status === "finished") {
    showView("podium");
    return;
  }
  if (room.status === "lobby") {
    showView("lobby");
    return;
  }
  if (room.status === "playing") {
    showView("round");
    return;
  }
  if (room.status === "voting") {
    showView("review");
  }
}

function renderAnswers(room) {
  elements.answersForm.innerHTML = "";
  const currentAnswers = room.answers[state.playerId] || {};

  room.categories.forEach((category) => {
    const label = document.createElement("label");
    label.textContent = category;

    const input = document.createElement("input");
    input.name = category;
    input.placeholder = `Palavra com ${room.current_letter || "a letra sorteada"}`;
    input.value = currentAnswers[category] || "";
    input.disabled = room.status !== "playing";

    label.append(input);
    elements.answersForm.append(label);
  });
}

function renderPlayers(room, container) {
  container.innerHTML = "";
  Object.entries(room.players).forEach(([playerId, name]) => {
    const item = document.createElement("div");
    item.className = "player";
    item.innerHTML = `
      ${renderPlayerName(name, playerId === room.host_id)}
      <span>${room.scores[playerId] || 0} pts</span>
    `;
    container.append(item);
  });
}

function renderParticipants(room) {
  elements.participantsLists.forEach((container) => {
    container.innerHTML = "";
    Object.entries(room.players).forEach(([playerId, name]) => {
      const item = document.createElement("div");
      item.className = "participant";
      const ready = isPlayerReady(room, playerId);
      item.innerHTML = `
        <div class="participant-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
        <div>
          ${renderPlayerName(name, playerId === room.host_id)}
          <small>${room.scores[playerId] || 0} pts</small>
        </div>
        <span class="ready-check ${ready ? "active" : ""}">✓</span>
      `;
      container.append(item);
    });
  });
}

function renderPlayerName(name, isHost) {
  const crown = isHost
    ? `
      <svg class="crown-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m3.5 8.5 4.7 3.8L12 5l3.8 7.3 4.7-3.8-1.7 9.5H5.2L3.5 8.5Z" />
        <path d="M5.5 20h13" />
      </svg>
    `
    : "";
  return `<strong class="player-name">${escapeHtml(name)}${crown}</strong>`;
}

function isPlayerReady(room, playerId) {
  if (room.status === "playing") {
    const answers = room.answers[playerId] || {};
    return room.categories.every((category) => (answers[category] || "").trim());
  }

  if (room.status === "voting") {
    const category = room.categories[room.review_category_index || 0] || room.categories[0];
    return Object.keys(room.players)
      .every((targetPlayerId) => {
        const answer = room.answers[targetPlayerId]?.[category] || "";
        if (!answer) {
          return true;
        }
        return Object.prototype.hasOwnProperty.call(room.votes[`${targetPlayerId}:${category}`] || {}, playerId);
      });
  }

  return false;
}

function renderActivity(room) {
  const events = room.events || [];
  elements.activityLogs.forEach((container) => {
    container.innerHTML = "";
    events.forEach((event) => {
      const item = document.createElement("div");
      item.className = `activity-item ${event.type === "chat" ? "chat" : "system"}`;
      item.textContent = event.message;
      container.append(item);
    });
  });
}

function renderVotes(room) {
  elements.votesPanel.innerHTML = "";
  if (room.status !== "voting") {
    return;
  }

  state.reviewCategoryIndex = room.review_category_index || 0;
  const category = room.categories[state.reviewCategoryIndex] || room.categories[0];
  elements.reviewCategoryTitle.textContent = `${category} (${state.reviewCategoryIndex + 1}/${room.categories.length})`;

  Object.entries(room.players).forEach(([playerId, playerName]) => {
    const answer = room.answers[playerId]?.[category] || "";
    const voteKey = `${playerId}:${category}`;
    const votes = room.votes[voteKey] || {};
    const currentVote = Object.prototype.hasOwnProperty.call(votes, state.playerId)
      ? votes[state.playerId]
      : votes.system;
    const row = document.createElement("button");
    row.type = "button";
    row.className = `vote-row ${currentVote ? "valid" : "invalid"}`;
    row.disabled = !answer;
    row.innerHTML = `
      <span>
        <strong>${escapeHtml(playerName)}</strong>
        <em>${escapeHtml(answer || "Sem resposta")}</em>
      </span>
      <b>${currentVote ? "✓" : "×"}</b>
    `;
    row.setAttribute("aria-label", `${currentVote ? "Invalidar" : "Validar"} resposta de ${playerName}`);
    row.addEventListener("click", () => voteAnswer(playerId, category, !currentVote));
    elements.votesPanel.append(row);
  });

  if (hasEveryoneVotedCurrentCategory(room)) {
    scheduleReviewAdvance(room, 250);
  }
}

function renderPodium(room) {
  const podium = Object.entries(room.players)
    .map(([playerId, name]) => ({
      playerId,
      name,
      total: room.scores[playerId] || 0,
      round: room.last_round_scores?.[playerId] || 0,
    }))
    .sort((first, second) => second.total - first.total);

  const winnerName = room.winner_id ? room.players[room.winner_id] : null;
  elements.podiumTitle.textContent = winnerName ? `${winnerName} venceu a sala!` : "Podium da rodada";
  elements.podiumList.innerHTML = "";

  podium.forEach((player, index) => {
    const item = document.createElement("div");
    item.className = `podium-item position-${index + 1}`;
    item.innerHTML = `
      <span>${index + 1}º</span>
      <strong>${escapeHtml(player.name)}</strong>
      <small>+${player.round} na rodada / ${player.total} pontos</small>
    `;
    elements.podiumList.append(item);
  });
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (!ensureRoomAndPlayer()) return;

  const input = event.currentTarget.querySelector(".chatInput");
  const message = input.value.trim();
  if (!message) {
    return;
  }

  const response = await request(`/api/v1/rooms/${state.room.id}/chat`, "POST", {
    player_id: state.playerId,
    message,
  });
  input.value = "";
  setRoom(response.data);
}

async function copyRoomCode() {
  if (!state.room?.id) {
    return;
  }
  await copyText(state.room.id);
  elements.copyRoomCodeBtn.classList.add("copied");
  elements.copyRoomCodeBtn.title = "Copiado!";
  setTimeout(() => {
    elements.copyRoomCodeBtn.classList.remove("copied");
    elements.copyRoomCodeBtn.title = "Copiar codigo";
  }, 1400);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("input");
  input.value = text;
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function showLeaveRoomModal() {
  elements.leaveRoomModal.classList.remove("hidden");
}

function hideLeaveRoomModal() {
  elements.leaveRoomModal.classList.add("hidden");
}

async function leaveRoom() {
  if (!ensureRoomAndPlayer()) return;

  await request(`/api/v1/rooms/${state.room.id}/players/${state.playerId}/leave`, "POST");
  hideLeaveRoomModal();
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }
  state.room = null;
  state.lastStatus = null;
  state.stopModalRound = null;
  state.reviewCategoryIndex = 0;
  state.playerId = null;
  localStorage.removeItem("stop.playerId");
  render();
}

function notifyPlayerLeft() {
  if (!state.room || !state.playerId) {
    return;
  }

  fetch(`/api/v1/rooms/${state.room.id}/players/${state.playerId}/leave`, {
    method: "POST",
    keepalive: true,
  });
}

function updateButtons(room) {
  const isHost = room.host_id === state.playerId;
  elements.startRoundBtn.disabled = !isHost || !["lobby", "finished"].includes(room.status);
  elements.startRoundBtn.title = isHost ? "" : "Apenas o dono da sala pode começar rodadas.";
  const canStop = room.status === "playing" && hasFilledAllAnswers(room);
  elements.stopBtn.disabled = !canStop;
  elements.stopBtn.title = canStop ? "" : "Preencha todos os campos antes de pedir STOP.";
  elements.newRoundBtn.disabled = !isHost || Boolean(room.winner_id);
  elements.newRoundBtn.title = isHost ? "" : "Apenas o dono da sala pode começar rodadas.";
}

function collectAnswers() {
  return Object.fromEntries(new FormData(elements.answersForm).entries());
}

function hasFilledAllAnswers(room) {
  if (!room || !state.playerId) {
    return false;
  }
  const answers = collectAnswers();
  return room.categories.every((category) => (answers[category] || "").trim());
}

function showView(viewName) {
  const views = {
    entry: elements.entryView,
    lobby: elements.lobbyView,
    round: elements.roundView,
    review: elements.reviewView,
    podium: elements.podiumView,
  };
  Object.values(views).forEach((view) => view.classList.remove("active"));
  views[viewName].classList.add("active");
}

function renderConfigChips() {
  renderChips(elements.categoriesChips, state.categories, removeCategory);
  updateCategoriesLimit();
  renderLetterOptions();
}

function updateCategoriesLimit() {
  elements.categoriesLimit.textContent = `${state.categories.length}/${MAX_CATEGORIES} temas`;
}

function showCategoryFeedback(message, type = "warning") {
  elements.categoryFeedback.textContent = message;
  elements.categoryFeedback.className = `category-feedback ${type}`;
}

function clearCategoryFeedback() {
  elements.categoryFeedback.textContent = "";
  elements.categoryFeedback.className = "category-feedback";
}

function showLetterFeedback(message, type = "warning") {
  elements.letterFeedback.textContent = message;
  elements.letterFeedback.className = `letter-feedback ${type}`;
}

function clearLetterFeedback() {
  elements.letterFeedback.textContent = "";
  elements.letterFeedback.className = "letter-feedback";
}

function renderChips(container, values, onAction) {
  container.innerHTML = "";
  if (values.length === 0) {
    container.innerHTML = "<small>Nenhum item cadastrado.</small>";
    return;
  }

  values.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<b>${escapeHtml(value)}</b>`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "chip-remove";
    removeButton.setAttribute("aria-label", `Remover ${value}`);
    removeButton.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4.2 4.2 8 8m0 0 3.8 3.8M8 8l3.8-3.8M8 8l-3.8 3.8" />
      </svg>
    `;
    removeButton.addEventListener("click", () => onAction(value));

    chip.append(removeButton);
    container.append(chip);
  });
}

function addCategory() {
  const category = elements.categoryInput.value.trim();
  if (!category) {
    elements.categoryInput.value = "";
    return;
  }
  const categoryExists = state.categories.some((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase());
  if (categoryExists) {
    showCategoryFeedback(`O tema "${category}" ja existe na sala.`);
    elements.categoryInput.value = "";
    return;
  }
  if (state.categories.length >= MAX_CATEGORIES) {
    showCategoryFeedback(`Limite maximo atingido: ${MAX_CATEGORIES} temas.`);
    elements.categoryInput.value = "";
    return;
  }
  state.categories.push(category);
  elements.categoryInput.value = "";
  renderConfigChips();
  if (state.categories.length === MAX_CATEGORIES) {
    showCategoryFeedback(`Limite maximo atingido: ${MAX_CATEGORIES} temas.`, "success");
    return;
  }
  clearCategoryFeedback();
}

function updateMaxRounds() {
  state.maxRounds = getMaxRounds();
  elements.maxRoundsInput.value = state.maxRounds;
}

function updateRoundDuration() {
  state.roundDurationSeconds = getRoundDurationSeconds();
  elements.roundDurationInput.value = state.roundDurationSeconds;
}

function getMaxRounds() {
  const value = Number.parseInt(elements.maxRoundsInput.value, 10);
  if (Number.isNaN(value)) {
    return 6;
  }
  return Math.min(15, Math.max(6, value));
}

function getRoundDurationSeconds() {
  const value = Number.parseInt(elements.roundDurationInput.value, 10);
  if (Number.isNaN(value)) {
    return 120;
  }
  return Math.min(600, Math.max(60, value));
}

function removeCategory(category) {
  if (state.categories.length <= MIN_CATEGORIES) {
    showCategoryFeedback(`Limite minimo atingido: a sala precisa ter pelo menos ${MIN_CATEGORIES} temas.`);
    return;
  }
  state.categories = state.categories.filter((item) => item !== category);
  renderConfigChips();
  clearCategoryFeedback();
}

function renderLetterOptions() {
  elements.lettersChips.innerHTML = "";
  AVAILABLE_LETTERS.forEach((letter) => {
    const isActive = state.letters.includes(letter);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `letter-option${isActive ? " active" : " inactive"}`;
    button.textContent = letter;
    button.setAttribute("aria-pressed", String(isActive));
    button.setAttribute("aria-label", `${isActive ? "Desativar" : "Ativar"} letra ${letter}`);
    button.addEventListener("click", () => toggleLetter(letter));
    elements.lettersChips.append(button);
  });
}

function toggleLetter(letter) {
  if (state.letters.includes(letter)) {
    if (state.letters.length <= MIN_LETTERS) {
      showLetterFeedback(`Limite minimo atingido: selecione pelo menos ${MIN_LETTERS} letras.`);
      return;
    }
    state.letters = state.letters.filter((item) => item !== letter);
  } else {
    state.letters.push(letter);
    state.letters.sort((first, second) => AVAILABLE_LETTERS.indexOf(first) - AVAILABLE_LETTERS.indexOf(second));
  }
  renderConfigChips();
  clearLetterFeedback();
}

function addChipOnEnter(event, callback) {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  callback();
}

function maybeShowStopModal(previousStatus, room) {
  const shouldShow =
    room.status === "voting" &&
    state.stopModalRound !== room.round_number &&
    previousStatus !== "voting";

  if (!shouldShow) {
    return;
  }

  const stoppedBy = room.players[room.stopped_by] || "Tempo esgotado";
  elements.stopMessage.textContent = `${stoppedBy} encerrou a rodada. Todos devem parar de escrever.`;
  elements.stopModal.classList.remove("hidden");
  state.stopModalRound = room.round_number;
}

function hideStopModal() {
  elements.stopModal.classList.add("hidden");
}

function startTimer(room) {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (room.status !== "playing") {
    elements.roundTimer.style.transitionDuration = "0s";
    elements.roundTimer.style.width = "100%";
    return;
  }

  const remaining = getRemainingSeconds(room);
  const duration = room.round_duration_seconds || 120;
  const progress = Math.max(0, Math.min(100, (remaining / duration) * 100));
  elements.roundTimer.style.transitionDuration = "0s";
  elements.roundTimer.style.width = `${progress}%`;
  requestAnimationFrame(() => {
    elements.roundTimer.style.transitionDuration = `${remaining}s`;
    elements.roundTimer.style.width = "0%";
  });

  const updateTimer = () => {
    const currentRemaining = getRemainingSeconds(room);
    if (currentRemaining === 0 && state.autoStopRound !== room.round_number) {
      state.autoStopRound = room.round_number;
      runAction(() => stopRound(true), true);
    }
  };

  state.timerInterval = setInterval(updateTimer, 1000);
}

function startReviewTimer(room) {
  if (state.reviewTimerInterval) {
    clearInterval(state.reviewTimerInterval);
    state.reviewTimerInterval = null;
  }

  if (room.status !== "voting") {
    if (elements.reviewTimer) {
      elements.reviewTimer.textContent = "20s";
    }
    return;
  }

  const updateReviewTimer = () => {
    const remaining = getReviewRemainingSeconds(room);
    if (elements.reviewTimer) {
      elements.reviewTimer.textContent = `${remaining}s`;
    }
    if (remaining === 0) {
      scheduleReviewAdvance(room, 0);
    }
  };

  updateReviewTimer();
  state.reviewTimerInterval = setInterval(updateReviewTimer, 1000);
}

function getReviewRemainingSeconds(room) {
  if (!room.review_category_started_at) {
    return 20;
  }
  const elapsed = Math.floor(Date.now() / 1000) - room.review_category_started_at;
  return Math.max(0, 20 - elapsed);
}

function hasEveryoneVotedCurrentCategory(room) {
  const category = room.categories[room.review_category_index || 0];
  if (!category) {
    return false;
  }

  const players = Object.keys(room.players);
  const targetsWithAnswers = players.filter((targetPlayerId) => (room.answers[targetPlayerId]?.[category] || "").trim());
  if (targetsWithAnswers.length === 0) {
    return true;
  }

  return players.every((voterId) =>
    targetsWithAnswers
      .every((targetPlayerId) => Object.prototype.hasOwnProperty.call(room.votes[`${targetPlayerId}:${category}`] || {}, voterId)),
  );
}

function scheduleReviewAdvance(room, delayMs) {
  const advanceKey = `${room.id}:${room.round_number}:${room.review_category_index}`;
  if (state.reviewAdvanceKey === advanceKey) {
    return;
  }
  state.reviewAdvanceKey = advanceKey;

  setTimeout(() => {
    if (!state.room || state.room.status !== "voting") {
      return;
    }
    const currentKey = `${state.room.id}:${state.room.round_number}:${state.room.review_category_index}`;
    if (currentKey !== advanceKey) {
      return;
    }
    runAction(advanceReviewCategory, true);
  }, delayMs);
}

async function advanceReviewCategory() {
  if (!ensureRoomAndPlayer()) return;
  if (state.room.status !== "voting") return;

  const response = await request(`/api/v1/rooms/${state.room.id}/review/next`, "POST", {
    player_id: state.playerId,
    review_category_index: state.room.review_category_index || 0,
  });
  state.reviewAdvanceKey = null;
  setRoom(response.data);
}

function getRemainingSeconds(room) {
  if (!room.round_started_at) {
    return room.round_duration_seconds || 120;
  }
  const elapsed = Math.floor(Date.now() / 1000) - room.round_started_at;
  return Math.max(0, (room.round_duration_seconds || 120) - elapsed);
}

function summarizeVotes(votes = {}) {
  const values = Object.values(votes);
  const validVotes = values.filter(Boolean).length;
  const invalidVotes = values.length - validVotes;
  return `${validVotes} valida(s), ${invalidVotes} invalida(s)`;
}

function scheduleAutoSave() {
  if (!state.room || state.room.status !== "playing") {
    return;
  }

  state.room.answers[state.playerId] = collectAnswers();
  renderParticipants(state.room);
  updateButtons(state.room);
  clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => runAction(() => submitAnswers(false), true), 600);
}

async function runAction(action, silent = false) {
  try {
    await action();
    refreshDevOpsPanel(true);
  } catch (error) {
    if (!silent) {
      alert(error.message);
    }
  }
}

function initDevOpsPanel() {
  if (!state.debugPanel) {
    return;
  }
  localStorage.setItem("stop.debugPanel", "true");
  elements.devOpsPanel.classList.remove("hidden");
  refreshDevOpsPanel(true);
}

async function refreshDevOpsPanel(silent = false) {
  if (!state.debugPanel) {
    return;
  }
  try {
    const response = await request("/api/v1/dev/cache/status");
    renderDevOpsPanel(response.data);
  } catch (error) {
    if (!silent) {
      throw error;
    }
  }
}

function renderDevOpsPanel(data) {
  const lastOperation = data.operations?.[0];
  elements.devDsmStatus.textContent = formatDsmStatus(data.dsm.status);
  elements.devRedisStatus.textContent = formatDsmStatus(data.redis.status);
  elements.devRedisLatency.textContent = data.redis.latencyMs === null ? "-" : `${data.redis.latencyMs}ms`;
  elements.devCacheState.textContent = data.dsm.lastCacheStatus || "-";
  elements.devOpsCount.textContent = String(data.operations?.length || 0);

  elements.devDiagnostics.innerHTML = `
    <small>Diagnostico</small>
    <div>TTL: ${data.cache.ttl}s | Prefixo: ${escapeHtml(data.cache.prefix)}</div>
    <div>Hit/Miss/Erro: ${data.stats.hits}/${data.stats.misses}/${data.stats.errors}</div>
    <div>Fallbacks: ${data.stats.fallbacks} | Salas na origem local: ${data.cache.originRooms}</div>
    <div>Ultima operacao: ${lastOperation ? escapeHtml(lastOperation.action) : "-"} (${lastOperation ? escapeHtml(lastOperation.result) : "-"})</div>
    <div>Cache ms: ${lastOperation?.cacheMs ?? "-"} | Origem ms: ${lastOperation?.originMs ?? "-"}</div>
    <div>Atualizado em: ${data.dsm.lastUpdatedAt ? new Date(data.dsm.lastUpdatedAt * 1000).toLocaleTimeString("pt-BR") : "-"}</div>
  `;
}

async function clearRoomCache() {
  const roomQuery = state.room?.id ? `?room_id=${encodeURIComponent(state.room.id)}` : "";
  const response = await request(`/api/v1/dev/cache/clear${roomQuery}`, "POST");
  alert(response.deleted ? "Cache limpo." : "Nenhuma chave de cache removida.");
}

async function forceCacheMiss() {
  if (!state.room?.id) {
    alert("Entre em uma sala para forcar miss.");
    return;
  }
  await request(`/api/v1/dev/cache/force-miss/${state.room.id}`, "POST");
  const response = await request(`/api/v1/rooms/${state.room.id}`);
  setRoom(response.data);
  await refreshDevOpsPanel();
}

function formatDsmStatus(value) {
  return String(value || "-").replaceAll("_", " ");
}

function requirePlayerName() {
  const name = elements.playerName.value.trim();
  if (!name) {
    alert("Informe seu nome.");
    throw new Error("Nome obrigatorio.");
  }
  return name;
}

function ensureRoomAndPlayer() {
  if (!state.room || !state.playerId) {
    alert("Crie ou entre em uma sala primeiro.");
    return false;
  }
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
