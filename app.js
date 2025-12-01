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
  const rect = canvas.getBoundingClientRect();
  startDrawing(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  drawLine(e.clientX - rect.left, e.clientY - rect.top, true);
});

canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

// 터치 이벤트 (아이패드)
canvas.addEventListener(
  "touchstart",
  (e) => {
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

// 🌟 관리자 모드일 때만 캡처 리스트 표시
if (window.isAdmin && capturesContainer) {
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

    // 최근 것이 위로
    capturesContainer.prepend(wrapper);
  });
}
