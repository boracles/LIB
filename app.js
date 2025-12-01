const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const canDrawCheckbox = document.getElementById("can-draw");
const clearBtn = document.getElementById("clear-btn");

// Firebase Realtime Database 참조
const roomRef = window.db.ref("rooms/default"); // 방 하나만 사용

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

// 전체 지우기
function clearCanvas(emit = true) {
  clearLocalCanvas();
  if (emit) {
    roomRef.child("clear").set({
      by: clientId,
      t: Date.now(),
    });
  }
}

clearBtn.addEventListener("click", () => clearCanvas(true));

window.addEventListener("resize", () => {
  clearLocalCanvas();
  resizeCanvas();
});

resizeCanvas();

// 그리기 로직
function startDrawing(x, y) {
  drawing = true;
  lastX = x;
  lastY = y;
}

function drawLine(x, y, emit = true) {
  if (!drawing) return;

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();

  if (emit) {
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
  }

  lastX = x;
  lastY = y;
}

function stopDrawing() {
  drawing = false;
}

// 마우스 이벤트
canvas.addEventListener("mousedown", (e) => {
  if (!canDrawCheckbox.checked) return;
  const rect = canvas.getBoundingClientRect();
  startDrawing(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener("mousemove", (e) => {
  if (!canDrawCheckbox.checked) return;
  const rect = canvas.getBoundingClientRect();
  drawLine(e.clientX - rect.left, e.clientY - rect.top, true);
});

canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

// 터치 이벤트 (아이패드)
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (!canDrawCheckbox.checked) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    startDrawing(t.clientX - rect.left, t.clientY - rect.top);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!canDrawCheckbox.checked) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    drawLine(t.clientX - rect.left, t.clientY - rect.top, true);
  },
  { passive: false }
);

canvas.addEventListener("touchend", stopDrawing);
canvas.addEventListener("touchcancel", stopDrawing);

// 🔄 다른 기기가 그린 선 받기
roomRef.child("strokes").on("child_added", (snap) => {
  const data = snap.val();
  if (!data) return;
  if (data.by === clientId) return; // 내가 그린 건 무시

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
