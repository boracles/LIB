const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const saveClearBtn = document.getElementById("save-clear-btn");
const capturesContainer = document.getElementById("captures");

// Firebase Realtime Database 참조
const roomRef = window.db.ref("rooms/default");
const capturesRef = window.db.ref("captures");

let drawing = false;
let lastX = 0;
let lastY = 0;
const clientId = Math.random().toString(36).slice(2);

// 캔버스 크기 세팅
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111827";
}

function clearLocalCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 전체 지우기 (다른 기기도 함께)
function clearCanvas(emit = true) {
  clearLocalCanvas();
  if (emit) {
    roomRef.child("clear").set({
      by: clientId,
      t: Date.now(),
    });
  }
}

window.addEventListener("resize", () => {
  clearLocalCanvas();
  resizeCanvas();
});

resizeCanvas();

// --------------------
// pointer 기반 그리기 (마우스 + 터치 + 펜)
// --------------------
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== undefined && e.button !== 0) return; // 왼쪽 버튼만

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  drawing = true;
  lastX = x;
  lastY = y;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();

  const w = canvas.width;
  const h = canvas.height;
  roomRef.child("strokes").push({
    by: clientId,
    x0: lastX / w,
    y0: lastY / h,
    x1: x / w,
    y1: y / h,
    t: Date.now(),
  });

  lastX = x;
  lastY = y;
});

function endPointer(e) {
  if (!drawing) return;
  drawing = false;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch (_) {}
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", endPointer);

// 🔄 다른 기기가 그린 선 받기
roomRef.child("strokes").on("child_added", (snap) => {
  const data = snap.val();
  if (!data) return;
  if (data.by === clientId) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.beginPath();
  ctx.moveTo(data.x0 * w, data.y0 * h);
  ctx.lineTo(data.x1 * w, data.y1 * h);
  ctx.stroke();
});

// 🔄 다른 기기의 clear 받기
roomRef.child("clear").on("value", (snap) => {
  const data = snap.val();
  if (!data) return;
  if (data.by === clientId) return;
  clearLocalCanvas();
});

// 🌟 저장하고 지우기: 캔버스를 PNG로 저장 + 전체 지우기
saveClearBtn.addEventListener("click", () => {
  const dataUrl = canvas.toDataURL("image/png");

  capturesRef.push({
    by: clientId,
    createdAt: Date.now(),
    image: dataUrl,
  });

  clearCanvas(true);
});

// 🌟 캡처 리스트: 저장 순서대로, 최신 것이 위로
if (capturesContainer) {
  capturesRef.on("child_added", (snap) => {
    const data = snap.val();
    if (!data) return;

    const wrapper = document.createElement("div");
    wrapper.className = "capture-item";

    const img = document.createElement("img");
    img.src = data.image;

    const meta = document.createElement("div");
    meta.className = "capture-meta";
    meta.textContent = new Date(data.createdAt).toLocaleString();

    wrapper.appendChild(img);
    wrapper.appendChild(meta);

    // 최신 것을 위로
    capturesContainer.prepend(wrapper);
  });
}
